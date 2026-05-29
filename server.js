#!/usr/bin/env node
/**
 * Backend dashboardu — czyta lokalne logi Claude Code z ~/.claude/projects,
 * sumuje tokeny (pole message.usage) ORAZ ich koszt-ekwiwalent (wagi cenowe per
 * model i typ tokenu), liczy zuzycie w oknach czasowych jak w ustawieniach konta
 * (kroczaca "sesja" 5h + ostatnie 7 dni) i wystawia /api/snapshot.
 *
 * Nie ma juz podzialu prywatne/firmowe — na danej maszynie zwykle podpiete jest
 * jedno konto, wiec liczone jest LACZNE zuzycie tego konta.
 *
 * % zuzycia: w logach NIE ma limitu planu, wiec limit ustalany jest przez
 * jednorazowa kalibracje — podajesz aktualny % z ekranu Usage w ustawieniach,
 * a backend wstecznie wylicza limit (w jednostkach kosztu) tak, by sie zgadzal.
 * Skalowanie cen nie musi byc idealne: wspolny mnoznik skraca sie przy kalibracji,
 * liczy sie tylko PROPORCJA kosztu miedzy modelami/typami tokenow.
 *
 * Zmienne srodowiskowe:
 *   PORT                (domyslnie 4000)
 *   SCAN_INTERVAL_MS    (domyslnie 8000)
 *   CLAUDE_CONFIG_DIR   (jesli logi sa poza ~/.claude)
 *   DASHBOARD_CONFIG    (sciezka pliku z kalibracja/wykluczeniami; domyslnie ~/.claude-usage-dashboard.json)
 */

import express from "express";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4000);
const SCAN_INTERVAL_MS = Number(process.env.SCAN_INTERVAL_MS || 8000);
const BASE = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
const PROJECTS_DIR = path.join(BASE, "projects");
const CONFIG_FILE = process.env.DASHBOARD_CONFIG || path.join(os.homedir(), ".claude-usage-dashboard.json");
const DIST = path.join(__dirname, "dist");

const FIVE_H = 5 * 60 * 60 * 1000;
const SEVEN_D = 7 * 24 * 60 * 60 * 1000;

const num = (x) => (typeof x === "number" && Number.isFinite(x) ? x : 0);

// ---- cennik (USD / mln tokenow) — wagi kosztu, nie faktura ----
// Wazne sa proporcje miedzy modelami/typami; kalibracja zdejmuje wspolny mnoznik.
const PRICING = {
  opus:   { input: 15, output: 75, cacheRead: 1.5, cacheWrite5m: 18.75, cacheWrite1h: 30 },
  sonnet: { input: 3,  output: 15, cacheRead: 0.3, cacheWrite5m: 3.75,  cacheWrite1h: 6 },
  haiku:  { input: 1,  output: 5,  cacheRead: 0.1, cacheWrite5m: 1.25,  cacheWrite1h: 2 },
};
function modelClass(model) {
  const m = String(model || "").toLowerCase();
  if (m.includes("opus")) return "opus";
  if (m.includes("sonnet")) return "sonnet";
  if (m.includes("haiku")) return "haiku";
  return null; // np. <synthetic> — bez kosztu
}

// ---- trwala konfiguracja (wykluczenia + skalibrowane limity) ----
let config = { excluded: [], sessionLimit: null, weeklyLimit: null };
try { config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")) }; } catch { /* brak pliku = domyslne */ }
const excluded = new Set(config.excluded || []);
async function saveConfig() {
  const out = { excluded: [...excluded], sessionLimit: config.sessionLimit, weeklyLimit: config.weeklyLimit };
  try { await fsp.writeFile(CONFIG_FILE, JSON.stringify(out, null, 2)); }
  catch (e) { console.error("Zapis konfiguracji nieudany:", e.message); }
}

// ---- stan w pamieci ----
const records = new Map();        // messageId -> rekord (z policzonym kosztem)
const fileMtimes = new Map();     // sciezka pliku -> mtimeMs (ostatnio sparsowane)
const projectDisplay = new Map(); // projectDir -> czytelna sciezka (cwd)
const sessionMeta = new Map();    // sessionId -> { projectDir, aiTitle, lastPrompt, firstUser }
let lastScan = null;
let scanError = null;

function decodeDir(dir) {
  const s = dir.startsWith("-") ? "/" + dir.slice(1) : dir;
  return s.replace(/-/g, "/");
}

// Usuwa znaczniki <...> i scala biale znaki — do tytulow z lastPrompt / promptu usera.
function cleanText(s) {
  if (!s) return null;
  const t = String(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return t || null;
}
// Tytul sesji jak w /resume: aiTitle, a gdy brak — ostatni prompt / pierwszy prompt usera.
function sessionTitle(meta) {
  return meta.aiTitle || cleanText(meta.lastPrompt) || cleanText(meta.firstUser) || "(bez tytułu)";
}

// Rozbija usage na typy tokenow. Cache-write bierzemy z rozbicia 5m/1h gdy jest
// (cache_creation_input_tokens = suma tych dwoch, wiec NIE dodajemy go ponownie),
// a gdy rozbicia brak — z pola sumarycznego (traktowane jak 5m).
function tokensFrom(u) {
  const cc = u.cache_creation && typeof u.cache_creation === "object" ? u.cache_creation : null;
  let cacheWrite5m, cacheWrite1h;
  if (cc) {
    cacheWrite5m = num(cc.ephemeral_5m_input_tokens);
    cacheWrite1h = num(cc.ephemeral_1h_input_tokens);
  } else {
    cacheWrite5m = num(u.cache_creation_input_tokens);
    cacheWrite1h = 0;
  }
  return {
    input: num(u.input_tokens),
    output: num(u.output_tokens),
    cacheRead: num(u.cache_read_input_tokens),
    cacheWrite5m,
    cacheWrite1h,
    cacheWrite: cacheWrite5m + cacheWrite1h,
  };
}

function costOf(t, model) {
  const pr = PRICING[modelClass(model)];
  if (!pr) return 0;
  return (
    t.input * pr.input +
    t.output * pr.output +
    t.cacheRead * pr.cacheRead +
    t.cacheWrite5m * pr.cacheWrite5m +
    t.cacheWrite1h * pr.cacheWrite1h
  ) / 1e6;
}

function dayOf(ts) {
  const d = new Date(ts);
  return isNaN(d.getTime()) ? "????-??-??" : d.toISOString().slice(0, 10);
}

async function parseFile(file, projectDir, mtimeMs) {
  const sessionId = path.basename(file, ".jsonl"); // nazwa pliku = sessionId
  const meta = sessionMeta.get(sessionId) || {};
  meta.projectDir = projectDir;
  const rl = readline.createInterface({
    input: fs.createReadStream(file, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    const s = line.trim();
    if (!s) continue;
    let o;
    try { o = JSON.parse(s); } catch { continue; }
    if (o.cwd) projectDisplay.set(projectDir, o.cwd);
    if (o.aiTitle) meta.aiTitle = o.aiTitle;          // najnowszy tytul /resume
    if (o.lastPrompt) meta.lastPrompt = o.lastPrompt; // ostatni prompt (fallback)
    if (!meta.firstUser && o.type === "user" && !o.isMeta) {
      const c = o.message?.content;
      if (typeof c === "string") meta.firstUser = c;
      else if (Array.isArray(c)) {
        const tb = c.find((b) => b?.type === "text" && b.text);
        if (tb) meta.firstUser = tb.text;
      }
    }
    const m = o.message;
    if (!m || m.role !== "assistant" || !m.usage) continue;
    const id = m.id || o.uuid;
    if (!id) continue; // bez id nie deduplikujemy -> pomijamy
    const ts = o.timestamp || new Date(mtimeMs).toISOString();
    const tok = tokensFrom(m.usage);
    const model = m.model || "?";
    records.set(id, { sessionId, projectDir, ts, day: dayOf(ts), model, ...tok, cost: costOf(tok, model) });
  }
  sessionMeta.set(sessionId, meta);
}

async function scan() {
  try {
    const entries = await fsp.readdir(PROJECTS_DIR, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const projectDir = e.name;
      if (!projectDisplay.has(projectDir)) projectDisplay.set(projectDir, decodeDir(projectDir));
      const dirPath = path.join(PROJECTS_DIR, projectDir);
      const files = await fsp.readdir(dirPath).catch(() => []);
      for (const fn of files) {
        if (!fn.endsWith(".jsonl")) continue;
        const file = path.join(dirPath, fn);
        let st;
        try { st = await fsp.stat(file); } catch { continue; }
        if (fileMtimes.get(file) === st.mtimeMs) continue; // bez zmian
        await parseFile(file, projectDir, st.mtimeMs);
        fileMtimes.set(file, st.mtimeMs);
      }
    }
    scanError = records.size === 0
      ? "Brak wpisow z tokenami. Sprawdz, czy uzywasz Claude Code i czy katalog logow jest poprawny."
      : null;
    lastScan = new Date().toISOString();
  } catch (e) {
    scanError = e.code === "ENOENT"
      ? `Nie znaleziono katalogu: ${PROJECTS_DIR}. Ustaw CLAUDE_CONFIG_DIR, jesli logi sa gdzie indziej.`
      : e.message;
  }
}

// Zdarzenia (czas, koszt) tylko z nie-wykluczonych projektow, posortowane rosnaco.
function liveCostEvents() {
  const live = [];
  for (const r of records.values()) {
    if (excluded.has(r.projectDir)) continue;
    const t = Date.parse(r.ts);
    if (!Number.isNaN(t)) live.push({ t, cost: r.cost });
  }
  live.sort((a, b) => a.t - b.t);
  return live;
}

// Okno "sesji" 5h jak na koncie Claude: okno startuje od DOKLADNEGO czasu pierwszej
// wiadomosci i trwa 5h (bez zaokraglania do pelnej godziny — to dawalo reset za
// wczesnie). Wiadomosc po start+5h zaczyna nowe okno. Zwracamy biezace okno (jesli
// wciaz aktywne) i moment jego resetu = pierwsza_wiadomosc + 5h.
function computeSession(live, now) {
  if (!live.length) return { cost: 0, messages: 0, active: false, startTs: null, resetTs: null };
  let block = null;
  const open = (x) => ({ start: x.t, end: x.t + FIVE_H, lastT: x.t, cost: x.cost, messages: 1 });
  for (const x of live) {
    if (!block || x.t >= block.end) block = open(x);
    else { block.lastT = x.t; block.cost += x.cost; block.messages++; }
  }
  const active = now < block.end;
  return {
    cost: active ? block.cost : 0,
    messages: active ? block.messages : 0,
    active,
    startTs: active ? new Date(block.start).toISOString() : null,
    resetTs: active ? new Date(block.end).toISOString() : null,
  };
}

function computeWeekly(live, now) {
  const since = now - SEVEN_D;
  let cost = 0, messages = 0;
  for (const x of live) if (x.t >= since) { cost += x.cost; messages++; }
  return { cost, messages, sinceTs: new Date(since).toISOString() };
}

function withLimit(win, limit) {
  return { ...win, limit: limit ?? null, percent: limit ? (win.cost / limit) * 100 : null };
}

function computeWindows(now) {
  const live = liveCostEvents();
  return {
    session: withLimit(computeSession(live, now), config.sessionLimit),
    weekly: withLimit(computeWeekly(live, now), config.weeklyLimit),
  };
}

// ---- przedzialy czasowe widoku historycznego ----
const DAY_MS = 24 * 60 * 60 * 1000;
const PERIODS = {
  day:      { since: DAY_MS,       gran: "hour" },
  week:     { since: 7 * DAY_MS,   gran: "day" },
  month:    { since: 30 * DAY_MS,  gran: "day" },
  halfyear: { since: 182 * DAY_MS, gran: "week" },
  year:     { since: 365 * DAY_MS, gran: "month" },
  all:      { since: Infinity,     gran: "day" },
};
const pad2 = (n) => String(n).padStart(2, "0");
// Klucz kubelka w czasie LOKALNYM (zgodnym z zegarem uzytkownika).
function bucketKey(t, gran) {
  const d = new Date(t);
  const Y = d.getFullYear(), M = pad2(d.getMonth() + 1), D = pad2(d.getDate());
  if (gran === "hour") return `${Y}-${M}-${D}T${pad2(d.getHours())}`;
  if (gran === "month") return `${Y}-${M}`;
  if (gran === "week") {
    const off = (d.getDay() + 6) % 7; // dni od poniedzialku
    const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - off);
    return `${mon.getFullYear()}-${pad2(mon.getMonth() + 1)}-${pad2(mon.getDate())}`;
  }
  return `${Y}-${M}-${D}`; // day
}

// periodKey skaluje WIDOK HISTORYCZNY (wykres, struktura, modele). Calosc/sesje/
// projekty/okna % licza sie zawsze z pelnych danych.
function buildSnapshot(periodKey) {
  const now = Date.now();
  const period = PERIODS[periodKey] ? periodKey : "all";
  const { since: span, gran } = PERIODS[period];
  const cutoff = span === Infinity ? -Infinity : now - span;

  const totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, messages: 0 };        // calosc
  const periodTotals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, messages: 0 };  // wybrany okres
  const bucketMap = new Map();  // klucz czasu -> kubelek tokenow (wybrany okres)
  const modelMap = new Map();   // model -> tokeny (wybrany okres)
  const projAgg = new Map();    // calosc
  const sessAgg = new Map();    // calosc

  for (const r of records.values()) {
    const tok = r.input + r.output + r.cacheRead + r.cacheWrite;

    // per-projekt: zawsze, z calosci (tabela pokazuje takze wykluczone)
    const pa = projAgg.get(r.projectDir) || { messages: 0, total: 0, lastTs: null };
    pa.messages++; pa.total += tok;
    if (!pa.lastTs || r.ts > pa.lastTs) pa.lastTs = r.ts;
    projAgg.set(r.projectDir, pa);

    if (excluded.has(r.projectDir)) continue; // wykluczone nie licza sie nigdzie indziej

    totals.input += r.input; totals.output += r.output; totals.cacheRead += r.cacheRead;
    totals.cacheWrite += r.cacheWrite; totals.total += tok; totals.messages++;

    const sa = sessAgg.get(r.sessionId) || { projectDir: r.projectDir, messages: 0, total: 0, firstTs: r.ts, lastTs: r.ts };
    sa.messages++; sa.total += tok;
    if (r.ts < sa.firstTs) sa.firstTs = r.ts;
    if (r.ts > sa.lastTs) sa.lastTs = r.ts;
    sessAgg.set(r.sessionId, sa);

    // wybrany okres: wykres + struktura + modele
    const t = Date.parse(r.ts);
    if (!Number.isNaN(t) && t >= cutoff) {
      periodTotals.input += r.input; periodTotals.output += r.output; periodTotals.cacheRead += r.cacheRead;
      periodTotals.cacheWrite += r.cacheWrite; periodTotals.total += tok; periodTotals.messages++;

      const key = bucketKey(t, gran);
      const b = bucketMap.get(key) || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
      b.input += r.input; b.output += r.output; b.cacheRead += r.cacheRead; b.cacheWrite += r.cacheWrite;
      bucketMap.set(key, b);

      const mm = modelMap.get(r.model) || { total: 0, messages: 0 };
      mm.total += tok; mm.messages++;
      modelMap.set(r.model, mm);
    }
  }

  const series = [...bucketMap.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([bucket, v]) => ({ bucket, ...v }));
  const models = [...modelMap.entries()].map(([model, v]) => ({ model, ...v })).sort((a, b) => b.total - a.total);
  const projects = [...projAgg.entries()].map(([dir, agg]) => ({
    dir,
    displayPath: projectDisplay.get(dir) || decodeDir(dir),
    messages: agg.messages,
    total: agg.total,
    lastTs: agg.lastTs,
    excluded: excluded.has(dir),
  })).sort((a, b) => b.total - a.total);

  const sessions = [...sessAgg.entries()].map(([id, a]) => ({
    id,
    projectDir: a.projectDir,
    displayPath: projectDisplay.get(a.projectDir) || decodeDir(a.projectDir),
    title: sessionTitle(sessionMeta.get(id) || {}),
    messages: a.messages,
    total: a.total,
    firstTs: a.firstTs,
    lastTs: a.lastTs,
  })).sort((a, b) => (a.lastTs < b.lastTs ? 1 : -1)); // najnowsze na gorze (jak /resume)

  return {
    lastScan, scanError, claudeDir: PROJECTS_DIR,
    period, gran, totals, periodTotals, series, models,
    windows: computeWindows(now), projects, sessions,
  };
}

const app = express();
app.use(express.json());

app.get("/api/snapshot", (req, res) => res.json(buildSnapshot(req.query.period)));

// wlacz/wyklucz projekt z liczenia
app.post("/api/exclude", async (req, res) => {
  const { dir, excluded: exc } = req.body || {};
  if (!dir) return res.status(400).json({ error: "Brak 'dir'." });
  if (exc) excluded.add(dir); else excluded.delete(dir);
  await saveConfig();
  res.json({ ok: true });
});

// kalibracja: podajesz aktualny % z ustawien, liczymy limit = koszt_w_oknie / (%/100).
// percent <= 0 czysci kalibracje danego okna.
app.post("/api/calibrate", async (req, res) => {
  const { window, percent } = req.body || {};
  if (window !== "session" && window !== "weekly")
    return res.status(400).json({ error: "window musi byc 'session' albo 'weekly'." });
  const p = Number(percent);
  if (!Number.isFinite(p)) return res.status(400).json({ error: "percent musi byc liczba." });
  const key = window === "session" ? "sessionLimit" : "weeklyLimit";
  if (p <= 0) {
    config[key] = null;
    await saveConfig();
    return res.json({ ok: true, cleared: true });
  }
  const win = computeWindows(Date.now())[window];
  if (win.cost <= 0)
    return res.status(409).json({ error: "Brak zuzycia w tym oknie — nie ma od czego skalibrowac." });
  config[key] = win.cost / (p / 100);
  await saveConfig();
  res.json({ ok: true, limit: config[key] });
});

// frontend (po `npm run build`)
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get("*", (_req, res) => res.sendFile(path.join(DIST, "index.html")));
} else {
  app.get("/", (_req, res) =>
    res.status(200).send(
      "<h2>Backend dziala.</h2><p>Frontend nie jest jeszcze zbudowany. Uruchom <code>npm run build</code> i odswiez te strone, " +
      "albo do developmentu uzyj <code>npm run dev</code> (Vite na :5173, z proxy do tego backendu).</p>"
    ));
}

await scan();
setInterval(scan, SCAN_INTERVAL_MS);
app.listen(PORT, () => {
  console.log(`\nclaude-usage-dashboard`);
  console.log(`  Dashboard: http://localhost:${PORT}`);
  console.log(`  Logi:      ${PROJECTS_DIR}`);
  console.log(`  Skan co ${SCAN_INTERVAL_MS / 1000}s\n`);
});
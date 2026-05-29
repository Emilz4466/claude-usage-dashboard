# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Local dashboard ("Claude Token Monitor") for tracking Claude Code token usage on one machine. It reads Claude Code's own session logs (`~/.claude/projects/**/*.jsonl`) — no paid API, no admin rights, data stays on the machine. Assumes **one account per machine** (e.g. only the work account on a work laptop), so it reports that account's **combined** usage — there is intentionally no private/company split. UI strings, code comments, and the README are in **Polish**; match that language when editing user-facing text.

## Commands

```bash
./start.sh         # one-shot: install-if-needed + build + run (bootstrap script)
npm run serve      # = npm run build && npm start (assumes deps installed)
npm run build      # Vite build -> dist/
npm start          # = node server.js; serves dist/ + API on :4000
npm run server     # backend only (same entrypoint as start)
npm run dev        # Vite dev server on :5173, proxies /api -> :4000
npm run typecheck  # tsc --noEmit — the ONLY static check available
```

There are **no tests and no linter** configured; `npm run typecheck` is the only check. Always run it after frontend changes.

- **One-command run:** `./start.sh` (or `npm run serve`), open http://localhost:4000.
- **Hot-reload dev:** run `npm run server` *and* `npm run dev` in two terminals, open http://localhost:5173. Both are required — the Vite server only proxies `/api`, it does not serve data itself.
- **No-clone run:** published to npm as **`claude-code-usage-dashboard`** → `npx claude-code-usage-dashboard` (`bin` → `server.js`, which **must stay executable / mode 755**). The built **`dist/` is committed** (not gitignored) and `files` ships `server.js` + `dist`, so install does **no build** and the only runtime dep is `express` (react/recharts are devDeps — bundled into `dist` at build time). `prepublishOnly` rebuilds `dist/` before each publish. ⚠️ Also `npm run build` + commit `dist/` on frontend changes for git/local runs. **Do NOT use `npx github:…`** — it breaks on Debian/Ubuntu npm 9.x (git-dep handling: "could not determine executable to run"); the registry path avoids that.

Env vars (read in `server.js`): `PORT` (4000), `SCAN_INTERVAL_MS` (8000), `CLAUDE_CONFIG_DIR` (`~/.claude`), `DASHBOARD_CONFIG` (`~/.claude-usage-dashboard.json`).

## Architecture

The browser can't read disk, so the app is split in two:

- **Backend — `server.js`** (single file, Node + Express, ESM). Periodically scans `$CLAUDE_CONFIG_DIR/projects`, parses each `*.jsonl` line, holds all state in memory. Endpoints: `GET /api/snapshot` (full computed view), `POST /api/calibrate {window, percent}` (anchor a window's limit), `POST /api/exclude {dir, excluded}` (toggle a project in/out of totals).
- **Frontend — `src/`** (React + TS + Vite + Recharts). Polls `/api/snapshot?period=…` and renders the two usage gauges, the token-over-time chart (with a **time-range selector**), the breakdown panel, and the projects/sessions tables.

### How token data flows (spans multiple files)

1. **Parse** (`scan()` → `parseFile()`): only `message.role === "assistant"` lines with a `usage` object count. Records live in the `records` Map keyed by **message id** (`m.id || o.uuid`), so re-parsing a file is idempotent — it overwrites, never double-counts. Lines without an id are skipped.
2. **Incremental scanning**: `fileMtimes` tracks each file's mtime; unchanged files are skipped next pass. New sessions appear almost live without a full re-read.
3. **Token buckets** (`tokensFrom()`): `input`, `output`, `cacheRead`, and cache-write split into `cacheWrite5m`/`cacheWrite1h` (from `usage.cache_creation.ephemeral_*`). **`cache_creation_input_tokens` equals the sum of the ephemeral buckets — do not add both** (the previous version double-counted cache writes; this is fixed here). When the ephemeral breakdown is absent, the summary field is used and treated as 5m.
4. **Cost weighting** (`costOf()` + `PRICING`): each record gets a `cost` (price-weighted token value) at parse time. **This is internal-only — it is NOT shown in the UI and NOT in the displayed snapshot fields.** It exists solely to weight the gauge windows (Opus ≫ Sonnet, output ≫ cache). Model class matched by substring (opus/sonnet/haiku); anything else (e.g. `<synthetic>`) weighs 0. Cost appears in the snapshot only inside `windows.*` (which the frontend reads as `percent`, never as a number).
5. **Aggregate** (`buildSnapshot(periodKey)`): the `periodKey` query param (`day|week|month|halfyear|year|all`) scopes the **historical view** — `series` (bucketed by `gran`: hour/day/week/month per period), `periodTotals`, and per-`model` token counts cover only that period. **All-time and independent of the period:** `totals` (StatusBar), `projects`, `sessions`, and the `windows` (5h/7d). Excluded projects drop out of everything except the projects table. No `cost` field is emitted for totals/series/models/projects/sessions.

A **session = one `.jsonl` file**; `sessionId` is the filename. Its `/resume`-style title is resolved by `sessionTitle()` from `aiTitle` → `lastPrompt` → first user prompt (captured per session into `sessionMeta` during parse; `cleanText()` strips `<...>` tags from the prompt fallbacks). Sessions are returned sorted by recency; the frontend (`SessionTable.tsx`) re-sorts client-side by recency or token count.

### The percentage feature (the core of this app)

There is **no plan limit / quota / max-token value anywhere in the logs** — it's server-side only. (`service_tier` is always `"standard"`; nothing matches limit/quota/reset.) So a "% used" can't be read; it must be **calibrated**:

- `computeWindows()` measures cost in two windows that mirror the account's Usage screen: **session** = a 5-hour block (`computeSession()`; a window starts at the **exact first-message timestamp** and spans 5h, `resetTs = firstMessage + 5h`; a message past `start+5h` opens the next window). Do **not** floor the start to the hour — an earlier version did, which made the reset countdown up to ~1h early versus the Claude account. **weekly** = rolling last 7 days (`computeWeekly()`).
- Calibration: the user reads the real % from settings and POSTs it; the backend sets `limit = windowCost / (percent/100)` and persists it. The gauge then shows `cost/limit`.
- **Key property: absolute price accuracy doesn't matter for the %.** Scaling all prices by a constant scales `cost` and the derived `limit` equally, so the calibrated percent is unchanged. Only the *ratios* in `PRICING` between models/token-types matter. (Editing `PRICING` only affects the displayed `~$` and shifts relative weighting; restart re-parses with empty `fileMtimes`, recomputing baked costs.)
- Known gaps to keep in mind: Anthropic's exact weighting is private, the settings "weekly" has a fixed reset anchor (we use rolling 7d), and Claude.ai chat usage isn't on disk. Treat the gauge as a close approximation, not an exact mirror.

### Persistence

Mutable state (project exclusions + calibrated limits) lives in **`$DASHBOARD_CONFIG`** (default `~/.claude-usage-dashboard.json`, in the home dir — **not** under the repo, so it survives `npx`/temp-dir runs): `{ excluded: string[], sessionLimit: number|null, weeklyLimit: number|null }`. Loaded at startup into the `excluded` Set and `config`; written by `saveConfig()`. (The old repo-local `dashboard-config.json` / `account-map.json` are obsolete but still gitignored as a safety net.)

### Project dir encoding

On-disk project dir names are path-encoded with dashes; `decodeDir()` reverses it (leading `-` → `/`, then all `-` → `/`). The true cwd is preferred when a log line carries a `cwd` field (`projectDisplay`).

### Frontend specifics

- **Theme system**: three themes (`light`/`dark`/`neon`, default `neon`) via React Context (`theme/ThemeContext.tsx`), persisted to `localStorage`, applied as `document.documentElement.dataset.theme` (CSS vars in `index.css`). Chart colors come from `usePalette()` (`theme/palette.ts`) because Recharts needs explicit values, not CSS vars; `levelColor()` picks the gauge color by threshold (<70 ok / <90 warn / else danger).
- **Gauges**: `UsageGauges.tsx` renders the two windows as Recharts `RadialBarChart` with a `domain=[0,100]` `PolarAngleAxis` and a CSS-overlaid center label; it also owns the inline calibrate/clear UI (clear = calibrate with percent 0).
- **Refresh cadence (two independent timers)**: backend rescans every `SCAN_INTERVAL_MS` (default 8s); the frontend polls every 5s (hardcoded `useSnapshot(5000)` in `App.tsx`). The gauge reset countdown is recomputed each poll from `resetTs` (no separate timer).

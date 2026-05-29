import { useState } from "react";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";
import type { WindowUsage, WindowKey } from "../types";
import { usePalette, levelColor } from "../theme/palette";
import { calibrate } from "../api";
import { fmtUsd, fmtPct, countdown, relTime } from "../lib/format";

interface Props {
  windows: Record<WindowKey, WindowUsage>;
  onChanged: () => void;
}

export function UsageGauges({ windows, onChanged }: Props) {
  return (
    <section className="grid-2">
      <GaugeCard wkey="session" title="Sesja (5 h)" win={windows.session} onChanged={onChanged} />
      <GaugeCard wkey="weekly" title="Tydzień (7 dni)" win={windows.weekly} onChanged={onChanged} />
    </section>
  );
}

function GaugeCard({
  wkey,
  title,
  win,
  onChanged,
}: {
  wkey: WindowKey;
  title: string;
  win: WindowUsage;
  onChanged: () => void;
}) {
  const p = usePalette();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pct = win.percent;
  const color = levelColor(p, pct);
  const data = [{ name: title, value: Math.min(pct ?? 0, 100) }];

  async function send(percent: number) {
    setBusy(true);
    setErr(null);
    try {
      await calibrate(wkey, percent);
      setEditing(false);
      setVal("");
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    const n = Number(val.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setErr("Podaj % z zakresu 0–100");
      return;
    }
    send(n);
  }

  const sub =
    wkey === "session"
      ? win.active
        ? `reset za ${countdown(win.resetTs)}`
        : "brak aktywnej sesji"
      : `ostatnie 7 dni · od ${relTime(win.sinceTs ?? null)}`;

  return (
    <div className="panel gauge-card">
      <div className="panel-head">
        <h2>{title}</h2>
        <span className="muted">{sub}</span>
      </div>

      <div className="gauge-row">
        <div className="gauge-wrap">
          <ResponsiveContainer width="100%" height={156}>
            <RadialBarChart innerRadius="74%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="value" cornerRadius={8} background={{ fill: p.track }} fill={color} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="gauge-center">
            <strong style={{ color }}>{fmtPct(pct)}</strong>
            {win.limit != null && <span className="muted">limit {fmtUsd(win.limit)}</span>}
          </div>
        </div>

        <div className="gauge-meta">
          <div className="kv">
            <span className="muted">koszt~</span>
            <strong>{fmtUsd(win.cost)}</strong>
          </div>
          <div className="kv">
            <span className="muted">wiadomości</span>
            <strong>{win.messages}</strong>
          </div>
          {pct == null && (
            <p className="hint">Nieskalibrowane — wpisz % z ekranu „Usage" w ustawieniach konta.</p>
          )}
        </div>
      </div>

      {editing ? (
        <div className="cal-row">
          <input
            className="cal-input"
            type="number"
            min={0}
            max={100}
            step="0.1"
            inputMode="decimal"
            placeholder="% z ustawień"
            value={val}
            autoFocus
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <button className="seg sm active" disabled={busy} onClick={submit}>
            Zapisz
          </button>
          <button
            className="seg sm"
            disabled={busy}
            onClick={() => {
              setEditing(false);
              setErr(null);
            }}
          >
            Anuluj
          </button>
        </div>
      ) : (
        <div className="cal-row">
          <button className="seg sm" disabled={busy} onClick={() => setEditing(true)}>
            {win.limit != null ? "Rekalibruj" : "Kalibruj"}
          </button>
          {win.limit != null && (
            <button className="seg sm" disabled={busy} onClick={() => send(0)}>
              Wyczyść
            </button>
          )}
        </div>
      )}
      {err && <div className="cal-err">⚠ {err}</div>}
    </div>
  );
}
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Totals, ModelTotal } from "../types";
import { usePalette } from "../theme/palette";
import { fmtInt, fmtCompact } from "../lib/format";

interface Props {
  totals: Totals;
  models: ModelTotal[];
}

const shortModel = (m: string) => m.replace(/^claude-/, "").replace(/[<>]/g, "");

export function BreakdownPanel({ totals, models }: Props) {
  const p = usePalette();
  const tooltipStyle = {
    background: "var(--panel-2)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    color: "var(--text)",
    fontSize: 12,
  };

  // udzial typow tokenow w sumie (jeden poziomy pasek = 100%)
  const sum = totals.input + totals.output + totals.cacheRead + totals.cacheWrite;
  const parts = [
    { key: "Input", val: totals.input, color: p.input },
    { key: "Output", val: totals.output, color: p.output },
    { key: "Cache read", val: totals.cacheRead, color: p.cacheRead },
    { key: "Cache write", val: totals.cacheWrite, color: p.cacheWrite },
  ];
  const barRow = [Object.fromEntries(parts.map((x) => [x.key, x.val]))];

  const modelData = models.filter((m) => m.total > 0).map((m) => ({ name: shortModel(m.model), tokens: m.total }));
  const cycle = [p.cacheWrite, p.output, p.input, p.cacheRead];

  return (
    <section className="grid-2">
      <div className="panel">
        <div className="panel-head">
          <h2>Struktura tokenów</h2>
          <span className="muted">udział typów w sumie (okres)</span>
        </div>
        {sum === 0 ? (
          <div className="empty">Brak danych w tym okresie.</div>
        ) : (
          <>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={56}>
                <BarChart
                  layout="vertical"
                  data={barRow}
                  stackOffset="expand"
                  margin={{ top: 6, right: 4, left: 4, bottom: 0 }}
                >
                  <XAxis type="number" hide domain={[0, 1]} />
                  <YAxis type="category" dataKey="name" hide />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => fmtInt(Number(value))} />
                  {parts.map((x, i) => (
                    <Bar
                      key={x.key}
                      dataKey={x.key}
                      stackId="a"
                      fill={x.color}
                      radius={i === 0 ? [6, 0, 0, 6] : i === parts.length - 1 ? [0, 6, 6, 0] : 0}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="legend-pct">
              {parts.map((x) => (
                <div className="it" key={x.key}>
                  <span className="sw" style={{ background: x.color }} />
                  <span>{x.key}</span>
                  <b>{((x.val / sum) * 100).toFixed(1)}%</b>
                  <span className="muted">{fmtInt(x.val)} tok</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Tokeny wg modelu</h2>
          <span className="muted">wybrany okres</span>
        </div>
        {modelData.length === 0 ? (
          <div className="empty">Brak danych w tym okresie.</div>
        ) : (
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={232}>
              <BarChart data={modelData} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" stroke={p.axis} fontSize={11} />
                <YAxis stroke={p.axis} fontSize={11} width={50} tickFormatter={fmtCompact} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [fmtInt(Number(value)), "tokeny"]} />
                <Bar dataKey="tokens" name="Tokeny" radius={[4, 4, 0, 0]}>
                  {modelData.map((d, i) => (
                    <Cell key={d.name} fill={cycle[i % cycle.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}

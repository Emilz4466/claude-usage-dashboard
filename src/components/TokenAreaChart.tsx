import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { DayPoint, Totals } from "../types";
import { usePalette } from "../theme/palette";
import { fmtCompact, fmtInt } from "../lib/format";

interface Props {
  data: DayPoint[];
  totals?: Totals;
}

export function TokenAreaChart({ data, totals }: Props) {
  const p = usePalette();

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Tokeny w czasie</h2>
        <span className="muted">
          {totals ? `${fmtInt(totals.total)} tok · ${totals.messages} wiad.` : "brak danych"}
        </span>
      </div>

      {data.length === 0 ? (
        <div className="empty">Brak danych — czy Claude Code zapisał już jakieś sesje?</div>
      ) : (
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={p.grid} vertical={false} />
              <XAxis dataKey="day" stroke={p.axis} fontSize={11} tickMargin={8} minTickGap={28} />
              <YAxis stroke={p.axis} fontSize={11} width={50} tickFormatter={fmtCompact} />
              <Tooltip
                contentStyle={{
                  background: "var(--panel-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  color: "var(--text)",
                  fontSize: 12,
                }}
                formatter={(value) => fmtInt(Number(value))}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="input" name="Input" stackId="1" stroke={p.input} fill={p.input} fillOpacity={0.35} />
              <Area type="monotone" dataKey="output" name="Output" stackId="1" stroke={p.output} fill={p.output} fillOpacity={0.35} />
              <Area type="monotone" dataKey="cacheRead" name="Cache read" stackId="1" stroke={p.cacheRead} fill={p.cacheRead} fillOpacity={0.3} />
              <Area type="monotone" dataKey="cacheWrite" name="Cache write" stackId="1" stroke={p.cacheWrite} fill={p.cacheWrite} fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
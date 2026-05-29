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
import type { BucketPoint, Totals, PeriodKey, Gran } from "../types";
import { usePalette } from "../theme/palette";
import { fmtCompact, fmtInt, bucketLabel } from "../lib/format";
import { PeriodSelector } from "./PeriodSelector";

interface Props {
  data: BucketPoint[];
  gran: Gran;
  periodTotals?: Totals;
  period: PeriodKey;
  onPeriodChange: (p: PeriodKey) => void;
}

export function TokenAreaChart({ data, gran, periodTotals, period, onPeriodChange }: Props) {
  const p = usePalette();
  const label = (b: unknown) => bucketLabel(String(b), gran);

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Tokeny w czasie</h2>
        <PeriodSelector value={period} onChange={onPeriodChange} />
      </div>
      <div className="sub-line muted">
        {periodTotals ? `${fmtInt(periodTotals.total)} tok · ${periodTotals.messages} wiad. w wybranym okresie` : "—"}
      </div>

      {data.length === 0 ? (
        <div className="empty">Brak danych w tym okresie.</div>
      ) : (
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={p.grid} vertical={false} />
              <XAxis dataKey="bucket" stroke={p.axis} fontSize={11} tickMargin={8} minTickGap={28} tickFormatter={label} />
              <YAxis stroke={p.axis} fontSize={11} width={50} tickFormatter={fmtCompact} />
              <Tooltip
                contentStyle={{
                  background: "var(--panel-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  color: "var(--text)",
                  fontSize: 12,
                }}
                labelFormatter={label}
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

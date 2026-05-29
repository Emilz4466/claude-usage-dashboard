import type { PeriodKey } from "../types";

const OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "day", label: "Dzień" },
  { key: "week", label: "Tydzień" },
  { key: "month", label: "Miesiąc" },
  { key: "halfyear", label: "Pół roku" },
  { key: "year", label: "Rok" },
  { key: "all", label: "Całość" },
];

interface Props {
  value: PeriodKey;
  onChange: (p: PeriodKey) => void;
}

export function PeriodSelector({ value, onChange }: Props) {
  return (
    <div className="theme-switch" role="group" aria-label="Przedział czasu">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          className={"seg sm" + (value === o.key ? " active" : "")}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

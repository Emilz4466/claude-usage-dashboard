export const fmtInt = (n: number): string =>
  new Intl.NumberFormat("pl-PL").format(Math.round(n || 0));

export const fmtCompact = (n: number): string =>
  new Intl.NumberFormat("pl-PL", { notation: "compact", maximumFractionDigits: 1 }).format(n || 0);

export const fmtUsd = (n: number): string =>
  new Intl.NumberFormat("pl-PL", { style: "currency", currency: "USD", maximumFractionDigits: (n || 0) < 10 ? 2 : 0 }).format(n || 0);

export const fmtPct = (n: number | null | undefined): string =>
  n == null || Number.isNaN(n) ? "—" : `${n.toFixed(n < 10 ? 1 : 0)}%`;

/** Odliczanie do momentu w przyszlosci, np. "2 h 13 min" / "8 min" / "teraz". */
export function countdown(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return "—";
  if (ms <= 0) return "teraz";
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function relTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "—";
  const s = Math.round((Date.now() - d) / 1000);
  if (s < 5) return "przed chwilą";
  if (s < 60) return `${s} s temu`;
  if (s < 3600) return `${Math.round(s / 60)} min temu`;
  if (s < 86400) return `${Math.round(s / 3600)} h temu`;
  return `${Math.round(s / 86400)} dni temu`;
}

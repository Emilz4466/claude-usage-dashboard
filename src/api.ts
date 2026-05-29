import type { Snapshot, WindowKey, PeriodKey } from "./types";

export async function fetchSnapshot(period: PeriodKey = "all"): Promise<Snapshot> {
  const r = await fetch("/api/snapshot?period=" + period, { cache: "no-store" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

export async function setExcluded(dir: string, excluded: boolean): Promise<void> {
  const r = await fetch("/api/exclude", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ dir, excluded }),
  });
  if (!r.ok) throw new Error("Zmiana statusu projektu nieudana (HTTP " + r.status + ")");
}

/** percent <= 0 czysci kalibracje danego okna. */
export async function calibrate(window: WindowKey, percent: number): Promise<void> {
  const r = await fetch("/api/calibrate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ window, percent }),
  });
  if (!r.ok) {
    const msg = await r.json().catch(() => null);
    throw new Error(msg?.error || "Kalibracja nieudana (HTTP " + r.status + ")");
  }
}
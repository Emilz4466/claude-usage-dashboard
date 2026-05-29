import { useCallback, useEffect, useState } from "react";
import { fetchSnapshot } from "../api";
import type { Snapshot } from "../types";

export function useSnapshot(intervalMs = 5000) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const snap = await fetchSnapshot();
      setData(snap);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return { data, error, refresh };
}

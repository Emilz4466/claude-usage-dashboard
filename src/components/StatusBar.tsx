import type { Snapshot } from "../types";
import { fmtInt, relTime } from "../lib/format";

interface Props {
  data: Snapshot | null;
  error: string | null;
}

export function StatusBar({ data, error }: Props) {
  const live = !!data && !error && !data.scanError;
  const status = error
    ? "serwer nieosiągalny"
    : data?.scanError
      ? "błąd skanu"
      : data
        ? "live"
        : "łączenie…";

  return (
    <div className="statusbar">
      <div className="status">
        <span className={"dot " + (live ? "live" : "err")} />
        <span>{status}</span>
        <span className="muted">· skan {relTime(data?.lastScan ?? null)}</span>
      </div>
      <div className="stat">
        <span className="muted">Łącznie tokenów</span>
        <strong>{fmtInt(data?.totals.total ?? 0)}</strong>
      </div>
      {data?.claudeDir && <div className="path">{data.claudeDir}</div>}
      {(error || data?.scanError) && <div className="banner">⚠ {error || data?.scanError}</div>}
    </div>
  );
}

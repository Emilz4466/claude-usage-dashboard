import { useState } from "react";
import type { SessionInfo } from "../types";
import { fmtInt, fmtUsd, relTime } from "../lib/format";

interface Props {
  sessions: SessionInfo[];
}

type Sort = "recent" | "tokens";

const baseName = (p: string) => p.split("/").filter(Boolean).pop() || p;

export function SessionTable({ sessions }: Props) {
  const [sort, setSort] = useState<Sort>("recent");

  const sorted = [...sessions].sort((a, b) =>
    sort === "tokens" ? b.total - a.total : a.lastTs < b.lastTs ? 1 : -1
  );

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Sesje</h2>
        <div className="head-tools">
          <span className="muted">{sessions.length} sesji · sortuj:</span>
          <div className="seg-group">
            <button className={"seg sm" + (sort === "recent" ? " active" : "")} onClick={() => setSort("recent")}>
              Ostatnio
            </button>
            <button className={"seg sm" + (sort === "tokens" ? " active" : "")} onClick={() => setSort("tokens")}>
              Tokeny
            </button>
          </div>
        </div>
      </div>
      <div className="table-wrap tall">
        <table className="map-table">
          <thead>
            <tr>
              <th>Sesja</th>
              <th>Projekt</th>
              <th>Tokeny</th>
              <th>Koszt~</th>
              <th>Wiad.</th>
              <th>Ostatnio</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  Brak sesji z tokenami.
                </td>
              </tr>
            )}
            {sorted.map((s) => (
              <tr key={s.id}>
                <td className="title" title={s.title}>
                  {s.title}
                </td>
                <td className="path" title={s.displayPath}>
                  {baseName(s.displayPath)}
                </td>
                <td className="num">{fmtInt(s.total)}</td>
                <td className="num">{fmtUsd(s.cost)}</td>
                <td className="num">{s.messages}</td>
                <td className="num muted">{relTime(s.lastTs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

import { useState } from "react";
import type { ProjectInfo } from "../types";
import { setExcluded } from "../api";
import { fmtInt, fmtUsd, relTime } from "../lib/format";

interface Props {
  projects: ProjectInfo[];
  onChanged: () => void;
}

export function ProjectTable({ projects, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(pr: ProjectInfo) {
    setBusy(pr.dir);
    try {
      await setExcluded(pr.dir, !pr.excluded);
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Projekty</h2>
        <span className="muted">Wyklucz szum (np. ten dashboard), żeby nie zaniżał kalibracji</span>
      </div>
      <div className="table-wrap">
        <table className="map-table">
          <thead>
            <tr>
              <th>Projekt</th>
              <th>Tokeny</th>
              <th>Koszt~</th>
              <th>Wiad.</th>
              <th>Ostatnio</th>
              <th>Liczony</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  Brak projektów — czy Claude Code zapisał już jakieś sesje?
                </td>
              </tr>
            )}
            {projects.map((pr) => (
              <tr key={pr.dir} className={(busy === pr.dir ? "busy " : "") + (pr.excluded ? "excluded" : "")}>
                <td className="path" title={pr.displayPath}>
                  {pr.displayPath}
                </td>
                <td className="num">{fmtInt(pr.total)}</td>
                <td className="num">{fmtUsd(pr.cost)}</td>
                <td className="num">{pr.messages}</td>
                <td className="num muted">{relTime(pr.lastTs)}</td>
                <td>
                  <button
                    className={"seg sm" + (pr.excluded ? "" : " active")}
                    disabled={busy === pr.dir}
                    onClick={() => toggle(pr)}
                    title={pr.excluded ? "Pominięty — kliknij, by liczyć" : "Liczony — kliknij, by pominąć"}
                  >
                    {pr.excluded ? "Pomijany" : "Liczony"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
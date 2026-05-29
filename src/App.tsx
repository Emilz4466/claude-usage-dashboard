import { useSnapshot } from "./hooks/useSnapshot";
import { ThemeSwitcher } from "./components/ThemeSwitcher";
import { StatusBar } from "./components/StatusBar";
import { UsageGauges } from "./components/UsageGauges";
import { TokenAreaChart } from "./components/TokenAreaChart";
import { BreakdownPanel } from "./components/BreakdownPanel";
import { ProjectTable } from "./components/ProjectTable";
import { SessionTable } from "./components/SessionTable";
import { fmtInt } from "./lib/format";

const EMPTY_WINDOW = { cost: 0, messages: 0, limit: null, percent: null };

export default function App() {
  const { data, error, refresh } = useSnapshot(5000);

  const totals = data?.totals;
  const windows = data?.windows ?? { session: EMPTY_WINDOW, weekly: EMPTY_WINDOW };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">◢◤</span>
          <div>
            <h1>Claude Token Monitor</h1>
            <p className="sub">Zużycie tokenów Claude Code · z lokalnych logów</p>
          </div>
        </div>
        <ThemeSwitcher />
      </header>

      <StatusBar data={data} error={error} />

      <UsageGauges windows={windows} onChanged={refresh} />

      <TokenAreaChart data={data?.series ?? []} totals={totals} />

      {totals && <BreakdownPanel totals={totals} models={data?.models ?? []} />}

      <ProjectTable projects={data?.projects ?? []} onChanged={refresh} />

      <SessionTable sessions={data?.sessions ?? []} />

      <footer className="foot">
        Odświeżanie co 5 s · źródło: lokalne logi Claude Code · łącznie {fmtInt(totals?.total ?? 0)} tokenów ·
        % liczony względem skalibrowanego limitu (logi nie zawierają limitu planu)
      </footer>
    </div>
  );
}

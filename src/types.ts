export type WindowKey = "session" | "weekly";
export type PeriodKey = "day" | "week" | "month" | "halfyear" | "year" | "all";
export type Gran = "hour" | "day" | "week" | "month";

export interface TokenBucket {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface BucketPoint extends TokenBucket {
  bucket: string;
}

export interface Totals extends TokenBucket {
  total: number;
  messages: number;
}

export interface ModelTotal {
  model: string;
  total: number;
  messages: number;
}

export interface WindowUsage {
  messages: number;
  limit: number | null;
  percent: number | null;
  // sesja:
  active?: boolean;
  startTs?: string | null;
  resetTs?: string | null;
  // tydzien:
  sinceTs?: string | null;
}

export interface ProjectInfo {
  dir: string;
  displayPath: string;
  messages: number;
  total: number;
  lastTs: string | null;
  excluded: boolean;
}

export interface SessionInfo {
  id: string;
  projectDir: string;
  displayPath: string;
  title: string;
  messages: number;
  total: number;
  firstTs: string;
  lastTs: string;
}

export interface Snapshot {
  lastScan: string | null;
  scanError: string | null;
  claudeDir: string;
  period: PeriodKey;
  gran: Gran;
  totals: Totals;
  periodTotals: Totals;
  series: BucketPoint[];
  models: ModelTotal[];
  windows: Record<WindowKey, WindowUsage>;
  projects: ProjectInfo[];
  sessions: SessionInfo[];
}

export type WindowKey = "session" | "weekly";

export interface TokenBucket {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface DayPoint extends TokenBucket {
  day: string;
  cost: number;
}

export interface Totals extends TokenBucket {
  total: number;
  cost: number;
  messages: number;
}

export interface ModelTotal {
  model: string;
  total: number;
  cost: number;
  messages: number;
}

export interface WindowUsage {
  cost: number;
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
  cost: number;
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
  cost: number;
  firstTs: string;
  lastTs: string;
}

export interface Snapshot {
  lastScan: string | null;
  scanError: string | null;
  claudeDir: string;
  totals: Totals;
  series: DayPoint[];
  models: ModelTotal[];
  windows: Record<WindowKey, WindowUsage>;
  projects: ProjectInfo[];
  sessions: SessionInfo[];
}
import { useTheme, type Theme } from "./ThemeContext";

export interface Palette {
  input: string;
  output: string;
  cacheRead: string;
  cacheWrite: string;
  grid: string;
  axis: string;
  ok: string;
  warn: string;
  danger: string;
  track: string;
}

const palettes: Record<Theme, Palette> = {
  light: {
    input: "#2563eb",
    output: "#16a34a",
    cacheRead: "#9333ea",
    cacheWrite: "#ea580c",
    grid: "#e5e7eb",
    axis: "#6b7280",
    ok: "#16a34a",
    warn: "#d97706",
    danger: "#dc2626",
    track: "#e4e7ef",
  },
  dark: {
    input: "#7aa2ff",
    output: "#7ee0a6",
    cacheRead: "#b794ff",
    cacheWrite: "#f5b06a",
    grid: "#262d3a",
    axis: "#8b97a8",
    ok: "#7ee0a6",
    warn: "#f5b06a",
    danger: "#ff6b81",
    track: "#2b323f",
  },
  neon: {
    input: "#00eaff",
    output: "#39ff14",
    cacheRead: "#b026ff",
    cacheWrite: "#ff2bd6",
    grid: "rgba(0,234,255,0.12)",
    axis: "#7fdfff",
    ok: "#39ff14",
    warn: "#ffe600",
    danger: "#ff3b6b",
    track: "rgba(0,234,255,0.12)",
  },
};

export function usePalette(): Palette {
  const { theme } = useTheme();
  return palettes[theme] ?? palettes.neon;
}

/** Kolor wg progu zuzycia: <70% ok, <90% warn, >=90% danger. */
export function levelColor(p: Palette, percent: number | null | undefined): string {
  if (percent == null) return p.track;
  if (percent >= 90) return p.danger;
  if (percent >= 70) return p.warn;
  return p.ok;
}
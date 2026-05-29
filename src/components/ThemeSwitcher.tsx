import { useTheme, type Theme } from "../theme/ThemeContext";

const OPTIONS: { key: Theme; label: string }[] = [
  { key: "light", label: "Jasny" },
  { key: "dark", label: "Ciemny" },
  { key: "neon", label: "Neon" },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="theme-switch" role="group" aria-label="Motyw">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          className={"seg" + (theme === o.key ? " active" : "")}
          onClick={() => setTheme(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

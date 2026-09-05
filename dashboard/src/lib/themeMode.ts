import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
type Resolved = "light" | "dark";

const KEY = "landsafe-theme";
const query = () => window.matchMedia("(prefers-color-scheme: dark)");

function stored(): ThemeMode {
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

/** Light, dark, or whatever the machine says.
 *
 *  The resolved value is stamped on <html> as data-theme, so CSS needs only
 *  one dark block and never has to reason about the system preference itself.
 *  The choice is remembered per browser; "system" keeps following the OS. */
export function useThemeMode(): { mode: ThemeMode; resolved: Resolved; setMode: (m: ThemeMode) => void } {
  const [mode, setMode] = useState<ThemeMode>(stored);
  const [system, setSystem] = useState<Resolved>(() => (query().matches ? "dark" : "light"));

  useEffect(() => {
    const mq = query();
    const onChange = (e: MediaQueryListEvent) => setSystem(e.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved: Resolved = mode === "system" ? system : mode;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    localStorage.setItem(KEY, mode);
  }, [mode, resolved]);

  return { mode, resolved, setMode };
}

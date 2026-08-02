"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
export type Density = "detailed" | "compact";

const THEME_KEY = "iwtr:theme";
const DENSITY_KEY = "iwtr:density";

// Mirrors the inline boot script in layout.tsx (which runs before paint to
// avoid a flash of the wrong theme) — keep the two in sync if this logic
// ever changes.
function applyTheme(theme: Theme) {
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

function applyDensity(density: Density) {
  document.documentElement.setAttribute("data-density", density);
}

interface SettingsContextValue {
  theme: Theme;
  density: Density;
  setTheme: (theme: Theme) => void;
  setDensity: (density: Density) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [density, setDensityState] = useState<Density>("detailed");

  useEffect(() => {
    const storedTheme = (localStorage.getItem(THEME_KEY) as Theme | null) ?? "system";
    const storedDensity = (localStorage.getItem(DENSITY_KEY) as Density | null) ?? "detailed";
    setThemeState(storedTheme);
    setDensityState(storedDensity);

    if (storedTheme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyTheme("system");
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }, []);

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    localStorage.setItem(DENSITY_KEY, next);
    applyDensity(next);
  }, []);

  return (
    <SettingsContext.Provider value={{ theme, density, setTheme, setDensity }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

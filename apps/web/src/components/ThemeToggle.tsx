"use client";

import { useSettings } from "@/lib/settings-context";

// Replaces the old hamburger/dropdown settings panel — now that density is
// gone, theme is the only setting left, so it gets a direct on/off switch
// (sun/moon, styled after a standard iOS-style toggle) instead of a menu.
export function ThemeToggle() {
  const { theme, setTheme } = useSettings();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      className={`relative inline-flex h-8 w-[60px] shrink-0 items-center justify-between rounded-full border px-2 transition-colors ${
        isDark ? "border-slate-600 bg-slate-800" : "border-amber-300 bg-amber-50"
      }`}
    >
      <span className={`text-sm leading-none transition-opacity ${isDark ? "opacity-40" : "opacity-100"}`} aria-hidden>
        ☀️
      </span>
      <span className={`text-sm leading-none transition-opacity ${isDark ? "opacity-100" : "opacity-40"}`} aria-hidden>
        🌙
      </span>
      <span
        className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${
          isDark ? "translate-x-7" : "translate-x-0"
        }`}
      />
    </button>
  );
}

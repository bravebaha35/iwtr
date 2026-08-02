"use client";

import { useEffect, useRef, useState } from "react";
import { type Density, type Theme, useSettings } from "@/lib/settings-context";

function segmentClass(active: boolean): string {
  return `flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
    active
      ? "bg-brand-600 text-white"
      : "text-muted-foreground hover:bg-surface-muted"
  }`;
}

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

const DENSITY_OPTIONS: { value: Density; label: string }[] = [
  { value: "detailed", label: "Detailed" },
  { value: "compact", label: "Compact" },
];

// Global, single mount point (rendered once from layout.tsx) so the
// sandwich control sits top-right on every page — auth screen, onboarding,
// admin queues, all of it — without threading it through each page's own
// header markup.
export function SettingsPanel() {
  const { theme, density, setTheme, setDensity } = useSettings();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="fixed top-4 right-4 z-50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Settings"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-sm transition hover:bg-surface-muted"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-surface p-4 shadow-lg">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Appearance</p>
          <div className="mb-4 flex gap-1 rounded-lg bg-surface-muted p-1">
            {THEME_OPTIONS.map((o) => (
              <button key={o.value} type="button" onClick={() => setTheme(o.value)} className={segmentClass(theme === o.value)}>
                {o.label}
              </button>
            ))}
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Density</p>
          <div className="flex gap-1 rounded-lg bg-surface-muted p-1">
            {DENSITY_OPTIONS.map((o) => (
              <button key={o.value} type="button" onClick={() => setDensity(o.value)} className={segmentClass(density === o.value)}>
                {o.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Compact tightens spacing across workplace and review lists, like switching a mail inbox
            from detailed to compact view.
          </p>
        </div>
      )}
    </div>
  );
}

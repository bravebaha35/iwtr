"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface DropdownOption {
  value: string;
  label: string;
  // Optional leading icon (e.g. a flag) rendered before the label, both in
  // the closed box and in the option list.
  icon?: ReactNode;
}

// Below this many options, the list fits on screen without scrolling far
// enough for a search box to earn its space (e.g. the ~4-option Sort menu) —
// above it (country/city lists running into the hundreds), typing to filter
// beats scrolling with the mouse wheel.
const SEARCH_THRESHOLD = 8;

/**
 * Generic single-select dropdown: a box showing the current selection (or a
 * placeholder), closed by default. Click to open a scrollable list, click an
 * option to choose it and close the menu. Same overlay pattern as the
 * existing "Sort" menu in WorkplaceBrowser.tsx (fixed inset click-away +
 * absolutely positioned panel) — reused here so the job-category filter and
 * the country picker above city/district search both get the same behavior
 * instead of two one-off implementations.
 *
 * Long lists (more than SEARCH_THRESHOLD options) get a search box above the
 * list, auto-focused on open — typing "t" narrows a 250-country list down to
 * the ones containing "t" instead of forcing a scroll-wheel hunt. The list
 * itself keeps a real (if slim) scrollbar rather than the `no-scrollbar`
 * treatment used elsewhere — this is the one place in the app where a list
 * is long enough that people need something to grab and drag, not just
 * wheel/trackpad scroll.
 */
export function SingleSelectDropdown({
  value,
  options,
  placeholder,
  onChange,
  maxHeightClassName = "max-h-64",
  disabled = false,
  searchable: searchableOverride,
  openSignal,
}: {
  value: string | null;
  options: DropdownOption[];
  placeholder: string;
  onChange: (value: string | null) => void;
  maxHeightClassName?: string;
  disabled?: boolean;
  // Undefined (the default) auto-decides from list length; pass explicitly
  // to force it either way — e.g. DateDropdownPicker's day/month/year lists
  // are long enough to cross SEARCH_THRESHOLD but are meant to stay a plain
  // scroll (typing "3" to jump isn't the expected interaction for a day/year
  // number the way it is for a 250-country list).
  searchable?: boolean;
  // Bump this number from the parent to force the menu open — used for
  // cascading pickers where finishing one selection should open the next
  // (e.g. LocationPicker: pick a country, city opens automatically). Only
  // the change matters, not the value itself.
  openSignal?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Only open when openSignal actually changes to a new value, never on the
  // mount run itself. A plain "is this the first effect run" flag isn't
  // enough — React Strict Mode double-invokes effects in dev (mount, fake
  // cleanup, mount again) against the same component instance, so a
  // one-shot flag already flips false by the second pass and the menu pops
  // open anyway. Comparing against the last-seen openSignal value is
  // idempotent across that double-invoke.
  const prevOpenSignalRef = useRef(openSignal);
  useEffect(() => {
    if (openSignal !== undefined && openSignal !== prevOpenSignalRef.current && !disabled) {
      setOpen(true);
    }
    prevOpenSignalRef.current = openSignal;
  }, [openSignal, disabled]);
  const selectedOption = options.find((o) => o.value === value);
  const searchable = searchableOverride ?? options.length > SEARCH_THRESHOLD;

  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
  const visibleOptions =
    searchable && normalizedQuery
      ? options.filter((o) => o.label.toLocaleLowerCase("tr-TR").includes(normalizedQuery))
      : options;

  function close() {
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-left text-xs font-medium text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:border-border/50 disabled:bg-surface-muted disabled:text-muted-foreground disabled:opacity-60 disabled:hover:bg-surface-muted"
      >
        <span className={`flex min-w-0 items-center gap-1.5 truncate ${value ? "text-foreground" : "text-muted-foreground"}`}>
          {selectedOption?.icon}
          <span className="truncate">{selectedOption?.label ?? placeholder}</span>
        </span>
        <span className={`shrink-0 text-[10px] text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[65]" onClick={close} />
          <div
            className="absolute left-0 right-0 z-[70] mt-1 rounded-lg border border-border bg-surface p-1 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {searchable && (
              <input
                type="search"
                autoFocus
                placeholder="Search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="mb-1 w-full rounded-md border border-border bg-surface-muted px-2 py-1 text-xs text-foreground"
              />
            )}
            <div className={`thin-scrollbar overflow-y-auto py-0.5 ${maxHeightClassName}`}>
              {value !== null && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    close();
                  }}
                  className="block w-full px-2 py-1.5 text-left text-xs font-medium text-muted-foreground hover:bg-surface-muted"
                >
                  {placeholder}
                </button>
              )}
              {searchable && visibleOptions.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No matches.</p>
              )}
              {visibleOptions.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    close();
                  }}
                  className={`flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs ${
                    o.value === value
                      ? "font-semibold text-brand-600 dark:text-brand-400"
                      : "text-foreground hover:bg-surface-muted"
                  }`}
                >
                  {o.icon}
                  <span className="truncate">{o.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

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
export const SEARCH_THRESHOLD = 8;

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
  clearable = true,
  fitContent = false,
}: {
  value: string | null;
  options: DropdownOption[];
  placeholder: string;
  onChange: (value: string | null) => void;
  maxHeightClassName?: string;
  disabled?: boolean;
  // Whether the option list shows a leading "clear back to placeholder"
  // entry once something is selected. Off for pickers like LocationPicker's
  // Country/City/District, where the field is a required step rather than
  // a resettable filter — that entry read as a stray "City"/"District"
  // list item there instead of a clear affordance.
  clearable?: boolean;
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
  // When true, neither the closed box nor the open list ever truncates —
  // both size to fit their longest label instead of being pinned to a fixed
  // width. Used by DateDropdownPicker's day/month/year boxes, where every
  // label is short enough that sizing to content is safe; left off (the
  // default) everywhere else, since an unbounded country/company-name list
  // sizing to its longest entry would blow out the layout.
  fitContent?: boolean;
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
        className={`flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-left text-xs font-medium text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:border-border/50 disabled:bg-surface-muted disabled:text-muted-foreground disabled:opacity-60 disabled:hover:bg-surface-muted ${fitContent ? "w-max" : "w-full"}`}
      >
        <span
          className={`flex min-w-0 items-center gap-1.5 ${fitContent ? "whitespace-nowrap" : "truncate"} ${value ? "text-foreground" : "text-muted-foreground"}`}
        >
          {selectedOption?.icon}
          <span className={fitContent ? "whitespace-nowrap" : "truncate"}>{selectedOption?.label ?? placeholder}</span>
        </span>
        <span className={`shrink-0 text-[10px] text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[65]" onClick={close} />
          <div
            // Non-fitContent lists used to pin the open panel's width to the
            // closed box's width (`right-0`) — fine for short labels, but a
            // narrow trigger (e.g. one of three columns in a Country/City/
            // District row) truncated any longer option ("Turkmenistan",
            // "Turks and Caicos Islands") to an unreadable "Turkmenist...".
            // `w-max` lets the panel grow past the trigger to fit its
            // content, `min-w-full` keeps it at least as wide as the
            // trigger, and `max-w-72` caps how far it can grow for the
            // handful of genuinely long labels (e.g. some country names run
            // 40+ characters) — those wrap across lines (see the option
            // label's whitespace-normal below) instead of blowing out the
            // layout or truncating.
            className={`absolute left-0 z-[70] mt-1 rounded-lg border border-border bg-surface p-1 shadow-lg ${fitContent ? "w-max min-w-full" : "w-max min-w-full max-w-72"}`}
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
              {clearable && value !== null && (
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
                  <span className={fitContent ? "whitespace-nowrap" : "whitespace-normal break-words"}>{o.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Generic multi-select dropdown: same closed-by-default box + overlay panel
 * as SingleSelectDropdown, but ticking an option doesn't close the panel —
 * it stays open so several options can be picked in one go (e.g. districts
 * within a city), closing only on an outside click or Escape.
 */
export function MultiSelectDropdown({
  values,
  options,
  placeholder,
  onToggle,
  maxHeightClassName = "max-h-64",
  disabled = false,
  searchable: searchableOverride,
}: {
  values: string[];
  options: DropdownOption[];
  placeholder: string;
  onToggle: (value: string) => void;
  maxHeightClassName?: string;
  disabled?: boolean;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

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

  const summary =
    values.length === 0
      ? placeholder
      : values.length === 1
        ? (options.find((o) => o.value === values[0])?.label ?? placeholder)
        : `${values.length} selected`;

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-left text-xs font-medium text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:border-border/50 disabled:bg-surface-muted disabled:text-muted-foreground disabled:opacity-60 disabled:hover:bg-surface-muted"
      >
        <span className={`min-w-0 truncate ${values.length > 0 ? "text-foreground" : "text-muted-foreground"}`}>
          {summary}
        </span>
        <span className={`shrink-0 text-[10px] text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[65]" onClick={close} />
          <div
            className="absolute left-0 z-[70] mt-1 w-max min-w-full max-w-72 rounded-lg border border-border bg-surface p-1 shadow-lg"
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
              {searchable && visibleOptions.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No matches.</p>
              )}
              {visibleOptions.map((o) => {
                const checked = values.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => onToggle(o.value)}
                    className={`flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs ${
                      checked ? "font-semibold text-brand-600 dark:text-brand-400" : "text-foreground hover:bg-surface-muted"
                    }`}
                  >
                    <span
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border text-[9px] leading-none ${
                        checked ? "border-brand-600 bg-brand-600 text-white dark:border-brand-400 dark:bg-brand-400" : "border-border"
                      }`}
                    >
                      {checked ? "✓" : ""}
                    </span>
                    {o.icon}
                    <span className="whitespace-normal break-words">{o.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

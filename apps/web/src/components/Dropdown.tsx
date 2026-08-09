"use client";

import { useState, type ReactNode } from "react";

export interface DropdownOption {
  value: string;
  label: string;
  // Optional leading icon (e.g. a flag) rendered before the label, both in
  // the closed box and in the option list.
  icon?: ReactNode;
}

/**
 * Generic single-select dropdown: a box showing the current selection (or a
 * placeholder), closed by default. Click to open a scrollable list, click an
 * option to choose it and close the menu. Same overlay pattern as the
 * existing "Sort" menu in WorkplaceBrowser.tsx (fixed inset click-away +
 * absolutely positioned panel) — reused here so the job-category filter and
 * the country picker above city/district search both get the same behavior
 * instead of two one-off implementations.
 */
export function SingleSelectDropdown({
  value,
  options,
  placeholder,
  onChange,
  maxHeightClassName = "max-h-64",
  disabled = false,
}: {
  value: string | null;
  options: DropdownOption[];
  placeholder: string;
  onChange: (value: string | null) => void;
  maxHeightClassName?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-left text-xs font-medium text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface"
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
          <div className="fixed inset-0 z-[65]" onClick={() => setOpen(false)} />
          <div
            className={`no-scrollbar absolute left-0 right-0 z-[70] mt-1 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg ${maxHeightClassName}`}
          >
            {value !== null && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="block w-full px-3 py-1.5 text-left text-xs font-medium text-muted-foreground hover:bg-surface-muted"
              >
                {placeholder}
              </button>
            )}
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs ${
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
        </>
      )}
    </div>
  );
}

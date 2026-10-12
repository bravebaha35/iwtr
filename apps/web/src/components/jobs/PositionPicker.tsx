"use client";

import type { JobPosition } from "@iwtr/shared-types";
import { JOB_POSITIONS } from "@/lib/jobPositions";

/**
 * The Position buttons: one row per position with a tick box in front, in
 * the fixed order of JOB_POSITIONS. A ticked row turns Wood with a white
 * tick (the site's one "selected" look). Used twice:
 * - Post a job: two columns, at most `max` ticked - once the limit is
 *   reached the remaining rows go quiet until one is unticked;
 * - the Jobs page's filter sidebar: one column, no limit.
 */
export function PositionPicker({
  selected,
  onToggle,
  max,
  columns = 1,
}: {
  selected: JobPosition[];
  onToggle: (value: JobPosition) => void;
  // How many can be ticked at once; leave out for no limit.
  max?: number;
  columns?: 1 | 2;
}) {
  const full = max !== undefined && selected.length >= max;
  return (
    <div className={columns === 2 ? "grid grid-cols-1 gap-1 sm:grid-cols-2" : "flex flex-col gap-0.5"}>
      {JOB_POSITIONS.map((p) => {
        const on = selected.includes(p.value);
        const locked = full && !on;
        return (
          <button
            key={p.value}
            type="button"
            role="checkbox"
            aria-checked={on}
            disabled={locked}
            onClick={() => onToggle(p.value)}
            className={`group flex w-full items-center gap-2 rounded-lg px-2 text-left leading-tight transition active:scale-[0.99] ${
              columns === 2 ? "min-h-10 py-2 text-sm" : "min-h-8 py-1.5 text-[13px]"
            } ${
              on
                ? "bg-brand-600 font-semibold text-white"
                : locked
                  ? "cursor-not-allowed text-muted-foreground/50"
                  : "text-foreground/80 hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            <span
              aria-hidden="true"
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] transition ${
                on
                  ? "bg-white/25"
                  : locked
                    ? "bg-surface-muted"
                    : "bg-surface-muted ring-1 ring-inset ring-border group-hover:ring-foreground/40"
              }`}
            >
              {on && (
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              )}
            </span>
            <span className="min-w-0 flex-1">{p.label}</span>
          </button>
        );
      })}
    </div>
  );
}

"use client";

import type { WorkplaceType } from "@iwtr/shared-types";
import { WORKPLACE_TYPES } from "@/lib/workplaceTypes";

// "ratingAsc"/"ratingDesc" and "alphabetical"/"alphabeticalDesc" are each
// two states of one button, so the button can show which way it's sorting.
export type SortOption = "default" | "alphabetical" | "alphabeticalDesc" | "workplace" | "ratingAsc" | "ratingDesc";

/** The A-Z button's 3-click loop: A→Z, then Z→A, then back to the default order. */
export function nextAlphaSort(current: SortOption): SortOption {
  if (current === "alphabetical") return "alphabeticalDesc";
  if (current === "alphabeticalDesc") return "default";
  return "alphabetical";
}

/** Rating's 3-click loop: least-rated first, best-rated first, then off. */
function nextRatingSort(current: SortOption): SortOption {
  if (current === "ratingAsc") return "ratingDesc";
  if (current === "ratingDesc") return "default";
  return "ratingAsc";
}

// Turkish-aware so Ç/Ş/İ/Ö/Ü/Ğ sort where Turkish readers expect them.
const collator = new Intl.Collator("tr", { sensitivity: "base" });

/**
 * The shared sort for the rating page and the jobs page. "default" returns
 * the list untouched (the caller may still apply its own order, e.g.
 * nearest-first).
 */
export function sortCompaniesBy<T extends { name: string; overallAvg: number | null; workplaceTypes: WorkplaceType[] }>(
  list: T[],
  sort: SortOption,
): T[] {
  switch (sort) {
    case "alphabetical":
      return [...list].sort((a, b) => collator.compare(a.name, b.name));
    case "alphabeticalDesc":
      return [...list].sort((a, b) => collator.compare(b.name, a.name));
    case "ratingDesc":
      return [...list].sort((a, b) => (b.overallAvg ?? -1) - (a.overallAvg ?? -1));
    case "ratingAsc":
      // Unrated companies sink to the bottom in both directions.
      return [...list].sort((a, b) => (a.overallAvg ?? Infinity) - (b.overallAvg ?? Infinity));
    case "workplace": {
      // By each company's first (primary) tag only.
      const order = WORKPLACE_TYPES.map((t) => t.value);
      return [...list].sort((a, b) => order.indexOf(a.workplaceTypes[0]) - order.indexOf(b.workplaceTypes[0]));
    }
    default:
      return list;
  }
}

const TOGGLE_BASE = "rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200";
const TOGGLE_OFF = "border-border bg-surface text-muted-foreground hover:text-foreground";
const TOGGLE_ON = "border-river-600 bg-river-600 text-white";

/**
 * Three separate sort buttons (not one segmented control), used by both
 * WorkplaceBrowser and JobsBrowser. A-Z loops A→Z / Z→A / off; Workplace is
 * on/off; Rating keeps its own red/green colours for least/best-rated first.
 */
export function SortButtons({ value, onChange }: { value: SortOption; onChange: (next: SortOption) => void }) {
  const alphaOn = value === "alphabetical" || value === "alphabeticalDesc";
  return (
    <div role="group" aria-label="Sort" className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(nextAlphaSort(value))}
        aria-pressed={alphaOn}
        title={value === "alphabetical" ? "Sorted A to Z" : value === "alphabeticalDesc" ? "Sorted Z to A" : "Sort A to Z"}
        className={`${TOGGLE_BASE} ${alphaOn ? TOGGLE_ON : TOGGLE_OFF}`}
      >
        {value === "alphabeticalDesc" ? "Z-A" : "A-Z"}
      </button>
      <button
        type="button"
        onClick={() => onChange(value === "workplace" ? "default" : "workplace")}
        aria-pressed={value === "workplace"}
        className={`${TOGGLE_BASE} ${value === "workplace" ? TOGGLE_ON : TOGGLE_OFF}`}
      >
        Workplace
      </button>
      <button
        type="button"
        onClick={() => onChange(nextRatingSort(value))}
        aria-pressed={value === "ratingAsc" || value === "ratingDesc"}
        title={
          value === "ratingAsc" ? "Showing least-rated first" : value === "ratingDesc" ? "Showing best-rated first" : "Sort by rating"
        }
        className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
          value === "ratingAsc"
            ? "border border-red-200 bg-red-50 text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-400"
            : value === "ratingDesc"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-400"
              : `border ${TOGGLE_OFF}`
        }`}
      >
        Rating
      </button>
    </div>
  );
}

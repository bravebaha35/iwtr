"use client";

// "ratingAsc"/"ratingDesc", "alphabetical"/"alphabeticalDesc" and
// "riskDesc"/"riskAsc" are each two states of one button, so the button can
// show which way it's sorting.
export type SortOption =
  | "default"
  | "alphabetical"
  | "alphabeticalDesc"
  | "ratingAsc"
  | "ratingDesc"
  | "riskDesc"
  | "riskAsc";

const SORT_OPTIONS: readonly SortOption[] = [
  "default",
  "alphabetical",
  "alphabeticalDesc",
  "ratingAsc",
  "ratingDesc",
  "riskDesc",
  "riskAsc",
];

/**
 * A sort read back from saved filters may be one that no longer exists
 * (the old "workplace" sort was removed) — anything unknown becomes "default".
 */
export function normalizeSortOption(value: unknown): SortOption {
  return SORT_OPTIONS.includes(value as SortOption) ? (value as SortOption) : "default";
}

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

/** RS's 3-click loop (Jobs page): riskiest (3) first, cleanest (0) first, then off. */
export function nextRiskSort(current: SortOption): SortOption {
  if (current === "riskDesc") return "riskAsc";
  if (current === "riskAsc") return "default";
  return "riskDesc";
}

// Turkish-aware so Ç/Ş/İ/Ö/Ü/Ğ sort where Turkish readers expect them.
const collator = new Intl.Collator("tr", { sensitivity: "base" });

/**
 * The shared sort for the rating page and the jobs page. "default" returns
 * the list untouched (the caller may still apply its own order, e.g.
 * nearest-first).
 */
export function sortCompaniesBy<T extends { name: string; overallAvg: number | null }>(
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
    default:
      return list;
  }
}

const TOGGLE_SIZE = "px-4 py-2 text-sm";
// Inside SearchSortBox, where they sit in the search pill's own height.
const TOGGLE_SIZE_COMPACT = "px-3 py-1 text-xs";
const TOGGLE_OFF = "border-border bg-surface text-muted-foreground hover:text-foreground";
const TOGGLE_ON = "border-brand-600 bg-brand-600 text-white";

// Red for the "bad end first" state, green for the "good end first" state -
// shared by Rating and RS.
const TOGGLE_RED = "border-red-200 bg-red-50 text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-400";
const TOGGLE_GREEN =
  "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-400";

/**
 * Separate sort buttons (not one segmented control), used by both
 * WorkplaceBrowser and JobsBrowser. A-Z loops A→Z / Z→A / off; Rating keeps
 * its own red/green colours for least/best-rated first. The Jobs page also
 * shows RS (Risk Score): red for riskiest first, green for cleanest first.
 */
export function SortButtons({
  value,
  onChange,
  compact = false,
  showRiskSort = false,
}: {
  value: SortOption;
  onChange: (next: SortOption) => void;
  compact?: boolean;
  showRiskSort?: boolean;
}) {
  const alphaOn = value === "alphabetical" || value === "alphabeticalDesc";
  const base = `rounded-full border font-medium transition-all duration-200 ${compact ? TOGGLE_SIZE_COMPACT : TOGGLE_SIZE}`;
  return (
    <div role="group" aria-label="Sort" className={`flex items-center ${compact ? "shrink-0 gap-1.5" : "flex-wrap gap-2"}`}>
      {showRiskSort && (
        <button
          type="button"
          onClick={() => onChange(nextRiskSort(value))}
          aria-pressed={value === "riskDesc" || value === "riskAsc"}
          aria-label="Sort by Risk Score"
          title={
            value === "riskDesc"
              ? "Showing highest Risk Score first"
              : value === "riskAsc"
                ? "Showing lowest Risk Score first"
                : "Sort by Risk Score"
          }
          className={`${base} ${value === "riskDesc" ? TOGGLE_RED : value === "riskAsc" ? TOGGLE_GREEN : TOGGLE_OFF}`}
        >
          RS
        </button>
      )}
      <button
        type="button"
        onClick={() => onChange(nextAlphaSort(value))}
        aria-pressed={alphaOn}
        title={value === "alphabetical" ? "Sorted A to Z" : value === "alphabeticalDesc" ? "Sorted Z to A" : "Sort A to Z"}
        className={`${base} ${alphaOn ? TOGGLE_ON : TOGGLE_OFF}`}
      >
        {value === "alphabeticalDesc" ? "Z-A" : "A-Z"}
      </button>
      <button
        type="button"
        onClick={() => onChange(nextRatingSort(value))}
        aria-pressed={value === "ratingAsc" || value === "ratingDesc"}
        title={
          value === "ratingAsc" ? "Showing least-rated first" : value === "ratingDesc" ? "Showing best-rated first" : "Sort by rating"
        }
        className={`${base} ${value === "ratingAsc" ? TOGGLE_RED : value === "ratingDesc" ? TOGGLE_GREEN : TOGGLE_OFF}`}
      >
        Rating
      </button>
    </div>
  );
}

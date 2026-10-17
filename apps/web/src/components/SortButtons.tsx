"use client";

import { useT } from "@/lib/i18n/client";

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

/** RS's 3-click loop: riskiest (3) first, cleanest (0) first, then off. */
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

// Each sort is a plain word, as tall as the search field it sits beside
// (SearchSortBox). The one in use takes its colour and gets a bar of that
// colour under it - no button shapes.
const TOGGLE_BASE =
  "relative flex h-12 items-center gap-1 px-3 text-sm font-semibold transition-colors after:absolute after:inset-x-3 after:bottom-2 after:h-[3px] after:rounded-full";
const TOGGLE_OFF = "text-muted-foreground hover:text-foreground";
// A-Z in use: Wood, the site's one "selected" colour.
const TOGGLE_ON = "text-brand-700 after:bg-brand-600 dark:text-brand-300 dark:after:bg-brand-400";

// Red for the "bad end first" state, green for the "good end first" state -
// shared by Rating and RS.
const TOGGLE_RED = "text-red-700 after:bg-red-500 dark:text-red-400";
const TOGGLE_GREEN = "text-emerald-700 after:bg-emerald-500 dark:text-emerald-400";

// Which way a Rating / RS sort runs: up = lowest first, down = highest first.
function DirectionArrow({ up }: { up: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-3.5 w-3.5 ${up ? "" : "rotate-180"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

/**
 * The sort controls, shown right next to the search field on both
 * WorkplaceBrowser and JobsBrowser: three plain words, the
 * one in use coloured with a bar under it. A-Z loops A→Z / Z→A / off (Wood);
 * Rating keeps its own red/green colours for least/best-rated first, with
 * an arrow for the direction. With showRiskSort, RS (Risk Score) comes
 * first: red for riskiest first, green for cleanest first.
 */
export function SortButtons({
  value,
  onChange,
  showRiskSort = false,
}: {
  value: SortOption;
  onChange: (next: SortOption) => void;
  showRiskSort?: boolean;
}) {
  const t = useT();
  const alphaOn = value === "alphabetical" || value === "alphabeticalDesc";
  const base = TOGGLE_BASE;
  return (
    <div role="group" aria-label={t("Sort")} className="flex h-12 shrink-0 items-center">
      {showRiskSort && (
        <button
          type="button"
          onClick={() => onChange(nextRiskSort(value))}
          aria-pressed={value === "riskDesc" || value === "riskAsc"}
          aria-label={t("Sort by Risk Score")}
          title={
            value === "riskDesc"
              ? t("Showing highest Risk Score first")
              : value === "riskAsc"
                ? t("Showing lowest Risk Score first")
                : t("Sort by Risk Score")
          }
          className={`${base} ${value === "riskDesc" ? TOGGLE_RED : value === "riskAsc" ? TOGGLE_GREEN : TOGGLE_OFF}`}
        >
          {t("RS")}
          {value === "riskDesc" && <DirectionArrow up={false} />}
          {value === "riskAsc" && <DirectionArrow up />}
        </button>
      )}
      <button
        type="button"
        onClick={() => onChange(nextAlphaSort(value))}
        aria-pressed={alphaOn}
        title={value === "alphabetical" ? t("Sorted A to Z") : value === "alphabeticalDesc" ? t("Sorted Z to A") : t("Sort A to Z")}
        className={`${base} ${alphaOn ? TOGGLE_ON : TOGGLE_OFF}`}
      >
        {value === "alphabeticalDesc" ? "Z-A" : "A-Z"}
      </button>
      <button
        type="button"
        onClick={() => onChange(nextRatingSort(value))}
        aria-pressed={value === "ratingAsc" || value === "ratingDesc"}
        title={
          value === "ratingAsc" ? t("Showing least-rated first") : value === "ratingDesc" ? t("Showing best-rated first") : t("Sort by rating")
        }
        className={`${base} ${value === "ratingAsc" ? TOGGLE_RED : value === "ratingDesc" ? TOGGLE_GREEN : TOGGLE_OFF}`}
      >
        {t("Rating")}
        {value === "ratingAsc" && <DirectionArrow up />}
        {value === "ratingDesc" && <DirectionArrow up={false} />}
      </button>
    </div>
  );
}

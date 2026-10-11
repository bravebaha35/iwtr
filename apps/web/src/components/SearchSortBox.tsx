"use client";

import { SortButtons, type SortOption } from "@/components/SortButtons";

/**
 * The workplace search field with the RS / A-Z / Rating sort buttons right
 * next to it (outside the field, to its right), so sorting sits with
 * searching and stays apart from the Quick Select pills below. Shared by the
 * rating homepage and the Jobs page.
 */
export function SearchSortBox({
  query,
  onQueryChange,
  sortBy,
  onSortChange,
  highlighted = false,
  showRiskSort = false,
  widthClassName = "w-full max-w-4xl",
}: {
  query: string;
  onQueryChange: (next: string) => void;
  sortBy: SortOption;
  onSortChange: (next: SortOption) => void;
  highlighted?: boolean;
  /** The RS (Risk Score) sort button (rating homepage and Jobs page). */
  showRiskSort?: boolean;
  /** Width classes for the whole row (field + sort buttons). */
  widthClassName?: string;
}) {
  return (
    <div className={`flex ${widthClassName} flex-wrap items-center gap-2.5`}>
      <div
        className={`flex h-12 min-w-[14rem] flex-1 items-center rounded-full bg-surface px-5 shadow-sm ring-1 ring-border/70 transition focus-within:ring-2 focus-within:ring-brand-600 dark:focus-within:ring-brand-400 ${
          highlighted ? "highlight-pulse" : ""
        }`}
      >
        <input
          type="search"
          aria-label="Search workplaces"
          placeholder="Search or sort a workplace you want !"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
      <SortButtons value={sortBy} onChange={onSortChange} showRiskSort={showRiskSort} />
    </div>
  );
}

"use client";

import { SortButtons, type SortOption } from "@/components/SortButtons";

/**
 * One wide pill holding the workplace search and the RS / A-Z / Rating sort
 * buttons, so sorting sits with searching and stays apart from the Quick
 * Select pills below. Shared by the rating homepage and the Jobs page.
 */
export function SearchSortBox({
  query,
  onQueryChange,
  sortBy,
  onSortChange,
  highlighted = false,
  showRiskSort = false,
  widthClassName = "w-full max-w-3xl",
}: {
  query: string;
  onQueryChange: (next: string) => void;
  sortBy: SortOption;
  onSortChange: (next: SortOption) => void;
  highlighted?: boolean;
  /** The RS (Risk Score) sort button (rating homepage and Jobs page). */
  showRiskSort?: boolean;
  /** Width classes for the pill; the Jobs page stretches it to fill its row. */
  widthClassName?: string;
}) {
  return (
    <div
      className={`flex ${widthClassName} items-center gap-2 rounded-full border border-border bg-surface py-1 pl-4 pr-1.5 transition focus-within:border-brand-600 ${
        highlighted ? "highlight-pulse" : ""
      }`}
    >
      <input
        type="search"
        aria-label="Search workplaces"
        placeholder="Search or sort a workplace you want !"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
      <SortButtons value={sortBy} onChange={onSortChange} compact showRiskSort={showRiskSort} />
    </div>
  );
}

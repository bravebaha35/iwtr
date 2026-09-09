"use client";

import Link from "next/link";
import type { WorkplaceType } from "@iwtr/shared-types";
import { WORKPLACE_TYPES } from "@/lib/workplaceTypes";
import { collarSegmentClassName } from "@/lib/collarColors";
import { MultiFilterPillGroup } from "@/components/FilterPillGroup";
import { CategoryGroupFilter, type CategoryGroup } from "@/lib/categoryGroups";
import { CompanyLogo } from "@/components/CompanyLogo";
import { useFollowedCompanies } from "@/lib/useFollowedCompanies";

function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

// The caller's own followed companies - scrollable, fixed-height so it
// can't push the rest of the sidebar down as the list grows. Same
// data/toggle source (useFollowedCompanies) the post-card Follow button
// uses, so unfollowing a company from a post immediately drops it here too.
function FollowingList() {
  const { companies, loading } = useFollowedCompanies();

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Following</h3>
      <div className="flex h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-1.5">
        {loading && <p className="p-1.5 text-xs text-muted-foreground">Loading...</p>}
        {!loading && companies.length === 0 && (
          <p className="p-1.5 text-xs text-muted-foreground">You&apos;re not following any companies yet.</p>
        )}
        {companies.map((c) => (
          <Link
            key={c.companyId}
            href={`/social/${c.companySlug}`}
            className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 transition hover:bg-surface-muted"
          >
            <CompanyLogo name={c.companyName} mainPhotoUrl={c.mainPhotoUrl} size="sm" />
            <span className="min-w-0 truncate text-sm text-foreground">{c.companyName}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function SocialSidebar({
  query,
  onQueryChange,
  workplaceType,
  onWorkplaceTypeChange,
  categoryGroup,
  onCategoryGroupChange,
  savedView,
  onToggleSavedView,
  isMember,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  workplaceType: WorkplaceType | null;
  onWorkplaceTypeChange: (v: WorkplaceType | null) => void;
  categoryGroup: CategoryGroup | null;
  onCategoryGroupChange: (v: CategoryGroup | null) => void;
  savedView: boolean;
  onToggleSavedView: () => void;
  isMember: boolean;
}) {
  // "Only show me:" is single-select (unlike the rating/jobs pages' up-to-2
  // Work-Type filter), so this wraps MultiFilterPillGroup's onToggle contract
  // (one value in/out at a time) into a plain replace-or-clear toggle -
  // same track/segmented-control look and colors (collarSegmentClassName) as
  // those two pages, just one selection instead of two.
  function toggleWorkplaceType(value: WorkplaceType) {
    onWorkplaceTypeChange(workplaceType === value ? null : value);
  }

  return (
    <aside className="flex shrink-0 flex-col gap-5 sm:w-56">
      {/* Same search-a-company-by-name box the feed used to render inline -
          moved here, sized down to fit the panel. */}
      <input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search a company by name..."
        className="w-full rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-foreground"
      />

      {isMember && <FollowingList />}

      {/* Same visual language as the rating/jobs pages' Work-Type filter -
          straight segmented pills, not a dropdown (see MultiFilterPillGroup's
          variant="track" + collarSegmentClassName). */}
      <MultiFilterPillGroup
        heading="Only Show Me"
        options={WORKPLACE_TYPES}
        selected={workplaceType ? [workplaceType] : []}
        onToggle={toggleWorkplaceType}
        onReset={() => onWorkplaceTypeChange(null)}
        direction="grid"
        variant="track"
        pillColorClassName={collarSegmentClassName}
      />

      {isMember && (
        <button
          type="button"
          onClick={onToggleSavedView}
          aria-pressed={savedView}
          className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition ${
            savedView
              ? "border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-950 dark:text-brand-300"
              : "border-border text-foreground hover:bg-surface-muted"
          }`}
        >
          <BookmarkIcon className="h-4 w-4" />
          Saved Posts
        </button>
      )}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick Select</h3>
        {/* The exact same icon-pill row as the rating homepage/jobs page
            (CategoryGroupFilter) - all 7 buckets, same icons/tooltips. */}
        <CategoryGroupFilter value={categoryGroup} onChange={onCategoryGroupChange} />
      </div>
    </aside>
  );
}

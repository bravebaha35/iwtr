"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { Company, SocialCompanySort, WorkplaceType } from "@iwtr/shared-types";
import { WORKPLACE_TYPES } from "@/lib/workplaceTypes";
import { collarSegmentClassName } from "@/lib/collarColors";
import { MultiFilterPillGroup } from "@/components/FilterPillGroup";
import { CategoryGroupFilter, type CategoryGroup } from "@/lib/categoryGroups";
import { CompanyLogo } from "@/components/CompanyLogo";
import { useFollowedCompanies } from "@/lib/useFollowedCompanies";
import { SidebarShell } from "@/components/layout/SidebarShell";

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
// Links into that company's own profile Social tab - there is no more
// standalone /social/[slug] route to point at.
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
            href={`/companies/${c.companySlug}?tab=social`}
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

// Vertical, full-width stack (fits the narrow sidebar column at any
// viewport width) rather than a wrapping row of pills. Newest/Oldest are one
// toggle button, not two separate pills - its label always names the
// CURRENTLY active direction ("Newest to Oldest" while sort is "newest",
// flipping to "Oldest to Newest" once pressed and sort becomes "oldest"),
// so pressing it again flips back. Most Liked / Most Commented stay as
// separate buttons below it.
function SortPills({ value, onChange }: { value: SocialCompanySort; onChange: (v: SocialCompanySort) => void }) {
  const isOldest = value === "oldest";
  const directionActive = value === "newest" || value === "oldest";

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sort</h3>
      <div className="flex w-full flex-col gap-1 rounded-xl border border-border bg-surface-muted p-1">
        <button
          type="button"
          onClick={() => onChange(isOldest ? "newest" : "oldest")}
          aria-pressed={directionActive}
          className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-all duration-200 ${
            directionActive ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {isOldest ? "Oldest to Newest" : "Newest to Oldest"}
        </button>
        <button
          type="button"
          onClick={() => onChange("mostLiked")}
          aria-pressed={value === "mostLiked"}
          className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-all duration-200 ${
            value === "mostLiked" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Most Liked
        </button>
        <button
          type="button"
          onClick={() => onChange("mostCommented")}
          aria-pressed={value === "mostCommented"}
          className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-all duration-200 ${
            value === "mostCommented" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Most Commented
        </button>
      </div>
    </div>
  );
}

// Small monochrome glyphs for the 7 possible social links - deliberately
// simple line/shape icons rather than exact brand marks, since the goal is
// "distinct and recognizable at a glance", not logo-accurate reproduction.
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 8.5h2V5.5h-2c-2 0-3.5 1.5-3.5 3.5v2H8v3h2.5V21h3v-7h2.3l.7-3h-3v-1.5c0-.6.4-1 1-1Z" />
    </svg>
  );
}
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="17" cy="7" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}
function WhatsappIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 11.5A8 8 0 1 1 8.3 4.4 8 8 0 0 1 20 11.5Z" />
      <path d="M4 20l1.3-3.8" />
      <path d="M9 9.3c.3 1.8 1.9 3.4 3.7 3.7.8.1 1-.5.7-1l-.6-1" />
    </svg>
  );
}
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 5l14 14" />
      <path d="M19 5 5 19" />
    </svg>
  );
}
function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path d="M8 10.5V17" />
      <circle cx="8" cy="7.3" r="0.9" fill="currentColor" stroke="none" />
      <path d="M12 17v-4c0-1.4 1-2.3 2.3-2.3 1.2 0 1.7.9 1.7 2.3v4" />
    </svg>
  );
}
function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="12" rx="3.5" />
      <path d="M10.5 9.5v5l4.3-2.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
function GlassdoorIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3v14a2 2 0 0 0 2 2h1" />
      <path d="M17 21V7a2 2 0 0 0-2-2h-1" />
    </svg>
  );
}

type CompanySocialLinks = Pick<
  Company,
  "facebookUrl" | "instagramUrl" | "whatsappUrl" | "xUrl" | "linkedinUrl" | "youtubeUrl" | "glassdoorUrl"
>;

// All 7 owner-editable social fields, shown only when set - including
// linkedinUrl/youtubeUrl/glassdoorUrl, which existed on Company already but
// were never rendered publicly anywhere before this. No sanitization
// happens here: httpUrlSchema already restricts every one of these fields
// to http(s):// at write time (owner dashboard save path), so any value
// reaching this component is already scheme-safe - same trust boundary the
// 4-field "Contact & Social Media" box on the rating tab already relies on.
function SeeThemOn({ links }: { links: CompanySocialLinks }) {
  const allEntries: ({ label: string; href: string; icon: ReactNode } | null)[] = [
    links.facebookUrl ? { label: "Facebook", href: links.facebookUrl, icon: <FacebookIcon className="h-4 w-4" /> } : null,
    links.instagramUrl ? { label: "Instagram", href: links.instagramUrl, icon: <InstagramIcon className="h-4 w-4" /> } : null,
    links.whatsappUrl ? { label: "WhatsApp", href: links.whatsappUrl, icon: <WhatsappIcon className="h-4 w-4" /> } : null,
    links.xUrl ? { label: "X", href: links.xUrl, icon: <XIcon className="h-4 w-4" /> } : null,
    links.linkedinUrl ? { label: "LinkedIn", href: links.linkedinUrl, icon: <LinkedinIcon className="h-4 w-4" /> } : null,
    links.youtubeUrl ? { label: "YouTube", href: links.youtubeUrl, icon: <YoutubeIcon className="h-4 w-4" /> } : null,
    links.glassdoorUrl ? { label: "Glassdoor", href: links.glassdoorUrl, icon: <GlassdoorIcon className="h-4 w-4" /> } : null,
  ];
  const entries = allEntries.filter((v): v is { label: string; href: string; icon: ReactNode } => v !== null);

  if (entries.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">See Them On</h3>
      {/* Tight, asymmetrical wrap - not a fixed grid - so a company with 2
          links doesn't leave a row of empty cells and one with 7 wraps
          naturally. */}
      <div className="flex flex-wrap gap-2">
        {entries.map(({ label, href, icon }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={label}
            aria-label={label}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-foreground hover:text-foreground"
          >
            {icon}
          </a>
        ))}
      </div>
    </div>
  );
}

type SocialSidebarProps =
  | {
      mode: "global";
      query: string;
      onQueryChange: (q: string) => void;
      workplaceType: WorkplaceType | null;
      onWorkplaceTypeChange: (v: WorkplaceType | null) => void;
      categoryGroup: CategoryGroup | null;
      onCategoryGroupChange: (v: CategoryGroup | null) => void;
      savedView: boolean;
      onToggleSavedView: () => void;
      isMember: boolean;
    }
  | {
      mode: "company";
      sort: SocialCompanySort;
      onSortChange: (v: SocialCompanySort) => void;
      socialLinks: CompanySocialLinks;
    };

export function SocialSidebar(props: SocialSidebarProps) {
  if (props.mode === "company") {
    // No Following list here (per user feedback) - it's redundant on a
    // single company's own page; it stays on the global /social sidebar
    // where it's actually useful for jumping between companies.
    return (
      <SidebarShell>
        <SortPills value={props.sort} onChange={props.onSortChange} />
        <SeeThemOn links={props.socialLinks} />
      </SidebarShell>
    );
  }

  const { query, onQueryChange, workplaceType, onWorkplaceTypeChange, categoryGroup, onCategoryGroupChange, savedView, onToggleSavedView, isMember } = props;

  // "Only show me:" is single-select (unlike the rating/jobs pages' up-to-2
  // Work-Type filter), so this wraps MultiFilterPillGroup's onToggle contract
  // (one value in/out at a time) into a plain replace-or-clear toggle -
  // same track/segmented-control look and colors (collarSegmentClassName) as
  // those two pages, just one selection instead of two.
  function toggleWorkplaceType(value: WorkplaceType) {
    onWorkplaceTypeChange(workplaceType === value ? null : value);
  }

  return (
    <SidebarShell>
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
    </SidebarShell>
  );
}

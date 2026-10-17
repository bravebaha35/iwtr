"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Company, SocialCompanySort, WorkplaceType } from "@iwtr/shared-types";
import { WorkTypeTiles } from "@/components/WorkTypeTiles";
import { RewindButton } from "@/components/RewindButton";
import { CategoryGroupFilter, type CategoryGroup } from "@/lib/categoryGroups";
import { CompanyLogo } from "@/components/CompanyLogo";
import { useFollowedCompanies } from "@/lib/useFollowedCompanies";
import { SidebarShell } from "@/components/layout/SidebarShell";
import { useT } from "@/lib/i18n/client";

// One section of the sidebar: a soft panel, the same family as the panels of
// the right-hand rail, so the two columns either side of the feed match.
function SidebarPanel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const t = useT();
  return (
    <section className="rounded-2xl bg-surface p-2.5 shadow-xs">
      <div className="mb-2 flex min-h-5 items-center justify-between gap-2 px-0.5">
        <h2 className="text-[13px] font-semibold text-foreground">{t(title)}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// How far down the page the reader must be before "Back to first post" shows.
const BACK_TO_TOP_AFTER_PX = 400;

// The sidebar follows the page down (SocialShell), so once the reader has
// scrolled into the feed this is always one click away. At the top of the
// page it is not shown at all.
function BackToFirstPost() {
  const [shown, setShown] = useState(false);
  const t = useT();
  useEffect(() => {
    const check = () => setShown(window.scrollY > BACK_TO_TOP_AFTER_PX);
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, []);
  if (!shown) return null;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="reaction-pop flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-surface-muted text-[13px] font-semibold text-foreground/80 transition hover:bg-surface-muted/70 hover:text-foreground active:scale-[0.98]"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5" />
        <path d="m5 12 7-7 7 7" />
      </svg>
      {t("Back to first post")}
    </button>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

// The caller's own followed companies. As tall as the list up to a limit,
// then it scrolls, so a long list can't push the filters off the screen.
// Same data source (useFollowedCompanies) as the post card's Follow button,
// so unfollowing from a post drops the company here at once. Each row opens
// that company's own Social tab.
function FollowingList() {
  const { companies, loading } = useFollowedCompanies();
  const t = useT();

  return (
    <SidebarPanel
      title="Following"
      action={
        companies.length > 0 ? (
          <span aria-label={t("{n} companies", { n: companies.length })} className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
            {companies.length}
          </span>
        ) : undefined
      }
    >
      {loading && companies.length === 0 ? (
        <div aria-hidden="true" className="flex animate-pulse flex-col gap-2.5 motion-reduce:animate-none">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-[0.5rem] bg-surface-muted" />
              <div className="h-3 w-28 rounded-full bg-surface-muted" />
            </div>
          ))}
        </div>
      ) : companies.length === 0 ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{t("Companies you follow show up here, one click from their posts.")}</p>
      ) : (
        <div className="thin-scrollbar -mx-1 flex max-h-52 flex-col gap-0.5 overflow-y-auto">
          {companies.map((c) => (
            <Link
              key={c.companyId}
              href={`/companies/${c.companySlug}?tab=social`}
              className="flex min-w-0 items-center gap-2.5 rounded-lg px-1 py-1 transition hover:bg-surface-muted"
            >
              <CompanyLogo name={c.companyName} mainPhotoUrl={c.mainPhotoUrl} size="sm" />
              <span className="min-w-0 truncate text-sm font-medium text-foreground">{c.companyName}</span>
            </Link>
          ))}
        </div>
      )}
    </SidebarPanel>
  );
}

// The company feed's order, as rows in a panel. Newest/Oldest are one row,
// not two: its label always names the direction in use ("Newest to Oldest"
// while sort is "newest") and pressing it again flips it. Most Liked / Most
// Commented are rows of their own. The row in use takes the site's one
// "selected" colour.
function SortPills({ value, onChange }: { value: SocialCompanySort; onChange: (v: SocialCompanySort) => void }) {
  const isOldest = value === "oldest";
  const t = useT();
  const directionActive = value === "newest" || value === "oldest";
  const row = (active: boolean) =>
    `flex h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left text-sm font-medium transition active:scale-[0.98] ${
      active ? "bg-brand-600 text-white" : "text-foreground/80 hover:bg-surface-muted hover:text-foreground"
    }`;

  return (
    <SidebarPanel title="Sort">
      <div className="flex flex-col gap-0.5">
        <button type="button" onClick={() => onChange(isOldest ? "newest" : "oldest")} aria-pressed={directionActive} className={row(directionActive)}>
          {isOldest ? t("Oldest to Newest") : t("Newest to Oldest")}
          {/* Two arrows: this row flips its direction when pressed again. */}
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 opacity-70" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 4v16M8 4 4.5 7.5M8 4l3.5 3.5" />
            <path d="M16 20V4m0 16-3.5-3.5M16 20l3.5-3.5" />
          </svg>
        </button>
        <button type="button" onClick={() => onChange("mostLiked")} aria-pressed={value === "mostLiked"} className={row(value === "mostLiked")}>
          {t("Most Liked")}
        </button>
        <button type="button" onClick={() => onChange("mostCommented")} aria-pressed={value === "mostCommented"} className={row(value === "mostCommented")}>
          {t("Most Commented")}
        </button>
      </div>
    </SidebarPanel>
  );
}

// Beside a company's Questions: the three rules a reader needs, in place of
// the Sort panel (questions are always newest first).
function QuestionsNote() {
  const points = [
    "Everyone asks and answers anonymously.",
    "\"Worked there\" marks people who had this company in their work history.",
    "The company answers under its owner's real name.",
  ];
  return (
    <SidebarPanel title="How questions work">
      <ul className="flex flex-col gap-2 px-0.5 pb-0.5">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
            {point}
          </li>
        ))}
      </ul>
    </SidebarPanel>
  );
}

// Small monochrome glyphs for the 5 possible social links - deliberately
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
function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="12" rx="3.5" />
      <path d="M10.5 9.5v5l4.3-2.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

type CompanySocialLinks = Pick<
  Company,
  "facebookUrl" | "instagramUrl" | "whatsappUrl" | "xUrl" | "youtubeUrl"
>;

// The 5 owner-editable social fields, shown only when set. LinkedIn and
// Glassdoor were dropped from the owner dashboard on 2026-09-27 (product
// decision), so any value still stored for them is no longer shown. No sanitization
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
    links.youtubeUrl ? { label: "YouTube", href: links.youtubeUrl, icon: <YoutubeIcon className="h-4 w-4" /> } : null,
  ];
  const entries = allEntries.filter((v): v is { label: string; href: string; icon: ReactNode } => v !== null);
  const t = useT();

  if (entries.length === 0) return null;

  return (
    <SidebarPanel title="See Them On">
      <div className="flex flex-col gap-0.5">
        {entries.map(({ label, href, icon }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex h-9 items-center gap-2.5 rounded-lg px-1 text-sm font-medium text-foreground/80 transition hover:bg-surface-muted hover:text-foreground"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted-foreground transition group-hover:text-foreground">
              {icon}
            </span>
            {label}
            <span className="sr-only"> {t("(opens in a new tab)")}</span>
          </a>
        ))}
      </div>
    </SidebarPanel>
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
      isMember: boolean;
      // The Questions tab searches question text as well as company names.
      searchPlaceholder?: string;
    }
  | {
      mode: "company";
      sort: SocialCompanySort;
      onSortChange: (v: SocialCompanySort) => void;
      socialLinks: CompanySocialLinks;
      // False on the Questions view, which is always newest first.
      showSort?: boolean;
    };

export function SocialSidebar(props: SocialSidebarProps) {
  const t = useT();
  if (props.mode === "company") {
    // No Following list here (per user feedback) - it's redundant on a
    // single company's own page; it stays on the global /social sidebar
    // where it's actually useful for jumping between companies.
    return (
      <SidebarShell>
        {props.showSort !== false ? <SortPills value={props.sort} onChange={props.onSortChange} /> : <QuestionsNote />}
        <SeeThemOn links={props.socialLinks} />
      </SidebarShell>
    );
  }

  const { query, onQueryChange, workplaceType, onWorkplaceTypeChange, categoryGroup, onCategoryGroupChange, isMember } = props;
  const placeholder = t(props.searchPlaceholder ?? "Search a company by name...");
  const filtersOn = (query.trim() ? 1 : 0) + (workplaceType ? 1 : 0) + (categoryGroup ? 1 : 0);

  function clearAll() {
    onQueryChange("");
    onWorkplaceTypeChange(null);
    onCategoryGroupChange(null);
  }

  // "Only show me:" is single-select (unlike the rating/jobs pages' up-to-2
  // Work-Type filter), so this wraps WorkTypeTiles' onToggle contract (one
  // value in/out at a time) into a plain replace-or-clear toggle - the same
  // tiles as those two pages, just one selection instead of two.
  function toggleWorkplaceType(value: WorkplaceType) {
    onWorkplaceTypeChange(workplaceType === value ? null : value);
  }

  return (
    <SidebarShell>
      <div className="flex flex-col gap-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <label htmlFor="social-search" className="sr-only">
            {t("Search IWT Social")}
          </label>
          <input
            id="social-search"
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={placeholder}
            className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-[13px] text-foreground shadow-xs"
          />
        </div>
        {/* One way back to "everything" once any filter is on. */}
        {filtersOn > 0 && (
          <p className="flex items-center justify-between px-1 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {t(filtersOn === 1 ? "{n} filter on" : "{n} filters on", { n: filtersOn })}
            </span>
            <button type="button" onClick={clearAll} className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
              {t("Clear all")}
            </button>
          </p>
        )}
      </div>

      {isMember && <FollowingList />}

      {/* The same beaver tiles as the rating/jobs pages' Work-Type filter. No
          panel around them: each tile is a small white panel of its own, and
          they need the column's full width for their names. */}
      <section>
        <div className="mb-2 flex min-h-5 items-center justify-between gap-2 px-0.5">
          <h2 className="text-[13px] font-semibold text-foreground">{t("Only Show Me")}</h2>
          <RewindButton onClick={() => onWorkplaceTypeChange(null)} active={workplaceType !== null} title="Clear Only Show Me filter" />
        </div>
        <WorkTypeTiles selected={workplaceType ? [workplaceType] : []} onToggle={toggleWorkplaceType} tone="surface" />
      </section>

      {/* Same 7 groups as the rating/jobs pages, as a list of rows here. */}
      <SidebarPanel title="Quick Select">
        <CategoryGroupFilter value={categoryGroup} onChange={onCategoryGroupChange} orientation="vertical" />
      </SidebarPanel>

      <BackToFirstPost />
    </SidebarShell>
  );
}

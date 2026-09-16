"use client";

import Link from "next/link";

export type OwnerDashboardCategory =
  | "general-info"
  | "premium-features"
  | "contact-social"
  | "reviews-ratings"
  | "applications";

const CATEGORIES: { key: OwnerDashboardCategory; label: string }[] = [
  { key: "general-info", label: "General Information" },
  { key: "premium-features", label: "Premium Features" },
  { key: "contact-social", label: "Contact & Social Media" },
  { key: "reviews-ratings", label: "Reviews & Ratings" },
  { key: "applications", label: "Applications" },
];

const NAV_ITEM_CLASS =
  "whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition text-muted-foreground hover:bg-surface-muted hover:text-foreground";
const NAV_ITEM_ACTIVE_CLASS =
  "whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition bg-brand-600 text-white";

/**
 * Left-side vertical nav on desktop, sticky horizontal tab bar on mobile —
 * the 5 fixed categories every approved-owner company card is organized
 * under (see sections/*.tsx), plus a real link to the Job Postings
 * dashboard (a separate route, not a locally-switched category — see
 * OwnerJobPostingsView.tsx). Purely a controlled tab switcher for the first
 * 5; every field and save action still lives in the category components
 * themselves.
 */
export function OwnerDashboardSidePanel({
  active,
  onChange,
  jobPostingsHref,
}: {
  active: OwnerDashboardCategory;
  onChange: (category: OwnerDashboardCategory) => void;
  jobPostingsHref: string;
}) {
  return (
    // Bare nav — no wrapping border/background box, matching /me's Edit
    // Profile sidebar (apps/web/src/app/me/page.tsx) — this is what makes it
    // read as a standalone sidebar next to the content instead of a tab
    // strip attached to it.
    <nav
      aria-label="Company dashboard sections"
      className="flex shrink-0 flex-row gap-1 overflow-x-auto sm:w-56 sm:flex-col sm:overflow-visible"
    >
      {CATEGORIES.map((c) => {
        const isActive = c.key === active;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(c.key)}
            aria-current={isActive ? "page" : undefined}
            className={isActive ? NAV_ITEM_ACTIVE_CLASS : NAV_ITEM_CLASS}
          >
            {c.label}
          </button>
        );
      })}
      <Link href={jobPostingsHref} className={NAV_ITEM_CLASS}>
        Job Postings
      </Link>
    </nav>
  );
}

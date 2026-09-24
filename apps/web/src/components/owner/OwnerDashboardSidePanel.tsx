"use client";

import { SettingsNav } from "@/components/layout/SettingsNav";

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
    <SettingsNav
      label="Company dashboard sections"
      items={[...CATEGORIES, { key: "job-postings", label: "Job Postings", href: jobPostingsHref }]}
      active={active}
      onChange={onChange}
    />
  );
}

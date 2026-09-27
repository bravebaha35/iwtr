"use client";

import { SettingsNav } from "@/components/layout/SettingsNav";

const CATEGORIES = [
  { key: "general-info", label: "General Information" },
  { key: "premium-features", label: "Premium Features" },
  { key: "contact-social", label: "Contact & Social Media" },
  { key: "reviews-ratings", label: "Reviews & Ratings" },
  { key: "applications", label: "Applications" },
  { key: "job-postings", label: "Job Postings" },
] as const;

export type OwnerDashboardCategory = (typeof CATEGORIES)[number]["key"];

export function isOwnerDashboardCategory(value: string): value is OwnerDashboardCategory {
  return CATEGORIES.some((c) => c.key === value);
}

/**
 * Left-side vertical nav on desktop, sticky horizontal tab bar on mobile —
 * the fixed sections every approved-owner company is organized under (see
 * sections/*.tsx). Purely a controlled tab switcher; every field and save
 * action lives in the section components themselves.
 */
export function OwnerDashboardSidePanel({
  active,
  onChange,
}: {
  active: OwnerDashboardCategory;
  onChange: (category: OwnerDashboardCategory) => void;
}) {
  return <SettingsNav label="Company dashboard sections" items={[...CATEGORIES]} active={active} onChange={onChange} />;
}

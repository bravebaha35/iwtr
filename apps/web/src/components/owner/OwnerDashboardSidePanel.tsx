"use client";

import { SettingsNavList } from "@/components/layout/SettingsNav";

// Everyday sections every owner has, on every plan.
const STANDARD_SECTIONS = [
  { key: "general-info", label: "General Information" },
  { key: "contact-social", label: "Contact & Social Media" },
  { key: "reviews-ratings", label: "Reviews & Ratings" },
  { key: "applications", label: "Applications" },
  { key: "job-postings", label: "Job Postings" },
  { key: "customer-support", label: "Customer Support & Service Level (SLA)" },
  { key: "company-login", label: "Company Login" },
] as const;

// Paid-plan features, listed after the everyday sections.
const PREMIUM_SECTIONS = [
  { key: "featured-review", label: "Featured Review Spotlight" },
  { key: "benchmark-reports", label: "Benchmark Reports" },
  { key: "featured-job-ads", label: "Posting Featured Job Ads" },
] as const;

type StandardSection = (typeof STANDARD_SECTIONS)[number]["key"];
type PremiumSection = (typeof PREMIUM_SECTIONS)[number]["key"];
export type OwnerDashboardCategory = StandardSection | PremiumSection;

export function isOwnerDashboardCategory(value: string): value is OwnerDashboardCategory {
  return [...STANDARD_SECTIONS, ...PREMIUM_SECTIONS].some((c) => c.key === value);
}

/**
 * The owner dashboard's sidebar: one list - the everyday sections, then the
 * paid-plan features at the end (no separate "Premium Features" panel).
 * Vertical on desktop, a horizontal tab strip on mobile. Purely a controlled
 * switcher; every field and save action lives in the section components.
 */
export function OwnerDashboardSidePanel({
  active,
  onChange,
  isCompanyLogin = false,
}: {
  active: OwnerDashboardCategory;
  onChange: (category: OwnerDashboardCategory) => void;
  // Signed in with the company's shared login: it can't manage that login.
  isCompanyLogin?: boolean;
}) {
  return (
    <aside className="flex shrink-0 flex-col gap-3 sm:w-56">
      <SettingsNavList
        label="Company dashboard sections"
        items={[...STANDARD_SECTIONS, ...PREMIUM_SECTIONS].filter((s) => !isCompanyLogin || s.key !== "company-login")}
        active={active}
        onChange={onChange}
      />
    </aside>
  );
}

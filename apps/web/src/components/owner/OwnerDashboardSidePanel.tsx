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
] as const;

// Paid-plan features, in their own panel under a "Premium Features" header.
const PREMIUM_SECTIONS = [
  { key: "featured-review", label: "Featured Review Spotlight" },
  { key: "benchmark-reports", label: "Benchmark Reports" },
  { key: "featured-job-ads", label: "Posting Featured Job Ads" },
  { key: "hr-seats", label: "HR Manager Licenses" },
] as const;

type StandardSection = (typeof STANDARD_SECTIONS)[number]["key"];
type PremiumSection = (typeof PREMIUM_SECTIONS)[number]["key"];
export type OwnerDashboardCategory = StandardSection | PremiumSection;

export function isOwnerDashboardCategory(value: string): value is OwnerDashboardCategory {
  return [...STANDARD_SECTIONS, ...PREMIUM_SECTIONS].some((c) => c.key === value);
}

function isPremium(key: OwnerDashboardCategory): key is PremiumSection {
  return PREMIUM_SECTIONS.some((c) => c.key === key);
}

/**
 * The owner dashboard's sidebar: the standard sections, then a "Premium
 * Features" header with the paid features as a second panel. Vertical on
 * desktop, two horizontal tab strips on mobile. Purely a controlled
 * switcher; every field and save action lives in the section components.
 */
export function OwnerDashboardSidePanel({
  active,
  onChange,
}: {
  active: OwnerDashboardCategory;
  onChange: (category: OwnerDashboardCategory) => void;
}) {
  return (
    <aside className="flex shrink-0 flex-col gap-3 sm:w-56">
      <SettingsNavList
        label="Company dashboard sections"
        items={[...STANDARD_SECTIONS]}
        active={isPremium(active) ? null : active}
        onChange={onChange}
      />
      <h2 className="px-3 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Premium Features
      </h2>
      <SettingsNavList
        label="Premium features"
        items={[...PREMIUM_SECTIONS]}
        active={isPremium(active) ? active : null}
        onChange={onChange}
      />
    </aside>
  );
}

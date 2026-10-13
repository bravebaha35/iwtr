"use client";

import { SettingsNavList } from "@/components/layout/SettingsNav";
import { SOCIAL_QUESTIONS_ENABLED } from "@/lib/socialQuestionsFlag";

// Everyday sections every owner has, on every plan.
const STANDARD_SECTIONS = [
  { key: "general-info", label: "General Information" },
  { key: "contact-social", label: "Contact & Social Media" },
  { key: "reviews-ratings", label: "Reviews & Ratings" },
  { key: "questions", label: "Questions" },
  { key: "social", label: "IWT Social" },
  { key: "applications", label: "Applications" },
  { key: "job-postings", label: "Job Postings" },
  { key: "customer-support", label: "Customer Support & Service Level (SLA)" },
  { key: "company-login", label: "Company Login" },
] as const;

// Paid-plan features, listed after the everyday sections.
const PREMIUM_SECTIONS = [
  { key: "featured-review", label: "Featured Review Spotlight" },
  { key: "benchmark-reports", label: "Benchmark Reports" },
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
 *
 * Two rows carry a bold line under their name: Job Postings, how many free
 * featured ads the plan has left this month; Questions, how many are waiting
 * for an answer.
 */
export function OwnerDashboardSidePanel({
  active,
  onChange,
  isCompanyLogin = false,
  freeAdsLeft = null,
  questionsWaiting = null,
}: {
  active: OwnerDashboardCategory;
  onChange: (category: OwnerDashboardCategory) => void;
  // Signed in with the company's shared login: it can't manage that login,
  // and Questions belong to the owner's own account (an answer is the owner
  // speaking under their own name). IWT Social as a whole is closed to it,
  // so its section (insights, scheduled posts) is too.
  isCompanyLogin?: boolean;
  // null while not known yet.
  freeAdsLeft?: number | null;
  questionsWaiting?: number | null;
}) {
  const notes: Partial<Record<OwnerDashboardCategory, string | null>> = {
    "job-postings": freeAdsLeft === null ? null : freeAdsLeftText(freeAdsLeft),
    questions: questionsWaiting ? `${questionsWaiting} waiting for you` : null,
  };
  const items = [...STANDARD_SECTIONS, ...PREMIUM_SECTIONS]
    .filter((s) => !isCompanyLogin || (s.key !== "company-login" && s.key !== "questions" && s.key !== "social"))
    .filter((s) => SOCIAL_QUESTIONS_ENABLED || s.key !== "questions")
    .map((s) => ({ ...s, note: notes[s.key] ?? null }));
  return (
    <aside className="flex shrink-0 flex-col gap-3 sm:w-56">
      <SettingsNavList label="Company dashboard sections" items={items} active={active} onChange={onChange} />
    </aside>
  );
}

/** "2 free ads left this month" - the same words in the side list and in the Job Postings section. */
export function freeAdsLeftText(n: number): string {
  return `${n} free ad${n === 1 ? "" : "s"} left this month`;
}

// Single source of truth for the 4-tier (Free/Starter/Pro/Enterprise) B2B
// membership matrix — both PricingComparisonTable and the owner dashboard's
// premium-features side menu read from here, so the copy can never drift
// between the two places it's shown.
//
// The real, DB-backed axis is OwnerTier (schema.prisma) — FREE/BLUE/
// BLUE_PLUS/ENTERPRISE — mapped onto this file's keys via
// tierKeyFromOwnerTier below. The matrix's own keys/copy/prices are
// unchanged from before that axis existed; only the source feeding
// tierKeyFromOwnerTier is new.

export type PricingTierKey = "free" | "starter" | "pro" | "enterprise";

export const PRICING_TIERS: { key: PricingTierKey; label: string; rank: number }[] = [
  { key: "free", label: "Free", rank: 0 },
  { key: "starter", label: "Starter", rank: 1 },
  { key: "pro", label: "Pro", rank: 2 },
  { key: "enterprise", label: "Enterprise", rank: 3 },
];

// CompanyOwner.rivalAnalyticsTier is nullable STARTER/PRO/ENTERPRISE — null
// maps to "free" here, matching how decideRivalAnalyticsAccess already
// treats a null tier as the lowest rung.
export function tierKeyFromRivalAnalyticsTier(tier: "STARTER" | "PRO" | "ENTERPRISE" | null): PricingTierKey {
  if (tier === "STARTER") return "starter";
  if (tier === "PRO") return "pro";
  if (tier === "ENTERPRISE") return "enterprise";
  return "free";
}

export function tierRank(key: PricingTierKey): number {
  return PRICING_TIERS.find((t) => t.key === key)?.rank ?? 0;
}

// The real, DB-backed OwnerTier axis (FREE/BLUE/BLUE_PLUS/ENTERPRISE — see
// its schema.prisma comment) mapped onto this file's free/starter/pro/
// enterprise keys. GOLD isn't a tier name — it's the badge ENTERPRISE grants
// (see the "verified-badge" row below) — so ENTERPRISE alone maps onto the
// matrix's top "enterprise" bucket.
export function tierKeyFromOwnerTier(tier: "FREE" | "BLUE" | "BLUE_PLUS" | "ENTERPRISE"): PricingTierKey {
  if (tier === "BLUE") return "starter";
  if (tier === "BLUE_PLUS") return "pro";
  if (tier === "ENTERPRISE") return "enterprise";
  return "free";
}

// The one label shown as a company's verification badge (browse card,
// company page header, dashboard) — null on Free. Derived straight from the
// "verified-badge" pricing-matrix row so this can never drift from the copy
// shown in PricingComparisonTable/PremiumFeaturesPanel.
export function badgeLabelForOwnerTier(tier: "FREE" | "BLUE" | "BLUE_PLUS" | "ENTERPRISE"): string | null {
  const value = pricingFeature("verified-badge").values[tierKeyFromOwnerTier(tier)];
  return value === "No" ? null : value;
}

interface PricingFeatureRow {
  id: string;
  label: string;
  values: Record<PricingTierKey, string>;
  // Lowest tier rank (see PRICING_TIERS) that unlocks this feature at all —
  // omitted where every tier has *some* real access (a lower limit is not
  // the same as being locked out). Drives the owner dashboard's premium
  // features side menu, not the comparison table itself.
  lockedBelowRank?: number;
}

export const PRICING_FEATURE_ROWS: PricingFeatureRow[] = [
  {
    id: "target-scale",
    label: "Target Company Scale",
    values: {
      free: "Micro and Small Businesses",
      starter: "Small and Medium-Sized Enterprises",
      pro: "Medium-Sized Enterprises",
      enterprise: "Holdings and Multinational Corporations and Franchises",
    },
  },
  {
    id: "verified-badge",
    label: "Verified Employer Badge",
    values: { free: "No", starter: "Blue", pro: "Blue+", enterprise: "Gold" },
    lockedBelowRank: 1,
  },
  {
    id: "comment-response",
    label: "Monthly Comment Response Count",
    values: {
      free: "Max. 2 comments",
      starter: "Max. 6 comments",
      pro: "Max. 10 comments",
      enterprise: "Unlimited",
    },
  },
  {
    id: "hr-analytics",
    label: "HR Analytics Dashboard Access",
    values: {
      free: `Only see company's "Questions and Answers", change logo, add contact information.`,
      starter: `See "Questions and Answers", Green Flags & Redflags, add logo, general information, contact information.`,
      pro: `See "Questions and Answers", Green Flags & Redflags, Most "Yes" answered question, Most "No" answered question (both in top 5 form), add logo and banner, general information, contact information.`,
      enterprise: `See "Questions and Answers", Green Flags & Redflags, Most "Yes" answered question, Most "No" answered question (both in top 5 form), suggestions about company below top 5, add logo and banner, general information, contact information.`,
    },
  },
  {
    id: "benchmarking",
    label: "Industry and Competitor Benchmarking",
    values: {
      free: "No",
      starter: "Only the industry average.",
      pro: "Monthly single competitor comparison, Industry and Competitor Benchmarking",
      enterprise: "Monthly Competitor & Regional Benchmarking Report",
    },
    lockedBelowRank: 1,
  },
  {
    id: "job-ads",
    label: "Posting Featured Job Ads",
    values: { free: "No*", starter: "2 Ads Monthly", pro: "5 Ads Monthly", enterprise: "10 Ads Monthly" },
    lockedBelowRank: 1,
  },
  {
    id: "candidate-tracking",
    label: "Candidate Tracking & Talent Pool Access",
    values: {
      free: `Only see who applied for them and message them in "Job" section.`,
      starter: `Only see who applied for them and message them in "Job" section.`,
      pro: `Advanced HR Filtering, only see who applied for them and message them in "Job" section.`,
      enterprise: `Advanced HR Filtering, only see who applied for them and message them in "Job" section.`,
    },
  },
  {
    id: "export-data",
    label: "Exporting HR Data (PDF / Excel Report)",
    values: { free: "No", starter: "No", pro: "Monthly Reports", enterprise: "Unlimited Reports" },
    lockedBelowRank: 2,
  },
  {
    id: "hr-seats",
    label: "HR Manager License (User Account)",
    values: { free: "Single user", starter: "2 users", pro: "5 users", enterprise: "10 users and sub-users" },
  },
  {
    id: "support",
    label: "Customer Support & Service Level (SLA)",
    values: {
      free: "Standard mail",
      starter: "Standard mail",
      pro: "Prioritized Mail Support (4 Hours)",
      enterprise: "Prioritized Mail Support (4 Hours) and Chat option",
    },
  },
];

export function pricingFeature(id: string): PricingFeatureRow {
  const row = PRICING_FEATURE_ROWS.find((r) => r.id === id);
  if (!row) throw new Error(`Unknown pricing feature id: ${id}`);
  return row;
}

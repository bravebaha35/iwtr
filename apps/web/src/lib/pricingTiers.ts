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

export function tierRank(key: PricingTierKey): number {
  return PRICING_TIERS.find((t) => t.key === key)?.rank ?? 0;
}

// The real, DB-backed OwnerTier axis (FREE/BLUE/BLUE_PLUS/ENTERPRISE — see
// its schema.prisma comment) mapped onto this file's free/starter/pro/
// enterprise keys — ENTERPRISE alone maps onto the matrix's top "enterprise"
// bucket (see the "verified-badge" row below for the badge it grants).
export function tierKeyFromOwnerTier(tier: "FREE" | "BLUE" | "BLUE_PLUS" | "ENTERPRISE"): PricingTierKey {
  if (tier === "BLUE") return "starter";
  if (tier === "BLUE_PLUS") return "pro";
  if (tier === "ENTERPRISE") return "enterprise";
  return "free";
}

// The plan name shown on the owner dashboard ("Starter Tier") — the same
// names as the pricing table's column headers.
export function planNameForOwnerTier(tier: "FREE" | "BLUE" | "BLUE_PLUS" | "ENTERPRISE"): string {
  const key = tierKeyFromOwnerTier(tier);
  return PRICING_TIERS.find((t) => t.key === key)?.label ?? "Free";
}


// Uploading / replacing a banner needs any paid membership — Starter
// (Blue), Pro (Blue+) or Enterprise. Only Free is locked out; a Free
// company keeps the system default banner it was assigned. Mirrors the
// same rule enforced server-side in owner.service.ts.
export function canUseBanner(tier: "FREE" | "BLUE" | "BLUE_PLUS" | "ENTERPRISE"): boolean {
  return tier !== "FREE";
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
    // Every tier has a badge: the same check-mark, coloured by tier (see
    // CompanyVerificationTick).
    values: { free: "Grey", starter: "Blue", pro: "Green", enterprise: "Gold" },
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
    // Premium Features › Benchmark Reports on the owner dashboard. The HR
    // Analytics Report is a placeholder until its feature is specified.
    id: "benchmark-reports",
    label: "Benchmark Reports",
    values: {
      free: "No",
      starter: "No",
      pro: "No",
      enterprise: "Sector Benchmark Report and HR Analytics Report",
    },
    lockedBelowRank: 3,
  },
  {
    id: "job-ads",
    label: "Posting Featured Job Ads",
    values: { free: "No*", starter: "2 Ads Monthly", pro: "5 Ads Monthly", enterprise: "10 Ads Monthly" },
    lockedBelowRank: 1,
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

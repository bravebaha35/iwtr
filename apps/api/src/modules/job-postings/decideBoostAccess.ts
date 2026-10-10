import type { BoostOption, MembershipTierKey, OwnerTier } from "@iwtr/shared-types";

// The real, DB-backed OwnerTier axis (see its schema.prisma comment) mapped
// onto the same free/starter/pro/enterprise MembershipTierKey buckets the
// job-ads pricing-matrix row already uses — ENTERPRISE alone maps onto the
// matrix's top "enterprise" bucket (it's the only tier whose badge and tier
// name are the same word).
export function tierKeyFromOwnerTier(tier: OwnerTier): MembershipTierKey {
  if (tier === "STARTER") return "starter";
  if (tier === "PRO") return "pro";
  if (tier === "ENTERPRISE") return "enterprise";
  return "free";
}

// The free monthly allowance of featured (boosted) job ads - the same
// numbers the Pricing table promises ("2 / 5 / 10 Ads Monthly"). Only a
// 7-day boost can be free; 14/21-day boosts are always paid.
const FREE_7_DAY_BOOSTS_PER_MONTH: Record<MembershipTierKey, number> = {
  free: 0,
  starter: 2,
  pro: 5,
  enterprise: 10,
};

export function freeBoostsRemaining(tierKey: MembershipTierKey, freeBoostsUsedThisMonth: number): number {
  return Math.max(0, FREE_7_DAY_BOOSTS_PER_MONTH[tierKey] - freeBoostsUsedThisMonth);
}

// Only the 7-day featured ad can ever be free — the 14-day featured ad and
// the ad-space package always require payment regardless of tier or
// remaining allowance.
export function decideBoostAccess(params: {
  option: BoostOption;
  tierKey: MembershipTierKey;
  freeBoostsUsedThisMonth: number;
}): { isFree: boolean } {
  if (params.option !== "FEATURED_7") return { isFree: false };
  return { isFree: freeBoostsRemaining(params.tierKey, params.freeBoostsUsedThisMonth) > 0 };
}

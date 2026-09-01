import type { MembershipTierKey } from "@iwtr/shared-types";

// Same idea as rival-analytics/access-decision.util.ts's
// decideRivalAnalyticsAccess, and the same reuse-rivalAnalyticsTier stand-in
// apps/web/src/lib/pricingTiers.ts already documents doing for the whole
// membership story — this module doesn't add a second, competing tier
// field, it just reads the one that already exists.
export function tierKeyFromRivalAnalyticsTier(tier: "STARTER" | "PRO" | "ENTERPRISE" | null): MembershipTierKey {
  if (tier === "STARTER") return "starter";
  if (tier === "PRO") return "pro";
  if (tier === "ENTERPRISE") return "enterprise";
  return "free";
}

// "Starter = 1 '7-days' boost, Pro = 2, Enterprise = 3" — the free
// allowance is specifically 7-day boosts, not a credit good for any
// duration (mirrors how the Rival Analytics free credit is tied to a
// specific report, not an amount of money).
const FREE_7_DAY_BOOSTS_PER_MONTH: Record<MembershipTierKey, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

export function freeBoostsRemaining(tierKey: MembershipTierKey, freeBoostsUsedThisMonth: number): number {
  return Math.max(0, FREE_7_DAY_BOOSTS_PER_MONTH[tierKey] - freeBoostsUsedThisMonth);
}

// Only a 7-day boost can ever be free — 14/21-day boosts always require
// payment regardless of tier or remaining allowance.
export function decideBoostAccess(params: {
  durationDays: 7 | 14 | 21;
  tierKey: MembershipTierKey;
  freeBoostsUsedThisMonth: number;
}): { isFree: boolean } {
  if (params.durationDays !== 7) return { isFree: false };
  return { isFree: freeBoostsRemaining(params.tierKey, params.freeBoostsUsedThisMonth) > 0 };
}

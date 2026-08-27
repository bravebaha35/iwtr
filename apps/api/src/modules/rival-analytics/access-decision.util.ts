export type RivalAnalyticsTier = "STARTER" | "PRO" | "ENTERPRISE" | null;

export type AccessDecision = { allowed: true; usedFreeCredit: boolean } | { allowed: false; reason: "PAYMENT_REQUIRED" };

/**
 * Enterprise gets exactly one free pull, ever — everyone else (Starter,
 * Pro, no tier at all, or an Enterprise member who's already used their
 * credit) always pays the per-pull price. Tier alone is never enough on
 * its own to grant access; only "ENTERPRISE and the credit is unused" is.
 */
export function decideRivalAnalyticsAccess(ownership: {
  rivalAnalyticsTier: RivalAnalyticsTier;
  rivalAnalyticsFreeRequestUsed: boolean;
}): AccessDecision {
  if (ownership.rivalAnalyticsTier === "ENTERPRISE" && !ownership.rivalAnalyticsFreeRequestUsed) {
    return { allowed: true, usedFreeCredit: true };
  }
  return { allowed: false, reason: "PAYMENT_REQUIRED" };
}

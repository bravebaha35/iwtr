import type { OwnerTier, PlanStatus } from "@prisma/client";
import type { HrReportAllowance } from "@iwtr/shared-types";

export type HrReportMode = HrReportAllowance["mode"];

/**
 * Who pays for the next HR Analytics Report. Pure, so the whole pricing rule
 * is testable without a database:
 * - Enterprise: included, any number (the daily cap still applies).
 * - A paid report that failed: rebuilt once without paying again.
 * - Pro: one report per calendar month.
 * - Everyone else, and Pro once this month's report is used: 199,99 TL.
 * A lapsed subscription counts as Free, same as the rest of the dashboard.
 */
export function decideHrReportAccess(input: {
  tier: OwnerTier;
  planStatus: PlanStatus;
  quotaUsedThisMonth: boolean;
  hasPaidCredit: boolean;
}): HrReportMode {
  const tier = input.planStatus === "ACTIVE" ? input.tier : "FREE";
  if (tier === "ENTERPRISE") return "INCLUDED";
  if (input.hasPaidCredit) return "PAID_CREDIT";
  if (tier === "BLUE_PLUS" && !input.quotaUsedThisMonth) return "MONTHLY_QUOTA";
  return "PAYMENT_REQUIRED";
}

/** "2026-10" — the key the one-per-month unique index is built on (UTC). */
export function quotaMonthKey(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The first day of next month (UTC), as YYYY-MM-DD: when a Pro allowance refills. */
export function nextQuotaReset(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
}

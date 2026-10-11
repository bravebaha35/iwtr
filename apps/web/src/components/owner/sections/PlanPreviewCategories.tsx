"use client";

import type { OwnerTier } from "@iwtr/shared-types";
import { pricingFeature, tierKeyFromOwnerTier } from "@/lib/pricingTiers";
import { useBoostStatus } from "@/components/jobs/BoostPicker";

/**
 * Premium Features > Posting Featured Job Ads: how many free featured
 * (boosted) ads the plan still has this month. Featuring itself happens on
 * a posting - when creating it, or with Edit under Job Postings - so this
 * section sends the owner there.
 */
export function FeaturedJobAdsCategory({
  companyId,
  tier,
  onOpenJobPostings,
}: {
  companyId: string;
  tier: OwnerTier;
  onOpenJobPostings: () => void;
}) {
  const status = useBoostStatus(companyId);
  return (
    <div className="rounded-2xl bg-surface p-7 shadow-xs">
      <h3 className="mb-1 font-semibold text-foreground">Posting Featured Job Ads</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Your plan includes: {pricingFeature("job-ads").values[tierKeyFromOwnerTier(tier)]}.
      </p>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        A featured job ad sits in the gold &quot;Featured jobs&quot; row at the top of the Jobs page for 7, 14 or 21
        days. Your free monthly ads cover 7-day boosts.
      </p>
      <p className="mb-4 text-sm text-foreground">
        {status === null ? (
          "Loading..."
        ) : (
          <>
            <span className="font-semibold">{status.freeBoostsRemaining}</span> free featured ad
            {status.freeBoostsRemaining === 1 ? "" : "s"} left this month.
          </>
        )}
      </p>
      <button
        type="button"
        onClick={onOpenJobPostings}
        className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
      >
        Feature a job ad
      </button>
    </div>
  );
}

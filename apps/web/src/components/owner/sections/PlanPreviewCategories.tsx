"use client";

import type { OwnerTier } from "@iwtr/shared-types";
import { pricingFeature, tierKeyFromOwnerTier } from "@/lib/pricingTiers";

// Two Premium Features sections that describe what the plan includes but
// aren't built yet (no job-ad boosting quota or extra HR seats behind them).
// Kept as clearly-labelled previews until the product owner picks them up.

function PreviewTag() {
  return (
    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      Coming soon
    </span>
  );
}

function Shell({ title, planLine, children }: { title: string; planLine: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-6">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <PreviewTag />
      </div>
      <p className="mb-4 text-sm text-muted-foreground">Your plan includes: {planLine}.</p>
      {children}
    </div>
  );
}

function DisabledButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled
      title="Coming soon"
      className="cursor-not-allowed rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground opacity-60"
    >
      {children}
    </button>
  );
}

export function FeaturedJobAdsCategory({ tier }: { tier: OwnerTier }) {
  return (
    <Shell title="Posting Featured Job Ads" planLine={pricingFeature("job-ads").values[tierKeyFromOwnerTier(tier)]}>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        Featured job ads are shown above the others on the Jobs page.
      </p>
      <DisabledButton>+ Feature a job ad</DisabledButton>
    </Shell>
  );
}

export function HrSeatsCategory({ tier }: { tier: OwnerTier }) {
  return (
    <Shell title="HR Manager Licenses" planLine={pricingFeature("hr-seats").values[tierKeyFromOwnerTier(tier)]}>
      <p className="text-sm text-foreground">1 seat used (you).</p>
      <div className="mt-3">
        <DisabledButton>+ Invite a teammate</DisabledButton>
      </div>
    </Shell>
  );
}

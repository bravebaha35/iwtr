"use client";

import { useEffect } from "react";
import type { OwnerTier } from "@iwtr/shared-types";
import { CompanyVerificationTick } from "@/components/CompanyVerificationTick";
import { planNameForOwnerTier, pricingFeature, tierKeyFromOwnerTier } from "@/lib/pricingTiers";

/**
 * Opens from the "{Tier} Tier" label next to "See plans" on the owner
 * dashboard: the Verified Employer Badge this plan gives (it used to be its
 * own Premium Features box).
 */
export function TierInfoDialog({ tier, onClose }: { tier: OwnerTier; onClose: () => void }) {
  const value = pricingFeature("verified-badge").values[tierKeyFromOwnerTier(tier)];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Verified Employer Badge"
        className="relative w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <p className="mb-3 pr-6 text-sm text-muted-foreground">Your current tier: {planNameForOwnerTier(tier)}.</p>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
          <CompanyVerificationTick badgeTier={tier} claimed size={20} />
          {value} check-mark
        </span>
        <p className="mt-4 text-sm text-muted-foreground">
          This check-mark appears next to your company name across the site. Its colour shows your plan: grey on
          Free, blue on Starter, green on Pro and gold on Enterprise.
        </p>
      </div>
    </div>
  );
}

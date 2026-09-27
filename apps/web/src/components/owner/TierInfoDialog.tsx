"use client";

import { useEffect } from "react";
import type { OwnerTier } from "@iwtr/shared-types";
import { pricingFeature, tierKeyFromOwnerTier } from "@/lib/pricingTiers";

const BADGE_STYLES: Record<string, string> = {
  Blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Blue+": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Enterprise: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

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
        <p className="mb-3 pr-6 text-sm text-muted-foreground">
          Your current tier: {value === "No" ? "Free" : value}.
        </p>
        {value === "No" ? (
          <p className="text-sm text-muted-foreground">No verified badge on this tier.</p>
        ) : (
          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE_STYLES[value] ?? ""}`}>
            {value}
          </span>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          The badge would appear next to your company name across the site, distinct from the existing free
          &quot;Verified&quot; badge shown above (which tracks your Plus subscription separately).
        </p>
      </div>
    </div>
  );
}

"use client";

import type { PaidOwnerTier } from "@iwtr/shared-types";

const PAID_TIER_PRICES: { tier: PaidOwnerTier; label: string; price: string }[] = [
  { tier: "BLUE", label: "Blue", price: "299,99₺" },
  { tier: "BLUE_PLUS", label: "Blue+", price: "499,99₺" },
  { tier: "ENTERPRISE", label: "Enterprise", price: "999,99₺" },
];

/**
 * What a Premium Features section shows on a plan that doesn't include it:
 * what the feature does, and the plans that unlock it.
 */
export function PremiumLocked({
  title,
  description,
  onStartUpgrade,
  onOpenPricing,
}: {
  title: string;
  description: string;
  onStartUpgrade: (tier: PaidOwnerTier) => void;
  onOpenPricing: () => void;
}) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/20 p-6 dark:border-amber-700/50 dark:bg-amber-950/10">
      <h3 className="mb-2 flex items-center gap-2 font-semibold text-foreground">
        <span aria-hidden="true">🔒</span>
        {title}
      </h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      <p className="mt-3 text-sm text-muted-foreground">Unlock it with a paid plan:</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {PAID_TIER_PRICES.map((t) => (
          <button
            key={t.tier}
            type="button"
            onClick={() => onStartUpgrade(t.tier)}
            className="rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-400 dark:hover:bg-brand-950"
          >
            {t.label} — {t.price}
          </button>
        ))}
        <button
          type="button"
          onClick={onOpenPricing}
          className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          Compare plans
        </button>
      </div>
    </div>
  );
}

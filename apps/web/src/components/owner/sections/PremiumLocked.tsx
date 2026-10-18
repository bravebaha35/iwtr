"use client";

import type { PaidOwnerTier } from "@iwtr/shared-types";
import { useT } from "@/lib/i18n/client";

const PAID_TIER_PRICES: { tier: PaidOwnerTier; label: string; price: string }[] = [
  { tier: "STARTER", label: "Starter", price: "299,99₺" },
  { tier: "PRO", label: "Pro", price: "499,99₺" },
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
  const t = useT();
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/20 p-6 dark:border-amber-700/50 dark:bg-amber-950/10">
      <h3 className="mb-2 flex items-center gap-2 font-semibold text-foreground">
        <span aria-hidden="true">🔒</span>
        {t(title)}
      </h3>
      <p className="text-sm text-muted-foreground">{t(description)}</p>
      <p className="mt-3 text-sm text-muted-foreground">{t("Unlock it with a paid plan:")}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {PAID_TIER_PRICES.map((p) => (
          <button
            key={p.tier}
            type="button"
            onClick={() => onStartUpgrade(p.tier)}
            className="rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-400 dark:hover:bg-brand-950"
          >
            {p.label} - {p.price}
          </button>
        ))}
        <button
          type="button"
          onClick={onOpenPricing}
          className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          {t("Compare plans")}
        </button>
      </div>
    </div>
  );
}

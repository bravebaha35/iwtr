"use client";

import { useEffect, useState } from "react";
import type { BoostOption, CreateJobPostingInput, JobPostingBoostStatus } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";

export const emptyBilling = {
  buyerName: "",
  buyerSurname: "",
  buyerIdentityNumber: "",
  buyerEmail: "",
  buyerGsmNumber: "",
  city: "",
  address: "",
};
export type BillingDraft = typeof emptyBilling;

// priceTry arrives as a plain dot-decimal numeric string (that's the exact
// value forwarded to iyzico's API unmodified, see iyzico.provider.ts) —
// Turkish display formatting (comma decimal) is purely a frontend concern,
// same as PricingComparisonTable.tsx's own hardcoded "299,99₺" style strings.
function formatTry(priceTry: string): string {
  const n = Number(priceTry);
  return Number.isFinite(n) ? n.toFixed(2).replace(".", ",") : priceTry;
}

const OPTION_COPY: Record<BoostOption, string> = {
  FEATURED_7: "Get hired faster. Boost your job posting for 7 days.",
  FEATURED_14: "Dominate the market. Boost your job posting for 14 days.",
  AD_SPACE_14:
    "Maximum visibility. Your company's own ad in the ad space next to the search bar on both the Rating and Jobs pages, for 14 days. Ad space only: it does not add the post to Featured jobs.",
};

// Each box's outline: plain for 7 days, blue for 14 days, gold for the ad
// space. Picked = the same colour, thicker, with a soft fill.
const OPTION_STYLE: Record<BoostOption, { idle: string; picked: string }> = {
  FEATURED_7: {
    idle: "border border-border hover:border-brand-300 dark:hover:border-brand-700",
    picked: "border-2 border-brand-600 bg-brand-600/5 dark:border-brand-400",
  },
  FEATURED_14: {
    idle: "border border-blue-500 hover:border-blue-400",
    picked: "border-2 border-blue-500 bg-blue-500/10",
  },
  AD_SPACE_14: {
    idle: "border border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.25)] hover:border-amber-300",
    picked: "border-2 border-amber-400 bg-amber-400/10 shadow-[0_0_14px_rgba(251,191,36,0.4)]",
  },
};

/** The company's boost prices and free boosts left this month. */
export function useBoostStatus(companyId: string): JobPostingBoostStatus | null {
  const [status, setStatus] = useState<JobPostingBoostStatus | null>(null);
  useEffect(() => {
    apiGet<JobPostingBoostStatus>(`/my-companies/${companyId}/job-postings/boost-status`)
      .then(setStatus)
      .catch(() => setStatus({ tierKey: "free", freeBoostsRemaining: 0, pricing: [] }));
  }, [companyId]);
  return status;
}

/** Whether the picked boost costs money (so billing details are needed). */
export function boostNeedsBilling(selected: BoostOption | null, status: JobPostingBoostStatus | null): boolean {
  const isFree = selected === "FEATURED_7" && (status?.freeBoostsRemaining ?? 0) > 0;
  return selected !== null && !isFree;
}

/** The request's boost field for the picked option (null = no boost). */
export function boostInput(
  selected: BoostOption | null,
  needsBilling: boolean,
  billing: BillingDraft,
): CreateJobPostingInput["boost"] {
  if (!selected) return null;
  return {
    option: selected,
    billing: needsBilling
      ? {
          buyerName: billing.buyerName,
          buyerSurname: billing.buyerSurname,
          buyerIdentityNumber: billing.buyerIdentityNumber,
          buyerEmail: billing.buyerEmail,
          buyerGsmNumber: billing.buyerGsmNumber || undefined,
          billingAddress: {
            contactName: `${billing.buyerName} ${billing.buyerSurname}`.trim(),
            city: billing.city,
            country: "Turkey",
            address: billing.address,
          },
        }
      : undefined,
  };
}

/**
 * The boost choice shared by a new job posting (JobBoostModal) and the
 * dashboard's Edit (EditJobPostingModal): 3 duration boxes, the free-boosts-
 * remaining line for the company's plan, and billing details when the pick
 * isn't free. Only the 7-day box can ever be free — 14/21-day boosts always
 * require payment (see decideBoostAccess.ts).
 */
export function BoostPicker({
  status,
  selected,
  onSelect,
  billing,
  onBillingChange,
  onOpenPricing,
}: {
  status: JobPostingBoostStatus | null;
  selected: BoostOption | null;
  onSelect: (value: BoostOption | null) => void;
  billing: BillingDraft;
  onBillingChange: (billing: BillingDraft) => void;
  onOpenPricing: () => void;
}) {
  if (status === null) return <p className="text-sm text-muted-foreground">Loading...</p>;

  const needsBilling = boostNeedsBilling(selected, status);
  const set = (key: keyof BillingDraft, value: string) => onBillingChange({ ...billing, [key]: value });
  const inputClass = "rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground";

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {status.pricing.map((option) => {
          const isChecked = selected === option.option;
          const freeForThisOne = option.option === "FEATURED_7" && status.freeBoostsRemaining > 0;
          const style = OPTION_STYLE[option.option];
          return (
            <button
              key={option.option}
              type="button"
              aria-pressed={isChecked}
              onClick={() => onSelect(isChecked ? null : option.option)}
              className={`flex flex-col gap-2 rounded-xl p-4 text-left transition ${isChecked ? style.picked : style.idle}`}
            >
              <p className="text-sm text-foreground">{OPTION_COPY[option.option]}</p>
              <p className="mt-auto text-lg font-bold text-foreground">
                {freeForThisOne ? "Free" : `${formatTry(option.priceTry)} ₺`}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-lg border border-border p-3 text-sm">
        {status.tierKey === "free" ? (
          <p className="text-muted-foreground">
            Free Membership —{" "}
            <button type="button" onClick={onOpenPricing} className="font-bold text-brand-600 hover:underline dark:text-brand-400">
              Upgrade your membership to get boosts monthly for free !
            </button>
          </p>
        ) : (
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">{status.freeBoostsRemaining}</span> free 7-day boost
            {status.freeBoostsRemaining === 1 ? "" : "s"} remaining this month on your{" "}
            {status.tierKey[0].toUpperCase() + status.tierKey.slice(1)} membership.
          </p>
        )}
      </div>

      {needsBilling && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-muted-foreground">Billing details, for payment and invoicing.</p>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="First name" value={billing.buyerName} onChange={(e) => set("buyerName", e.target.value)} className={inputClass} />
            <input placeholder="Last name" value={billing.buyerSurname} onChange={(e) => set("buyerSurname", e.target.value)} className={inputClass} />
            <input
              placeholder="T.C. Kimlik No / Tax ID (11 digits)"
              value={billing.buyerIdentityNumber}
              onChange={(e) => set("buyerIdentityNumber", e.target.value)}
              className={`col-span-2 ${inputClass}`}
            />
            <input
              placeholder="Billing email"
              value={billing.buyerEmail}
              onChange={(e) => set("buyerEmail", e.target.value)}
              className={`col-span-2 ${inputClass}`}
            />
            <input
              placeholder="Phone (optional)"
              value={billing.buyerGsmNumber}
              onChange={(e) => set("buyerGsmNumber", e.target.value)}
              className={`col-span-2 ${inputClass}`}
            />
            <input placeholder="City" value={billing.city} onChange={(e) => set("city", e.target.value)} className={inputClass} />
            <input placeholder="Billing address" value={billing.address} onChange={(e) => set("address", e.target.value)} className={inputClass} />
          </div>
        </div>
      )}
    </>
  );
}

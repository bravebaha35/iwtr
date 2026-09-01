"use client";

import { useEffect, useState } from "react";
import type {
  BoostDurationDays,
  CreateJobPostingInput,
  CreateJobPostingResult,
  JobPostingBoostStatus,
  OwnedCompany,
} from "@iwtr/shared-types";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { IyzicoCheckoutEmbed } from "@/components/IyzicoCheckoutEmbed";
import { PricingComparisonTable } from "@/components/PricingComparisonTable";
import type { JobSetupData } from "@/components/jobs/JobSetupModal";

const emptyBilling = {
  buyerName: "",
  buyerSurname: "",
  buyerIdentityNumber: "",
  buyerEmail: "",
  buyerGsmNumber: "",
  city: "",
  address: "",
};

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  );
}

const DURATION_COPY: Record<BoostDurationDays, string> = {
  7: "Get hired faster. Boost your job posting for 7 days.",
  14: "Dominate the market. Boost your job posting for 14 days.",
  21: "Maximum visibility. Boost your job posting for 21 days.",
};

/**
 * Job Creation Flow, Modal 2 ("Boosts"): 3 duration boxes, a free-boosts-
 * remaining line driven by the owner's Rival Analytics tier (reused as the
 * membership-tier signal — see decideBoostAccess.ts), and the same iyzico
 * one-time-checkout flow RivalAnalyticsRequestModal already uses for a paid
 * boost. Only the 7-day box can ever be free (spec: "Starter = 1 '7-days'
 * boost") — 14/21-day boosts always require payment.
 */
export function JobBoostModal({
  company,
  setupData,
  onClose,
  onDone,
}: {
  company: OwnedCompany;
  setupData: JobSetupData;
  onClose: () => void;
  onDone: (result: CreateJobPostingResult) => void;
}) {
  const [status, setStatus] = useState<JobPostingBoostStatus | null>(null);
  const [selected, setSelected] = useState<BoostDurationDays | null>(null);
  const [billing, setBilling] = useState(emptyBilling);
  const [showPricing, setShowPricing] = useState(false);
  const [result, setResult] = useState<CreateJobPostingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiGet<JobPostingBoostStatus>(`/my-companies/${company.companyId}/job-postings/boost-status`)
      .then(setStatus)
      .catch(() => setStatus({ tierKey: "free", freeBoostsRemaining: 0, pricing: [] }));
  }, [company.companyId]);

  const isFreeSelected = selected === 7 && (status?.freeBoostsRemaining ?? 0) > 0;
  const needsBilling = selected !== null && !isFreeSelected;

  function set<K extends keyof typeof emptyBilling>(key: K, value: string) {
    setBilling((b) => ({ ...b, [key]: value }));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const boost: CreateJobPostingInput["boost"] = selected
        ? {
            durationDays: selected,
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
          }
        : null;
      const body: CreateJobPostingInput = { jobTitle: setupData.jobTitle, description: setupData.description, boost };
      const data = await apiPost<CreateJobPostingResult>(`/my-companies/${company.companyId}/job-postings`, body);
      if (data.status === "CHECKOUT_REQUIRED") {
        setResult(data);
      } else {
        onDone(data);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create this job posting.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result?.status === "CHECKOUT_REQUIRED") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
        <div className="relative w-full max-w-lg rounded-xl bg-surface p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <CloseButton onClose={onClose} />
          <h2 className="mb-2 text-lg font-bold text-foreground">Complete payment</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Your job posting is created — it goes live as soon as payment succeeds.
          </p>
          <IyzicoCheckoutEmbed checkoutFormContent={result.checkoutFormContent} />
          <button
            type="button"
            onClick={() => onDone(result)}
            className="mt-4 w-full rounded-lg border border-border py-2 text-sm text-foreground hover:bg-surface-muted"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="relative w-full max-w-2xl rounded-xl bg-surface p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <CloseButton onClose={onClose} />
        <h2 className="mb-1 text-xl font-bold text-foreground">Boost your posting?</h2>
        <p className="mb-6 text-sm text-muted-foreground">Step 2 of 2 — optional, get seen by more people.</p>

        {status === null ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {status.pricing.map((option) => {
                const isChecked = selected === option.durationDays;
                const freeForThisOne = option.durationDays === 7 && status.freeBoostsRemaining > 0;
                return (
                  <button
                    key={option.durationDays}
                    type="button"
                    onClick={() => setSelected((v) => (v === option.durationDays ? null : option.durationDays))}
                    className={`flex flex-col gap-2 rounded-xl border-2 p-4 text-left transition ${
                      isChecked
                        ? "border-brand-600 dark:border-brand-400"
                        : "border-border hover:border-brand-300 dark:hover:border-brand-700"
                    }`}
                  >
                    <p className="text-sm text-foreground">{DURATION_COPY[option.durationDays]}</p>
                    <p className="mt-auto text-lg font-bold text-foreground">
                      {freeForThisOne ? "Free" : `${option.priceTry} ₺`}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-lg border border-border p-3 text-sm">
              {status.tierKey === "free" ? (
                <p className="text-muted-foreground">
                  Free Membership —{" "}
                  <button
                    type="button"
                    onClick={() => setShowPricing(true)}
                    className="font-bold text-brand-600 hover:underline dark:text-brand-400"
                  >
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
                  <input
                    placeholder="First name"
                    value={billing.buyerName}
                    onChange={(e) => set("buyerName", e.target.value)}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                  />
                  <input
                    placeholder="Last name"
                    value={billing.buyerSurname}
                    onChange={(e) => set("buyerSurname", e.target.value)}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                  />
                  <input
                    placeholder="T.C. Kimlik No / Tax ID (11 digits)"
                    value={billing.buyerIdentityNumber}
                    onChange={(e) => set("buyerIdentityNumber", e.target.value)}
                    className="col-span-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                  />
                  <input
                    placeholder="Billing email"
                    value={billing.buyerEmail}
                    onChange={(e) => set("buyerEmail", e.target.value)}
                    className="col-span-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                  />
                  <input
                    placeholder="Phone (optional)"
                    value={billing.buyerGsmNumber}
                    onChange={(e) => set("buyerGsmNumber", e.target.value)}
                    className="col-span-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                  />
                  <input
                    placeholder="City"
                    value={billing.city}
                    onChange={(e) => set("city", e.target.value)}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                  />
                  <input
                    placeholder="Billing address"
                    value={billing.address}
                    onChange={(e) => set("address", e.target.value)}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                  />
                </div>
              </div>
            )}

            {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="mt-6 w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting ? "Please wait..." : selected ? "Finish" : "Continue without boost"}
            </button>
          </>
        )}

        {showPricing && <PricingComparisonTable onClose={() => setShowPricing(false)} />}
      </div>
    </div>
  );
}

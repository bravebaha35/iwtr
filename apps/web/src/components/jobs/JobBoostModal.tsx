"use client";

import { useState } from "react";
import type { BoostOption, CreateJobPostingInput, CreateJobPostingResult, OwnedCompany } from "@iwtr/shared-types";
import { apiPost, ApiError } from "@/lib/api-client";
import { IyzicoCheckoutEmbed } from "@/components/IyzicoCheckoutEmbed";
import { PricingComparisonTable } from "@/components/PricingComparisonTable";
import type { JobSetupData } from "@/components/jobs/JobSetupModal";
import { BoostPicker, boostInput, boostNeedsBilling, emptyBilling, useBoostStatus } from "@/components/jobs/BoostPicker";

export function CloseButton({ onClose }: { onClose: () => void }) {
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

/**
 * Job Creation Flow, Modal 2 ("Boosts"): the shared BoostPicker (durations,
 * free boosts left on the plan, billing for a paid one), the Fair Hiring
 * Rules agreement, and iyzico's hosted checkout when the boost is paid.
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
  const status = useBoostStatus(company.companyId);
  const [selected, setSelected] = useState<BoostOption | null>(null);
  const [billing, setBilling] = useState(emptyBilling);
  const [showPricing, setShowPricing] = useState(false);
  const [result, setResult] = useState<CreateJobPostingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);
  const [autoReshareEnabled, setAutoReshareEnabled] = useState(false);

  const needsBilling = boostNeedsBilling(selected, status);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const boost = boostInput(selected, needsBilling, billing);
      const body: CreateJobPostingInput = {
        jobTitle: setupData.jobTitle,
        description: setupData.description,
        workType: setupData.workType,
        positions: setupData.positions,
        autoReshareEnabled,
        boost,
      };
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
            Your job posting is created — the boost starts as soon as payment succeeds.
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
            <BoostPicker
              status={status}
              selected={selected}
              onSelect={setSelected}
              billing={billing}
              onBillingChange={setBilling}
              onOpenPricing={() => setShowPricing(true)}
            />

            {error && <p className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p>}

            <label className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={disclaimerChecked}
                onChange={(e) => setDisclaimerChecked(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                By publishing this job, you accept our Fair Hiring Rules. To prevent job-board spamming and protect
                workers from high-turnover roles, posting the exact same position and work-type repeatedly will
                increase your company&apos;s public &apos;Risk Score&apos; up to a maximum of 3. This score is
                visible to all workers. You cannot simply post and delete jobs to manipulate the system.
                Furthermore, all worker applications are anonymous by default; we prioritize direct, bias-free
                contact by providing only candidate emails and phone numbers.
              </span>
            </label>

            <label className="mt-2 flex items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={autoReshareEnabled}
                onChange={(e) => setAutoReshareEnabled(e.target.checked)}
              />
              Re-share automatically after 30 days
            </label>

            <button
              type="button"
              onClick={submit}
              disabled={submitting || !disclaimerChecked}
              className="mt-4 w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
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

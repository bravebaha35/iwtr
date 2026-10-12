"use client";

import { useState } from "react";
import {
  JOB_DESCRIPTION_MAX_LENGTH,
  type BoostOption,
  type OwnerJobPosting,
  type UpdateJobPostingInput,
  type UpdateJobPostingResult,
} from "@iwtr/shared-types";
import { apiPatch, ApiError } from "@/lib/api-client";
import { IyzicoCheckoutEmbed } from "@/components/IyzicoCheckoutEmbed";
import { PricingComparisonTable } from "@/components/PricingComparisonTable";
import { BoostPicker, boostInput, boostNeedsBilling, emptyBilling, useBoostStatus } from "@/components/jobs/BoostPicker";
import { CloseButton } from "@/components/jobs/JobBoostModal";
import { BulletTextarea } from "@/components/BulletTextarea";

const DESCRIPTION_MAX = JOB_DESCRIPTION_MAX_LENGTH;

export function isBoostActive(posting: Pick<OwnerJobPosting, "boostExpiresAt">): boolean {
  return !!posting.boostExpiresAt && new Date(posting.boostExpiresAt).getTime() > Date.now();
}

/**
 * The dashboard's Edit on an active job posting. The job title (what the
 * company is looking for, e.g. "Forklift Operatörü") is fixed once posted;
 * only the description can change, and a boost can be added if the posting
 * isn't already boosted. Saving a changed description re-runs the same
 * checks as a new posting.
 */
export function EditJobPostingModal({
  companyId,
  posting,
  onClose,
  onSaved,
}: {
  companyId: string;
  posting: OwnerJobPosting;
  onClose: () => void;
  onSaved: () => void;
}) {
  const boosted = isBoostActive(posting);
  const status = useBoostStatus(companyId);
  const [description, setDescription] = useState(posting.description);
  const [selected, setSelected] = useState<BoostOption | null>(null);
  const [billing, setBilling] = useState(emptyBilling);
  const [showPricing, setShowPricing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UpdateJobPostingResult | null>(null);

  const descriptionChanged = description.trim() !== posting.description.trim();
  const needsBilling = boostNeedsBilling(selected, status);
  const canSave = !submitting && description.trim().length > 0 && (descriptionChanged || selected !== null);

  async function save() {
    setSubmitting(true);
    setError(null);
    try {
      const body: UpdateJobPostingInput = {
        ...(descriptionChanged ? { description: description.trim() } : {}),
        ...(selected ? { boost: boostInput(selected, needsBilling, billing) } : {}),
      };
      const data = await apiPatch<UpdateJobPostingResult>(`/my-companies/${companyId}/job-postings/${posting.id}`, body);
      setResult(data);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your changes.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`Edit ${posting.jobTitle}`}
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-surface p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CloseButton onClose={onClose} />

        {result?.status === "CHECKOUT_REQUIRED" ? (
          <>
            <h2 className="mb-2 text-lg font-bold text-foreground">Complete payment</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Your changes are saved — the boost starts as soon as payment succeeds.
            </p>
            <IyzicoCheckoutEmbed checkoutFormContent={result.checkoutFormContent} />
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-lg border border-border py-2 text-sm text-foreground hover:bg-surface-muted"
            >
              Done
            </button>
          </>
        ) : result ? (
          <>
            <h2 className="mb-2 text-lg font-bold text-foreground">
              {result.status === "PENDING_ADMIN" ? "Sent for a quick check" : "Changes saved"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {result.status === "PENDING_ADMIN"
                ? "The new description needs a quick admin check, so this posting is off the Jobs page until it's approved. You'll get a notification."
                : isBoostActive(result.jobPosting)
                  ? "Your posting is now featured at the top of the Jobs page."
                  : "Job-seekers see the updated posting on the Jobs page now."}
            </p>
            {result.boostError && (
              <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                {result.boostError}
              </p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Close
            </button>
          </>
        ) : (
          <>
            <h2 className="mb-5 text-xl font-bold text-foreground">Edit job posting</h2>

            <p className="mb-1 text-[13px] font-semibold text-foreground">Looking for</p>
            <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted px-3 py-2">
              <span className="font-semibold text-foreground">{posting.jobTitle}</span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
                Can&apos;t be changed
              </span>
            </div>

            <label htmlFor="edit-job-description" className="mb-1 block text-[13px] font-semibold text-foreground">
              Description
            </label>
            <BulletTextarea
              id="edit-job-description"
              value={description}
              maxLength={DESCRIPTION_MAX}
              onChange={setDescription}
              className="h-56"
            />
            <p className="mb-5 text-right text-xs text-muted-foreground">
              {description.length}/{DESCRIPTION_MAX}
            </p>

            <p className="mb-2 text-[13px] font-semibold text-foreground">Boost</p>
            {boosted ? (
              <p className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                {posting.boostAdSpace
                  ? "In the employer ad space (Rating and Jobs pages) until"
                  : "Featured on the Jobs page until"}{" "}
                {new Date(posting.boostExpiresAt!).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.
              </p>
            ) : (
              <BoostPicker
                status={status}
                selected={selected}
                onSelect={setSelected}
                billing={billing}
                onBillingChange={setBilling}
                onOpenPricing={() => setShowPricing(true)}
              />
            )}

            {error && <p className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p>}

            <button
              type="button"
              onClick={() => void save()}
              disabled={!canSave}
              className="mt-5 w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting ? "Saving..." : selected ? "Save and boost" : "Save changes"}
            </button>
          </>
        )}

        {showPricing && <PricingComparisonTable onClose={() => setShowPricing(false)} />}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { apiPost, ApiError } from "@/lib/api-client";

export function RemoveJobPostingModal({
  companyId,
  jobPostingId,
  jobTitle,
  daysRemaining,
  onClose,
  onRemoved,
}: {
  companyId: string;
  jobPostingId: string;
  jobTitle: string;
  daysRemaining: number;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmFilled() {
    setSubmitting(true);
    setError(null);
    try {
      await apiPost(`/my-companies/${companyId}/job-postings/${jobPostingId}/mark-filled`, {});
      onRemoved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove this posting.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Remove posting: ${jobTitle}`}
        className="w-full max-w-sm rounded-xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-sm font-semibold text-foreground">Are you sure you want to remove this post ?</h3>
        <p className="mb-4 text-xs text-muted-foreground">{jobTitle}</p>
        {error && <p className="mb-3 text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={confirmFilled}
            disabled={submitting}
            className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            Yes, already hired someone.
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            No, I will wait until my post expires ({daysRemaining} days left)
          </button>
        </div>
      </div>
    </div>
  );
}

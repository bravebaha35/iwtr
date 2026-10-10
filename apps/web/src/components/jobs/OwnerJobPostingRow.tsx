"use client";

import { useState } from "react";
import type { OwnerJobPosting } from "@iwtr/shared-types";
import { RemoveJobPostingModal } from "@/components/jobs/RemoveJobPostingModal";
import { EditJobPostingModal, isBoostActive } from "@/components/jobs/EditJobPostingModal";

// Plain words for the owner - no internal status names.
const STATUS_LABEL: Record<OwnerJobPosting["status"], string> = {
  PUBLISHED: "Live on the Jobs page",
  PENDING_ADMIN: "Waiting for our team to approve it",
  REJECTED: "Not approved by our team",
  FILLED: "Position filled",
};

/** Live on the Jobs page right now (anything else is inactive). */
export function isActivePosting(posting: OwnerJobPosting): boolean {
  return posting.status === "PUBLISHED" && posting.daysRemaining > 0;
}

// Owner-oriented, not the public JobCard — an owner looking at their own
// listing has no use for JobCard's "contact this company" framing, so this
// is a distinct, simpler row rather than forcing JobCard to serve two
// purposes (per the frontend spec's own section 3).
export function OwnerJobPostingRow({
  companyId,
  posting,
  onChanged,
}: {
  companyId: string;
  posting: OwnerJobPosting;
  onChanged: () => void;
}) {
  const [removing, setRemoving] = useState(false);
  const [editing, setEditing] = useState(false);
  const active = isActivePosting(posting);
  const featured = active && isBoostActive(posting);

  return (
    <div className={`flex flex-col gap-2 rounded-xl border bg-surface p-4 ${featured ? "border-amber-400" : "border-border"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{posting.jobTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {STATUS_LABEL[posting.status]}
            {posting.status === "PUBLISHED"
              ? ` — ${posting.daysRemaining} day${posting.daysRemaining === 1 ? "" : "s"} left`
              : ""}
          </p>
          {featured && (
            <p className="mt-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
              Featured until{" "}
              {new Date(posting.boostExpiresAt!).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {active && (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setRemoving(true)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
              >
                Remove
              </button>
            </>
          )}
          <span
            role="img"
            aria-label={active ? "Active" : "Inactive"}
            title={active ? "Active - live on the Jobs page" : "Inactive - not on the Jobs page"}
            className={`h-3 w-3 rounded-full ${active ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.7)]" : "bg-red-500"}`}
          />
        </div>
      </div>
      {posting.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{posting.description}</p>}
      {removing && (
        <RemoveJobPostingModal
          companyId={companyId}
          jobPostingId={posting.id}
          jobTitle={posting.jobTitle}
          daysRemaining={posting.daysRemaining}
          onClose={() => setRemoving(false)}
          onRemoved={() => {
            setRemoving(false);
            onChanged();
          }}
        />
      )}
      {editing && (
        <EditJobPostingModal
          companyId={companyId}
          posting={posting}
          onClose={() => setEditing(false)}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}

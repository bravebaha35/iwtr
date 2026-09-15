"use client";

import { useState } from "react";
import type { OwnerJobPosting } from "@iwtr/shared-types";
import { RemoveJobPostingModal } from "@/components/jobs/RemoveJobPostingModal";

const STATUS_LABEL: Record<OwnerJobPosting["status"], string> = {
  PUBLISHED: "Live",
  PENDING_ADMIN: "Awaiting admin review",
  REJECTED: "Rejected",
  FILLED: "Filled",
};

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

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{posting.jobTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {STATUS_LABEL[posting.status]}
            {posting.status === "PUBLISHED"
              ? ` — ${posting.daysRemaining} day${posting.daysRemaining === 1 ? "" : "s"} left`
              : ""}
          </p>
        </div>
        {posting.status === "PUBLISHED" && (
          <button
            type="button"
            onClick={() => setRemoving(true)}
            className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
          >
            Remove
          </button>
        )}
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
    </div>
  );
}

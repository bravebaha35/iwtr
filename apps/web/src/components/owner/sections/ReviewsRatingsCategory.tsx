"use client";

import { useCallback, useEffect, useState } from "react";
import type { CompanyDetail, ReplyAllowance, WorkplaceType } from "@iwtr/shared-types";
import { scoreBandLabel } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { ReviewsList } from "@/components/ReviewsList";

function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}

// How many public replies are left this month on the owner's plan.
function MonthlyReplies({ allowance }: { allowance: ReplyAllowance | null }) {
  if (!allowance) return null;
  const unlimited = allowance.limit === null;
  const used = allowance.usedThisMonth;
  const fraction = unlimited ? 0 : Math.min(1, used / Math.max(1, allowance.limit ?? 1));
  return (
    <section aria-label="Monthly comment responses" className="mb-6 rounded-lg border border-border p-4">
      <h4 className="mb-1 text-sm font-semibold text-foreground">Monthly comment responses</h4>
      {unlimited ? (
        <p className="text-sm text-muted-foreground">
          Your plan includes unlimited replies. You&apos;ve replied to {used} review{used === 1 ? "" : "s"} this month.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              {allowance.remaining} of {allowance.limit} replies left
            </span>{" "}
            this month on your plan. The count starts over on {formatDay(allowance.resetsOn)}. Editing a reply you
            already posted doesn&apos;t use one up.
          </p>
          <div className="mt-2 h-2 w-full max-w-md overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${fraction * 100}%` }} />
          </div>
        </>
      )}
    </section>
  );
}

export function ReviewsRatingsCategory({
  companyId,
  companySlug,
  companyName,
  detail,
}: {
  companyId: string;
  companySlug: string;
  companyName: string;
  detail: CompanyDetail | null;
  workplaceTypes?: WorkplaceType[];
}) {
  const aggregate = detail?.aggregate;
  const [allowance, setAllowance] = useState<ReplyAllowance | null>(null);

  const loadAllowance = useCallback(() => {
    apiGet<ReplyAllowance>(`/my-companies/${companyId}/reply-allowance`)
      .then((a) => setAllowance(a ?? null))
      .catch(() => setAllowance(null));
  }, [companyId]);

  useEffect(() => {
    loadAllowance();
  }, [loadAllowance]);

  return (
    <div className="rounded-xl border border-border p-6">
      <h3 className="mb-4 font-semibold text-foreground">Ratings</h3>

      {aggregate && aggregate.reviewCount > 0 ? (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: "Overall", value: aggregate.overallAvg },
            { label: "Culture", value: aggregate.corporateCultureAvg },
            { label: "Leadership", value: aggregate.leadershipAvg },
            { label: "Infrastructure", value: aggregate.infrastructureAvg },
            { label: "Work/Life", value: aggregate.workLifeBalanceAvg },
          ].map((row) => (
            <div key={row.label} className="rounded-lg border border-border p-3 text-center">
              <p className="font-grotesk text-lg font-bold tabular-nums text-foreground">{row.value.toFixed(1)}</p>
              <p className="text-[11px] text-muted-foreground">{row.label}</p>
            </div>
          ))}
          <p className="col-span-2 self-center text-sm text-muted-foreground sm:col-span-5">
            {scoreBandLabel(aggregate.overallAvg)} · {aggregate.reviewCount} review
            {aggregate.reviewCount === 1 ? "" : "s"}
          </p>
        </div>
      ) : (
        <p className="mb-6 text-sm text-muted-foreground">No reviews yet.</p>
      )}

      <MonthlyReplies allowance={allowance} />

      <div className="max-h-[32rem] overflow-y-auto thin-scrollbar">
        <ReviewsList
          companySlug={companySlug}
          workplaceTypes={detail?.company.workplaceTypes}
          companyName={companyName}
          featuredReviewId={detail?.company.featuredReviewId ?? null}
          canReply
          onReplyPosted={loadAllowance}
        />
      </div>
    </div>
  );
}

"use client";

import type { CompanyDetail, WorkplaceType } from "@iwtr/shared-types";
import { scoreBandLabel } from "@iwtr/shared-types";
import { ReviewsList } from "@/components/ReviewsList";

export function ReviewsRatingsCategory({
  companySlug,
  companyName,
  detail,
}: {
  companySlug: string;
  companyName: string;
  detail: CompanyDetail | null;
  workplaceTypes?: WorkplaceType[];
}) {
  const aggregate = detail?.aggregate;
  return (
    <div className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
      <h3 className="mb-4 font-semibold text-foreground">Reviews & Ratings</h3>

      {aggregate && aggregate.reviewCount > 0 ? (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: "Overall", value: aggregate.overallAvg },
            { label: "Culture", value: aggregate.corporateCultureAvg },
            { label: "Leadership", value: aggregate.leadershipAvg },
            { label: "Infrastructure", value: aggregate.infrastructureAvg },
            { label: "Work/Life", value: aggregate.workLifeBalanceAvg },
          ].map((row) => (
            <div key={row.label} className="rounded-lg border border-border p-3 text-center">
              <p className="text-lg font-bold text-foreground">{row.value.toFixed(1)}</p>
              <p className="text-[11px] text-muted-foreground">{row.label}</p>
            </div>
          ))}
          <p className="col-span-2 self-center text-sm text-muted-foreground sm:col-span-5">
            {scoreBandLabel(aggregate.overallAvg)} · {aggregate.reviewCount} review
            {aggregate.reviewCount === 1 ? "" : "s"}
          </p>
        </div>
      ) : (
        <p className="mb-4 text-sm text-muted-foreground">No reviews yet.</p>
      )}

      <div className="max-h-[32rem] overflow-y-auto thin-scrollbar">
        <ReviewsList companySlug={companySlug} workplaceTypes={detail?.company.workplaceTypes} companyName={companyName} canReply />
      </div>
    </div>
  );
}

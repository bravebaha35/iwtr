"use client";

import type { OwnedCompany } from "@iwtr/shared-types";
import { SOCIAL_SCHEDULED_POST_LIMITS } from "@iwtr/shared-types";
import { SocialInsightsPanel } from "./SocialInsightsPanel";
import { ScheduledPostsPanel } from "./ScheduledPostsPanel";

/**
 * The owner dashboard's Post Scheduling section: how the company's posts are
 * doing (Insights) and the posts waiting to go out (Scheduled posts). Both
 * come with the Starter, Pro and Enterprise plans; on Free (or a lapsed paid
 * plan) the section is one note pointing at the plans. The shared company
 * login sees both, but only the owner's own account schedules, moves,
 * publishes or deletes.
 */
export function SocialToolsCategory({
  company,
  onOpenPricing,
  readOnly = false,
}: {
  company: OwnedCompany;
  onOpenPricing: () => void;
  readOnly?: boolean;
}) {
  const tier = company.planStatus === "ACTIVE" ? company.tier : "FREE";
  if (SOCIAL_SCHEDULED_POST_LIMITS[tier] === 0) {
    return (
      <div className="rounded-2xl bg-surface p-7 shadow-xs">
        <h3 className="font-semibold text-foreground">Post Scheduling</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Write IWT Social posts now and have them go out later, and see how your posts are doing: followers, views,
          reactions and comments over time.
        </p>
        <p className="mt-4 text-sm text-foreground">
          Post Scheduling comes with the Starter, Pro and Enterprise plans.{" "}
          <button type="button" onClick={onOpenPricing} className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
            Compare plans
          </button>
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <SocialInsightsPanel companyId={company.companyId} companyName={company.companyName} onOpenPricing={onOpenPricing} />
      <ScheduledPostsPanel company={company} onOpenPricing={onOpenPricing} readOnly={readOnly} />
    </div>
  );
}

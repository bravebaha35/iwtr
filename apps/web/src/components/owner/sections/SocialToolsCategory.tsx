"use client";

import type { OwnedCompany } from "@iwtr/shared-types";
import { SocialInsightsPanel } from "./SocialInsightsPanel";
import { ScheduledPostsPanel } from "./ScheduledPostsPanel";

/**
 * The owner dashboard's IWT Social section: how the company's posts are
 * doing (Insights) and the posts waiting to go out (Scheduled posts). For the
 * owner's own account only - like the rest of IWT Social it is not opened to
 * the shared company login.
 */
export function SocialToolsCategory({ company, onOpenPricing }: { company: OwnedCompany; onOpenPricing: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <SocialInsightsPanel companyId={company.companyId} companyName={company.companyName} onOpenPricing={onOpenPricing} />
      <ScheduledPostsPanel company={company} onOpenPricing={onOpenPricing} />
    </div>
  );
}

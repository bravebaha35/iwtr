import Link from "next/link";
import { scoreBandLabel, type OwnerTier, type WorkplaceType } from "@iwtr/shared-types";
import { scoreTextColor } from "@/lib/scoreBandColors";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";
import { badgeLabelForOwnerTier } from "@/lib/pricingTiers";
import { CompanyLogo } from "@/components/CompanyLogo";

const BADGE_TIER_CLASSES: Record<string, string> = {
  Blue: "text-blue-600 dark:text-blue-400",
  "Blue+": "text-blue-600 dark:text-blue-400",
  Gold: "text-amber-600 dark:text-amber-400",
};

export interface CompanyWorkCardData {
  name: string;
  mainPhotoUrl: string | null;
  workplaceTypes: WorkplaceType[];
  category: string;
  city: string | null;
  district: string | null;
  isHiring: boolean;
  badgeTier: OwnerTier;
  overallAvg: number | null;
  reviewCount: number;
}

/**
 * The one "Rating / Overview" page card layout (originally WorkplaceBrowser's
 * inline CompanyCard) — extracted so the owner dashboard's live preview can
 * render the *exact* same component real visitors see, rather than a
 * look-alike copy that could quietly drift. `href` makes it a real link on
 * the browse grid; omitted entirely for the dashboard's non-navigating
 * live-preview use.
 */
export function CompanyWorkCard({ company, href }: { company: CompanyWorkCardData; href?: string }) {
  const badgeLabel = badgeLabelForOwnerTier(company.badgeTier);

  const content = (
    <>
      <div className="flex items-center gap-3">
        <CompanyLogo name={company.name} mainPhotoUrl={company.mainPhotoUrl} size="md" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-semibold leading-snug text-foreground">{company.name}</p>
          {badgeLabel && (
            <span
              className={`mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium ${BADGE_TIER_CLASSES[badgeLabel] ?? "text-brand-600 dark:text-brand-400"}`}
            >
              ✓ {badgeLabel}
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {company.workplaceTypes.map(workplaceTypeLabel).join(" / ")} · {company.category}
      </p>
      {(company.city || company.district) && (
        <p className="truncate text-xs text-muted-foreground">
          {company.district ? `${company.district}, ` : ""}
          {company.city}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-2">
        {company.overallAvg !== null ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold text-foreground">{company.overallAvg.toFixed(1)}</span>
              <span className={`text-xs font-medium ${scoreTextColor(company.overallAvg)}`}>
                {scoreBandLabel(company.overallAvg)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {company.isHiring && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
                  Hiring now
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {company.reviewCount} review{company.reviewCount === 1 ? "" : "s"}
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            {company.isHiring && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
                Hiring now
              </span>
            )}
            <p className="text-xs text-muted-foreground">No reviews yet</p>
          </div>
        )}
      </div>
    </>
  );

  const className =
    "flex h-[196px] w-full max-w-[280px] flex-col gap-2 rounded-xl border border-border bg-surface p-4 transition";

  if (href) {
    return (
      <Link href={href} className={`${className} hover:border-brand-300 hover:shadow-md dark:hover:border-brand-700`}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}

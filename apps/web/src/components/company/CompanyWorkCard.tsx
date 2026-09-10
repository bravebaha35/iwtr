"use client";

import Link from "next/link";
import { scoreBandLabel, type OwnerTier, type WorkplaceType } from "@iwtr/shared-types";
import { scoreTextColor } from "@/lib/scoreBandColors";
import { WorkTypeLabel } from "@/components/WorkTypeLabel";
import { canUseBanner } from "@/lib/pricingTiers";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CompanyVerificationTick } from "@/components/CompanyVerificationTick";

export interface CompanyWorkCardData {
  name: string;
  mainPhotoUrl: string | null;
  workplaceTypes: WorkplaceType[];
  category: string;
  city: string | null;
  district: string | null;
  isHiring: boolean;
  badgeTier: OwnerTier;
  bannerImageUrl: string | null;
  // Always set (see companySchema) — the system default keyed on the primary
  // work-type, shown whenever the company has no custom bannerImageUrl.
  defaultBannerUrl: string;
  // Whether the company has an approved owner: drives the claimed check-mark
  // and whether a default banner shows in colour or greyscale.
  hasApprovedOwner: boolean;
  overallAvg: number | null;
  reviewCount: number;
}

/**
 * The one "Rating / Overview" page card layout (originally WorkplaceBrowser's
 * inline CompanyCard) — extracted so the owner dashboard's live preview can
 * render the *exact* same component real visitors see, rather than a
 * look-alike copy that could quietly drift. `href` makes it a real link on
 * the browse grid; omitted entirely for the dashboard's non-navigating
 * live-preview use. Carries no width class of its own (matches the original
 * pre-extraction card) — sizing comes entirely from whatever renders it: a
 * browse-grid cell, or a fixed-width wrapper around the dashboard preview.
 */
export function CompanyWorkCard({ company, href }: { company: CompanyWorkCardData; href?: string }) {
  // Every card shows a banner: the owner's own image when their tier
  // includes custom banners and one is set, otherwise the system default
  // keyed on the primary work-type (company.defaultBannerUrl).
  const hasCustomBanner = canUseBanner(company.badgeTier) && !!company.bannerImageUrl;
  const bannerUrl = hasCustomBanner ? company.bannerImageUrl! : company.defaultBannerUrl;
  // Greyscale the default banner until the company has been claimed.
  const bannerIsGreyscale = !hasCustomBanner && !company.hasApprovedOwner;

  const content = (
    <>
      {/* Facebook-style cover-photo layout: the banner bleeds to the card's
          outer edges (negative margin cancels the card's own p-4) and the
          logo overlaps its bottom-left corner by half its own height
          (top-full + -translate-y-1/2, anchored against this *relative*
          wrapper) — mb-6 reserves room below the banner for the half of the
          logo that hangs past it, so the name row below never collides with
          it. 4:1 keeps the strip short relative to the rest of the card. */}
      <div className="relative -mx-4 -mt-4 mb-6 w-[calc(100%+2rem)]">
        <div className="aspect-[4/1] w-full overflow-hidden rounded-t-xl">
          {/* eslint-disable-next-line @next/next/no-img-element -- a small fixed set of local /public default banners, or an owner-submitted URL */}
          <img
            src={bannerUrl}
            alt=""
            className={`h-full w-full object-cover ${bannerIsGreyscale ? "grayscale" : ""}`}
          />
        </div>
        <div className="absolute left-4 top-full -translate-y-1/2">
          <CompanyLogo name={company.name} mainPhotoUrl={company.mainPhotoUrl} size="md" />
        </div>
      </div>

      {/* The logo already sits above, overlapping the banner's bottom-left
          corner, so this row is just the name + verification tick. */}
      <p className="line-clamp-2 min-w-0 font-semibold leading-snug text-foreground">
        {company.name}
        <CompanyVerificationTick
          badgeTier={company.badgeTier}
          claimed={company.hasApprovedOwner}
          size={15}
          className="ml-1.5"
        />
      </p>

      <p className="text-xs text-muted-foreground">
        <WorkTypeLabel workplaceTypes={company.workplaceTypes} /> · {company.category}
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

  // min-h (not a fixed h) — the standard card body is ~196px, but the banner
  // strip + overlapping logo need room to grow the card taller rather than
  // getting clipped.
  const className = "flex min-h-[196px] flex-col gap-2 rounded-xl border border-border bg-surface p-4 transition";

  if (href) {
    return (
      <Link href={href} className={`${className} hover:border-brand-300 hover:shadow-md dark:hover:border-brand-700`}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}

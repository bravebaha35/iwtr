"use client";

import Link from "next/link";
import Image from "next/image";
import { isOwnStaticAsset } from "@/lib/imageSource";
import { scoreBandLabel, type OwnerTier, type WorkplaceType } from "@iwtr/shared-types";
import { scoreTextColor } from "@/lib/scoreBandColors";
import { WorkTypeLabel } from "@/components/WorkTypeLabel";
import { canUseBanner } from "@/lib/pricingTiers";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CompanyVerificationTick } from "@/components/CompanyVerificationTick";
import { RiskScoreBadge } from "@/components/jobs/RiskScoreBadge";
import { useT } from "@/lib/i18n/client";

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
// riskScore: pass it (a number, or null for "-") to show the short Risk Score word
// badge on the right, level with the logo; leave it out (the owner
// dashboard's live preview) to show no badge.
export function CompanyWorkCard({
  company,
  href,
  riskScore,
}: {
  company: CompanyWorkCardData;
  href?: string;
  riskScore?: number | null;
}) {
  // Every card shows a banner: the owner's own image when their tier
  // includes custom banners and one is set, otherwise the system default
  // keyed on the primary work-type (company.defaultBannerUrl).
  const t = useT();
  const hasCustomBanner = canUseBanner(company.badgeTier) && !!company.bannerImageUrl;
  const bannerUrl = hasCustomBanner ? company.bannerImageUrl! : company.defaultBannerUrl;
  // Greyscale the default banner until the company has been claimed.
  const bannerIsGreyscale = !hasCustomBanner && !company.hasApprovedOwner;

  const content = (
    <>
      {/* Facebook-style cover-photo layout, the same card the Jobs page
          uses: the banner bleeds to the card's outer edges (negative margin
          cancels the card's own p-4) and the logo overlaps its bottom-left
          corner by half its own height (top-full + -translate-y-1/2,
          anchored against this *relative* wrapper) — mb-6 reserves room
          below the banner for the half of the logo that hangs past it, so
          the name row below never collides with it. 4:1 keeps the strip
          short relative to the rest of the card. */}
      <div className="relative -mx-4 -mt-4 mb-6 w-[calc(100%+2rem)]">
        <div className="relative aspect-[4/1] w-full overflow-hidden rounded-t-xl bg-surface-muted">
          <Image
            src={bannerUrl}
            alt=""
            fill
            sizes="(min-width: 3200px) 480px, (min-width: 1280px) 320px, (min-width: 640px) 50vw, 100vw"
            unoptimized={!isOwnStaticAsset(bannerUrl)}
            className={`h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none ${bannerIsGreyscale ? "grayscale" : ""}`}
          />
        </div>
        <div className="absolute left-4 top-full -translate-y-1/2">
          <CompanyLogo name={company.name} mainPhotoUrl={company.mainPhotoUrl} size="md" />
        </div>
        {riskScore !== undefined && (
          <div className="absolute right-4 top-full mt-1.5">
            <RiskScoreBadge riskScore={riskScore} short />
          </div>
        )}
      </div>

      {/* The logo already sits above, overlapping the banner's bottom-left
          corner, so this row is just the name + verification tick. */}
      <h3 className="line-clamp-2 min-w-0 text-[19px] leading-snug text-foreground transition-colors group-hover:text-brand-700 dark:group-hover:text-brand-300">
        {company.name}
        <CompanyVerificationTick
          badgeTier={company.badgeTier}
          claimed={company.hasApprovedOwner}
          size={15}
          className="ml-1.5"
        />
      </h3>

      <p className="text-xs text-muted-foreground">
        <WorkTypeLabel workplaceTypes={company.workplaceTypes} /> · {t(company.category)}
      </p>
      {(company.city || company.district) && (
        <p className="truncate text-xs text-muted-foreground">
          {company.district ? `${company.district}, ` : ""}
          {company.city}
        </p>
      )}

      {/* Wraps onto a second line on narrow cards instead of squeezing the
          words ("Hiring now", "11 reviews") into each other or off the edge. */}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-border/60 pt-2.5">
        {company.overallAvg !== null && company.reviewCount > 0 ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="font-display text-2xl leading-none tabular-nums text-foreground">{company.overallAvg.toFixed(1)}</span>
              <span className={`whitespace-nowrap text-xs font-medium ${scoreTextColor(company.overallAvg)}`}>
                {t(scoreBandLabel(company.overallAvg))}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              {company.isHiring && (
                <span className="whitespace-nowrap rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
                  {t("Hiring now")}
                </span>
              )}
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {t(company.reviewCount === 1 ? "{n} review" : "{n} reviews", { n: company.reviewCount })}
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            {company.isHiring && (
              <span className="whitespace-nowrap rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
                {t("Hiring now")}
              </span>
            )}
            <p className="text-xs text-muted-foreground">{t("No reviews yet")}</p>
          </div>
        )}
      </div>
    </>
  );

  // min-h (not a fixed h) — the standard card body is ~196px, but the banner
  // strip + overlapping logo need room to grow the card taller rather than
  // getting clipped.
  // A soft surface card with no outline, matching JobCard.
  const className = "group flex min-h-[196px] flex-col gap-2 rounded-xl bg-surface p-4 shadow-xs transition";

  if (href) {
    return (
      <Link href={href} className={`${className} hover:shadow-md`}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}

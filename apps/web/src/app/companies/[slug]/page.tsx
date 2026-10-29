import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { isOwnStaticAsset } from "@/lib/imageSource";
import type { CompanyDetail, CompanyNarrative } from "@iwtr/shared-types";
import { scoreBandLabel } from "@iwtr/shared-types";
import { apiGetPublic, ApiError } from "@/lib/api-client";
import { ReviewsList } from "@/components/ReviewsList";
import { CompanyProfileTabs } from "@/components/companies/CompanyProfileTabs";
import { WorkplaceVibeFlags } from "@/components/WorkplaceVibeFlags";
import { OwnerClaimPanel } from "@/components/OwnerClaimPanel";
import { CompanyLogo } from "@/components/CompanyLogo";
import { RateButton } from "@/components/RateButton";
import { AdSlot } from "@/components/AdSlot";
import { scoreBarColor, scoreTextColor } from "@/lib/scoreBandColors";
import { WorkTypeLabel } from "@/components/WorkTypeLabel";
import { RatingIllustration } from "@/components/companies/RatingIllustration";
import { WorkTypeViewProvider } from "@/components/companies/WorkTypeView";
import { getTranslator } from "@/lib/i18n/server";
import type { Locale, TFn } from "@/lib/i18n/core";
import { canUseBanner } from "@/lib/pricingTiers";
import { CompanyVerificationTick } from "@/components/CompanyVerificationTick";
import { RiskScoreBadge } from "@/components/jobs/RiskScoreBadge";
import { CompanyActions } from "@/components/companies/CompanyActions";
import { CompanyDetails } from "@/components/companies/CompanyDetails";

const CATEGORIES = [
  { key: "corporateCultureAvg" as const, label: "Corporate Culture" },
  { key: "leadershipAvg" as const, label: "Leadership & Management" },
  { key: "infrastructureAvg" as const, label: "Infrastructure & Resources" },
  { key: "workLifeBalanceAvg" as const, label: "Work-Life Balance" },
  { key: "stabilityAvg" as const, label: "Organizational Stability" },
];

// Illustration (from the overall score) + a short summary. The summary text
// is whatever GET /companies/:slug/narrative returned: the AI paragraph, a
// plain numbers sentence, or null. When null and there are 1-2 reviews we
// show a "summary appears at 3 reviews" line; with 0 reviews the box is an
// empty fixed-size slot (reserved for future design). It has a fixed `lg:`
// height (set below) so 600 chars of text and the empty state render at the
// same size.
function RatingNarrativeBox({
  score,
  narrative,
  t,
  locale,
}: {
  score: number | null;
  narrative: CompanyNarrative | null;
  t: TFn;
  locale: Locale;
}) {
  // The API writes the Summary in both languages (summary-composer.ts).
  const summary = narrative ? (locale === "tr" ? (narrative.descriptionTr ?? narrative.description) : narrative.description) : null;
  const waitingLine =
    narrative && narrative.description === null && narrative.reviewCount >= 1 && narrative.reviewCount <= 2
      ? t(
          narrative.reviewCount === 1
            ? "{n} review so far - a full summary appears once 3 people have rated this workplace."
            : "{n} reviews so far - a full summary appears once 3 people have rated this workplace.",
          { n: narrative.reviewCount },
        )
      : null;

  return (
    // Height measured live against a 600-char description + the enlarged
    // illustration on desktop (350px) → lg:h-[360px]. Scoped to lg: so the
    // mobile stacked layout flows; the 0-review empty state holds this same
    // slot.
    <div className="flex flex-col items-center gap-6 font-sans sm:flex-row sm:items-center xl:min-h-[360px] xl:min-w-0 xl:max-w-2xl">
      {/* Drawn for the work type picked in WorkTypeViewProvider (below). */}
      <RatingIllustration score={score} />
      {(summary || waitingLine) && (
        <div className="min-w-0 text-center sm:text-left">
          <h2 className="mb-3 text-xl text-foreground">{t("Summary")}</h2>
          {summary ? (
            <p className="text-[15px] leading-relaxed text-foreground">{summary}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{waitingLine}</p>
          )}
        </div>
      )}
    </div>
  );
}

// Per-company title, description and social preview text, so a shared or
// search-listed company link says which workplace it is and how it scores.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { company, aggregate } = await apiGetPublic<CompanyDetail>(`/companies/${slug}`);
    const { t } = await getTranslator();
    const title = t("{name} reviews", { name: company.name });
    const description =
      aggregate && aggregate.reviewCount > 0
        ? t("Anonymous employee ratings for {name}: {score}/5 ({band}) from {n} reviews.", {
            name: company.name,
            score: aggregate.overallAvg.toFixed(1),
            band: t(scoreBandLabel(aggregate.overallAvg)),
            n: aggregate.reviewCount,
          })
        : t("What is it really like to work at {name}? Read and write anonymous employee reviews.", { name: company.name });
    return {
      title,
      description,
      alternates: { canonical: `/companies/${slug}` },
      openGraph: { title, description, url: `/companies/${slug}`, type: "website" },
      twitter: { card: "summary_large_image", title, description },
    };
  } catch {
    return { title: (await getTranslator()).t("Company not found") };
  }
}

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string | string[]; review?: string | string[] }>;
}) {
  const { slug } = await params;
  const { tab, review } = await searchParams;
  const { t, locale } = await getTranslator();
  const initialTab = Array.isArray(tab) ? tab[0] : tab;
  // From a notification link: the review to scroll to and pulse.
  const highlightReviewId = Array.isArray(review) ? review[0] : review;

  // Both reads go out together. The narrative (for RatingNarrativeBox) is
  // always 200 for a valid slug; a failure just leaves the box without text,
  // same as the 0-review state.
  const narrativeRead = apiGetPublic<CompanyNarrative>(`/companies/${slug}/narrative`).catch(() => null);
  let detail: CompanyDetail;
  try {
    detail = await apiGetPublic<CompanyDetail>(`/companies/${slug}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const { company, aggregate } = detail;
  // A banner is now always shown: the owner's own uploaded image when their
  // tier includes custom banners and one is set, otherwise the
  // system-assigned default the API picked from the company's primary
  // work-type (company.defaultBannerUrl). The logo always overlaps it.
  const hasCustomBanner = canUseBanner(company.badgeTier) && !!company.bannerImageUrl;
  const bannerUrl = hasCustomBanner ? company.bannerImageUrl! : company.defaultBannerUrl;
  // A default banner on a company nobody has claimed renders greyscale;
  // once it has an owner (any tier) it shows in full colour.
  const bannerIsGreyscale = !hasCustomBanner && !company.hasApprovedOwner;

  const narrative = await narrativeRead;

  return (
    // Same 3-column shell as the homepage (ad rail / content / ad rail) —
    // this page used to be a narrow, centered max-w-3xl column regardless
    // of viewport width, which read as a mobile layout stretched onto a
    // desktop screen instead of using the space.
    <div className="flex w-full items-start justify-center gap-6 px-4 py-8">
      <AdSlot />

      <div className="w-full max-w-6xl">
        {/* Same Facebook-style overlap as the browse-grid card, scaled up
            for a full-width detail-page hero. No ring around the logo — a
            transparent brand image should read as transparent. */}
        <div className="relative mb-14">
          {/* 5:1, not 4:1 — on this full-width hero a 4:1 slab ran ~290px
              tall and read as a wall; 5:1 keeps it a cover strip. mb-14
              clears the half of the lg logo that hangs below it. */}
          <div className="relative aspect-[5/1] w-full overflow-hidden rounded-2xl bg-surface-muted">
            <Image
              src={bannerUrl}
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 1024px, 100vw"
              unoptimized={!isOwnStaticAsset(bannerUrl)}
              className={`h-full w-full object-cover ${bannerIsGreyscale ? "grayscale" : ""}`}
            />
          </div>
          <div className="absolute left-6 top-full -translate-y-1/2">
            <CompanyLogo name={company.name} mainPhotoUrl={company.mainPhotoUrl} size="lg" />
          </div>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl leading-tight text-foreground sm:text-4xl">
                {company.name}
                <CompanyVerificationTick
                  badgeTier={company.badgeTier}
                  claimed={company.hasApprovedOwner}
                  size={26}
                  className="ml-2"
                />
              </h1>
              <p className="mt-1 text-[15px] text-muted-foreground">
                {t(company.category)} · <WorkTypeLabel workplaceTypes={company.workplaceTypes} />
                {company.city ? ` · ${company.city}` : ""}
              </p>
              <div className="mt-2">
                {/* "-" mirrors the same rule job cards use: no real, open
                    posting to have a repost history against yet. isHiring is
                    the one signal already on this page's own CompanyDetail
                    fetch without an extra request. */}
                <RiskScoreBadge riskScore={company.riskScore > 0 ? company.riskScore : company.isHiring ? 0 : null} />
              </div>
            </div>
          </div>
          {/* Follow / Report / Share sit level with the company name. */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <CompanyActions company={company} />
            <RateButton
              companyId={company.id}
              companyName={company.name}
              workplaceTypes={company.workplaceTypes}
              structureType={company.structureType}
              city={company.city}
              region={company.region}
            />
          </div>
        </div>

        {/* Everything below the header is split into three tabs (Ratings /
            IWT Social / Job Postings). The Ratings panel is passed in as
            server-rendered JSX so it keeps full SSR; the other two panels
            are client components that fetch their own stream only once
            their tab is opened. The global "IWT Social" / "Jobs" links in
            GlobalHeader are a different thing and are left alone. */}
        <CompanyProfileTabs
          // A new key per company and tab: a link to another tab (a
          // notification, opened while already on a company page) or to
          // another company starts on that tab instead of keeping the old one.
          key={`${slug}:${initialTab ?? "ratings"}`}
          slug={slug}
          initialTab={initialTab}
          company={company}
          aggregate={aggregate}
          ratings={
            // One work-type choice shared by the illustration and the Vibe
            // Flags, so a company with an office and a shop floor shows
            // both in step.
            <WorkTypeViewProvider types={company.workplaceTypes}>
            <div className="flex flex-col gap-10">
              {/* Rating visuals (left) + the category-breakdown box (right)
                  sit in their own full-width flex row, so there's real room
                  for the dynamic image + text beside the 5 category bars.
                  Workplace Vibe Flags and the Company Details box get their
                  own row below, side by side. "What reviewers said"
                  (SurveyHighlights, the old Q&A detail box) is intentionally
                  not rendered here any more — the component itself is
                  untouched and still available to reuse elsewhere later. */}
              <div className="flex flex-col gap-8 xl:flex-row xl:items-center xl:gap-12">
                <RatingNarrativeBox
                  score={aggregate && aggregate.reviewCount > 0 ? aggregate.overallAvg : null}
                  narrative={narrative}
                  t={t}
                  locale={locale}
                />

                <div className="min-w-0 flex-1 font-sans xl:border-l xl:border-border xl:pl-12">
                  <h2 className="mb-4 text-xl text-foreground">{t("Rating Breakdown")}</h2>
                  {aggregate && aggregate.reviewCount > 0 ? (
                    <div className="flex flex-col gap-2.5">
                      {/* The overall score leads: it is the one number a
                          job-seeker came for. The five categories follow. */}
                      <div className="mb-4 flex items-baseline gap-2">
                        <span className="font-display text-6xl leading-none tabular-nums text-foreground">{aggregate.overallAvg.toFixed(1)}</span>
                        <span className="text-sm text-muted-foreground">/ 5.0</span>
                        <span className={`ml-3 text-lg font-semibold ${scoreTextColor(aggregate.overallAvg)}`}>
                          {t(scoreBandLabel(aggregate.overallAvg))}
                        </span>
                        <span className="ml-auto text-sm text-muted-foreground">
                          {t(aggregate.reviewCount === 1 ? "{n} review" : "{n} reviews", { n: aggregate.reviewCount })}
                        </span>
                      </div>
                      {CATEGORIES.map((c) => (
                        <div key={c.key} className="flex items-center gap-3">
                          <span className="w-36 shrink-0 text-sm leading-tight text-foreground sm:w-44">{t(c.label)}</span>
                          <div className="h-2 min-w-12 flex-1 rounded-full bg-surface-muted">
                            <div
                              className={`h-2 rounded-full ${scoreBarColor(aggregate[c.key])}`}
                              style={{ width: `${(aggregate[c.key] / 5) * 100}%` }}
                            />
                          </div>
                          <span className="w-8 text-right text-sm font-semibold tabular-nums text-foreground">
                            {aggregate[c.key].toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t("No reviews yet. Be the first to rate this workplace if it's in your work history.")}
                    </p>
                  )}
                </div>
              </div>

              <div
                id="vibe-flags"
                className="grid scroll-mt-24 grid-cols-1 gap-10 border-t border-border pt-10 lg:grid-cols-2 lg:gap-12"
              >
                {/* Side by side, both blocks are one fixed height (owner's
                    request, 2026-10-29): 54rem, just over the tallest Vibe
                    Flags can get (all five areas with two flags each plus three
                    mixed signals, Turkish text, at the narrowest two-column
                    width: 851px). Anything longer scrolls inside its block. */}
                <div className="lg:h-[54rem] lg:overflow-y-auto">
                  <WorkplaceVibeFlags companySlug={slug} />
                </div>
                {/* The same hairline that splits the rating row above: across
                    the top on phones, down the left side beside the flags. */}
                <div className="border-t border-border pt-10 lg:h-[54rem] lg:overflow-y-auto lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
                  <CompanyDetails company={company} t={t} />
                </div>
              </div>

              {/* Full column width — this is the actual review text people
                  are here to read, so it gets the most room. No longer
                  collapsed to 3: it has its own tab now, not a slice of a
                  combined page. */}
              <ReviewsList
                companySlug={slug}
                workplaceTypes={company.workplaceTypes}
                companyName={company.name}
                highlightReviewId={highlightReviewId}
                // Spotlight is a paid feature: a pick left over from a lapsed
                // plan isn't pinned.
                featuredReviewId={company.badgeTier !== "FREE" ? company.featuredReviewId : null}
              />
            </div>
            </WorkTypeViewProvider>
          }
        />

        <div className="mt-14">
          <OwnerClaimPanel companySlug={slug} hasApprovedOwner={company.hasApprovedOwner} />
        </div>
      </div>

      <AdSlot side="right" />
    </div>
  );
}

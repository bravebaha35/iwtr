"use client";

import { useEffect, useState } from "react";
import type { CompanyDetail, MyCompanyClaim, PublicReview, WorkplaceType } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { MultiFilterPillGroup } from "@/components/FilterPillGroup";
import { SingleSelectDropdown } from "@/components/Dropdown";
import { WORKPLACE_TYPES } from "@/lib/workplaceTypes";
import { CompanyLogoUploader } from "@/components/CompanyLogoUploader";
import { BannerUploader } from "@/components/owner/BannerUploader";
import { CompanyWorkCard, type CompanyWorkCardData } from "@/components/company/CompanyWorkCard";
import { PremiumFeaturesPanel } from "@/components/PremiumFeaturesPanel";
import { RivalAnalyticsRequestModal } from "@/components/RivalAnalyticsRequestModal";
import { tierKeyFromOwnerTier } from "@/lib/pricingTiers";

const PAID_TIER_PRICES: { tier: "BLUE" | "BLUE_PLUS" | "ENTERPRISE"; label: string; price: string }[] = [
  { tier: "BLUE", label: "Blue", price: "299,99₺" },
  { tier: "BLUE_PLUS", label: "Blue+", price: "499,99₺" },
  { tier: "ENTERPRISE", label: "Enterprise", price: "999,99₺" },
];

export interface GeneralInfoCategoryProps {
  claim: MyCompanyClaim;
  detail: CompanyDetail | null;
  companySlug: string;
  companyId: string;
  companyName: string;

  name: string;
  setName: (v: string) => void;
  workplaceTypes: WorkplaceType[];
  toggleWorkplaceType: (v: WorkplaceType) => void;
  onResetWorkplaceTypes: () => void;
  category: string | null;
  setCategory: (v: string | null) => void;
  sectorOptions: { value: string; label: string }[];
  mainPhotoUrl: string;
  setMainPhotoUrl: (v: string) => void;
  city: string | null;
  setCity: (v: string | null) => void;
  district: string | null;
  setDistrict: (v: string | null) => void;
  cityOptions: { value: string; label: string }[];
  districtOptions: { value: string; label: string }[];
  isHiring: boolean;
  setIsHiring: (v: boolean) => void;
  description: string;
  setDescription: (v: string) => void;
  website: string;
  setWebsite: (v: string) => void;
  hasActivePaidTier: boolean;
  onSaveGeneralInfo: () => void;
  generalInfoSaving: boolean;
  generalInfoStatus: string | null;
  generalInfoError: string | null;
  onStartUpgrade: (tier: "BLUE" | "BLUE_PLUS" | "ENTERPRISE") => void;

  bannerImageUrl: string;
  setBannerImageUrl: (v: string) => void;
  featuredReviewId: string | null;
  setFeaturedReviewId: (v: string | null) => void;
  onSavePremium: () => void;
  premiumSaving: boolean;
  premiumStatus: string | null;
  premiumError: string | null;

  showRivalAnalytics: boolean;
  setShowRivalAnalytics: (v: boolean) => void;
  hasFreeRivalAnalyticsRequest: boolean;
  rivalAnalyticsFreeRequestUsed: boolean;
  onFreeCreditUsed: () => void;
  onOpenPricing: () => void;
}

function DashboardBox({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`relative rounded-xl border border-gray-200 p-6 dark:border-gray-800 ${className}`}>
      <h3 className="mb-3 font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

export function GeneralInfoCategory(props: GeneralInfoCategoryProps) {
  const [ownReviews, setOwnReviews] = useState<PublicReview[] | null>(null);

  // Only fetched when the Premium box is actually shown (paid tiers) — a
  // Free-tier owner never sees the featured-review picker, so there's no
  // reason to pay for this request on their page load.
  useEffect(() => {
    if (!props.hasActivePaidTier) return;
    let cancelled = false;
    apiGet<PublicReview[]>(`/companies/${props.companySlug}/reviews`)
      .then((rows) => {
        if (!cancelled) setOwnReviews(rows);
      })
      .catch(() => {
        if (!cancelled) setOwnReviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, [props.hasActivePaidTier, props.companySlug]);

  const livePreview: CompanyWorkCardData = {
    name: props.name || props.companyName,
    mainPhotoUrl: props.mainPhotoUrl.trim() || null,
    workplaceTypes: props.workplaceTypes.length > 0 ? props.workplaceTypes : (["OFFICE"] as WorkplaceType[]),
    category: props.category ?? "",
    city: props.city,
    district: props.district,
    isHiring: props.isHiring,
    badgeTier: props.claim.tier,
    overallAvg: props.detail?.aggregate?.overallAvg ?? null,
    reviewCount: props.detail?.aggregate?.reviewCount ?? 0,
  };

  const publishedOwnReviews = (ownReviews ?? []).filter((r) => r.status === "PUBLISHED");
  const priorityResponse = props.claim.tier === "ENTERPRISE" || props.claim.tier === "BLUE_PLUS";

  return (
    <div className="flex flex-col gap-6">
      <DashboardBox title="General Information">
        {/* Live Work Card preview, anchored top-right — the exact same
            component the "Rating / Overview" browse grid renders, updating
            instantly as the fields below change. */}
        <div className="mb-4 flex justify-end sm:absolute sm:right-6 sm:top-6 sm:mb-0">
          <CompanyWorkCard company={livePreview} />
        </div>

        <div className="flex max-w-xl flex-col gap-3 sm:pr-72">
          <label className="text-xs font-medium text-muted-foreground">
            Company name
            <input
              value={props.name}
              onChange={(e) => props.setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
            />
          </label>

          <MultiFilterPillGroup
            heading="Workplace types (up to 2)"
            options={WORKPLACE_TYPES}
            selected={props.workplaceTypes}
            onToggle={props.toggleWorkplaceType}
            onReset={props.onResetWorkplaceTypes}
            direction="grid"
          />

          <label className="mt-2 text-xs font-medium text-muted-foreground">
            Sector / Industry <span className="text-muted-foreground/70">(optional)</span>
            <div className="mt-1">
              <SingleSelectDropdown value={props.category} options={props.sectorOptions} placeholder="Sector" onChange={props.setCategory} />
            </div>
          </label>

          <div className="text-xs font-medium text-muted-foreground">
            Company Logo
            <div className="mt-1">
              <CompanyLogoUploader
                uploadPath={`/my-companies/${props.companyId}/logo`}
                companyName={props.companyName}
                value={props.mainPhotoUrl}
                onChange={props.setMainPhotoUrl}
              />
            </div>
          </div>

          <label className="mt-2 text-xs font-medium text-muted-foreground">Headcount Range / Location</label>
          <div className="grid grid-cols-2 gap-2">
            <SingleSelectDropdown
              value={props.city}
              options={props.cityOptions}
              placeholder="City"
              clearable={false}
              onChange={(v) => {
                props.setCity(v);
                props.setDistrict(null);
              }}
            />
            <SingleSelectDropdown
              value={props.district}
              options={props.districtOptions}
              placeholder="District"
              disabled={!props.city}
              clearable={false}
              onChange={props.setDistrict}
            />
          </div>

          <label className="mt-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <input
              type="checkbox"
              checked={props.isHiring}
              onChange={(e) => props.setIsHiring(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            We&apos;re currently hiring (show this company on the Jobs page)
          </label>

          {props.hasActivePaidTier ? (
            <>
              <label className="mt-2 text-xs font-medium text-muted-foreground">
                About / Description
                <textarea
                  value={props.description}
                  onChange={(e) => props.setDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                Website
                <input
                  value={props.website}
                  onChange={(e) => props.setWebsite(e.target.value)}
                  placeholder="https://..."
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                />
              </label>
            </>
          ) : (
            <div className="mt-2 rounded-lg border border-dashed border-border p-3">
              <p className="text-xs text-muted-foreground">
                Description, website, and the Premium Features box below unlock on a paid tier.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PAID_TIER_PRICES.map((t) => (
                  <button
                    key={t.tier}
                    type="button"
                    onClick={() => props.onStartUpgrade(t.tier)}
                    className="rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-400 dark:hover:bg-brand-950"
                  >
                    {t.label} — {t.price}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={props.onSaveGeneralInfo}
            disabled={props.generalInfoSaving}
            className="mt-2 self-start rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Save changes
          </button>
          {props.generalInfoStatus && <p className="mt-2 text-sm text-green-700 dark:text-green-400">{props.generalInfoStatus}</p>}
          {props.generalInfoError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{props.generalInfoError}</p>}
        </div>
      </DashboardBox>

      {props.hasActivePaidTier && (
        <DashboardBox
          title="Premium Features"
          className="border-amber-300 bg-amber-50/20 dark:border-amber-700/50 dark:bg-amber-950/10"
        >
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Custom banner image</label>
              <div className="mt-1">
                <BannerUploader
                  uploadPath={`/my-companies/${props.companyId}/banner`}
                  value={props.bannerImageUrl}
                  onChange={props.setBannerImageUrl}
                />
              </div>
            </div>

            <label className="text-xs font-medium text-muted-foreground">
              Featured review spotlight
              <div className="mt-1">
                <SingleSelectDropdown
                  value={props.featuredReviewId}
                  onChange={props.setFeaturedReviewId}
                  placeholder="Choose a published review to feature"
                  options={publishedOwnReviews.map((r) => ({
                    value: r.id,
                    label: `${r.generalThoughts ? r.generalThoughts.slice(0, 60) : "(no comment)"}${
                      r.generalThoughts && r.generalThoughts.length > 60 ? "…" : ""
                    }`,
                  }))}
                />
              </div>
            </label>

            <button
              onClick={props.onSavePremium}
              disabled={props.premiumSaving}
              className="self-start rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Save Premium Features
            </button>
            {props.premiumStatus && <p className="text-sm text-green-700 dark:text-green-400">{props.premiumStatus}</p>}
            {props.premiumError && <p className="text-sm text-red-600 dark:text-red-400">{props.premiumError}</p>}

            <div className="border-t border-border pt-4">
              <h4 className="mb-1 text-sm font-semibold text-foreground">Priority response</h4>
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                  priorityResponse
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : "bg-surface-muted text-muted-foreground"
                }`}
              >
                {priorityResponse ? "Priority — 4 hour response" : "Standard"}
              </span>
            </div>

            <div className="border-t border-border pt-4">
              <h4 className="mb-1 text-sm font-semibold text-foreground">Competitor benchmark</h4>
              <p className="mb-3 text-sm text-muted-foreground">
                See how another company compares — overall rating, most agreed/disputed questions, and workplace vibe
                flags, delivered as a PDF to your inbox.
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => props.setShowRivalAnalytics(true)}
                  className="rounded-lg border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-400 dark:hover:bg-brand-950"
                >
                  Request Rival Analytics
                </button>
                {props.hasFreeRivalAnalyticsRequest && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                    1 Free Request available
                  </span>
                )}
              </div>
              {props.showRivalAnalytics && (
                <RivalAnalyticsRequestModal
                  requestingCompanyId={props.companyId}
                  rivalAnalyticsTier={props.claim.rivalAnalyticsTier}
                  rivalAnalyticsFreeRequestUsed={props.rivalAnalyticsFreeRequestUsed}
                  onClose={() => props.setShowRivalAnalytics(false)}
                  onFreeCreditUsed={props.onFreeCreditUsed}
                />
              )}
            </div>

            <PremiumFeaturesPanel tierKey={tierKeyFromOwnerTier(props.claim.tier)} onOpenPricing={props.onOpenPricing} />
          </div>
        </DashboardBox>
      )}
    </div>
  );
}

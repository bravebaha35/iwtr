"use client";

import { useEffect, useState } from "react";
import type { MyCompanyClaim, PublicReview } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { SingleSelectDropdown } from "@/components/Dropdown";
import { PremiumFeaturesPanel } from "@/components/PremiumFeaturesPanel";
import { RivalAnalyticsRequestModal } from "@/components/RivalAnalyticsRequestModal";
import { SectorBenchmarkTile } from "@/components/owner/SectorBenchmarkTile";
import { tierKeyFromOwnerTier } from "@/lib/pricingTiers";

const PAID_TIER_PRICES: { tier: "BLUE" | "BLUE_PLUS" | "ENTERPRISE"; label: string; price: string }[] = [
  { tier: "BLUE", label: "Blue", price: "299,99₺" },
  { tier: "BLUE_PLUS", label: "Blue+", price: "499,99₺" },
  { tier: "ENTERPRISE", label: "Enterprise", price: "999,99₺" },
];

export interface PremiumFeaturesCategoryProps {
  claim: MyCompanyClaim;
  companySlug: string;
  companyId: string;
  hasActivePaidTier: boolean;
  onStartUpgrade: (tier: "BLUE" | "BLUE_PLUS" | "ENTERPRISE") => void;

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
    <div className={`relative rounded-xl border border-border p-6 ${className}`}>
      <h3 className="mb-3 font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

// One cell of the paid view's bento grid — square, 1px border, tight
// padding; the grid itself sets each tile's span.
function BentoTile({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`flex flex-col border border-border bg-surface p-4 ${className}`}>
      <h4 className="mb-2 text-sm font-semibold text-foreground">{title}</h4>
      {children}
    </section>
  );
}

// This category is reachable from the sidebar at every tier — a Free-tier
// owner sees an upsell instead of a blank/broken page, same spirit as the
// dashed upsell box General Information already shows for Description/
// Website/Banner on a lower tier.
export function PremiumFeaturesCategory(props: PremiumFeaturesCategoryProps) {
  const [ownReviews, setOwnReviews] = useState<PublicReview[] | null>(null);

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

  if (!props.hasActivePaidTier) {
    return (
      <DashboardBox title="Premium Features" className="border-amber-300 bg-amber-50/20 dark:border-amber-700/50 dark:bg-amber-950/10">
        <p className="text-sm text-muted-foreground">
          Featured review spotlight, priority response, competitor benchmarking, and more unlock on a paid tier.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
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
      </DashboardBox>
    );
  }

  const publishedOwnReviews = (ownReviews ?? []).filter((r) => r.status === "PUBLISHED");
  const priorityResponse = props.claim.tier === "ENTERPRISE" || props.claim.tier === "BLUE_PLUS";

  return (
    <DashboardBox title="Premium Features" className="border-amber-300 bg-amber-50/20 dark:border-amber-700/50 dark:bg-amber-950/10">
      {/* Bento grid: wide tiles for the things you act on (spotlight,
          sector report), narrow ones for status and the rival request. */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
        <BentoTile title="Featured review spotlight" className="md:col-span-4">
          <SingleSelectDropdown
            ariaLabel="Featured review spotlight"
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
          <button
            onClick={props.onSavePremium}
            disabled={props.premiumSaving}
            className="mt-3 self-start bg-brand-600 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-brand-700 disabled:opacity-50"
          >
            Save Premium Features
          </button>
          {props.premiumStatus && <p className="mt-2 text-sm text-green-700 dark:text-green-400">{props.premiumStatus}</p>}
          {props.premiumError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{props.premiumError}</p>}
        </BentoTile>

        <BentoTile title="Priority response" className="md:col-span-2">
          <span
            className={`self-start px-2.5 py-1 text-xs font-semibold ${
              priorityResponse
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-surface-muted text-muted-foreground"
            }`}
          >
            {priorityResponse ? "Priority — 4 hour response" : "Standard"}
          </span>
        </BentoTile>

        <BentoTile title="Competitor benchmark" className="md:col-span-2">
          <p className="mb-3 text-sm text-muted-foreground">
            See how another company compares — overall rating, most agreed/disputed questions, and workplace vibe
            flags, delivered as a PDF to your inbox.
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => props.setShowRivalAnalytics(true)}
              className="border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-400 dark:hover:bg-brand-950"
            >
              Request Rival Analytics
            </button>
            {props.hasFreeRivalAnalyticsRequest && (
              <span className="bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
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
        </BentoTile>

        <BentoTile title="Sector Benchmark Report" className="md:col-span-4">
          <SectorBenchmarkTile companyId={props.companyId} isEnterprise={props.claim.tier === "ENTERPRISE"} />
        </BentoTile>

        <div className="md:col-span-6">
          <PremiumFeaturesPanel tierKey={tierKeyFromOwnerTier(props.claim.tier)} onOpenPricing={props.onOpenPricing} />
        </div>
      </div>
    </DashboardBox>
  );
}

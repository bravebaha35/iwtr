"use client";

import { useState } from "react";
import { defaultBannerUrlForWorkplaceType, type CompanyDetail, type MyCompanyClaim, type WorkplaceType } from "@iwtr/shared-types";
import { SingleSelectDropdown } from "@/components/Dropdown";
import { WORKPLACE_TYPES } from "@/lib/workplaceTypes";
import { CompanyLogoUploader } from "@/components/CompanyLogoUploader";
import { BannerUploader } from "@/components/owner/BannerUploader";
import { BannerLockedDialog } from "@/components/owner/BannerLockedDialog";
import { CompanyWorkCard, type CompanyWorkCardData } from "@/components/company/CompanyWorkCard";
import { canUseBanner } from "@/lib/pricingTiers";

const PAID_TIER_PRICES: { tier: "BLUE" | "BLUE_PLUS" | "ENTERPRISE"; label: string; price: string }[] = [
  { tier: "BLUE", label: "Blue", price: "299,99₺" },
  { tier: "BLUE_PLUS", label: "Blue+", price: "499,99₺" },
  { tier: "ENTERPRISE", label: "Enterprise", price: "999,99₺" },
];

export interface GeneralInfoCategoryProps {
  claim: MyCompanyClaim;
  detail: CompanyDetail | null;
  companyId: string;
  companyName: string;

  name: string;
  setName: (v: string) => void;
  workplaceTypes: WorkplaceType[];
  setPrimaryWorkType: (v: WorkplaceType) => void;
  setSecondaryWorkType: (v: WorkplaceType | null) => void;
  onSaveWorkplaceTypes: () => void;
  workplaceTypesSaving: boolean;
  workplaceTypesStatus: string | null;
  workplaceTypesError: string | null;
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
  bannerImageUrl: string;
  setBannerImageUrl: (v: string) => void;
  hasActivePaidTier: boolean;
  onSaveGeneralInfo: () => void;
  generalInfoSaving: boolean;
  generalInfoStatus: string | null;
  generalInfoError: string | null;
  onStartUpgrade: (tier: "BLUE" | "BLUE_PLUS" | "ENTERPRISE") => void;
  // Opens the full pricing comparison (the banner-locked dialog's "See Plans").
  onSeePlans: () => void;
}

function DashboardBox({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`relative rounded-xl border border-border p-6 ${className}`}>
      <h3 className="mb-3 font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

export function GeneralInfoCategory(props: GeneralInfoCategoryProps) {
  const bannerAllowed = canUseBanner(props.claim.tier) && props.hasActivePaidTier;
  const workplaceTypesLocked = props.detail?.company.workplaceTypesLocked ?? false;
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false);

  // workplaceTypes is stored as one ordered array; item 0 is the primary
  // (required) work-type and item 1, if present, the secondary (optional).
  const primaryType = props.workplaceTypes[0] ?? null;
  const secondaryType = props.workplaceTypes[1] ?? null;
  const secondaryOptions = WORKPLACE_TYPES.filter((t) => t.value !== primaryType);

  const livePreview: CompanyWorkCardData = {
    name: props.name || props.companyName,
    mainPhotoUrl: props.mainPhotoUrl.trim() || null,
    workplaceTypes: props.workplaceTypes.length > 0 ? props.workplaceTypes : (["OFFICE"] as WorkplaceType[]),
    defaultBannerUrl: defaultBannerUrlForWorkplaceType(props.workplaceTypes[0] ?? "OFFICE"),
    category: props.category ?? "",
    city: props.city,
    district: props.district,
    isHiring: props.isHiring,
    badgeTier: props.claim.tier,
    bannerImageUrl: props.bannerImageUrl.trim() || null,
    overallAvg: props.detail?.aggregate?.overallAvg ?? null,
    reviewCount: props.detail?.aggregate?.reviewCount ?? 0,
  };

  return (
    <div className="flex flex-col gap-6">
      <DashboardBox title="General Information">
        {/* Live Work Card preview, anchored top-right — the exact same
            component the "Rating / Overview" browse grid renders, updating
            instantly as the fields below change. The helper note under it
            tells an owner what this preview actually means (it's easy to
            mistake for decoration otherwise). */}
        <div className="mb-4 flex flex-col items-end gap-1.5 sm:absolute sm:right-6 sm:top-6 sm:mb-0">
          <div className="w-[280px]">
            <CompanyWorkCard company={livePreview} />
          </div>
          <p className="max-w-[280px] text-right text-[11px] leading-snug text-muted-foreground">
            This is how your company will appear to job seekers browsing the site.
          </p>
        </div>

        {/* No max-w here (was max-w-xl) — fields fill the box's actual
            width, capped only by sm:pr-72 so they don't run under the
            preview. */}
        <div className="flex flex-col gap-3 sm:pr-72">
          <label className="text-xs font-medium text-muted-foreground">
            Company name
            <input
              value={props.name}
              onChange={(e) => props.setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
            />
          </label>

          <div>
            {/* Owner-only terminology: employees never see "primary /
                secondary", only the bold/normal emphasis it produces on the
                public cards. */}
            <p className="text-xs font-medium text-muted-foreground">Primary Work-Type</p>
            <div className="mt-1">
              <SingleSelectDropdown
                value={primaryType}
                options={WORKPLACE_TYPES}
                placeholder="Choose your main work-type"
                ariaLabel="Primary work-type"
                clearable={false}
                disabled={workplaceTypesLocked}
                onChange={(v) => v && props.setPrimaryWorkType(v as WorkplaceType)}
              />
            </div>
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              Secondary Work-Type <span className="text-muted-foreground/70">(optional)</span>
            </p>
            <div className="mt-1">
              <SingleSelectDropdown
                value={secondaryType}
                options={secondaryOptions}
                placeholder="None"
                ariaLabel="Secondary work-type"
                disabled={workplaceTypesLocked || !primaryType}
                onChange={(v) => props.setSecondaryWorkType((v as WorkplaceType | null) ?? null)}
              />
            </div>
            <button
              onClick={props.onSaveWorkplaceTypes}
              disabled={props.workplaceTypesSaving || workplaceTypesLocked}
              className="mt-2 self-start rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save work types
            </button>
            {workplaceTypesLocked && (
              <p className="mt-1.5 text-xs text-muted-foreground">Please mail us to change your work-types.</p>
            )}
            {props.workplaceTypesStatus && (
              <p className="mt-1.5 text-xs text-green-700 dark:text-green-400">{props.workplaceTypesStatus}</p>
            )}
            {props.workplaceTypesError && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{props.workplaceTypesError}</p>
            )}
          </div>

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
                Description, website, and the Premium Features menu unlock on a paid tier.
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

          {/* Stays in General Information per the task's own instruction
              (everything else Premium moved to its own sidebar category) —
              always visible, greyed out below Blue+/Enterprise rather than
              hidden outright, so a lower-tier owner sees what they're
              missing instead of nothing at all. */}
          <div className="mt-2">
            <p className="text-xs font-medium text-muted-foreground">Banner image</p>
            <div className="mt-1">
              {bannerAllowed ? (
                <BannerUploader
                  uploadPath={`/my-companies/${props.companyId}/banner`}
                  value={props.bannerImageUrl}
                  onChange={props.setBannerImageUrl}
                />
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-surface-muted/60 p-3">
                  <p className="text-xs text-muted-foreground">
                    Your profile shows a default banner chosen from your primary work-type. Uploading
                    your own image is a Blue+ / Enterprise feature.
                  </p>
                  <button
                    type="button"
                    onClick={() => setBannerDialogOpen(true)}
                    className="mt-2 rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-400 dark:hover:bg-brand-950"
                  >
                    Change banner image
                  </button>
                </div>
              )}
            </div>
          </div>

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

      {bannerDialogOpen && (
        <BannerLockedDialog
          onClose={() => setBannerDialogOpen(false)}
          onSeePlans={() => {
            setBannerDialogOpen(false);
            props.onSeePlans();
          }}
        />
      )}
    </div>
  );
}

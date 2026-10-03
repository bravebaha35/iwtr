"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  companyContactPhoneSchema,
  type CompanyDetail,
  type MyCompanyClaim,
  type PaidOwnerTier,
  type PlusCheckoutResult,
  type WorkplaceType,
} from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPatch, apiPost, ApiError } from "@/lib/api-client";
import { IyzicoCheckoutEmbed } from "@/components/IyzicoCheckoutEmbed";
import { PricingComparisonTable } from "@/components/PricingComparisonTable";
import { OwnerNameGate } from "@/components/owner/OwnerNameGate";
import { AdSlot } from "@/components/AdSlot";
import { canUseBanner, planNameForOwnerTier } from "@/lib/pricingTiers";
import { CompanyVerificationTick } from "@/components/CompanyVerificationTick";
import { TURKEY_PROVINCES, findProvinceByCityName } from "@/lib/turkeyGeo";
import { sectorsForWorkplaceTypes } from "@/lib/sectors";
import {
  OwnerDashboardSidePanel,
  isOwnerDashboardCategory,
  type OwnerDashboardCategory,
} from "@/components/owner/OwnerDashboardSidePanel";
import { SidebarContentRow } from "@/components/layout/SidebarShell";
import { GeneralInfoCategory } from "@/components/owner/sections/GeneralInfoCategory";
import { ContactSocialCategory } from "@/components/owner/sections/ContactSocialCategory";
import { ReviewsRatingsCategory } from "@/components/owner/sections/ReviewsRatingsCategory";
import { ApplicationsCategory } from "@/components/owner/sections/ApplicationsCategory";
import { JobPostingsCategory } from "@/components/owner/sections/JobPostingsCategory";
import { SupportCategory } from "@/components/owner/sections/SupportCategory";
import { FeaturedReviewCategory } from "@/components/owner/sections/FeaturedReviewCategory";
import { BenchmarkReportsCategory } from "@/components/owner/sections/BenchmarkReportsCategory";
import { FeaturedJobAdsCategory, HrSeatsCategory } from "@/components/owner/sections/PlanPreviewCategories";
import { PremiumLocked } from "@/components/owner/sections/PremiumLocked";
import { TierInfoDialog } from "@/components/owner/TierInfoDialog";

const STATUS_STYLES: Record<MyCompanyClaim["claimStatus"], string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const emptyBilling = {
  buyerName: "",
  buyerSurname: "",
  buyerIdentityNumber: "",
  buyerEmail: "",
  buyerGsmNumber: "",
  city: "",
  address: "",
};

// Generalized from the old single-plan "Upgrade to Plus" button: the owner
// picks which of the 3 paid tiers they want (each carrying its own price)
// before billing details even show, and that choice rides along as
// targetTier on the checkout call — PaymentsService.applySubscriptionStatus
// applies exactly that tier once iyzico confirms payment.
function UpgradeCheckout({
  companyId,
  initialTier,
  onClose,
}: {
  companyId: string;
  initialTier: PaidOwnerTier;
  onClose: () => void;
}) {
  const [tier, setTier] = useState<PaidOwnerTier>(initialTier);
  const [billing, setBilling] = useState(emptyBilling);
  const [checkout, setCheckout] = useState<PlusCheckoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof typeof emptyBilling>(key: K, value: string) {
    setBilling((b) => ({ ...b, [key]: value }));
  }

  async function startCheckout() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiPost<PlusCheckoutResult>(`/my-companies/${companyId}/plus/checkout`, {
        targetTier: tier,
        buyerName: billing.buyerName,
        buyerSurname: billing.buyerSurname,
        buyerIdentityNumber: billing.buyerIdentityNumber,
        buyerEmail: billing.buyerEmail,
        buyerGsmNumber: billing.buyerGsmNumber || undefined,
        billingAddress: {
          contactName: `${billing.buyerName} ${billing.buyerSurname}`.trim(),
          city: billing.city,
          country: "Turkey",
          address: billing.address,
        },
      });
      setCheckout(result);
    } catch (err) {
      if (err instanceof ApiError && err.status === 501) {
        setError("Subscriptions aren't set up yet — the site owner needs to add iyzico payment credentials first.");
      } else {
        setError(err instanceof ApiError ? err.message : "Couldn't start checkout.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const TIERS: { value: PaidOwnerTier; label: string; price: string }[] = [
    { value: "BLUE", label: "Blue", price: "299,99₺" },
    { value: "BLUE_PLUS", label: "Blue+", price: "499,99₺" },
    { value: "ENTERPRISE", label: "Enterprise", price: "999,99₺" },
  ];

  return (
    <div className="mt-3 rounded-lg border border-border p-3">
      {checkout ? (
        <>
          <p className="mb-2 text-xs text-muted-foreground">Complete payment below:</p>
          <IyzicoCheckoutEmbed checkoutFormContent={checkout.checkoutFormContent} />
        </>
      ) : (
        <>
          <div className="mb-3 flex gap-2">
            {TIERS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTier(t.value)}
                className={`flex-1 rounded-lg border px-3 py-2 text-center text-sm font-medium transition ${
                  tier === t.value
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-border text-foreground hover:bg-surface-muted"
                }`}
              >
                {t.label}
                <br />
                <span className="text-xs font-normal text-muted-foreground">{t.price}</span>
              </button>
            ))}
          </div>
          <p className="mb-2 text-xs text-muted-foreground">
            Billing details for the subscription invoice (not shared with reviewers or the public).
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="First name"
              value={billing.buyerName}
              onChange={(e) => set("buyerName", e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
            />
            <input
              placeholder="Last name"
              value={billing.buyerSurname}
              onChange={(e) => set("buyerSurname", e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
            />
            <input
              placeholder="T.C. Kimlik No / Tax ID (11 digits)"
              value={billing.buyerIdentityNumber}
              onChange={(e) => set("buyerIdentityNumber", e.target.value)}
              className="col-span-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
            />
            <input
              placeholder="Billing email"
              value={billing.buyerEmail}
              onChange={(e) => set("buyerEmail", e.target.value)}
              className="col-span-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
            />
            <input
              placeholder="Phone (optional)"
              value={billing.buyerGsmNumber}
              onChange={(e) => set("buyerGsmNumber", e.target.value)}
              className="col-span-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
            />
            <input
              placeholder="City"
              value={billing.city}
              onChange={(e) => set("city", e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
            />
            <input
              placeholder="Billing address"
              value={billing.address}
              onChange={(e) => set("address", e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button
              onClick={startCheckout}
              disabled={submitting}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Continue to payment
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function sameWorkplaceTypes(a: WorkplaceType[], b: WorkplaceType[]): boolean {
  return a.length === b.length && a.every((v) => b.includes(v));
}

function OwnedCompanyCard({ claim }: { claim: MyCompanyClaim }) {
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<OwnerDashboardCategory>("general-info");
  // Links can open a section directly as ?company={companyId}&category=...
  // (a new-application notification uses category=applications, see
  // NotificationsService.list; the old job-postings page redirects with
  // category=job-postings) - only the named company opens it. Read from
  // window.location once on mount rather than useSearchParams so this page
  // keeps rendering without a Suspense boundary.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("company") !== claim.companyId) return;
    const category = params.get("category");
    if (category && isOwnerDashboardCategory(category)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from the URL once on mount
      setActiveCategory(category);
    }
  }, [claim.companyId]);

  // General Information (Box 1)
  const [name, setName] = useState(claim.companyName);
  const [workplaceTypes, setWorkplaceTypes] = useState<WorkplaceType[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [mainPhotoUrl, setMainPhotoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [isHiring, setIsHiring] = useState(false);
  const [generalInfoSaving, setGeneralInfoSaving] = useState(false);
  const [generalInfoStatus, setGeneralInfoStatus] = useState<string | null>(null);
  const [generalInfoError, setGeneralInfoError] = useState<string | null>(null);
  const [pendingUpgradeTier, setPendingUpgradeTier] = useState<PaidOwnerTier | null>(null);
  const [workplaceTypesSaving, setWorkplaceTypesSaving] = useState(false);
  const [workplaceTypesStatus, setWorkplaceTypesStatus] = useState<string | null>(null);
  const [workplaceTypesError, setWorkplaceTypesError] = useState<string | null>(null);

  // Premium Features (Box 2)
  const [bannerImageUrl, setBannerImageUrl] = useState("");
  const [featuredReviewId, setFeaturedReviewId] = useState<string | null>(null);
  const [premiumSaving, setPremiumSaving] = useState(false);
  const [premiumStatus, setPremiumStatus] = useState<string | null>(null);
  const [premiumError, setPremiumError] = useState<string | null>(null);

  // Contact & Social Media
  const [contactEmail, setContactEmail] = useState("");
  const [contactEmail2, setContactEmail2] = useState("");
  const [contactEmail3, setContactEmail3] = useState("");
  const [contactPhone, setContactPhone] = useState("+90");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [contactSaving, setContactSaving] = useState(false);
  const [contactStatus, setContactStatus] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);

  const [showPricing, setShowPricing] = useState(false);
  const [showTierInfo, setShowTierInfo] = useState(false);

  const hasActivePaidTier = claim.tier !== "FREE" && claim.planStatus === "ACTIVE";

  // `scope` limits which category's local field state gets overwritten by
  // the fresh server response — each category saves independently, so a
  // reload after one category's save must never discard unsaved edits
  // sitting in another. `detail` itself always refreshes fully (read-only
  // display data, not editable form state).
  const loadDetail = useCallback(
    async (scope?: "general" | "premium" | "contact" | "workplace") => {
      try {
        const data = await apiGet<CompanyDetail>(`/companies/${claim.companySlug}`);
        setDetail(data);
        const c = data.company;
        if (!scope || scope === "general") {
          setName(c.name);
          setCategory(c.category);
          setMainPhotoUrl(c.mainPhotoUrl ?? "");
          setDescription(c.description ?? "");
          setWebsite(c.website ?? "");
          setCity(c.city);
          setDistrict(c.district);
          setIsHiring(c.isHiring);
        }
        if (!scope || scope === "workplace") {
          setWorkplaceTypes(c.workplaceTypes);
        }
        if (!scope || scope === "premium") {
          setBannerImageUrl(c.bannerImageUrl ?? "");
          setFeaturedReviewId(c.featuredReviewId);
        }
        if (!scope || scope === "contact") {
          setContactEmail(c.contactEmail ?? "");
          setContactEmail2(c.contactEmail2 ?? "");
          setContactEmail3(c.contactEmail3 ?? "");
          setContactPhone(c.contactPhone ?? "+90");
          setFacebookUrl(c.facebookUrl ?? "");
          setInstagramUrl(c.instagramUrl ?? "");
          setWhatsappUrl(c.whatsappUrl ?? "");
          setXUrl(c.xUrl ?? "");
          setYoutubeUrl(c.youtubeUrl ?? "");
        }
      } catch (err) {
        setDetailError(err instanceof ApiError ? err.message : "Couldn't load this company's details.");
      }
    },
    [claim.companySlug],
  );

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  // Picking a 3rd, distinct type doesn't add to the selection — it starts a
  // fresh selection with just that type, as if the two previous picks were
  // cleared first (same rule as the browse-page Workplace filter). Any
  // change resets Sector, since the previously-picked one might not belong
  // to any of the newly-selected type(s) any more.
  // workplaceTypes is one ordered array: item 0 is the primary work-type,
  // item 1 (optional) the secondary. The owner edits them as two separate
  // dropdowns; these keep the ordering consistent. Any change clears the
  // Sector pick, which may no longer belong to the new type(s).
  function setPrimaryWorkType(value: WorkplaceType) {
    setWorkplaceTypes((prev) => {
      const secondary = prev[1];
      return secondary && secondary !== value ? [value, secondary] : [value];
    });
    setCategory(null);
  }
  function setSecondaryWorkType(value: WorkplaceType | null) {
    setWorkplaceTypes((prev) => {
      const primary = prev[0];
      if (!primary) return prev;
      return value && value !== primary ? [primary, value] : [primary];
    });
    setCategory(null);
  }

  const sectorOptions = useMemo(() => sectorsForWorkplaceTypes(workplaceTypes), [workplaceTypes]);

  async function saveGeneralInfo() {
    setGeneralInfoSaving(true);
    setGeneralInfoError(null);
    setGeneralInfoStatus(null);
    try {
      const body: Record<string, unknown> = {};
      if (name.trim() && name.trim() !== detail?.company.name) body.name = name.trim();
      if (category && category !== detail?.company.category) body.category = category;
      if (mainPhotoUrl.trim() && mainPhotoUrl.trim() !== detail?.company.mainPhotoUrl) body.mainPhotoUrl = mainPhotoUrl.trim();
      if (city) {
        body.city = city;
        // district is z.string().min(1) server-side — omit rather than send
        // "" so "no district" round-trips as "leave it unset", not a 400.
        if (district) body.district = district;
      }
      if (hasActivePaidTier && description.trim() && description.trim() !== detail?.company.description) {
        body.description = description.trim();
      }
      if (hasActivePaidTier && website.trim() && website.trim() !== detail?.company.website) {
        body.website = website.trim();
      }
      if (isHiring !== (detail?.company.isHiring ?? false)) {
        body.isHiring = isHiring;
      }
      if (
        canUseBanner(claim.tier) &&
        hasActivePaidTier &&
        bannerImageUrl.trim() &&
        bannerImageUrl.trim() !== detail?.company.bannerImageUrl
      ) {
        body.bannerImageUrl = bannerImageUrl.trim();
      }
      if (Object.keys(body).length === 0) {
        setGeneralInfoError("Change at least one field before saving.");
        return;
      }
      await apiPatch(`/my-companies/${claim.companyId}`, body);
      await loadDetail("general");
      setGeneralInfoStatus("Saved.");
    } catch (err) {
      setGeneralInfoError(err instanceof ApiError ? err.message : "Couldn't save changes.");
    } finally {
      setGeneralInfoSaving(false);
    }
  }

  // Decoupled from saveGeneralInfo's shared button — once submitted, a
  // workplaceTypes change can become permanently locked (both types
  // reviewed), which makes it a higher-stakes, single-purpose edit rather
  // than something to bundle in with routine name/city changes.
  async function saveWorkplaceTypes() {
    setWorkplaceTypesSaving(true);
    setWorkplaceTypesError(null);
    setWorkplaceTypesStatus(null);
    try {
      if (workplaceTypes.length === 0 || sameWorkplaceTypes(workplaceTypes, detail?.company.workplaceTypes ?? [])) {
        setWorkplaceTypesError("Change the workplace types before saving.");
        return;
      }
      await apiPatch(`/my-companies/${claim.companyId}`, { workplaceTypes });
      await loadDetail("workplace");
      setWorkplaceTypesStatus("Saved.");
    } catch (err) {
      setWorkplaceTypesError(err instanceof ApiError ? err.message : "Couldn't save work types.");
    } finally {
      setWorkplaceTypesSaving(false);
    }
  }

  async function saveFeaturedReview(reviewId: string | null) {
    setPremiumSaving(true);
    setPremiumError(null);
    setPremiumStatus(null);
    try {
      await apiPatch(`/my-companies/${claim.companyId}`, { featuredReviewId: reviewId });
      await loadDetail("premium");
      setPremiumStatus(reviewId ? "Pinned. It now shows first on your company page." : "Unpinned.");
    } catch (err) {
      setPremiumError(err instanceof ApiError ? err.message : "Couldn't save changes.");
    } finally {
      setPremiumSaving(false);
    }
  }

  async function saveContact() {
    setContactSaving(true);
    setContactError(null);
    setContactStatus(null);
    const trimmedEmail = contactEmail.trim();
    const trimmedPhone = contactPhone.trim() === "+90" ? "" : contactPhone.trim();
    if (!trimmedEmail && !trimmedPhone) {
      setContactError("Provide at least a phone number or an email address so applicants can reach you.");
      setContactSaving(false);
      return;
    }
    if (trimmedPhone) {
      const phoneCheck = companyContactPhoneSchema.safeParse(trimmedPhone);
      if (!phoneCheck.success) {
        setContactError(phoneCheck.error.issues[0]?.message ?? "That phone number isn't valid.");
        setContactSaving(false);
        return;
      }
    }
    try {
      const body: Record<string, string> = {
        contactEmail: trimmedEmail,
        // "" clears an optional email the owner emptied.
        contactEmail2: contactEmail2.trim(),
        contactEmail3: contactEmail3.trim(),
        contactPhone: trimmedPhone,
      };
      if (facebookUrl.trim()) body.facebookUrl = facebookUrl.trim();
      if (instagramUrl.trim()) body.instagramUrl = instagramUrl.trim();
      if (whatsappUrl.trim()) body.whatsappUrl = whatsappUrl.trim();
      if (xUrl.trim()) body.xUrl = xUrl.trim();
      if (youtubeUrl.trim()) body.youtubeUrl = youtubeUrl.trim();
      await apiPatch(`/my-companies/${claim.companyId}`, body);
      await loadDetail("contact");
      setContactStatus("Saved.");
    } catch (err) {
      setContactError(err instanceof ApiError ? err.message : "Couldn't save changes.");
    } finally {
      setContactSaving(false);
    }
  }

  const province = findProvinceByCityName(city);
  const cityOptions = TURKEY_PROVINCES.map((p) => ({ value: p.name, label: p.name }));
  const districtOptions = (province?.districts ?? []).map((d) => ({ value: d, label: d }));

  return (
    // No outline around the whole company block: the sidebar and the content
    // column must not share a card (they sit side by side as <aside> and
    // <section>). A heavy top rule still separates one owned company from the
    // next.
    <div className="border-t border-border pt-5">
      {showPricing && <PricingComparisonTable onClose={() => setShowPricing(false)} />}
      <div className="mb-4 flex items-center justify-between">
        <Link href={`/companies/${claim.companySlug}`} className="font-semibold text-foreground hover:underline">
          {claim.companyName}
        </Link>
        <div className="flex items-center gap-2">
          {/* The owner is looking at their own company — always claimed. */}
          <CompanyVerificationTick badgeTier={claim.tier} claimed size={22} />
          <button
            type="button"
            onClick={() => setShowTierInfo(true)}
            aria-haspopup="dialog"
            className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 hover:underline dark:bg-brand-900 dark:text-brand-300"
          >
            {planNameForOwnerTier(claim.tier)} Tier
          </button>
          <button
            type="button"
            onClick={() => setShowPricing(true)}
            className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            See plans
          </button>
        </div>
      </div>

      {showTierInfo && <TierInfoDialog tier={claim.tier} onClose={() => setShowTierInfo(false)} />}

      {detailError && <p className="mb-3 text-sm text-red-600 dark:text-red-300">{detailError}</p>}

      {claim.hidden && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300">
          This company is currently hidden by an administrator. Contact support at{" "}
          <a href="mailto:iworkedthere@hotmail.com" className="font-medium underline">
            iworkedthere@hotmail.com
          </a>
          .
        </div>
      )}

      <fieldset disabled={claim.hidden} className="min-w-0">
        <SidebarContentRow>
          <OwnerDashboardSidePanel
            active={activeCategory}
            onChange={setActiveCategory}
          />

          <section className="min-w-0 flex-1">
            {activeCategory === "general-info" && (
              <GeneralInfoCategory
                claim={claim}
                detail={detail}
                companyId={claim.companyId}
                companyName={claim.companyName}
                name={name}
                setName={setName}
                workplaceTypes={workplaceTypes}
                setPrimaryWorkType={setPrimaryWorkType}
                setSecondaryWorkType={setSecondaryWorkType}
                onSaveWorkplaceTypes={saveWorkplaceTypes}
                workplaceTypesSaving={workplaceTypesSaving}
                workplaceTypesStatus={workplaceTypesStatus}
                workplaceTypesError={workplaceTypesError}
                category={category}
                setCategory={setCategory}
                sectorOptions={sectorOptions}
                mainPhotoUrl={mainPhotoUrl}
                setMainPhotoUrl={setMainPhotoUrl}
                city={city}
                setCity={setCity}
                district={district}
                setDistrict={setDistrict}
                cityOptions={cityOptions}
                districtOptions={districtOptions}
                isHiring={isHiring}
                setIsHiring={setIsHiring}
                description={description}
                setDescription={setDescription}
                website={website}
                setWebsite={setWebsite}
                bannerImageUrl={bannerImageUrl}
                setBannerImageUrl={setBannerImageUrl}
                hasActivePaidTier={hasActivePaidTier}
                onSaveGeneralInfo={saveGeneralInfo}
                generalInfoSaving={generalInfoSaving}
                generalInfoStatus={generalInfoStatus}
                generalInfoError={generalInfoError}
                onStartUpgrade={setPendingUpgradeTier}
                onSeePlans={() => setShowPricing(true)}
              />
            )}

            {activeCategory === "contact-social" && (
              <ContactSocialCategory
                companyId={claim.companyId}
                city={city}
                contactEmail={contactEmail}
                setContactEmail={setContactEmail}
                contactEmail2={contactEmail2}
                setContactEmail2={setContactEmail2}
                contactEmail3={contactEmail3}
                setContactEmail3={setContactEmail3}
                contactPhone={contactPhone}
                setContactPhone={setContactPhone}
                facebookUrl={facebookUrl}
                setFacebookUrl={setFacebookUrl}
                instagramUrl={instagramUrl}
                setInstagramUrl={setInstagramUrl}
                whatsappUrl={whatsappUrl}
                setWhatsappUrl={setWhatsappUrl}
                xUrl={xUrl}
                setXUrl={setXUrl}
                youtubeUrl={youtubeUrl}
                setYoutubeUrl={setYoutubeUrl}
                onSave={saveContact}
                saving={contactSaving}
                status={contactStatus}
                error={contactError}
              />
            )}

            {activeCategory === "reviews-ratings" && (
              <ReviewsRatingsCategory
                companyId={claim.companyId}
                companySlug={claim.companySlug}
                companyName={detail?.company.name ?? claim.companyName}
                detail={detail}
              />
            )}

            {activeCategory === "applications" && <ApplicationsCategory companyId={claim.companyId} />}

            {activeCategory === "job-postings" && <JobPostingsCategory companyId={claim.companyId} />}

            {activeCategory === "customer-support" && <SupportCategory companyId={claim.companyId} tier={claim.tier} />}

            {activeCategory === "featured-review" &&
              (hasActivePaidTier ? (
                <FeaturedReviewCategory
                  companySlug={claim.companySlug}
                  featuredReviewId={featuredReviewId}
                  savedFeaturedReviewId={detail?.company.featuredReviewId ?? null}
                  setFeaturedReviewId={setFeaturedReviewId}
                  onSave={saveFeaturedReview}
                  saving={premiumSaving}
                  status={premiumStatus}
                  error={premiumError}
                />
              ) : (
                <PremiumLocked
                  title="Featured Review Spotlight"
                  description="Pin one of your published reviews to the top of your company page, with a Featured label."
                  onStartUpgrade={setPendingUpgradeTier}
                  onOpenPricing={() => setShowPricing(true)}
                />
              ))}

            {activeCategory === "benchmark-reports" && (
              <BenchmarkReportsCategory
                companyId={claim.companyId}
                isEnterprise={claim.tier === "ENTERPRISE" && hasActivePaidTier}
                city={detail?.company.city ?? null}
              />
            )}

            {activeCategory === "featured-job-ads" &&
              (hasActivePaidTier ? (
                <FeaturedJobAdsCategory tier={claim.tier} />
              ) : (
                <PremiumLocked
                  title="Posting Featured Job Ads"
                  description="Show your job ads above the others on the Jobs page."
                  onStartUpgrade={setPendingUpgradeTier}
                  onOpenPricing={() => setShowPricing(true)}
                />
              ))}

            {activeCategory === "hr-seats" && <HrSeatsCategory tier={hasActivePaidTier ? claim.tier : "FREE"} />}

            {/* Rendered here (sibling to every activeCategory block, not nested
                inside general-info's) because GeneralInfoCategory and the locked
                Premium Features sections can set pendingUpgradeTier via
                onStartUpgrade — this must show regardless of which tab is
                active when the upgrade button was clicked. */}
            {pendingUpgradeTier && (
              <UpgradeCheckout
                companyId={claim.companyId}
                initialTier={pendingUpgradeTier}
                onClose={() => setPendingUpgradeTier(null)}
              />
            )}
          </section>
        </SidebarContentRow>
      </fieldset>

    </div>
  );
}

const TAB_BASE = "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors";
const TAB_IDLE = `${TAB_BASE} text-sidebar-foreground/80 hover:bg-black/5 hover:text-sidebar-foreground dark:hover:bg-white/10`;
const TAB_ACTIVE = `${TAB_BASE} bg-brand-600 text-white`;

// One tab per approved company, in the same pill style as the profile and
// dashboard side panels. Only shown when the owner has more than one.
function CompanyTabs({
  companies,
  selectedId,
  onSelect,
}: {
  companies: MyCompanyClaim[];
  selectedId: string;
  onSelect: (companyId: string) => void;
}) {
  return (
    <nav
      aria-label="Your companies"
      className="mb-6 flex flex-row gap-1 overflow-x-auto rounded-2xl border border-border bg-sidebar p-2"
    >
      {companies.map((c) => {
        const active = c.companyId === selectedId;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.companyId)}
            aria-current={active ? "page" : undefined}
            className={active ? TAB_ACTIVE : TAB_IDLE}
          >
            {c.companyName}
          </button>
        );
      })}
    </nav>
  );
}

export default function MyCompaniesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [claims, setClaims] = useState<MyCompanyClaim[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Which company is open. Starts from ?company= (notification links, the
  // old job-postings page) and is written back so a refresh stays put.
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from the URL once on mount
    setSelectedCompanyId(new URLSearchParams(window.location.search).get("company"));
  }, []);

  function selectCompany(companyId: string) {
    setSelectedCompanyId(companyId);
    const url = new URL(window.location.href);
    url.searchParams.set("company", companyId);
    url.searchParams.delete("category");
    window.history.replaceState(null, "", url);
  }

  const ownedCompanies = useMemo(() => claims?.filter((c) => c.claimStatus === "APPROVED") ?? [], [claims]);
  const otherClaims = useMemo(() => claims?.filter((c) => c.claimStatus !== "APPROVED") ?? [], [claims]);
  const openCompany = ownedCompanies.find((c) => c.companyId === selectedCompanyId) ?? ownedCompanies[0] ?? null;

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await apiGet<MyCompanyClaim[]>("/me/company-claims");
      setClaims(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your claims.");
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  if (authLoading) return null;

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Log in to see companies you own or have claimed.</p>
      </div>
    );
  }

  return (
    <div className="flex w-full items-start justify-center gap-6 px-4 py-8">
      <AdSlot />

      <div className="w-full max-w-7xl">
        <h1 className="mb-1 text-2xl font-bold text-foreground">My companies</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Companies you&apos;ve claimed, and their approval status. Search a workplace and use &ldquo;Claim this
          company&rdquo; on its page to add one here.
        </p>

        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-300">{error}</p>}
        {claims === null && <p className="text-sm text-muted-foreground">Loading...</p>}
        {claims !== null && claims.length === 0 && (
          <p className="text-sm text-muted-foreground">You haven&apos;t claimed any companies yet.</p>
        )}

        {openCompany && (
          <OwnerNameGate>
            {ownedCompanies.length > 1 && (
              <CompanyTabs companies={ownedCompanies} selectedId={openCompany.companyId} onSelect={selectCompany} />
            )}
            <OwnedCompanyCard key={openCompany.id} claim={openCompany} />
          </OwnerNameGate>
        )}

        {otherClaims.length > 0 && (
          <div className={openCompany ? "mt-8" : ""}>
            {openCompany && <h2 className="mb-3 text-sm font-semibold text-foreground">Other claims</h2>}
            <div className="flex flex-col gap-4 compact:gap-2">
              {otherClaims.map((claim) => (
                <div
                  key={claim.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 compact:p-2.5"
                >
                  <Link href={`/companies/${claim.companySlug}`} className="font-medium text-foreground hover:underline">
                    {claim.companyName}
                  </Link>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[claim.claimStatus]}`}>
                    {claim.claimStatus === "PENDING" ? "Pending review" : "Not approved"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AdSlot />
    </div>
  );
}

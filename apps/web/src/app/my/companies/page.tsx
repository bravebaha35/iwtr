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
import { AdSlot } from "@/components/AdSlot";
import { badgeLabelForOwnerTier } from "@/lib/pricingTiers";
import { TURKEY_PROVINCES, findProvinceByCityName } from "@/lib/turkeyGeo";
import { sectorsForWorkplaceTypes } from "@/lib/sectors";
import { OwnerDashboardSidePanel, type OwnerDashboardCategory } from "@/components/owner/OwnerDashboardSidePanel";
import { GeneralInfoCategory } from "@/components/owner/sections/GeneralInfoCategory";
import { ContactSocialCategory } from "@/components/owner/sections/ContactSocialCategory";
import { ReviewsRatingsCategory } from "@/components/owner/sections/ReviewsRatingsCategory";

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
                className={`flex-1 rounded-lg border-2 px-3 py-2 text-center text-sm font-medium transition ${
                  tier === t.value
                    ? "border-brand-600 bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300"
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
          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
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

  // Premium Features (Box 2)
  const [bannerImageUrl, setBannerImageUrl] = useState("");
  const [featuredReviewId, setFeaturedReviewId] = useState<string | null>(null);
  const [premiumSaving, setPremiumSaving] = useState(false);
  const [premiumStatus, setPremiumStatus] = useState<string | null>(null);
  const [premiumError, setPremiumError] = useState<string | null>(null);
  const [showRivalAnalytics, setShowRivalAnalytics] = useState(false);
  const [freeRivalAnalyticsRequestJustUsed, setFreeRivalAnalyticsRequestJustUsed] = useState(false);

  // Contact & Social Media
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("+90");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [glassdoorUrl, setGlassdoorUrl] = useState("");
  const [contactSaving, setContactSaving] = useState(false);
  const [contactStatus, setContactStatus] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);

  const [contactAdminMessage, setContactAdminMessage] = useState("");
  const [contactAdminStatus, setContactAdminStatus] = useState<string | null>(null);
  const [contactAdminError, setContactAdminError] = useState<string | null>(null);
  const [sendingContactAdmin, setSendingContactAdmin] = useState(false);

  const [showPricing, setShowPricing] = useState(false);

  const rivalAnalyticsFreeRequestUsed = claim.rivalAnalyticsFreeRequestUsed || freeRivalAnalyticsRequestJustUsed;
  const hasFreeRivalAnalyticsRequest = claim.rivalAnalyticsTier === "ENTERPRISE" && !rivalAnalyticsFreeRequestUsed;
  const hasActivePaidTier = claim.tier !== "FREE" && claim.planStatus === "ACTIVE";

  // `scope` limits which category's local field state gets overwritten by
  // the fresh server response — each category saves independently, so a
  // reload after one category's save must never discard unsaved edits
  // sitting in another. `detail` itself always refreshes fully (read-only
  // display data, not editable form state).
  const loadDetail = useCallback(
    async (scope?: "general" | "premium" | "contact") => {
      try {
        const data = await apiGet<CompanyDetail>(`/companies/${claim.companySlug}`);
        setDetail(data);
        const c = data.company;
        if (!scope || scope === "general") {
          setName(c.name);
          setWorkplaceTypes(c.workplaceTypes);
          setCategory(c.category);
          setMainPhotoUrl(c.mainPhotoUrl ?? "");
          setDescription(c.description ?? "");
          setWebsite(c.website ?? "");
          setCity(c.city);
          setDistrict(c.district);
          setIsHiring(c.isHiring);
        }
        if (!scope || scope === "premium") {
          setBannerImageUrl(c.bannerImageUrl ?? "");
          setFeaturedReviewId(c.featuredReviewId);
        }
        if (!scope || scope === "contact") {
          setContactEmail(c.contactEmail ?? "");
          setContactPhone(c.contactPhone ?? "+90");
          setFacebookUrl(c.facebookUrl ?? "");
          setInstagramUrl(c.instagramUrl ?? "");
          setWhatsappUrl(c.whatsappUrl ?? "");
          setXUrl(c.xUrl ?? "");
          setLinkedinUrl(c.linkedinUrl ?? "");
          setYoutubeUrl(c.youtubeUrl ?? "");
          setGlassdoorUrl(c.glassdoorUrl ?? "");
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
  function toggleWorkplaceType(value: WorkplaceType) {
    setWorkplaceTypes((prev) => {
      if (prev.includes(value)) return prev.filter((v) => v !== value);
      if (prev.length >= 2) return [value];
      return [...prev, value];
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
      if (workplaceTypes.length > 0 && !sameWorkplaceTypes(workplaceTypes, detail?.company.workplaceTypes ?? [])) {
        body.workplaceTypes = workplaceTypes;
      }
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

  async function savePremium() {
    setPremiumSaving(true);
    setPremiumError(null);
    setPremiumStatus(null);
    try {
      const body: Record<string, unknown> = {};
      if (bannerImageUrl.trim() && bannerImageUrl.trim() !== detail?.company.bannerImageUrl) {
        body.bannerImageUrl = bannerImageUrl.trim();
      }
      if (featuredReviewId !== (detail?.company.featuredReviewId ?? null)) {
        body.featuredReviewId = featuredReviewId;
      }
      if (Object.keys(body).length === 0) {
        setPremiumError("Change at least one field before saving.");
        return;
      }
      await apiPatch(`/my-companies/${claim.companyId}`, body);
      await loadDetail("premium");
      setPremiumStatus("Saved.");
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
    const phoneCheck = companyContactPhoneSchema.safeParse(contactPhone.trim());
    if (!phoneCheck.success) {
      setContactError(phoneCheck.error.issues[0]?.message ?? "That phone number isn't valid.");
      setContactSaving(false);
      return;
    }
    try {
      const body: Record<string, string> = {
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
      };
      if (facebookUrl.trim()) body.facebookUrl = facebookUrl.trim();
      if (instagramUrl.trim()) body.instagramUrl = instagramUrl.trim();
      if (whatsappUrl.trim()) body.whatsappUrl = whatsappUrl.trim();
      if (xUrl.trim()) body.xUrl = xUrl.trim();
      if (linkedinUrl.trim()) body.linkedinUrl = linkedinUrl.trim();
      if (youtubeUrl.trim()) body.youtubeUrl = youtubeUrl.trim();
      if (glassdoorUrl.trim()) body.glassdoorUrl = glassdoorUrl.trim();
      await apiPatch(`/my-companies/${claim.companyId}`, body);
      await loadDetail("contact");
      setContactStatus("Saved.");
    } catch (err) {
      setContactError(err instanceof ApiError ? err.message : "Couldn't save changes.");
    } finally {
      setContactSaving(false);
    }
  }

  async function sendContactAdminMessage() {
    if (!contactAdminMessage.trim()) return;
    setSendingContactAdmin(true);
    setContactAdminError(null);
    setContactAdminStatus(null);
    try {
      await apiPost(`/my-companies/${claim.companyId}/contact-admin`, { message: contactAdminMessage.trim() });
      setContactAdminMessage("");
      setContactAdminStatus("Message sent to the admin.");
    } catch (err) {
      setContactAdminError(err instanceof ApiError ? err.message : "Couldn't send the message.");
    } finally {
      setSendingContactAdmin(false);
    }
  }

  const province = findProvinceByCityName(city);
  const cityOptions = TURKEY_PROVINCES.map((p) => ({ value: p.name, label: p.name }));
  const districtOptions = (province?.districts ?? []).map((d) => ({ value: d, label: d }));
  const badgeLabel = badgeLabelForOwnerTier(claim.tier);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      {showPricing && <PricingComparisonTable onClose={() => setShowPricing(false)} />}
      <div className="mb-4 flex items-center justify-between">
        <Link href={`/companies/${claim.companySlug}`} className="font-semibold text-foreground hover:underline">
          {claim.companyName}
        </Link>
        <div className="flex items-center gap-2">
          {badgeLabel && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
              {badgeLabel} Badge
            </span>
          )}
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300">
            {claim.tier === "FREE" ? "Free Tier" : `${badgeLabel ?? claim.tier} Tier`}
          </span>
          <button
            type="button"
            onClick={() => setShowPricing(true)}
            className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            See plans
          </button>
        </div>
      </div>

      {detailError && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{detailError}</p>}

      <div className="flex flex-col gap-6 sm:flex-row">
        <OwnerDashboardSidePanel active={activeCategory} onChange={setActiveCategory} />

        <div className="min-w-0 flex-1">
          {activeCategory === "general-info" && (
            <>
              <GeneralInfoCategory
                claim={claim}
                detail={detail}
                companySlug={claim.companySlug}
                companyId={claim.companyId}
                companyName={claim.companyName}
                name={name}
                setName={setName}
                workplaceTypes={workplaceTypes}
                toggleWorkplaceType={toggleWorkplaceType}
                onResetWorkplaceTypes={() => {
                  setWorkplaceTypes([]);
                  setCategory(null);
                }}
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
                hasActivePaidTier={hasActivePaidTier}
                onSaveGeneralInfo={saveGeneralInfo}
                generalInfoSaving={generalInfoSaving}
                generalInfoStatus={generalInfoStatus}
                generalInfoError={generalInfoError}
                onStartUpgrade={setPendingUpgradeTier}
                bannerImageUrl={bannerImageUrl}
                setBannerImageUrl={setBannerImageUrl}
                featuredReviewId={featuredReviewId}
                setFeaturedReviewId={setFeaturedReviewId}
                onSavePremium={savePremium}
                premiumSaving={premiumSaving}
                premiumStatus={premiumStatus}
                premiumError={premiumError}
                showRivalAnalytics={showRivalAnalytics}
                setShowRivalAnalytics={setShowRivalAnalytics}
                hasFreeRivalAnalyticsRequest={hasFreeRivalAnalyticsRequest}
                rivalAnalyticsFreeRequestUsed={rivalAnalyticsFreeRequestUsed}
                onFreeCreditUsed={() => setFreeRivalAnalyticsRequestJustUsed(true)}
                onOpenPricing={() => setShowPricing(true)}
              />
              {pendingUpgradeTier && (
                <UpgradeCheckout
                  companyId={claim.companyId}
                  initialTier={pendingUpgradeTier}
                  onClose={() => setPendingUpgradeTier(null)}
                />
              )}
            </>
          )}

          {activeCategory === "contact-social" && (
            <ContactSocialCategory
              city={city}
              contactEmail={contactEmail}
              setContactEmail={setContactEmail}
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
              linkedinUrl={linkedinUrl}
              setLinkedinUrl={setLinkedinUrl}
              youtubeUrl={youtubeUrl}
              setYoutubeUrl={setYoutubeUrl}
              glassdoorUrl={glassdoorUrl}
              setGlassdoorUrl={setGlassdoorUrl}
              onSave={saveContact}
              saving={contactSaving}
              status={contactStatus}
              error={contactError}
            />
          )}

          {activeCategory === "reviews-ratings" && (
            <ReviewsRatingsCategory companySlug={claim.companySlug} companyName={detail?.company.name ?? claim.companyName} detail={detail} />
          )}
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <label className="text-xs font-medium text-muted-foreground">
          Contact the admin (one-way — they can&apos;t reply here, but can reach you by email)
          <textarea
            value={contactAdminMessage}
            onChange={(e) => setContactAdminMessage(e.target.value)}
            rows={2}
            placeholder="e.g. our details are wrong, or we have a question"
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          />
        </label>
        <button
          onClick={sendContactAdminMessage}
          disabled={sendingContactAdmin || !contactAdminMessage.trim()}
          className="mt-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
        >
          Send message
        </button>
        {contactAdminStatus && <p className="mt-3 text-sm text-green-700 dark:text-green-400">{contactAdminStatus}</p>}
        {contactAdminError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{contactAdminError}</p>}
      </div>
    </div>
  );
}

export default function MyCompaniesPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [claims, setClaims] = useState<MyCompanyClaim[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {claims === null && <p className="text-sm text-muted-foreground">Loading...</p>}
        {claims !== null && claims.length === 0 && (
          <p className="text-sm text-muted-foreground">You haven&apos;t claimed any companies yet.</p>
        )}

        <div className="flex flex-col gap-4 compact:gap-2">
          {claims?.map((claim) =>
            claim.claimStatus === "APPROVED" ? (
              <OwnedCompanyCard key={claim.id} claim={claim} />
            ) : (
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
            ),
          )}
        </div>
      </div>

      <AdSlot />
    </div>
  );
}

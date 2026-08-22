"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  companyContactPhoneSchema,
  scoreBandLabel,
  type CompanyDetail,
  type MyCompanyClaim,
  type PlusCheckoutResult,
} from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPatch, apiPost, ApiError } from "@/lib/api-client";
import { IyzicoCheckoutEmbed } from "@/components/IyzicoCheckoutEmbed";
import { CompanyLogoUploader } from "@/components/CompanyLogoUploader";
import { ReviewsList } from "@/components/ReviewsList";
import { AdSlot } from "@/components/AdSlot";
import { SingleSelectDropdown } from "@/components/Dropdown";
import { TurkishPhoneInput } from "@/components/TurkishPhoneInput";
import { TURKEY_PROVINCES, findProvinceByCityName } from "@/lib/turkeyGeo";

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

function UpgradeToPlus({ companyId }: { companyId: string }) {
  const [showForm, setShowForm] = useState(false);
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
        setError(
          "Plus subscriptions aren't set up yet — the site owner needs to add iyzico payment credentials first.",
        );
      } else {
        setError(err instanceof ApiError ? err.message : "Couldn't start checkout.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (checkout) {
    return (
      <div className="mt-3 rounded-lg border border-border p-3">
        <p className="mb-2 text-xs text-muted-foreground">Complete payment below:</p>
        <IyzicoCheckoutEmbed checkoutFormContent={checkout.checkoutFormContent} />
      </div>
    );
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="mt-3 rounded-lg border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-400 dark:hover:bg-brand-950"
      >
        Upgrade to Plus
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-border p-3">
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
          onClick={() => setShowForm(false)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Shared shell for all 3 dashboard boxes so the grid reads as one system
// rather than unrelated one-off cards. `h-full` matters most on the General
// Information box: it spans both rows of the right column's stack (see the
// `lg:row-span-2` grid item below), and this is what makes it stretch to
// fill that spanned height rather than shrink-wrapping its own content.
function DashboardBox({
  title,
  className = "",
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex h-full flex-col rounded-xl border border-border bg-surface p-5 ${className}`}>
      <h3 className="mb-3 font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function OwnedCompanyCard({ claim }: { claim: MyCompanyClaim }) {
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  // General Information — basics + location, one merged save action
  const [name, setName] = useState(claim.companyName);
  const [category, setCategory] = useState("");
  const [mainPhotoUrl, setMainPhotoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [generalInfoSaving, setGeneralInfoSaving] = useState(false);
  const [generalInfoStatus, setGeneralInfoStatus] = useState<string | null>(null);
  const [generalInfoError, setGeneralInfoError] = useState<string | null>(null);

  // Box 3 — contact & socials
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("+90");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [box3Saving, setBox3Saving] = useState(false);
  const [box3Status, setBox3Status] = useState<string | null>(null);
  const [box3Error, setBox3Error] = useState<string | null>(null);

  const [contactMessage, setContactMessage] = useState("");
  const [contactStatus, setContactStatus] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const isPlusActive = claim.tier === "PLUS" && claim.planStatus === "ACTIVE";

  const loadDetail = useCallback(async () => {
    try {
      const data = await apiGet<CompanyDetail>(`/companies/${claim.companySlug}`);
      setDetail(data);
      const c = data.company;
      setName(c.name);
      setCategory(c.category);
      setMainPhotoUrl(c.mainPhotoUrl ?? "");
      setDescription(c.description ?? "");
      setWebsite(c.website ?? "");
      setCity(c.city);
      setDistrict(c.district);
      setContactEmail(c.contactEmail ?? "");
      setContactPhone(c.contactPhone ?? "+90");
      setFacebookUrl(c.facebookUrl ?? "");
      setInstagramUrl(c.instagramUrl ?? "");
      setWhatsappUrl(c.whatsappUrl ?? "");
      setXUrl(c.xUrl ?? "");
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : "Couldn't load this company's details.");
    }
  }, [claim.companySlug]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function saveGeneralInfo() {
    setGeneralInfoSaving(true);
    setGeneralInfoError(null);
    setGeneralInfoStatus(null);
    try {
      const body: Record<string, string> = {};
      if (name.trim() && name.trim() !== detail?.company.name) body.name = name.trim();
      if (category.trim() && category.trim() !== detail?.company.category) body.category = category.trim();
      if (mainPhotoUrl.trim() && mainPhotoUrl.trim() !== detail?.company.mainPhotoUrl) body.mainPhotoUrl = mainPhotoUrl.trim();
      if (city) {
        body.city = city;
        // district is z.string().min(1) server-side — omit rather than send
        // "" so "no district" round-trips as "leave it unset", not a 400.
        if (district) body.district = district;
      }
      if (isPlusActive && description.trim() && description.trim() !== detail?.company.description) {
        body.description = description.trim();
      }
      if (isPlusActive && website.trim() && website.trim() !== detail?.company.website) {
        body.website = website.trim();
      }
      if (Object.keys(body).length === 0) {
        setGeneralInfoError("Change at least one field before saving.");
        return;
      }
      await apiPatch(`/my-companies/${claim.companyId}`, body);
      await loadDetail();
      setGeneralInfoStatus("Saved.");
    } catch (err) {
      setGeneralInfoError(err instanceof ApiError ? err.message : "Couldn't save changes.");
    } finally {
      setGeneralInfoSaving(false);
    }
  }

  async function saveBox3() {
    setBox3Saving(true);
    setBox3Error(null);
    setBox3Status(null);
    const phoneCheck = companyContactPhoneSchema.safeParse(contactPhone.trim());
    if (!phoneCheck.success) {
      setBox3Error(phoneCheck.error.issues[0]?.message ?? "That phone number isn't valid.");
      setBox3Saving(false);
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
      await apiPatch(`/my-companies/${claim.companyId}`, body);
      await loadDetail();
      setBox3Status("Saved.");
    } catch (err) {
      setBox3Error(err instanceof ApiError ? err.message : "Couldn't save changes.");
    } finally {
      setBox3Saving(false);
    }
  }

  async function sendContactMessage() {
    if (!contactMessage.trim()) return;
    setSending(true);
    setContactError(null);
    setContactStatus(null);
    try {
      await apiPost(`/my-companies/${claim.companyId}/contact-admin`, { message: contactMessage.trim() });
      setContactMessage("");
      setContactStatus("Message sent to the admin.");
    } catch (err) {
      setContactError(err instanceof ApiError ? err.message : "Couldn't send the message.");
    } finally {
      setSending(false);
    }
  }

  const province = findProvinceByCityName(city);
  const cityOptions = TURKEY_PROVINCES.map((p) => ({ value: p.name, label: p.name }));
  const districtOptions = (province?.districts ?? []).map((d) => ({ value: d, label: d }));

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <Link href={`/companies/${claim.companySlug}`} className="font-semibold text-foreground hover:underline">
          {claim.companyName}
        </Link>
        <div className="flex items-center gap-2">
          {claim.isVerifiedBadge && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
              Verified
            </span>
          )}
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300">
            {claim.tier === "PLUS" ? "Plus Tier" : "Free Tier"}
          </span>
          <Link href="/plans" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
            See plans
          </Link>
        </div>
      </div>

      {detailError && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{detailError}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        {/* Left, large: company basics + location, one merged save action */}
        <DashboardBox title="General Information" className="lg:row-span-2">
          <div className="flex flex-1 flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              Company name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Category
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Retail, Cafe, Software"
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
              />
            </label>
            <div className="text-xs font-medium text-muted-foreground">
              Company Logo
              <div className="mt-1">
                <CompanyLogoUploader
                  companyId={claim.companyId}
                  companyName={claim.companyName}
                  value={mainPhotoUrl}
                  onChange={setMainPhotoUrl}
                />
              </div>
            </div>

            <label className="mt-2 text-xs font-medium text-muted-foreground">Location</label>
            <div className="grid grid-cols-2 gap-2">
              <SingleSelectDropdown
                value={city}
                options={cityOptions}
                placeholder="City"
                clearable={false}
                onChange={(v) => {
                  setCity(v);
                  setDistrict(null);
                }}
              />
              <SingleSelectDropdown
                value={district}
                options={districtOptions}
                placeholder="District"
                disabled={!city}
                clearable={false}
                onChange={setDistrict}
              />
            </div>

            {isPlusActive ? (
              <>
                <label className="mt-2 text-xs font-medium text-muted-foreground">
                  Description (Plus)
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                  />
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  Website (Plus)
                  <input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://..."
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                  />
                </label>
              </>
            ) : (
              <>
                <p className="mt-2 text-xs text-muted-foreground">
                  Description and website are Plus-tier features.
                </p>
                <UpgradeToPlus companyId={claim.companyId} />
              </>
            )}
          </div>
          <button
            onClick={saveGeneralInfo}
            disabled={generalInfoSaving}
            className="mt-auto self-start rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Save changes
          </button>
          {generalInfoStatus && <p className="mt-2 text-sm text-green-700 dark:text-green-400">{generalInfoStatus}</p>}
          {generalInfoError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{generalInfoError}</p>}
        </DashboardBox>

        {/* Right, top: contact & socials */}
        <DashboardBox title="Contact & Social Media">
          <div className="flex flex-1 flex-col gap-2">
            <div className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-xs text-brand-800 dark:border-brand-700 dark:bg-brand-950 dark:text-brand-300">
              <p className="font-semibold">Notice on Contact Numbers:</p>
              <ul className="mt-1 list-disc space-y-1 pl-4">
                <li>
                  <span className="font-medium">Sole Proprietorships (Şahıs Şirketleri):</span> If an official
                  corporate landline is unavailable, you may register using your personal or primary mobile
                  number.
                </li>
                <li>
                  <span className="font-medium">Corporate Entities (A.Ş., LTD. ŞTİ., etc.):</span> You must
                  provide an official corporate landline number accompanied by your city&apos;s official Turkish
                  area code.
                </li>
              </ul>
            </div>

            <label className="text-xs font-medium text-muted-foreground">
              Email <span className="text-red-600 dark:text-red-400">(required)</span>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="contact@company.com"
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Phone <span className="text-red-600 dark:text-red-400">(required)</span>
              <div className="mt-1">
                <TurkishPhoneInput value={contactPhone} onChange={setContactPhone} suggestedProvince={city} />
              </div>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Facebook <span className="text-muted-foreground/70">(optional)</span>
              <input
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
                placeholder="https://facebook.com/..."
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Instagram <span className="text-muted-foreground/70">(optional)</span>
              <input
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                placeholder="https://instagram.com/..."
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              WhatsApp <span className="text-muted-foreground/70">(optional)</span>
              <input
                value={whatsappUrl}
                onChange={(e) => setWhatsappUrl(e.target.value)}
                placeholder="https://wa.me/..."
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              X (Twitter) <span className="text-muted-foreground/70">(optional)</span>
              <input
                value={xUrl}
                onChange={(e) => setXUrl(e.target.value)}
                placeholder="https://x.com/..."
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
              />
            </label>
          </div>
          <button
            onClick={saveBox3}
            disabled={box3Saving || !contactEmail.trim() || !contactPhone.trim() || contactPhone.trim() === "+90"}
            className="mt-3 self-start rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Save changes
          </button>
          {box3Status && <p className="mt-2 text-sm text-green-700 dark:text-green-400">{box3Status}</p>}
          {box3Error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{box3Error}</p>}
        </DashboardBox>

        {/* Right, bottom: reviews & ratings (read-only) */}
        <DashboardBox title="Reviews & Ratings">
          {detail?.aggregate && detail.aggregate.reviewCount > 0 ? (
            <p className="mb-3 text-sm text-foreground">
              <span className="text-xl font-bold">{detail.aggregate.overallAvg.toFixed(1)}</span>{" "}
              {scoreBandLabel(detail.aggregate.overallAvg)} ·{" "}
              {detail.aggregate.reviewCount} review{detail.aggregate.reviewCount === 1 ? "" : "s"}
            </p>
          ) : (
            <p className="mb-3 text-sm text-muted-foreground">No reviews yet.</p>
          )}
          <div className="max-h-80 overflow-y-auto thin-scrollbar">
            <ReviewsList companySlug={claim.companySlug} workplaceTypes={detail?.company.workplaceTypes} />
          </div>
        </DashboardBox>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <label className="text-xs font-medium text-muted-foreground">
          Contact the admin (one-way — they can&apos;t reply here, but can reach you by email)
          <textarea
            value={contactMessage}
            onChange={(e) => setContactMessage(e.target.value)}
            rows={2}
            placeholder="e.g. our details are wrong, or we have a question"
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          />
        </label>
        <button
          onClick={sendContactMessage}
          disabled={sending || !contactMessage.trim()}
          className="mt-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
        >
          Send message
        </button>
        {contactStatus && <p className="mt-3 text-sm text-green-700 dark:text-green-400">{contactStatus}</p>}
        {contactError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{contactError}</p>}
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

      <div className="w-full max-w-4xl">
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

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { MyCompanyClaim, PlusCheckoutResult } from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPatch, apiPost, ApiError } from "@/lib/api-client";
import { IyzicoCheckoutEmbed } from "@/components/IyzicoCheckoutEmbed";

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

function UpgradeToPlus({ companyId, accessToken }: { companyId: string; accessToken: string }) {
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
      const result = await apiPost<PlusCheckoutResult>(
        `/my-companies/${companyId}/plus/checkout`,
        {
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
        },
        accessToken,
      );
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

function OwnedCompanyCard({ claim, accessToken }: { claim: MyCompanyClaim; accessToken: string }) {
  const [name, setName] = useState(claim.companyName);
  const [category, setCategory] = useState("");
  const [mainPhotoUrl, setMainPhotoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const isPlusActive = claim.tier === "PLUS" && claim.planStatus === "ACTIVE";

  async function saveCompany() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const body: Record<string, string> = {};
      if (name.trim() && name.trim() !== claim.companyName) body.name = name.trim();
      if (category.trim()) body.category = category.trim();
      if (mainPhotoUrl.trim()) body.mainPhotoUrl = mainPhotoUrl.trim();
      if (isPlusActive && description.trim()) body.description = description.trim();
      if (isPlusActive && website.trim()) body.website = website.trim();
      if (Object.keys(body).length === 0) {
        setError("Change at least one field before saving.");
        return;
      }
      await apiPatch(`/my-companies/${claim.companyId}`, body, accessToken);
      setStatus("Saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function sendContactMessage() {
    if (!contactMessage.trim()) return;
    setSending(true);
    setError(null);
    setStatus(null);
    try {
      await apiPost(`/my-companies/${claim.companyId}/contact-admin`, { message: contactMessage.trim() }, accessToken);
      setContactMessage("");
      setStatus("Message sent to the admin.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send the message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
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
            {claim.tier} tier
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
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
        <label className="text-xs font-medium text-muted-foreground">
          Photo URL
          <input
            value={mainPhotoUrl}
            onChange={(e) => setMainPhotoUrl(e.target.value)}
            placeholder="https://..."
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
          />
        </label>

        {isPlusActive ? (
          <>
            <label className="text-xs font-medium text-muted-foreground">
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
          <UpgradeToPlus companyId={claim.companyId} accessToken={accessToken} />
        )}

        <button
          onClick={saveCompany}
          disabled={saving}
          className="mt-1 self-start rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Save changes
        </button>
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
      </div>

      {status && <p className="mt-3 text-sm text-green-700 dark:text-green-400">{status}</p>}
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export default function MyCompaniesPage() {
  const { accessToken, isLoading: authLoading } = useAuth();
  const [claims, setClaims] = useState<MyCompanyClaim[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await apiGet<MyCompanyClaim[]>("/me/company-claims", accessToken);
      setClaims(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your claims.");
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (authLoading) return null;

  if (!accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Log in to see companies you own or have claimed.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 py-10">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        &larr; Back
      </Link>
      <h1 className="mt-4 mb-1 text-2xl font-bold text-foreground">My companies</h1>
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
            <OwnedCompanyCard key={claim.id} claim={claim} accessToken={accessToken} />
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
  );
}

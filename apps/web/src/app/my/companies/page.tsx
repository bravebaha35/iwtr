"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { MyCompanyClaim } from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPatch, apiPost, ApiError } from "@/lib/api-client";

const STATUS_STYLES: Record<MyCompanyClaim["claimStatus"], string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function OwnedCompanyCard({ claim, accessToken }: { claim: MyCompanyClaim; accessToken: string }) {
  const [name, setName] = useState(claim.companyName);
  const [category, setCategory] = useState("");
  const [mainPhotoUrl, setMainPhotoUrl] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  async function saveCompany() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const body: Record<string, string> = {};
      if (name.trim() && name.trim() !== claim.companyName) body.name = name.trim();
      if (category.trim()) body.category = category.trim();
      if (mainPhotoUrl.trim()) body.mainPhotoUrl = mainPhotoUrl.trim();
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
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <Link href={`/companies/${claim.companySlug}`} className="font-semibold text-zinc-900 hover:underline dark:text-zinc-50">
          {claim.companyName}
        </Link>
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300">
          {claim.tier} tier
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Company name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </label>
        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Category
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Retail, Cafe, Software"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </label>
        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Photo URL
          <input
            value={mainPhotoUrl}
            onChange={(e) => setMainPhotoUrl(e.target.value)}
            placeholder="https://..."
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </label>
        <button
          onClick={saveCompany}
          disabled={saving}
          className="mt-1 self-start rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Save changes
        </button>
      </div>

      <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Contact the admin (one-way — they can&apos;t reply here, but can reach you by email)
          <textarea
            value={contactMessage}
            onChange={(e) => setContactMessage(e.target.value)}
            rows={2}
            placeholder="e.g. our details are wrong, or we have a question"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </label>
        <button
          onClick={sendContactMessage}
          disabled={sending || !contactMessage.trim()}
          className="mt-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
        <p className="text-sm text-zinc-500">Log in to see companies you own or have claimed.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 py-10">
      <Link href="/" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
        &larr; Back
      </Link>
      <h1 className="mt-4 mb-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">My companies</h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Companies you&apos;ve claimed, and their approval status. Search a workplace and use &ldquo;Claim this
        company&rdquo; on its page to add one here.
      </p>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {claims === null && <p className="text-sm text-zinc-500">Loading...</p>}
      {claims !== null && claims.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          You haven&apos;t claimed any companies yet.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {claims?.map((claim) =>
          claim.claimStatus === "APPROVED" ? (
            <OwnedCompanyCard key={claim.id} claim={claim} accessToken={accessToken} />
          ) : (
            <div
              key={claim.id}
              className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <Link href={`/companies/${claim.companySlug}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
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

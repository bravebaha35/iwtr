"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MyCompanyClaim } from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";

export function OwnerClaimPanel({ companySlug }: { companySlug: string }) {
  const { accessToken, onboardingStatus, isLoading: authLoading } = useAuth();
  const [claim, setClaim] = useState<MyCompanyClaim | null | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      setClaim(undefined);
      return;
    }
    apiGet<MyCompanyClaim[]>("/me/company-claims", accessToken)
      .then((claims) => setClaim(claims.find((c) => c.companySlug === companySlug) ?? null))
      .catch(() => setClaim(null));
  }, [accessToken, companySlug]);

  if (authLoading || !accessToken || onboardingStatus?.status !== "ACTIVE" || claim === undefined) {
    return null;
  }

  async function submitClaim() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiPost<MyCompanyClaim>(
        `/companies/${companySlug}/claim`,
        { message: message.trim() || undefined },
        accessToken ?? undefined,
      );
      setClaim(result);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit the claim.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-dashed border-border p-5">
      <h3 className="text-sm font-semibold text-foreground">Is this your company?</h3>

      {claim === null && !showForm && (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Company representatives can claim this profile to edit it (subject to admin approval).
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Claim this company
          </button>
        </>
      )}

      {claim === null && showForm && (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Optional: tell the admin who you are (e.g. your work email or role) so they can verify the claim."
            rows={3}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={submitClaim}
              disabled={submitting}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Submit claim
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {claim?.claimStatus === "PENDING" && (
        <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
          Your claim is waiting for admin review.
        </p>
      )}

      {claim?.claimStatus === "APPROVED" && (
        <p className="mt-1 text-sm text-green-700 dark:text-green-400">
          You&apos;re an approved owner of this company.{" "}
          <Link href="/my/companies" className="font-medium text-brand-700 underline dark:text-brand-400">
            Go to your dashboard
          </Link>
          .
        </p>
      )}

      {claim?.claimStatus === "REJECTED" && !showForm && (
        <div className="mt-1">
          <p className="text-sm text-red-700 dark:text-red-400">Your previous claim wasn&apos;t approved.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Submit a new claim
          </button>
        </div>
      )}

      {claim?.claimStatus === "REJECTED" && showForm && (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add more context to help the admin approve this claim."
            rows={3}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={submitClaim}
              disabled={submitting}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Submit claim
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

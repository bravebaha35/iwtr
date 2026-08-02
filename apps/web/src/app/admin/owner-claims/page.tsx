"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminOwnerClaim, OwnerContactMessage } from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";

export default function OwnerClaimsPage() {
  const { accessToken, isLoading } = useAuth();
  const [claims, setClaims] = useState<AdminOwnerClaim[] | null>(null);
  const [messages, setMessages] = useState<OwnerContactMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [claimsData, messagesData] = await Promise.all([
        apiGet<AdminOwnerClaim[]>("/admin/owner-claims?status=PENDING", accessToken),
        apiGet<OwnerContactMessage[]>("/admin/owner-messages", accessToken),
      ]);
      setClaims(claimsData);
      setMessages(messagesData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load owner claims.");
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function actOnClaim(id: string, action: "approve" | "reject") {
    setActioningId(id);
    setError(null);
    try {
      await apiPost(`/admin/owner-claims/${id}/${action}`, {}, accessToken ?? undefined);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setActioningId(null);
    }
  }

  async function resolveMessage(id: string) {
    setActioningId(id);
    setError(null);
    try {
      await apiPost(`/admin/owner-messages/${id}/resolve`, {}, accessToken ?? undefined);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setActioningId(null);
    }
  }

  if (isLoading) return null;

  if (!accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Log in as an admin to view this page.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold text-foreground">Company owner claims</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        People asking to manage a company profile, and messages sent to you by approved owners.
      </p>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <h2 className="mb-2 text-sm font-semibold text-foreground">Pending claims</h2>
      {claims === null && !error && <p className="text-sm text-muted-foreground">Loading...</p>}
      {claims !== null && claims.length === 0 && (
        <p className="mb-6 text-sm text-muted-foreground">No pending claims.</p>
      )}
      <div className="mb-8 flex flex-col gap-4 compact:gap-2">
        {claims?.map((claim) => (
          <div key={claim.id} className="rounded-xl border border-border bg-surface p-5 compact:p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{claim.companyName}</h3>
              <span className="text-xs text-muted-foreground">{claim.claimantEmail}</span>
            </div>
            {claim.claimMessage && (
              <p className="mb-3 rounded-md bg-surface-muted p-2 text-sm text-muted-foreground">
                &ldquo;{claim.claimMessage}&rdquo;
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => actOnClaim(claim.id, "approve")}
                disabled={actioningId === claim.id}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => actOnClaim(claim.id, "reject")}
                disabled={actioningId === claim.id}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-foreground">Messages from owners</h2>
      {messages !== null && messages.length === 0 && (
        <p className="text-sm text-muted-foreground">No unresolved messages.</p>
      )}
      <div className="flex flex-col gap-4 compact:gap-2">
        {messages?.map((msg) => (
          <div key={msg.id} className="rounded-xl border border-border bg-surface p-5 compact:p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{msg.companyName}</h3>
              <span className="text-xs text-muted-foreground">{msg.ownerEmail}</span>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">{msg.message}</p>
            <button
              onClick={() => resolveMessage(msg.id)}
              disabled={actioningId === msg.id}
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
            >
              Mark resolved
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

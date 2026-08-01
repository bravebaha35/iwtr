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
        <p className="text-sm text-zinc-500">Log in as an admin to view this page.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">Company owner claims</h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        People asking to manage a company profile, and messages sent to you by approved owners.
      </p>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Pending claims</h2>
      {claims === null && !error && <p className="text-sm text-zinc-500">Loading...</p>}
      {claims !== null && claims.length === 0 && (
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">No pending claims.</p>
      )}
      <div className="mb-8 flex flex-col gap-4">
        {claims?.map((claim) => (
          <div
            key={claim.id}
            className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{claim.companyName}</h3>
              <span className="text-xs text-zinc-400">{claim.claimantEmail}</span>
            </div>
            {claim.claimMessage && (
              <p className="mb-3 rounded-md bg-zinc-50 p-2 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
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

      <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Messages from owners</h2>
      {messages !== null && messages.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No unresolved messages.</p>
      )}
      <div className="flex flex-col gap-4">
        {messages?.map((msg) => (
          <div
            key={msg.id}
            className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{msg.companyName}</h3>
              <span className="text-xs text-zinc-400">{msg.ownerEmail}</span>
            </div>
            <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">{msg.message}</p>
            <button
              onClick={() => resolveMessage(msg.id)}
              disabled={actioningId === msg.id}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Mark resolved
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

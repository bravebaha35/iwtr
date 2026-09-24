"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminJobPosting } from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";

export default function AdminJobPostingsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [postings, setPostings] = useState<AdminJobPosting[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await apiGet<AdminJobPosting[]>("/admin/job-postings?status=PENDING_ADMIN");
      setPostings(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load job postings.");
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  async function actOn(id: string, action: "approve" | "reject") {
    setActioningId(id);
    setError(null);
    try {
      await apiPost(`/admin/job-postings/${id}/${action}`, {});
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setActioningId(null);
    }
  }

  if (isLoading) return null;

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Log in as an admin to view this page.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold text-foreground">Job postings needing review</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Postings the moderation check flagged (competitor names, profanity, or masked PII) — approve to publish, or
        reject.
      </p>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {postings === null && !error && <p className="text-sm text-muted-foreground">Loading...</p>}
      {postings !== null && postings.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing pending review.</p>
      )}
      <div className="flex flex-col gap-4 compact:gap-2">
        {postings?.map((posting) => (
          <div key={posting.id} className="rounded-xl border border-border bg-surface p-5 compact:p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{posting.companyName}</h3>
              <span className="text-xs text-muted-foreground">{posting.createdByUserEmail}</span>
            </div>
            <p className="mb-1 text-sm font-medium text-foreground">{posting.jobTitle}</p>
            <p className="mb-3 rounded-md bg-surface-muted p-2 text-sm text-muted-foreground">{posting.description}</p>
            <div className="flex gap-2">
              <button
                onClick={() => actOn(posting.id, "approve")}
                disabled={actioningId === posting.id}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => actOn(posting.id, "reject")}
                disabled={actioningId === posting.id}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

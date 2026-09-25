"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { OwnerJobPosting } from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiGet, ApiError } from "@/lib/api-client";
import { OwnerJobPostingRow } from "@/components/jobs/OwnerJobPostingRow";

export function OwnerJobPostingsView({ companyId }: { companyId: string }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [postings, setPostings] = useState<OwnerJobPosting[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<OwnerJobPosting[]>(`/my-companies/${companyId}/job-postings`);
      setPostings(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load job postings.");
    }
  }, [companyId]);

  useEffect(() => {
    if (isAuthenticated) void load();
  }, [isAuthenticated, load]);

  if (authLoading) return null;

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Log in to see this company&apos;s job postings.</p>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <Link
          href="/my/companies"
          className="mb-4 inline-block text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          ← Back to My companies
        </Link>
        <h1 className="mb-1 text-2xl font-bold text-foreground">Job postings</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Every posting you&apos;ve ever made for this company, including expired and removed ones for 30 more days.
        </p>

        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-300">{error}</p>}
        {postings === null && !error && <p className="text-sm text-muted-foreground">Loading...</p>}
        {postings !== null && postings.length === 0 && (
          <p className="text-sm text-muted-foreground">No job postings yet.</p>
        )}

        <div className="flex flex-col gap-3">
          {postings?.map((p) => (
            <OwnerJobPostingRow key={p.id} companyId={companyId} posting={p} onChanged={load} />
          ))}
        </div>
      </div>
    </div>
  );
}

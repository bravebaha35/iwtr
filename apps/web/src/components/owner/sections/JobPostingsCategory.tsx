"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { OwnerJobPosting } from "@iwtr/shared-types";
import { apiGet, ApiError } from "@/lib/api-client";
import { OwnerJobPostingRow } from "@/components/jobs/OwnerJobPostingRow";

/**
 * The owner dashboard's Job Postings section: every job ad this company has
 * posted, newest first. Ads that ended or were removed stay listed for 30
 * days (the API decides that), then drop off.
 */
export function JobPostingsCategory({ companyId }: { companyId: string }) {
  const [postings, setPostings] = useState<OwnerJobPosting[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPostings(await apiGet<OwnerJobPosting[]>(`/my-companies/${companyId}/job-postings`));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your job ads.");
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="rounded-xl border border-border p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">Job Postings</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            All the job ads you&apos;ve posted for this company. An ad that has ended, or that you removed, stays
            here for 30 days and then disappears.
          </p>
        </div>
        <Link
          href="/jobs"
          className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Post a new job
        </Link>
      </div>

      {error && <p className="mb-3 text-sm text-red-600 dark:text-red-300">{error}</p>}
      {postings === null && !error && <p className="text-sm text-muted-foreground">Loading...</p>}
      {postings !== null && postings.length === 0 && (
        <p className="text-sm text-muted-foreground">You haven&apos;t posted any jobs yet.</p>
      )}

      <div className="flex flex-col gap-3">
        {postings?.map((p) => (
          <OwnerJobPostingRow key={p.id} companyId={companyId} posting={p} onChanged={load} />
        ))}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { OwnerJobPosting } from "@iwtr/shared-types";
import { apiGet, ApiError } from "@/lib/api-client";
import { OwnerJobPostingRow, isActivePosting } from "@/components/jobs/OwnerJobPostingRow";
import { freeAdsLeftText } from "@/components/owner/OwnerDashboardSidePanel";
import { useT } from "@/lib/i18n/client";

/**
 * The owner dashboard's Job Postings section: every job ad this company has
 * posted - active ones (green dot) first, then inactive (red dot), each
 * group newest first. Ads that ended or were removed stay listed for 30
 * days (the API decides that), then drop off.
 *
 * Under the heading, in bold: how many free featured ads the plan still has
 * this month (this replaced the separate "Posting Featured Job Ads" section).
 */
export function JobPostingsCategory({
  companyId,
  freeAdsLeft,
  planIncludes,
  onChanged,
}: {
  companyId: string;
  // null while not known yet.
  freeAdsLeft: number | null;
  // What the owner's plan gives, in the Pricing table's own words.
  planIncludes: string;
  // A posting was edited, boosted or removed: the free-ad count may have moved.
  onChanged?: () => void;
}) {
  const [postings, setPostings] = useState<OwnerJobPosting[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  const load = useCallback(async () => {
    try {
      setPostings(await apiGet<OwnerJobPosting[]>(`/my-companies/${companyId}/job-postings`));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("Couldn't load your job ads."));
    }
  }, [companyId]);

  const reload = useCallback(async () => {
    await load();
    onChanged?.();
  }, [load, onChanged]);

  useEffect(() => {
    void load();
  }, [load]);

  // The API sends newest first; a stable sort keeps that order inside each group.
  const sorted = postings ? [...postings].sort((a, b) => Number(isActivePosting(b)) - Number(isActivePosting(a))) : null;

  return (
    <div className="rounded-2xl bg-surface p-7 shadow-xs">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">{t("Job Postings")}</h3>
          {/* Space is kept for the line while the number is on its way. */}
          <p className="mt-1 min-h-6 text-base font-bold text-foreground">{freeAdsLeft === null ? "" : freeAdsLeftText(freeAdsLeft, t)}</p>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
            {t("Featured job ads on your plan: {plan}. A featured ad sits in the gold row at the top of the Jobs page; feature one when you post it, or with Edit below. Free ads cover 7 days.", { plan: t(planIncludes) })}
          </p>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {t("All the job ads you've posted for this company. An ad that has ended, or that you removed, stays here for 30 days and then disappears.")}
          </p>
        </div>
        <Link
          href="/jobs"
          className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          {t("Post a new job")}
        </Link>
      </div>

      {error && <p className="mb-3 text-sm text-red-600 dark:text-red-300">{error}</p>}
      {postings === null && !error && <p className="text-sm text-muted-foreground">{t("Loading...")}</p>}
      {postings !== null && postings.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("You haven't posted any jobs yet.")}</p>
      )}

      <div className="flex flex-col gap-3">
        {sorted?.map((p) => (
          <OwnerJobPostingRow key={p.id} companyId={companyId} posting={p} onChanged={reload} />
        ))}
      </div>
    </div>
  );
}

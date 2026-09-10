"use client";

import { useEffect, useState } from "react";
import type { CompanyJobPostings as CompanyJobPostingsData } from "@iwtr/shared-types";
import { apiGet, ApiError } from "@/lib/api-client";

// The "Job Postings" tab on a company's profile page. Its own fetch against
// GET /companies/:slug/job-postings (added in apps/api) — independent of the
// Ratings and IWT Social tabs, so opening this tab never pays for their
// requests and vice versa.
//
// Two kinds of row come back, exactly as on the cross-company /jobs grid:
//   - jobPostings: owner-authored, currently-published roles, each with a
//     description the owner wrote.
//   - jobTitles: roles inferred from employees' own work history when the
//     owner hasn't posted anything explicit — no description to show.
// Company identity (logo, name, rating) is already in the page header right
// above these cards, so unlike the /jobs JobCard these rows are just the
// role itself.
export function CompanyJobPostings({ slug }: { slug: string }) {
  const [data, setData] = useState<CompanyJobPostingsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // slug is a route param, so this component remounts on navigation: the
  // effect runs once per company and needs no reset of prior state. setState
  // stays in the promise callbacks (never the effect body), matching
  // WorkplaceVibeFlags / ReviewsList on this same page.
  useEffect(() => {
    let cancelled = false;
    apiGet<CompanyJobPostingsData>(`/companies/${slug}/job-postings`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Couldn't load job postings.");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }
  if (data === null) {
    return <p className="text-sm text-muted-foreground">Loading job postings...</p>;
  }

  const { jobPostings, jobTitles } = data;
  if (jobPostings.length === 0 && jobTitles.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This workplace has no open roles listed right now.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">Open Roles</h2>

      {jobPostings.map((posting) => (
        <div
          key={`posting-${posting.jobTitle}`}
          className="rounded-xl border border-border bg-surface p-5"
        >
          <span className="inline-block rounded-full bg-brand-50 px-2.5 py-1 text-sm font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
            {posting.jobTitle}
          </span>
          {posting.description && (
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{posting.description}</p>
          )}
        </div>
      ))}

      {jobTitles.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Roles seen here
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Drawn from what people who worked here listed as their job — this workplace hasn&apos;t
            posted these as formal openings.
          </p>
          <ul className="flex flex-wrap gap-2">
            {jobTitles.map((title) => (
              <li
                key={`title-${title}`}
                className="inline-block rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground"
              >
                {title}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

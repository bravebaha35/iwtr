"use client";

import { useEffect, useState } from "react";
import type {
  Company,
  CompanyAggregateScore,
  CompanyJobPostings as CompanyJobPostingsData,
  CompanyListItem,
} from "@iwtr/shared-types";
import { apiGet, ApiError } from "@/lib/api-client";
import { JobCard, postingsForCard } from "@/components/jobs/JobCard";

// The "Job Postings" tab on a company's profile page. Its own fetch against
// GET /companies/:slug/job-postings — independent of the Ratings and IWT
// Social tabs, so opening this tab never pays for their requests.
//
// Renders the same job cards the cross-company /jobs page uses (one card per
// open role). The company identity those cards need — logo, rating, contact,
// verification tick, banner — comes from the profile page's own CompanyDetail
// (passed in), so this component only fetches the roles themselves.
export function CompanyJobPostings({
  company,
  aggregate,
}: {
  company: Company;
  aggregate: CompanyAggregateScore | null;
}) {
  const [data, setData] = useState<CompanyJobPostingsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // slug is a route param, so this component remounts on navigation: the
  // effect runs once per company and needs no reset of prior state. setState
  // stays in the promise callbacks (never the effect body).
  useEffect(() => {
    let cancelled = false;
    apiGet<CompanyJobPostingsData>(`/companies/${company.slug}/job-postings`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : "Couldn't load job postings.");
      });
    return () => {
      cancelled = true;
    };
  }, [company.slug]);

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

  // The job card wants a CompanyListItem (Company + score + the role arrays).
  const companyForCard: CompanyListItem = {
    ...company,
    overallAvg: aggregate?.overallAvg ?? null,
    reviewCount: aggregate?.reviewCount ?? 0,
    jobTitles,
    jobPostings,
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">Open Roles</h2>
      <div className="grid grid-cols-1 gap-4 compact:gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {postingsForCard(companyForCard).map((posting, i) => (
          <JobCard
            key={`${posting?.jobTitle ?? "none"}-${i}`}
            company={companyForCard}
            posting={posting}
          />
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  ClassifiedJobTitle,
  Company,
  CompanyAggregateScore,
  CompanyJobPostings as CompanyJobPostingsData,
  PublicJobPosting,
} from "@iwtr/shared-types";
import { primaryWorkplaceType } from "@iwtr/shared-types";
import { apiGet, ApiError } from "@/lib/api-client";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";
import { jobPositionLabel } from "@/lib/jobPositions";
import { collarTileTone } from "@/lib/collarColors";
import { useSavedJobPostings } from "@/lib/useSavedJobPostings";
import { RichText } from "@/components/RichText";
import { ContactButton } from "@/components/jobs/JobCard";
import { ApplyButton } from "@/components/jobs/ApplyButton";
import { BookmarkIcon } from "@/components/jobs/BookmarkIcon";
import { JobCardFacts } from "@/components/jobs/JobCardFacts";
import { useT } from "@/lib/i18n/client";

// The "Job Postings" tab on a company's profile page. Its own fetch against
// GET /companies/:slug/job-postings - independent of the Ratings and Social
// tabs, so opening this tab never pays for their requests.
//
// The company itself is already the page header (banner, logo, name, rating),
// so unlike the /jobs grid these are not company cards: each open role is one
// wide row, the role's facts and actions on the left and the description the
// owner wrote on the right. A long description (up to 4000 characters) shows
// its first part and opens in place, so every row starts out the same size.

// About fourteen lines of description before "Read the full posting".
const PREVIEW_MAX_HEIGHT = "17.5rem";

function RoleRow({ company, posting }: { company: Company; posting: PublicJobPosting }) {
  const { savedIds, canSave, toggleSave, loading: savedLoading } = useSavedJobPostings();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const workType = posting.workType ?? primaryWorkplaceType(company);
  const location = [company.district, company.city].filter(Boolean).join(", ");
  const isSaved = savedIds.has(posting.id);

  // Only offer "Read the full posting" when the text is really cut off.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(el);
    return () => observer?.disconnect();
  }, [posting.description]);

  return (
    <article className="grid grid-cols-1 overflow-hidden rounded-2xl bg-surface shadow-xs md:grid-cols-[17rem_1fr] lg:grid-cols-[19rem_1fr]">
      <div className="flex flex-col gap-4 p-5 md:border-r md:border-border/60 lg:p-6">
        <div>
          <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span className={`h-[3px] w-4 rounded-full ${collarTileTone[workType].bar}`} aria-hidden="true" />
            {t(workplaceTypeLabel(workType))}
          </span>
          <h3 className="mt-2 font-display text-2xl leading-tight text-foreground">{posting.jobTitle}</h3>
          {location && <p className="mt-1 text-sm text-muted-foreground">{location}</p>}
        </div>

        {posting.positions.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label={t("Position")}>
            {posting.positions.map((p) => (
              <li key={p} className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-foreground">
                {t(jobPositionLabel(p))}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-1.5">
          <ApplyButton jobPostingId={posting.id} />
          <ContactButton icon="mail" label="Mail" value={company.contactEmail} />
          <ContactButton icon="phone" label="Call" value={company.contactPhone} />
        </div>

        <div className="mt-auto flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => canSave && toggleSave(posting.id)}
            disabled={!canSave || savedLoading}
            title={!canSave ? t("Log in to save") : undefined}
            aria-pressed={isSaved}
            className="-ml-1 flex items-center gap-1.5 rounded-full px-1 py-1 text-xs font-semibold text-muted-foreground transition hover:text-brand-600 disabled:opacity-40 dark:hover:text-brand-400"
          >
            <BookmarkIcon className="h-4 w-4" filled={isSaved} />
            {isSaved ? t("Saved") : t("Save")}
          </button>
        </div>
      </div>

      <div className="flex min-w-0 flex-col p-5 lg:p-6">
        <div
          ref={textRef}
          id={`role-${posting.id}-text`}
          style={open ? undefined : { maxHeight: PREVIEW_MAX_HEIGHT }}
          className={`relative overflow-hidden text-sm leading-relaxed text-foreground/85 ${
            !open && overflows ? "[mask-image:linear-gradient(to_bottom,black_70%,transparent)]" : ""
          }`}
        >
          {posting.description.trim() ? (
            <RichText text={posting.description} className="whitespace-pre-wrap" />
          ) : (
            <p className="text-muted-foreground">{t("The company has not written a description for this role yet.")}</p>
          )}
        </div>
        {(overflows || open) && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={`role-${posting.id}-text`}
            className="mt-3 self-start text-[13px] font-semibold text-brand-600 transition hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            {open ? t("Show less") : t("Read the full posting")}
          </button>
        )}
        {/* A thin line at the bottom, then Salary and Perks (no Risk Score here). */}
        <div className="mt-auto pt-4">
          <JobCardFacts salary={posting.salary} perks={company.perks} />
        </div>
      </div>
    </article>
  );
}

// No owner-written postings, but reviewers' job titles say what this
// workplace hires for. Small tiles, no Apply: there is no posting behind them.
function InferredRoles({ company, titles }: { company: Company; titles: ClassifiedJobTitle[] }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {t("No job ads right now. These are roles people who worked here have held; contact the company to ask about them.")}
      </p>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {titles.map((role) => (
          <li key={role.title} className="flex items-center justify-between gap-3 rounded-2xl bg-surface p-4 shadow-xs">
            <span className="min-w-0">
              <span className="block truncate font-semibold text-foreground">{role.title}</span>
              <span className="block text-xs text-muted-foreground">{t(workplaceTypeLabel(role.workType))}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <ContactButton icon="mail" label="Mail" value={company.contactEmail} />
              <ContactButton icon="phone" label="Call" value={company.contactPhone} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CompanyJobPostings({
  company,
}: {
  company: Company;
  // Kept for the caller's signature; the rating is in the page header.
  aggregate?: CompanyAggregateScore | null;
}) {
  const [data, setData] = useState<CompanyJobPostingsData | null>(null);
  const t = useT();
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
    return <p className="text-sm text-red-600 dark:text-red-300">{t(error)}</p>;
  }
  if (data === null) {
    return (
      <div className="flex flex-col gap-4" aria-hidden="true">
        {[0, 1].map((i) => (
          <div key={i} className="h-64 animate-pulse rounded-2xl bg-surface-muted" />
        ))}
      </div>
    );
  }

  const { jobPostings, jobTitles } = data;
  if (jobPostings.length === 0 && jobTitles.length === 0) {
    return (
      <div className="rounded-2xl bg-surface-muted px-6 py-8">
        <p className="font-semibold text-foreground">{t("No open roles right now")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("Follow this workplace to hear when it posts a job.")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-semibold text-foreground">
        {t("Open Roles")}
        {jobPostings.length > 0 && <span className="ml-2 text-sm font-normal tabular-nums text-muted-foreground">{jobPostings.length}</span>}
      </h2>
      {jobPostings.length > 0 ? (
        jobPostings.map((posting) => <RoleRow key={posting.id} company={company} posting={posting} />)
      ) : (
        <InferredRoles company={company} titles={jobTitles} />
      )}
    </div>
  );
}

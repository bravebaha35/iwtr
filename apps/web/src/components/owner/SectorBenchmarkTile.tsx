"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { BenchmarkReportJob, SectorBenchmarkRequest } from "@iwtr/shared-types";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { SETTLE_EASE } from "@/lib/motion/easings";
import { announceNewNotifications } from "@/lib/notification-events";

const POLL_MS = 3_000;

const SCOPES: { value: SectorBenchmarkRequest["scope"]; label: string }[] = [
  { value: "TURKEY", label: "All of Turkey" },
  { value: "CITY", label: "My company's city" },
];

function isPending(job: BenchmarkReportJob) {
  return job.status === "QUEUED" || job.status === "RUNNING";
}

export function downloadHref(companyId: string, jobId: string) {
  return `/api/proxy/my-companies/${companyId}/sector-benchmark/${jobId}/download`;
}

/**
 * "Generating report" indicator. Not a spinner: the bar eases quickly
 * toward ~90% on a long, gently settling curve (SETTLE_EASE,
 * cubic-bezier(0.25, 1, 0.5, 1)) and only fills the last stretch once the
 * job is actually READY — so it reads as progress without pretending to
 * know the exact remaining time.
 */
function GeneratingBar({ status }: { status: BenchmarkReportJob["status"] }) {
  const reduceMotion = useReducedMotion();
  const target = status === "QUEUED" ? 0.35 : status === "RUNNING" ? 0.9 : 1;
  return (
    <div
      role="progressbar"
      aria-label="Generating report"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(target * 100)}
      className="h-2 w-full overflow-hidden border border-border bg-surface-muted"
    >
      <motion.div
        className="h-full origin-left bg-river-600 dark:bg-river-400"
        initial={{ scaleX: 0.05 }}
        animate={{ scaleX: target }}
        transition={reduceMotion ? { duration: 0 } : { duration: status === "QUEUED" ? 1.2 : 6, ease: SETTLE_EASE }}
      />
    </div>
  );
}

/**
 * Sector Benchmark Report tile on the owner dashboard's Premium Features
 * tab. Enterprise-only: orders a report (queued on the API, built in the
 * background), polls while one is being built, and lists recent reports
 * with a download link for 7 days.
 */
export function SectorBenchmarkTile({ companyId, isEnterprise }: { companyId: string; isEnterprise: boolean }) {
  const [jobs, setJobs] = useState<BenchmarkReportJob[] | null>(null);
  const [scope, setScope] = useState<SectorBenchmarkRequest["scope"]>("TURKEY");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingIds = useRef<Set<string>>(new Set());

  const applyRows = useCallback((rows: BenchmarkReportJob[]) => {
    // A job we were watching just finished: let the header bell know.
    if (rows.some((j) => pendingIds.current.has(j.id) && j.status === "READY")) announceNewNotifications();
    pendingIds.current = new Set(rows.filter(isPending).map((j) => j.id));
    setJobs(rows);
  }, []);
  const fetchJobs = useCallback(
    () => apiGet<BenchmarkReportJob[]>(`/my-companies/${companyId}/sector-benchmark`),
    [companyId],
  );

  useEffect(() => {
    if (!isEnterprise) return;
    let cancelled = false;
    fetchJobs()
      .then((rows) => !cancelled && applyRows(rows))
      .catch(() => !cancelled && setJobs([]));
    return () => {
      cancelled = true;
    };
  }, [isEnterprise, fetchJobs, applyRows]);

  const hasPending = (jobs ?? []).some(isPending);
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => {
      fetchJobs()
        .then(applyRows)
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [hasPending, fetchJobs, applyRows]);

  async function generate() {
    setError(null);
    setSubmitting(true);
    try {
      const job = await apiPost<BenchmarkReportJob>(`/my-companies/${companyId}/sector-benchmark`, {
        scope,
      } satisfies SectorBenchmarkRequest);
      pendingIds.current.add(job.id);
      setJobs((prev) => [job, ...(prev ?? [])]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start the report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isEnterprise) {
    return (
      <p className="text-sm text-muted-foreground">
        Salary ranges, benefits and the questions your whole sector agrees and disagrees on, as a PDF. Available on
        the Enterprise plan.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Salary ranges, benefits, the 10 questions your sector agrees and disagrees on most, and its risk of staff
        leaving. Built only from anonymous data, and only when enough people and companies are behind every figure.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Report scope" className="flex border border-border">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={scope === s.value}
              onClick={() => setScope(s.value)}
              className={`px-3 py-1.5 text-xs font-medium ${
                scope === s.value ? "bg-river-600 text-white" : "text-foreground hover:bg-surface-muted"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={submitting || hasPending}
          className="bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {hasPending ? "Generating…" : "Generate report"}
        </button>
      </div>
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}

      {jobs && jobs.length > 0 && (
        <ul className="flex flex-col divide-y divide-border border-t border-border">
          {jobs.map((job) => (
            <li key={job.id} className="flex flex-col gap-1.5 py-2">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-foreground">
                  {job.sectorCategory} · {job.city ?? "All of Turkey"}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(job.createdAt).toLocaleDateString()}
                </span>
              </div>
              {isPending(job) && <GeneratingBar status={job.status} />}
              {job.status === "READY" && job.expiresAt && new Date(job.expiresAt) < new Date() && (
                <p className="text-xs text-muted-foreground">Download expired (reports are kept for 7 days).</p>
              )}
              {job.status === "READY" && !(job.expiresAt && new Date(job.expiresAt) < new Date()) && (
                <a
                  href={downloadHref(companyId, job.id)}
                  className="self-start text-sm font-semibold text-river-600 underline underline-offset-2 dark:text-river-300"
                >
                  Download PDF
                </a>
              )}
              {job.status === "FAILED" && (
                <p className="text-xs text-red-700 dark:text-red-400">{job.errorMessage ?? "This report failed."}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  HR_REPORT_PRICE_LABEL,
  type HrReportAllowance,
  type HrReportJob,
  type HrReportOverview,
  type HrReportRequestResult,
} from "@iwtr/shared-types";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { IyzicoCheckoutEmbed } from "@/components/IyzicoCheckoutEmbed";
import { announceNewNotifications } from "@/lib/notification-events";

const POLL_MS = 3_000;

const emptyBilling = {
  buyerName: "",
  buyerSurname: "",
  buyerIdentityNumber: "",
  buyerEmail: "",
  buyerGsmNumber: "",
  city: "",
  address: "",
};

const ACCESS_LABEL: Record<HrReportJob["access"], string> = {
  PLAN: "Included in your plan",
  MONTHLY_QUOTA: "Your monthly report",
  PAID: "Bought",
};

function isBuilding(job: HrReportJob) {
  return job.status === "QUEUED" || job.status === "RUNNING";
}

function isExpired(job: HrReportJob) {
  return !!job.expiresAt && new Date(job.expiresAt) < new Date();
}

export function hrReportDownloadHref(companyId: string, jobId: string) {
  return `/api/proxy/my-companies/${companyId}/hr-analytics-report/${jobId}/download`;
}

function formatDay(isoDay: string) {
  return new Date(`${isoDay}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}

/** One line on what the next click will do. */
function allowanceNote(allowance: HrReportAllowance): string {
  switch (allowance.mode) {
    case "INCLUDED":
      return "Included in your Enterprise plan.";
    case "MONTHLY_QUOTA":
      return "Your Pro plan includes 1 report a month. You have 1 left this month.";
    case "PAID_CREDIT":
      return "Your last bought report couldn't be built, so you can build it again at no charge.";
    case "PAYMENT_REQUIRED":
      return allowance.quotaRemaining === 0
        ? `You've used this month's report. It comes back on ${formatDay(allowance.quotaResetsOn!)}; an extra report is ${HR_REPORT_PRICE_LABEL}.`
        : `One report is ${HR_REPORT_PRICE_LABEL}. The Pro plan includes one every month.`;
  }
}

/**
 * "Building your report" indicator. Not a spinner: two small page outlines
 * fill in line by line, page 1 while the job waits its turn and page 2 once
 * it's being built, so the owner sees roughly where it is. Holds still when
 * the visitor prefers less motion.
 */
function BuildingPages({ status }: { status: HrReportJob["status"] }) {
  const reduceMotion = useReducedMotion();
  const running = status === "RUNNING";
  return (
    <div role="status" className="flex items-center gap-3">
      <div aria-hidden="true" className="flex gap-1.5">
        {[0, 1].map((page) => {
          const active = page === 0 || running;
          return (
            <div key={page} className="flex h-9 w-7 flex-col gap-[3px] rounded-[3px] border border-border bg-surface p-1">
              {[0, 1, 2, 3, 4].map((line) => (
                <motion.span
                  key={line}
                  className="h-[2px] origin-left rounded-full bg-brand-600 dark:bg-brand-400"
                  initial={{ scaleX: 0 }}
                  animate={active ? { scaleX: reduceMotion ? 1 : [0, 1, 1, 0] } : { scaleX: 0 }}
                  transition={
                    reduceMotion || !active
                      ? { duration: 0 }
                      : { duration: 1.6, times: [0, 0.35, 0.85, 1], ease: [0.16, 1, 0.3, 1], repeat: Infinity, delay: line * 0.12 + page * 0.3 }
                  }
                  style={{ width: line === 4 ? "60%" : "100%" }}
                />
              ))}
            </div>
          );
        })}
      </div>
      <span className="text-sm text-muted-foreground">
        {running ? "Laying out your pages…" : "Gathering your reviewers' answers…"}
      </span>
    </div>
  );
}

function BillingForm({
  billing,
  onChange,
}: {
  billing: typeof emptyBilling;
  onChange: (key: keyof typeof emptyBilling, value: string) => void;
}) {
  const field = (key: keyof typeof emptyBilling, label: string, wide = false, type = "text") => (
    <label className={`flex flex-col gap-1 text-xs text-muted-foreground ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      <input
        type={type}
        value={billing[key]}
        onChange={(e) => onChange(key, e.target.value)}
        className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
      />
    </label>
  );
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {field("buyerName", "First name")}
      {field("buyerSurname", "Last name")}
      {field("buyerIdentityNumber", "T.C. Kimlik No / Tax ID (11 digits)", true)}
      {field("buyerEmail", "Billing email", true, "email")}
      {field("buyerGsmNumber", "Phone (optional)", true, "tel")}
      {field("city", "City")}
      {field("address", "Billing address")}
    </div>
  );
}

/**
 * HR Analytics Report on the owner dashboard (Premium Features › Benchmark
 * Reports). Shows what the next report costs (included, the Pro monthly
 * report, or 199,99₺), takes billing details and opens the iyzico payment
 * when it isn't included, then lists recent reports with a 7-day PDF link.
 * The server makes every one of these decisions again; this only explains them.
 */
export function HrAnalyticsReportTile({ companyId }: { companyId: string }) {
  const [overview, setOverview] = useState<HrReportOverview | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingOpen, setBillingOpen] = useState(false);
  const [billing, setBilling] = useState(emptyBilling);
  const [checkout, setCheckout] = useState<string | null>(null);
  const buildingIds = useRef<Set<string>>(new Set());

  const apply = useCallback((next: HrReportOverview) => {
    if (next.jobs.some((j) => buildingIds.current.has(j.id) && j.status === "READY")) announceNewNotifications();
    buildingIds.current = new Set(next.jobs.filter(isBuilding).map((j) => j.id));
    setOverview(next);
  }, []);
  const load = useCallback(
    () => apiGet<HrReportOverview>(`/my-companies/${companyId}/hr-analytics-report`),
    [companyId],
  );

  useEffect(() => {
    let cancelled = false;
    load()
      .then((o) => !cancelled && apply(o))
      .catch(() => !cancelled && setLoadFailed(true));
    return () => {
      cancelled = true;
    };
  }, [load, apply]);

  const building = (overview?.jobs ?? []).some(isBuilding);
  useEffect(() => {
    if (!building) return;
    const timer = setInterval(() => {
      load()
        .then(apply)
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [building, load, apply]);

  async function submit(withBilling: boolean) {
    setError(null);
    setSubmitting(true);
    try {
      const body = withBilling
        ? {
            billing: {
              buyerName: billing.buyerName.trim(),
              buyerSurname: billing.buyerSurname.trim(),
              buyerIdentityNumber: billing.buyerIdentityNumber.trim(),
              buyerEmail: billing.buyerEmail.trim(),
              buyerGsmNumber: billing.buyerGsmNumber.trim() || undefined,
              billingAddress: {
                contactName: `${billing.buyerName} ${billing.buyerSurname}`.trim(),
                city: billing.city.trim(),
                country: "Turkey",
                address: billing.address.trim(),
              },
            },
          }
        : {};
      const result = await apiPost<HrReportRequestResult>(`/my-companies/${companyId}/hr-analytics-report`, body);
      if (result.status === "CHECKOUT_REQUIRED") {
        setCheckout(result.checkoutFormContent);
      } else {
        buildingIds.current.add(result.job.id);
        setOverview((prev) => (prev ? { ...prev, jobs: [result.job, ...prev.jobs] } : prev));
        setBillingOpen(false);
        void load().then(apply).catch(() => {});
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start the report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function onGenerate() {
    if (!overview) return;
    if (overview.allowance.mode === "PAYMENT_REQUIRED") {
      setBillingOpen(true);
      return;
    }
    void submit(false);
  }

  const billingComplete =
    billing.buyerName.trim() &&
    billing.buyerSurname.trim() &&
    /^\d{11}$/.test(billing.buyerIdentityNumber.trim()) &&
    /\S+@\S+\.\S+/.test(billing.buyerEmail.trim()) &&
    billing.city.trim() &&
    billing.address.trim();

  const allowance = overview?.allowance;
  const pays = allowance?.mode === "PAYMENT_REQUIRED";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Your company as your reviewers see it, in two pages: your Vibe Flags and why you earned each one, your Risk
        Score with every past job posting&apos;s effect on it, and every survey question as percentages across
        Corporate Culture, Leadership &amp; Management, Infrastructure &amp; Resources, Work-Life Balance and
        Organizational Stability. Built only from anonymous answers.
      </p>

      {loadFailed && <p className="text-sm text-red-700 dark:text-red-300">Couldn&apos;t load your reports. Refresh to try again.</p>}
      {!overview && !loadFailed && <div className="h-4 w-2/3 animate-pulse rounded bg-surface-muted" aria-label="Loading" />}

      {allowance && (
        <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-foreground">
          {allowance.eligible ? allowanceNote(allowance) : allowance.ineligibleReason}
        </p>
      )}

      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}

      {overview && overview.jobs.length > 0 && (
        <ul className="flex flex-col divide-y divide-border border-t border-border">
          {overview.jobs.map((job) => (
            <li key={job.id} className="flex flex-col gap-1.5 py-2">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-foreground">{ACCESS_LABEL[job.access]}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{new Date(job.createdAt).toLocaleDateString()}</span>
              </div>
              {isBuilding(job) && <BuildingPages status={job.status} />}
              {job.status === "READY" && isExpired(job) && (
                <p className="text-xs text-muted-foreground">Download expired (reports are kept for 7 days).</p>
              )}
              {job.status === "READY" && !isExpired(job) && (
                <a
                  href={hrReportDownloadHref(companyId, job.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-start text-sm font-semibold text-brand-700 underline underline-offset-2 dark:text-brand-300"
                >
                  Open PDF
                </a>
              )}
              {job.status === "FAILED" && (
                <p className="text-xs text-red-700 dark:text-red-300">{job.errorMessage ?? "This report failed."}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {checkout ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <p className="text-sm text-foreground">
            Complete the {HR_REPORT_PRICE_LABEL} payment below. Your report starts building as soon as it goes through.
          </p>
          <IyzicoCheckoutEmbed checkoutFormContent={checkout} />
          <button
            type="button"
            onClick={() => {
              setCheckout(null);
              setBillingOpen(false);
              void load().then(apply).catch(() => {});
            }}
            className="self-end rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-surface-muted"
          >
            Close
          </button>
        </div>
      ) : billingOpen && pays ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <p className="text-sm text-foreground">Billing details, for the payment and your invoice.</p>
          <BillingForm billing={billing} onChange={(key, value) => setBilling((b) => ({ ...b, [key]: value }))} />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setBillingOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-surface-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit(true)}
              disabled={!billingComplete || submitting}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting ? "Opening payment…" : `Pay ${HR_REPORT_PRICE_LABEL}`}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onGenerate}
            disabled={!allowance?.eligible || submitting || building}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {building
              ? "Building…"
              : pays
                ? `Buy report for ${HR_REPORT_PRICE_LABEL}`
                : allowance?.mode === "PAID_CREDIT"
                  ? "Build it again"
                  : "Generate Report"}
          </button>
        </div>
      )}
    </div>
  );
}

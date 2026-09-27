"use client";

import { useEffect, useState } from "react";
import {
  COMPANY_REPORT_REASONS,
  COMPANY_REPORT_REASON_LABELS,
  type Company,
  type CompanyReportReason,
} from "@iwtr/shared-types";
import { ApiError, apiPost } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useFollowedCompanies } from "@/lib/useFollowedCompanies";
import { useIsCompanyOwner } from "@/lib/useIsCompanyOwner";

const BUTTON =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50";
const OUTLINE = "border-border bg-surface text-foreground hover:bg-surface-muted";
// The site's one "selected" look: Wood fill + white text.
const SELECTED = "border-brand-600 bg-brand-600 text-white hover:bg-brand-700";

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}
function FlagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 22V4a1 1 0 0 1 .4-.8C5.3 2.5 6.7 2 8.5 2c3 0 4.5 2 7.5 2 1.4 0 2.7-.3 3.6-.8a.5.5 0 0 1 .4.4V14a1 1 0 0 1-.4.8c-.9.7-2.3 1.2-3.6 1.2-3 0-4.5-2-7.5-2-1.8 0-3.2.5-4.1 1.2" />
    </svg>
  );
}
function ShareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}

/**
 * Follow / Report / Share, on the right of a company page's name row.
 * Follow is the same follow as on IWT Social (useFollowedCompanies keeps
 * every Follow button in sync); owners can't follow, so they don't see it.
 * Logged-out visitors get the sign-in modal for Follow and Report.
 */
export function CompanyActions({ company }: { company: Company }) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const isCompanyOwner = useIsCompanyOwner();
  const { followedIds, canFollow, toggleFollow } = useFollowedCompanies();
  const following = followedIds.has(company.id);

  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<CompanyReportReason | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function onFollow() {
    if (!isAuthenticated) return openAuthModal();
    void toggleFollow(company.id, {
      companyName: company.name,
      companySlug: company.slug,
      mainPhotoUrl: company.mainPhotoUrl,
      badgeTier: company.badgeTier,
    });
  }

  function openReport() {
    if (!isAuthenticated) return openAuthModal();
    setReason(null);
    setReportError(null);
    setReportOpen(true);
  }

  async function submitReport() {
    if (!reason) return;
    setReportBusy(true);
    setReportError(null);
    try {
      await apiPost(`/companies/${company.id}/report`, { reason });
      setReportOpen(false);
      setToast("Report submitted. Thank you.");
    } catch (err) {
      setReportError(err instanceof ApiError ? err.message : "Couldn't send the report. Please try again.");
    } finally {
      setReportBusy(false);
    }
  }

  async function onShare() {
    const url = window.location.href.split("#")[0];
    // The phone's own share sheet where there is one, else copy the link.
    if (navigator.share) {
      try {
        await navigator.share({ title: `${company.name} on I Worked There`, url });
      } catch {
        // Closing the share sheet isn't an error worth showing.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setToast("Link copied");
    } catch {
      setToast("Couldn't copy the link");
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {(canFollow || !isAuthenticated) && !isCompanyOwner && (
          <button
            type="button"
            onClick={onFollow}
            aria-pressed={following}
            className={`${BUTTON} ${following ? SELECTED : OUTLINE}`}
          >
            {following ? <CheckIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
            {following ? "Following" : "Follow"}
          </button>
        )}
        <button type="button" onClick={openReport} className={`${BUTTON} ${OUTLINE}`}>
          <FlagIcon className="h-4 w-4" />
          Report
        </button>
        <button type="button" onClick={onShare} className={`${BUTTON} ${OUTLINE}`}>
          <ShareIcon className="h-4 w-4" />
          Share
        </button>
      </div>

      {reportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setReportOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Report ${company.name}`}
            className="w-full max-w-sm rounded-xl bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-sm font-semibold text-foreground">What&apos;s wrong with this company page?</h2>
            <div className="flex flex-col gap-2">
              {COMPANY_REPORT_REASONS.map((r) => (
                <label
                  key={r}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2 text-sm has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 dark:has-[:checked]:bg-brand-950"
                >
                  <input
                    type="radio"
                    name="company-report-reason"
                    className="mt-0.5"
                    checked={reason === r}
                    onChange={() => setReason(r)}
                  />
                  <span className="text-foreground">{COMPANY_REPORT_REASON_LABELS[r]}</span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Reports go to our moderators only. The company never sees who reported it.
            </p>
            {reportError && <p className="mt-2 text-xs text-red-600 dark:text-red-300">{reportError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReport}
                disabled={!reason || reportBusy}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Submit report
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
          <div role="status" className="rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </>
  );
}

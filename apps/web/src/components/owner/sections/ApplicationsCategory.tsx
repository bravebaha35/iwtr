"use client";

import { useEffect, useState } from "react";
import type { JobApplicationListItem } from "@iwtr/shared-types";
import { apiGet, apiGetBlob, apiPost } from "@/lib/api-client";

export function ApplicationsCategory({ companyId }: { companyId: string }) {
  const [applications, setApplications] = useState<JobApplicationListItem[] | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<JobApplicationListItem[]>(`/my-companies/${companyId}/job-applications`)
      .then((data) => {
        if (!cancelled) setApplications(data);
      })
      .catch(() => {
        if (!cancelled) setApplications([]);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  async function markViewed(id: string) {
    await apiPost(`/my-companies/${companyId}/job-applications/${id}/mark-viewed`, {});
    setApplications((prev) => prev && prev.map((a) => (a.id === id ? { ...a, viewedAt: new Date().toISOString() } : a)));
  }

  // a.pdfUrl is now a relative, authenticated apps/api path (e.g.
  // /my-companies/{companyId}/job-applications/{id}/pdf), not a directly
  // fetchable public URL — a plain <a href={a.pdfUrl}> can't attach the
  // Authorization header that route now requires. Fetch it as a blob
  // through the same authenticated proxy every other call on this page
  // uses, then open it from an object URL instead.
  async function viewCv(a: JobApplicationListItem) {
    setPdfError(null);
    if (a.viewedAt === null) void markViewed(a.id);
    try {
      const blob = await apiGetBlob(a.pdfUrl);
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank");
      // The object URL only needs to live long enough for the new tab to
      // load it, not for the rest of this page's lifetime — revoke it
      // shortly after rather than leaking one blob URL per click.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      setPdfError("Couldn't open that CV.");
    }
  }

  if (applications === null) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (applications.length === 0) return <p className="text-sm text-muted-foreground">No applications yet.</p>;

  return (
    <div className="flex flex-col gap-2">
      {pdfError && <p className="text-sm text-red-600 dark:text-red-300">{pdfError}</p>}
      <ul className="flex flex-col gap-2">
        {applications.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{a.applicantDisplayName}</p>
              <p className="truncate text-xs text-muted-foreground">
                Applied to {a.jobTitle} · {new Date(a.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {a.viewedAt === null && (
                <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-bold uppercase">
                  New
                </span>
              )}
              <button type="button" onClick={() => viewCv(a)} className="text-xs font-bold underline">
                View CV
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

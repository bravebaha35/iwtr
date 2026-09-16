"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { MyProfile, SubmitJobApplicationResponse } from "@iwtr/shared-types";
import { apiGet, apiUpload } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { CvPreview } from "@/components/profile/CvPreview";

// Renders the actual CvPreview off-screen (never visible to the user as a
// second copy on the page) purely so html2pdf.js has a real DOM node with
// real layout to snapshot — this is the same node design shown live on
// /me's "My CV" tab (see Task 5), so the PDF a company receives always
// matches what the applicant already saw there. profile is fetched once on
// mount (not per click) since Apply is a fast action — a stale-by-a-few-
// minutes CV snapshot is an acceptable tradeoff against re-fetching on
// every click.
export function ApplyButton({ jobPostingId }: { jobPostingId: string }) {
  const { isAuthenticated, role } = useAuth();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [state, setState] = useState<"idle" | "generating" | "sending" | "done" | "error">("idle");
  const hiddenPreviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated || role === "COMPANY_OWNER") return;
    let cancelled = false;
    apiGet<MyProfile>("/me/profile").then((data) => {
      if (!cancelled) setProfile(data);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, role]);

  if (!isAuthenticated || role === "COMPANY_OWNER") return null;

  async function handleApply() {
    if (!hiddenPreviewRef.current) return;
    setState("generating");
    try {
      // html2pdf.js needs the node actually mounted (even if visually
      // hidden via position, never `display:none` — that produces a blank
      // PDF) to compute real layout before snapshotting it.
      const html2pdf = (await import("html2pdf.js")).default;
      const blob: Blob = await html2pdf()
        .set({ filename: "cv.pdf", jsPDF: { format: "a4" } })
        .from(hiddenPreviewRef.current)
        .outputPdf("blob");

      setState("sending");
      const formData = new FormData();
      formData.append("file", blob, "cv.pdf");
      await apiUpload<SubmitJobApplicationResponse>(`/job-postings/${jobPostingId}/apply`, formData);
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <>
      <motion.button
        type="button"
        onClick={handleApply}
        disabled={!profile || state === "generating" || state === "sending"}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
        className="flex h-7 items-center gap-1 rounded-none border border-slate-800 bg-slate-900 px-2 text-xs font-bold text-zinc-50 transition disabled:opacity-50"
      >
        {state === "done" ? "Applied" : state === "generating" || state === "sending" ? "Sending..." : "Apply"}
      </motion.button>
      {/* Positioned off-screen, not display:none, so html2pdf.js can still
          measure real layout. */}
      {profile && (
        <div style={{ position: "fixed", left: "-9999px", top: 0, width: "210mm" }} aria-hidden="true">
          <div ref={hiddenPreviewRef}>
            <CvPreview profile={profile} />
          </div>
        </div>
      )}
    </>
  );
}

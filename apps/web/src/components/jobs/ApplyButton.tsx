"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { MyEmploymentEntry, MyProfile, SubmitJobApplicationResponse } from "@iwtr/shared-types";
import { apiGet, apiUpload } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { CvPreview } from "@/components/profile/CvPreview";
import {
  getCvShowEmail,
  getCvShowPhone,
  getHasSavedCv,
  getHasSeenApplyCvPrompt,
  markSeenApplyCvPrompt,
} from "@/lib/cvDisclosurePrefs";

// Renders the actual CvPreview off-screen (never visible to the user as a
// second copy on the page) purely so html2pdf.js has a real DOM node with
// real layout to snapshot — this is the same node design shown live on
// /me's "My CV" tab (see Task 5), so the PDF a company receives always
// matches what the applicant already saw there.
//
// profile and employment history are fetched LAZILY, inside handleApply,
// not on mount: fetching eagerly on every card's mount fired one
// unhandled-rejection-prone request per job card for any non-ACTIVE member
// browsing /jobs, and mounted a hidden CV DOM tree nobody needed unless they
// actually clicked Apply (see the 2026-09-16 final-review fix report,
// Fix 3). Employment history is fetched here — in parallel with profile —
// and passed into CvPreview as a prop specifically so CvPreview's own
// internal fetch is skipped for this hidden instance: since this component
// now mounts for the very first time right as Apply is clicked (no head
// start from an earlier mount-time fetch), letting it run its own fetch
// would race html2pdf's snapshot.
export function ApplyButton({ jobPostingId }: { jobPostingId: string }) {
  const { isAuthenticated, role } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [employment, setEmployment] = useState<MyEmploymentEntry[]>([]);
  const [state, setState] = useState<"idle" | "generating" | "sending" | "error" | "done">("idle");
  // Shown at most once ever per member — see cvDisclosurePrefs.ts's doc
  // comment on HAS_SEEN_APPLY_PROMPT_KEY.
  const [showCvPrompt, setShowCvPrompt] = useState(false);
  const hiddenPreviewRef = useRef<HTMLDivElement>(null);
  // Flips to true right before `profile` is populated inside handleApply.
  // The effect below waits on it: set the state, let React actually commit
  // the hidden CvPreview to the DOM (with employment history already in
  // hand, not racing its own fetch), THEN run html2pdf — rather than racing
  // a state update against a render that hasn't happened yet.
  const pendingGenerationRef = useRef(false);

  const generateAndSend = useCallback(async () => {
    if (!hiddenPreviewRef.current) {
      setState("error");
      return;
    }
    try {
      // A React state update commits to the DOM synchronously, but the
      // browser hasn't necessarily painted/laid out that commit yet on the
      // very first frame after mount. Waiting two animation frames gives
      // html2canvas a DOM it has actually rendered at least once before it
      // measures it, instead of reading a 0x0 box.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      const html2pdf = (await import("html2pdf.js")).default;
      // html2pdf.js's bundled type declaration doesn't list `pagebreak`
      // (an option the library does support at runtime — see its README),
      // so it's added here via a local intersection type on top of
      // whatever `.set()` actually accepts, rather than widening the call
      // to `any` or hand-maintaining a separate ambient .d.ts for one field.
      const pdfOptions: Parameters<InstanceType<typeof html2pdf.Worker>["set"]>[0] & {
        pagebreak?: { mode: Array<"avoid-all" | "css" | "legacy"> };
      } = {
        filename: "cv.pdf",
        jsPDF: { format: "a4" },
        // A CV with several employment entries plus a long free-text block
        // can be taller than one A4 page — without this it's silently cut
        // off at one page instead of spanning multiple.
        pagebreak: { mode: ["css", "legacy"] },
      };
      const blob: Blob = await html2pdf().set(pdfOptions).from(hiddenPreviewRef.current).outputPdf("blob");

      setState("sending");
      const formData = new FormData();
      formData.append("file", blob, "cv.pdf");
      await apiUpload<SubmitJobApplicationResponse>(`/job-postings/${jobPostingId}/apply`, formData);
      setState("done");
    } catch {
      setState("error");
    }
  }, [jobPostingId]);

  useEffect(() => {
    if (pendingGenerationRef.current && profile) {
      pendingGenerationRef.current = false;
      void generateAndSend();
    }
  }, [profile, generateAndSend]);

  if (!isAuthenticated || role === "COMPANY_OWNER") return null;

  function goToCv() {
    router.push("/me?tab=cv");
  }

  async function handleApply() {
    // A member who has never saved the "My CV" tab is still sending
    // *something* (CvPreview always renders — see its "Your name here"
    // fallback), but nobody has actually looked at it yet. Redirect to the
    // CV editor instead of applying with an unreviewed CV; the very first
    // time this happens for an account, lead with a one-time explanatory
    // prompt rather than silently redirecting.
    if (!getHasSavedCv()) {
      if (!getHasSeenApplyCvPrompt()) {
        markSeenApplyCvPrompt();
        setShowCvPrompt(true);
        return;
      }
      goToCv();
      return;
    }

    // Confirm before the FIRST successful generate-and-send on this button
    // instance — sending a CV (which may include email/phone, see Fix 2) to
    // an employer isn't something a single accidental click should trigger.
    if (!window.confirm("This will send your CV to this employer. Continue?")) return;
    setState("generating");
    try {
      const [fetchedProfile, fetchedEmployment] = await Promise.all([
        apiGet<MyProfile>("/me/profile"),
        apiGet<MyEmploymentEntry[]>("/me/employment-history"),
      ]);
      pendingGenerationRef.current = true;
      setEmployment(fetchedEmployment);
      setProfile(fetchedProfile);
    } catch {
      setState("error");
    }
  }

  return (
    <>
      <motion.button
        type="button"
        onClick={handleApply}
        disabled={state === "generating" || state === "sending"}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
        className="flex h-7 items-center gap-1 rounded-none border border-border bg-sidebar px-2 text-xs font-bold text-sidebar-foreground transition disabled:opacity-50"
      >
        {state === "done"
          ? "Applied"
          : state === "generating" || state === "sending"
            ? "Sending..."
            : state === "error"
              ? "Couldn't send — try again"
              : "Apply"}
      </motion.button>
      {showCvPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setShowCvPrompt(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-xl bg-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-foreground">
              Before you apply for any job we advice you edit your profile to max and add notes in the
              &quot;CV&quot; section to gain even more attention!
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCvPrompt(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-surface-muted"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCvPrompt(false);
                  goToCv();
                }}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-brand-700"
              >
                Go to My CV
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Positioned off-screen, not display:none, so html2pdf.js can still
          measure real layout. */}
      {profile && (
        <div style={{ position: "fixed", left: "-9999px", top: 0, width: "210mm" }} aria-hidden="true">
          <div ref={hiddenPreviewRef}>
            <CvPreview
              profile={profile}
              employment={employment}
              showEmail={getCvShowEmail()}
              showPhone={getCvShowPhone()}
              forPrint
            />
          </div>
        </div>
      )}
    </>
  );
}

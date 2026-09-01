"use client";

import { useEffect, useState } from "react";
import type { CreateJobPostingResult, OwnedCompany } from "@iwtr/shared-types";
import { apiGet, ApiError } from "@/lib/api-client";
import { JobSetupModal, type JobSetupData } from "@/components/jobs/JobSetupModal";
import { JobBoostModal } from "@/components/jobs/JobBoostModal";

// Close (x) button shared by every step's card here — same shape as
// AuthModal.tsx's local CloseButton (not exported from there, so redeclared).
function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  );
}

function ShellModal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="relative w-full max-w-sm rounded-xl bg-surface p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <CloseButton onClose={onClose} />
        {children}
      </div>
    </div>
  );
}

type Step = "loading" | "none-approved" | "picker" | "setup" | "boost" | "done";

/**
 * Owns the "+" button's whole job-creation flow: which company it's for
 * (auto-resolved if the owner has exactly one approved company, otherwise a
 * one-line picker — the spec's "+" is global, not per-company), then Modal 1
 * (JobSetupModal) -> Modal 2 (JobBoostModal) in sequence.
 */
export function JobCreationFlow({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<Step>("loading");
  const [companies, setCompanies] = useState<OwnedCompany[]>([]);
  const [company, setCompany] = useState<OwnedCompany | null>(null);
  const [setupData, setSetupData] = useState<JobSetupData | null>(null);
  const [result, setResult] = useState<CreateJobPostingResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("loading");
    setCompany(null);
    setSetupData(null);
    setResult(null);
    setLoadError(null);
    apiGet<OwnedCompany[]>("/me/owned-companies")
      .then((data) => {
        setCompanies(data);
        if (data.length === 0) {
          setStep("none-approved");
        } else if (data.length === 1) {
          setCompany(data[0]);
          setStep("setup");
        } else {
          setStep("picker");
        }
      })
      .catch((err) => {
        setLoadError(err instanceof ApiError ? err.message : "Couldn't load your companies.");
        setStep("none-approved");
      });
  }, [open]);

  function reset() {
    setStep("loading");
    onClose();
  }

  if (!open) return null;

  if (step === "loading") {
    return (
      <ShellModal onClose={reset}>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </ShellModal>
    );
  }

  if (step === "none-approved") {
    return (
      <ShellModal onClose={reset}>
        <h2 className="mb-2 text-lg font-bold text-foreground">No approved company yet</h2>
        <p className="text-sm text-muted-foreground">
          {loadError ?? "You need an approved company claim before you can post a job. Claim a company from its page, then check back once an admin approves it."}
        </p>
      </ShellModal>
    );
  }

  if (step === "picker") {
    return (
      <ShellModal onClose={reset}>
        <h2 className="mb-4 text-lg font-bold text-foreground">Which company is this job for?</h2>
        <div className="flex flex-col gap-2">
          {companies.map((c) => (
            <button
              key={c.companyId}
              type="button"
              onClick={() => {
                setCompany(c);
                setStep("setup");
              }}
              className="rounded-lg border border-border px-3 py-2 text-left text-sm font-medium text-foreground transition hover:bg-surface-muted"
            >
              {c.companyName}
            </button>
          ))}
        </div>
      </ShellModal>
    );
  }

  if (step === "setup" && company) {
    return (
      <JobSetupModal
        company={company}
        onClose={reset}
        onContinue={(data) => {
          setSetupData(data);
          setStep("boost");
        }}
      />
    );
  }

  if (step === "boost" && company && setupData) {
    return (
      <JobBoostModal
        company={company}
        setupData={setupData}
        onClose={reset}
        onDone={(res) => {
          setResult(res);
          setStep("done");
        }}
      />
    );
  }

  if (step === "done" && result) {
    return (
      <ShellModal onClose={reset}>
        <h2 className="mb-2 text-lg font-bold text-foreground">
          {result.status === "PENDING_ADMIN" ? "Submitted for review" : "Your job posting is up !"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {result.status === "PENDING_ADMIN"
            ? "This posting needs a quick admin check before it goes live — you'll get a notification once it's published."
            : "Job-seekers browsing /jobs can see it now."}
        </p>
      </ShellModal>
    );
  }

  return null;
}

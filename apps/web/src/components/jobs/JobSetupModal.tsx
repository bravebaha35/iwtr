"use client";

import { useEffect, useState } from "react";
import type { CompanyDetail, OwnedCompany } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { SingleSelectDropdown } from "@/components/Dropdown";

const DESCRIPTION_MAX_LENGTH = 600;

export interface JobSetupData {
  jobTitle: string;
  description: string;
}

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

/**
 * Job Creation Flow, Modal 1 ("Setup"): grayed-out company name + sector,
 * a job-title dropdown sourced from the company's own workplace-type
 * keyword catalog (GET /companies/:slug/job-title-suggestions — the same
 * Turkish keyword lists workplace-classifier/workplaceCategories.ts already
 * uses to classify EmploymentHistory rows), and a capped description.
 */
export function JobSetupModal({
  company,
  onClose,
  onContinue,
}: {
  company: OwnedCompany;
  onClose: () => void;
  onContinue: (data: JobSetupData) => void;
}) {
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [jobTitle, setJobTitle] = useState<string | null>(null);
  const [description, setDescription] = useState("");

  useEffect(() => {
    apiGet<CompanyDetail>(`/companies/${company.companySlug}`)
      .then(setDetail)
      .catch(() => setDetail(null));
    apiGet<string[]>(`/companies/${company.companySlug}/job-title-suggestions`)
      .then(setSuggestions)
      .catch(() => setSuggestions([]));
  }, [company.companySlug]);

  const canContinue = Boolean(jobTitle) && description.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="relative w-full max-w-lg rounded-xl bg-surface p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <CloseButton onClose={onClose} />
        <h2 className="mb-1 text-xl font-bold text-foreground">Post a job</h2>
        <p className="mb-6 text-sm text-muted-foreground">Step 1 of 2 — the basics.</p>

        <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-muted px-3 py-2">
          <span className="truncate text-sm font-medium text-muted-foreground">{company.companyName}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{detail?.company.category ?? "—"}</span>
        </div>

        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">What are you looking for?</span>
          <SingleSelectDropdown
            value={jobTitle}
            onChange={setJobTitle}
            options={suggestions.map((title) => ({ value: title, label: title }))}
            placeholder={suggestions.length === 0 ? "Loading..." : "Choose a job title"}
            disabled={suggestions.length === 0}
          />
        </label>

        <label className="mb-6 block">
          <span className="mb-1 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Tell us more</span>
            <span>
              {description.length}/{DESCRIPTION_MAX_LENGTH}
            </span>
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX_LENGTH))}
            rows={4}
            placeholder="Responsibilities, working hours, what makes this role worth applying for..."
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          />
        </label>

        <button
          type="button"
          disabled={!canContinue}
          onClick={() => jobTitle && onContinue({ jobTitle, description: description.trim() })}
          className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

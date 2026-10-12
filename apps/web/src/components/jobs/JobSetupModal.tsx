"use client";

import { useCallback, useEffect, useState } from "react";
import {
  JOB_DESCRIPTION_MAX_LENGTH,
  MAX_JOB_POSITIONS,
  type CompanyDetail,
  type JobPosition,
  type OwnedCompany,
  type WorkplaceType,
} from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { SingleSelectDropdown } from "@/components/Dropdown";
import { BulletTextarea } from "@/components/BulletTextarea";
import { PositionPicker } from "@/components/jobs/PositionPicker";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";

export interface JobSetupData {
  jobTitle: string;
  description: string;
  workType: WorkplaceType;
  positions: JobPosition[];
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

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <p className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px] font-semibold text-foreground">
      <span>{children}</span>
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </p>
  );
}

function Missing({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-300">{children}</p>;
}

/**
 * Job Creation Flow, step 1 ("Setup"), a wide two-sided pop-up:
 * - left: the company (greyed out), the job-title dropdown sourced from the
 *   company's own workplace-type keyword catalog (GET
 *   /companies/:slug/job-title-suggestions), the work type when the company
 *   has two, and the Position buttons (1 to 3);
 * - right: nothing but "Tell us more", up to 4000 characters, with bullet
 *   and numbered lists.
 * Nothing is forced while filling it in - a dropdown closes on a click
 * anywhere - and Continue says what is still missing.
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
  const [workType, setWorkType] = useState<WorkplaceType | null>(null);
  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [detailError, setDetailError] = useState(false);
  // Turned on by the first Continue press with something missing.
  const [showMissing, setShowMissing] = useState(false);

  // workType can only ever come from this fetch (OwnedCompany has no
  // workplaceTypes of its own), so a transient failure here must be
  // retryable - otherwise the flow can never be continued.
  const loadDetail = useCallback(() => {
    setDetailError(false);
    apiGet<CompanyDetail>(`/companies/${company.companySlug}`)
      .then((d) => {
        setDetail(d);
        // A single-work-type company never sees the work-type control at
        // all; a two-type company picks one.
        if (d.company.workplaceTypes.length === 1) {
          setWorkType(d.company.workplaceTypes[0]);
        }
      })
      .catch(() => setDetailError(true));
  }, [company.companySlug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDetail();
    apiGet<string[]>(`/companies/${company.companySlug}/job-title-suggestions`)
      .then(setSuggestions)
      .catch(() => setSuggestions([]));
  }, [company.companySlug, loadDetail]);

  function togglePosition(value: JobPosition) {
    setPositions((prev) => {
      if (prev.includes(value)) return prev.filter((p) => p !== value);
      return prev.length >= MAX_JOB_POSITIONS ? prev : [...prev, value];
    });
  }

  const text = description.trim();
  const missing = {
    jobTitle: !jobTitle,
    workType: workType === null,
    positions: positions.length === 0,
    description: text.length === 0,
  };
  const anyMissing = Object.values(missing).some(Boolean);
  // Something has been filled in: a stray click on the dark area mustn't
  // throw it away.
  const dirty = Boolean(jobTitle) || positions.length > 0 || text.length > 0;

  function submit() {
    if (anyMissing || !jobTitle || !workType) {
      setShowMissing(true);
      return;
    }
    onContinue({ jobTitle, description: text, workType, positions });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
      onClick={() => {
        if (!dirty) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label="Post a job"
        className="relative flex max-h-full w-full max-w-5xl flex-col overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <CloseButton onClose={onClose} />
        <h2 className="mb-1 text-2xl text-foreground">Post a job</h2>
        <p className="mb-6 text-sm text-muted-foreground">Step 1 of 2: the basics.</p>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,29rem)_minmax(0,1fr)]">
          {/* Left: who, what, which level. */}
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-muted px-3.5 py-2.5">
              <span className="truncate text-sm font-semibold text-foreground/80">{company.companyName}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{detail?.company.category ?? "-"}</span>
            </div>

            {/* Plain wrappers, not <label>: a label hands a click anywhere
                inside it to its first button, which is the dropdown's own
                trigger - so a click-away meant to close the list opened it
                again. */}
            <div>
              <FieldLabel>What are you looking for?</FieldLabel>
              <SingleSelectDropdown
                value={jobTitle}
                onChange={setJobTitle}
                options={suggestions.map((title) => ({ value: title, label: title }))}
                placeholder={suggestions.length === 0 ? "Loading..." : "Choose a job title"}
                disabled={suggestions.length === 0}
                ariaLabel="Job title"
              />
              {showMissing && missing.jobTitle && <Missing>Choose a job title.</Missing>}
            </div>

            {detailError && (
              <p className="text-sm text-red-600 dark:text-red-300">
                Couldn&apos;t load company details.{" "}
                <button type="button" onClick={loadDetail} className="underline">
                  Retry
                </button>
              </p>
            )}

            {detail && detail.company.workplaceTypes.length > 1 && (
              <div>
                <FieldLabel>Which type of role is this?</FieldLabel>
                <SingleSelectDropdown
                  value={workType}
                  onChange={(v) => setWorkType(v as WorkplaceType | null)}
                  options={detail.company.workplaceTypes.map((t) => ({ value: t, label: workplaceTypeLabel(t) }))}
                  placeholder="Choose a work type"
                  ariaLabel="Work type"
                />
                {showMissing && missing.workType && <Missing>Choose a work type.</Missing>}
              </div>
            )}

            <div>
              <FieldLabel
                hint={
                  <span aria-live="polite">
                    {positions.length} of {MAX_JOB_POSITIONS} ticked
                  </span>
                }
              >
                Position
              </FieldLabel>
              <PositionPicker selected={positions} onToggle={togglePosition} max={MAX_JOB_POSITIONS} columns={2} />
              <p className="mt-2 text-xs text-muted-foreground">
                Tick the level this role is for - {MAX_JOB_POSITIONS} at most. Job-seekers can filter the Jobs page by
                position, and see it when they open your posting.
              </p>
              {showMissing && missing.positions && <Missing>Tick at least one position.</Missing>}
            </div>
          </div>

          {/* Right: the description, and nothing else. */}
          <div className="flex min-h-[24rem] flex-col">
            <FieldLabel
              hint={
                <span className="tabular-nums">
                  {description.length}/{JOB_DESCRIPTION_MAX_LENGTH}
                </span>
              }
            >
              Tell us more
            </FieldLabel>
            <BulletTextarea
              value={description}
              onChange={setDescription}
              maxLength={JOB_DESCRIPTION_MAX_LENGTH}
              ariaLabel="Tell us more"
              placeholder="Responsibilities, working hours, what makes this role worth applying for..."
              className="flex-1"
            />
            {showMissing && missing.description && <Missing>Write a few words about the role.</Missing>}
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
          {showMissing && anyMissing && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-300">
              A few things are still missing - they&apos;re marked above.
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            className="rounded-full bg-brand-600 px-9 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98]"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

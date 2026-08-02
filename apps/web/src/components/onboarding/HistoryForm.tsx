"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiPost, ApiError } from "@/lib/api-client";
import type { CompanyListItem, EduLevel } from "@iwtr/shared-types";
import { WorkplacePicker } from "@/components/WorkplacePicker";
import { DateDropdownPicker } from "@/components/DateDropdownPicker";

const EDU_LEVELS: { level: EduLevel; label: string }[] = [
  { level: "ELEMENTARY", label: "Elementary School" },
  { level: "HIGH_SCHOOL", label: "High School" },
  { level: "COLLEGE", label: "College" },
];

type EduRow = { institutionName: string; graduationYear: string };
const emptyEduRows: Record<EduLevel, EduRow> = {
  ELEMENTARY: { institutionName: "", graduationYear: "" },
  HIGH_SCHOOL: { institutionName: "", graduationYear: "" },
  COLLEGE: { institutionName: "", graduationYear: "" },
};

type JobRow = {
  company: Pick<CompanyListItem, "id" | "name" | "slug"> | null;
  startDate: string | null;
  endDate: string | null;
};
const emptyJob: JobRow = { company: null, startDate: null, endDate: null };

export function HistoryForm({ onSubmitted }: { onSubmitted: () => void }) {
  const { accessToken } = useAuth();
  const [edu, setEdu] = useState(emptyEduRows);
  const [jobs, setJobs] = useState<JobRow[]>([{ ...emptyJob }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateJob(index: number, patch: Partial<JobRow>) {
    setJobs((prev) => prev.map((j, i) => (i === index ? { ...j, ...patch } : j)));
  }

  function addJob() {
    setJobs((prev) => [...prev, { ...emptyJob }]);
  }

  function removeJob(index: number) {
    setJobs((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const education = EDU_LEVELS.filter((l) => edu[l.level].institutionName.trim() !== "").map(
        (l) => ({
          level: l.level,
          institutionName: edu[l.level].institutionName,
          graduationYear: edu[l.level].graduationYear ? Number(edu[l.level].graduationYear) : undefined,
        }),
      );
      const employment = jobs
        .filter((j) => j.company !== null)
        .map((j) => ({
          rawCompanyName: j.company!.name,
          companyId: j.company!.id,
          startDate: j.startDate ?? undefined,
          endDate: j.endDate ?? undefined,
        }));

      if (education.length === 0 || employment.length === 0) {
        setError("Please fill in at least one school and pick at least one workplace.");
        setSubmitting(false);
        return;
      }

      await apiPost("/onboarding/history", { education, employment }, accessToken ?? undefined);
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 px-4 py-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-xl bg-surface p-8 shadow-xl"
      >
        <h2 className="mb-1 text-xl font-bold text-foreground">
          Your education &amp; work history
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          You&apos;ll only be able to rate workplaces that appear here.
        </p>

        <div className="mb-6 flex flex-col gap-3">
          {EDU_LEVELS.map(({ level, label }) => (
            <div key={level} className="grid grid-cols-3 gap-2">
              <input
                placeholder={label}
                value={edu[level].institutionName}
                onChange={(e) =>
                  setEdu((prev) => ({ ...prev, [level]: { ...prev[level], institutionName: e.target.value } }))
                }
                className="col-span-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground"
              />
              <input
                placeholder="Grad. year"
                inputMode="numeric"
                value={edu[level].graduationYear}
                onChange={(e) =>
                  setEdu((prev) => ({ ...prev, [level]: { ...prev[level], graduationYear: e.target.value } }))
                }
                className="col-span-1 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground"
              />
            </div>
          ))}
        </div>

        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground/80">
            Where have you worked?
          </h3>
          <button
            type="button"
            onClick={addJob}
            className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-200 dark:bg-brand-900 dark:text-brand-300 dark:hover:bg-brand-900/70"
          >
            + Add workplace
          </button>
        </div>
        <div className="flex flex-col gap-4">
          {jobs.map((job, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <WorkplacePicker onPick={(company) => updateJob(i, { company })} />
              {job.company && (
                <p className="text-xs text-muted-foreground">
                  Selected: <span className="font-medium text-foreground">{job.company.name}</span>
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="mb-1 text-[11px] font-medium text-muted-foreground">Start date</p>
                  <DateDropdownPicker
                    value={job.startDate}
                    onChange={(v) => updateJob(i, { startDate: v })}
                    maxYear={new Date().getFullYear()}
                  />
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-medium text-muted-foreground">End date (if any)</p>
                  <DateDropdownPicker
                    value={job.endDate}
                    onChange={(v) => updateJob(i, { endDate: v })}
                    maxYear={new Date().getFullYear()}
                  />
                </div>
              </div>
              {jobs.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeJob(i)}
                  className="self-start text-xs text-red-500 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Continue"}
        </button>
      </form>
    </div>
  );
}

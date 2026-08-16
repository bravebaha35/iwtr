"use client";

import { useState } from "react";
import { apiPost, ApiError } from "@/lib/api-client";
import type { EduLevel } from "@iwtr/shared-types";
import { WorkplacePicker } from "@/components/WorkplacePicker";
import { DateDropdownPicker } from "@/components/DateDropdownPicker";

const EDU_LEVELS: { level: EduLevel; label: string }[] = [
  { level: "ELEMENTARY", label: "Elementary School" },
  { level: "HIGH_SCHOOL", label: "High School" },
  { level: "COLLEGE", label: "College" },
];

// Elementary is assumed universal and always shown. High school and college
// aren't — not everyone finished (or attended) either, so both get a
// "didn't graduate" toggle. Unticked (the default) is the normal case —
// fields stay active. Ticking it doesn't hide the row (a collapsing form is
// disorienting) — the fields just grey out and stop accepting input, without
// losing whatever was already typed, so unticking again picks right back up.
// Anyone who skipped one here can still add it later from the Edit Profile
// page (its education section is an open-ended list, not fixed per-level
// slots).
const OPTIONAL_EDU_LEVELS: EduLevel[] = ["HIGH_SCHOOL", "COLLEGE"];

function DidNotGraduateToggle({
  checked,
  onChange,
  tooltip,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  tooltip: string;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="relative inline-flex shrink-0"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={tooltip}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
          checked ? "border-brand-600 bg-brand-600" : "border-border bg-transparent hover:border-muted-foreground"
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      >
        {checked && (
          <svg viewBox="0 0 24 24" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>
      {hovered && (
        <div className="pointer-events-none absolute right-full top-1/2 z-10 mr-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-lg">
          {tooltip}
          <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-foreground" />
        </div>
      )}
    </div>
  );
}

type EduRow = { institutionName: string; graduationYear: string; faculty: string; department: string };
const emptyEduRows: Record<EduLevel, EduRow> = {
  ELEMENTARY: { institutionName: "", graduationYear: "", faculty: "", department: "" },
  HIGH_SCHOOL: { institutionName: "", graduationYear: "", faculty: "", department: "" },
  COLLEGE: { institutionName: "", graduationYear: "", faculty: "", department: "" },
};

type JobRow = {
  // companyId is null when the reviewer free-typed a workplace name that
  // didn't match anything already seeded — see WorkplacePicker's
  // allowFreeText. The backend (onboarding.service.ts's submitHistory)
  // stores it as a plain rawCompanyName either way and backfills the link
  // later if/when a matching Company is seeded.
  company: { companyId: string | null; name: string; slug: string | null } | null;
  startDate: string | null;
  endDate: string | null;
};
const emptyJob: JobRow = { company: null, startDate: null, endDate: null };

export function HistoryForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [edu, setEdu] = useState(emptyEduRows);
  const [didNotGraduate, setDidNotGraduate] = useState<Record<EduLevel, boolean>>({
    ELEMENTARY: false,
    HIGH_SCHOOL: false,
    COLLEGE: false,
  });
  const [jobs, setJobs] = useState<JobRow[]>([{ ...emptyJob }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // College graduation requires having graduated high school first, so
  // "didn't graduate high school" and "didn't graduate college" are kept in
  // lockstep whenever high school is the one being toggled: ticking it
  // forces college on too (and locks it — see the `disabled` prop below),
  // unticking it clears and unlocks college again, since "I did graduate
  // high school" removes the only reason college was forced on. College can
  // still be ticked/unticked independently whenever high school itself is
  // unticked.
  function setDidNotGraduateLevel(level: EduLevel, next: boolean) {
    setDidNotGraduate((prev) => {
      const updated = { ...prev, [level]: next };
      if (level === "HIGH_SCHOOL") updated.COLLEGE = next;
      return updated;
    });
  }

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
      const education = EDU_LEVELS.filter(
        (l) => !didNotGraduate[l.level] && edu[l.level].institutionName.trim() !== "",
      ).map(
        (l) => ({
          level: l.level,
          institutionName: edu[l.level].institutionName,
          graduationYear: edu[l.level].graduationYear ? Number(edu[l.level].graduationYear) : undefined,
          faculty: l.level === "COLLEGE" && edu[l.level].faculty.trim() ? edu[l.level].faculty.trim() : undefined,
          department:
            (l.level === "COLLEGE" || l.level === "HIGH_SCHOOL") && edu[l.level].department.trim()
              ? edu[l.level].department.trim()
              : undefined,
        }),
      );
      const employment = jobs
        .filter((j) => j.company !== null)
        .map((j) => ({
          rawCompanyName: j.company!.name,
          companyId: j.company!.companyId ?? undefined,
          startDate: j.startDate ?? undefined,
          endDate: j.endDate ?? undefined,
        }));

      if (education.length === 0 || employment.length === 0) {
        setError("Please fill in at least one school and pick at least one workplace.");
        setSubmitting(false);
        return;
      }

      await apiPost("/onboarding/history", { education, employment });
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
        // max-w-xl (not the lg used elsewhere) — the start/end date pair
        // below sit side by side in a 2-column row, and each half needs
        // enough room for Day/Month/Year to stay on one line ("September"
        // is the long pole) instead of wrapping.
        className="w-full max-w-xl rounded-xl bg-surface p-8 shadow-xl"
      >
        <h2 className="mb-1 text-xl font-bold text-foreground">
          Your education &amp; work history
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          You&apos;ll only be able to rate workplaces that appear here.
        </p>

        <div className="mb-6 flex flex-col gap-3">
          {EDU_LEVELS.map(({ level, label }) => {
            const isOptional = OPTIONAL_EDU_LEVELS.includes(level);
            const greyedOut = isOptional && didNotGraduate[level];
            return (
              <div key={level} className="flex flex-col gap-2">
                {isOptional && (
                  <div className="flex items-center gap-2">
                    <DidNotGraduateToggle
                      checked={didNotGraduate[level]}
                      onChange={(next) => setDidNotGraduateLevel(level, next)}
                      disabled={level === "COLLEGE" && didNotGraduate.HIGH_SCHOOL}
                      tooltip={
                        level === "COLLEGE" && didNotGraduate.HIGH_SCHOOL
                          ? "Can't graduate college without graduating high school first."
                          : `I didn't graduate from ${level === "HIGH_SCHOOL" ? "high school" : "college"}.`
                      }
                    />
                    <span className="text-sm font-medium text-foreground">{label}</span>
                  </div>
                )}
                <div className={`flex flex-col gap-2 transition-opacity ${greyedOut ? "opacity-40" : ""}`}>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      disabled={greyedOut}
                      placeholder={isOptional ? "Institution name" : label}
                      value={edu[level].institutionName}
                      onChange={(e) =>
                        setEdu((prev) => ({ ...prev, [level]: { ...prev[level], institutionName: e.target.value } }))
                      }
                      className="col-span-2 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed"
                    />
                    <input
                      disabled={greyedOut}
                      placeholder="Grad. year"
                      inputMode="numeric"
                      value={edu[level].graduationYear}
                      onChange={(e) =>
                        setEdu((prev) => ({ ...prev, [level]: { ...prev[level], graduationYear: e.target.value } }))
                      }
                      className="col-span-1 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed"
                    />
                  </div>
                  {level === "COLLEGE" && edu.COLLEGE.institutionName.trim() !== "" && (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        disabled={greyedOut}
                        placeholder="Faculty"
                        value={edu.COLLEGE.faculty}
                        onChange={(e) =>
                          setEdu((prev) => ({ ...prev, COLLEGE: { ...prev.COLLEGE, faculty: e.target.value } }))
                        }
                        className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed"
                      />
                      <input
                        disabled={greyedOut}
                        placeholder="Department (optional)"
                        value={edu.COLLEGE.department}
                        onChange={(e) =>
                          setEdu((prev) => ({ ...prev, COLLEGE: { ...prev.COLLEGE, department: e.target.value } }))
                        }
                        className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed"
                      />
                    </div>
                  )}
                  {level === "HIGH_SCHOOL" && edu.HIGH_SCHOOL.institutionName.trim() !== "" && (
                    <input
                      disabled={greyedOut}
                      placeholder="Department (optional)"
                      value={edu.HIGH_SCHOOL.department}
                      onChange={(e) =>
                        setEdu((prev) => ({
                          ...prev,
                          HIGH_SCHOOL: { ...prev.HIGH_SCHOOL, department: e.target.value },
                        }))
                      }
                      className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed"
                    />
                  )}
                </div>
              </div>
            );
          })}
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
              <WorkplacePicker allowFreeText onPick={(company) => updateJob(i, { company })} />
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
                    onChange={(v) => {
                      // Clearing the start date re-greys end date; picking a
                      // later start year invalidates an existing end date
                      // that's now earlier than it — both cases drop endDate
                      // rather than leave it silently out of range.
                      const endStillValid =
                        v !== null && job.endDate !== null && Number(job.endDate.slice(0, 4)) >= Number(v.slice(0, 4));
                      updateJob(i, { startDate: v, endDate: endStillValid ? job.endDate : null });
                    }}
                    maxYear={new Date().getFullYear()}
                  />
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                    End date (if any) {!job.startDate && "— pick a start date first"}
                  </p>
                  <DateDropdownPicker
                    value={job.endDate}
                    onChange={(v) => updateJob(i, { endDate: v })}
                    minYear={job.startDate ? Number(job.startDate.slice(0, 4)) : undefined}
                    maxYear={new Date().getFullYear()}
                    disabled={!job.startDate}
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

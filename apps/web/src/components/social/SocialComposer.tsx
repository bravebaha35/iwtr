"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { OwnedCompany, OwnerJobPosting } from "@iwtr/shared-types";
import {
  validateSocialImageUpload,
  MAX_SOCIAL_POST_IMAGES,
  SOCIAL_EVENT_LOCATION_MAX,
  SOCIAL_POLL_DAYS,
  SOCIAL_POLL_MAX_OPTIONS,
  SOCIAL_POLL_MIN_OPTIONS,
  SOCIAL_POLL_OPTION_MAX,
  SOCIAL_POST_TITLE_MAX,
} from "@iwtr/shared-types";
import { apiGet, apiUpload, ApiError } from "@/lib/api-client";
import { WordTabs } from "@/components/WordTabs";

interface Picked {
  file: File;
  previewUrl: string;
}

// What the composer offers. "Update" is the plain post - text, photos or
// both (the API files it as PHOTO or UPDATE by whether photos came along).
type ComposerKind = "UPDATE" | "POLL" | "EVENT" | "MILESTONE" | "HIRING";

const KIND_TABS: { value: ComposerKind; label: string }[] = [
  { value: "UPDATE", label: "Update" },
  { value: "POLL", label: "Poll" },
  { value: "EVENT", label: "Event" },
  { value: "MILESTONE", label: "Milestone" },
  { value: "HIRING", label: "Hiring" },
];

const TEXT_LABEL: Record<ComposerKind, string> = {
  UPDATE: "Your post",
  POLL: "Question",
  EVENT: "Details (optional)",
  MILESTONE: "A few words (optional)",
  HIRING: "A few words (optional)",
};

const POLL_DAYS_LABEL: Record<number, string> = { 1: "1 day", 3: "3 days", 7: "1 week", 14: "2 weeks" };

const inputClass = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground";

// Label above the field, the problem (if any) below it.
function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string | false; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-foreground">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 dark:text-red-300">{error}</p>}
    </div>
  );
}

/**
 * The owner's "new post" form. One row of plain-word tabs picks what kind of
 * post it is; the fields below follow. Photos can go on everything except a
 * poll. Nothing is checked until Post is pressed, then each missing piece is
 * named under its own field.
 */
export function SocialComposer({
  companies,
  onPosted,
  onCancel,
}: {
  companies: OwnedCompany[];
  onPosted: () => void;
  onCancel: () => void;
}) {
  const [companyId, setCompanyId] = useState(companies[0]?.companyId ?? "");
  const [kind, setKind] = useState<ComposerKind>("UPDATE");
  const [caption, setCaption] = useState("");
  const [title, setTitle] = useState("");
  const [eventStartsAt, setEventStartsAt] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollDays, setPollDays] = useState<number>(3);
  const [jobPostingId, setJobPostingId] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Turned on by the first Post press with something missing.
  const [showMissing, setShowMissing] = useState(false);
  // "Now" as of when the form opened; the API has the final say on whether
  // an event's time is still ahead.
  const [openedAt] = useState(() => Date.now());
  // The picked company's live job ads, read the first time Hiring is opened
  // for it. null = not read yet.
  const [jobs, setJobs] = useState<{ companyId: string; list: OwnerJobPosting[] } | null>(null);

  const liveJobs = jobs?.companyId === companyId ? jobs.list : null;
  useEffect(() => {
    if (kind !== "HIRING" || !companyId || liveJobs) return;
    let cancelled = false;
    apiGet<OwnerJobPosting[]>(`/my-companies/${companyId}/job-postings`)
      .then((list) => {
        if (!cancelled) setJobs({ companyId, list: list.filter((j) => j.status === "PUBLISHED" && j.daysRemaining > 0) });
      })
      .catch(() => {
        if (!cancelled) setJobs({ companyId, list: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [kind, companyId, liveJobs]);

  // Instagram-style multi-photo picker: each newly chosen batch is appended
  // to whatever's already picked (up to MAX_SOCIAL_POST_IMAGES), not
  // replaced - so tapping "Add a photo" again adds more instead of
  // resetting the selection.
  function pickFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = MAX_SOCIAL_POST_IMAGES - picked.length;
    if (room <= 0) {
      setError(`You can add up to ${MAX_SOCIAL_POST_IMAGES} photos.`);
      return;
    }
    const next: Picked[] = [];
    for (const f of Array.from(files).slice(0, room)) {
      const check = validateSocialImageUpload({ mimeType: f.type, sizeBytes: f.size });
      if (!check.valid) {
        setError(check.error);
        return;
      }
      next.push({ file: f, previewUrl: URL.createObjectURL(f) });
    }
    setError(null);
    setPicked((prev) => [...prev, ...next]);
  }

  function removePicked(index: number) {
    setPicked((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  const text = caption.trim();
  const answers = pollOptions.map((o) => o.trim()).filter(Boolean);
  const photosAllowed = kind !== "POLL";
  const eventDate = eventStartsAt ? new Date(eventStartsAt) : null;
  const missing = {
    text:
      kind === "UPDATE" ? text.length === 0 && picked.length === 0 && "Write something or add a photo." : kind === "POLL" && text.length === 0 && "Write the question.",
    title: (kind === "EVENT" || kind === "MILESTONE") && title.trim().length === 0 && (kind === "EVENT" ? "Give the event a name." : "Say what you are celebrating."),
    eventStartsAt:
      kind === "EVENT" &&
      (!eventDate || Number.isNaN(eventDate.getTime()) ? "Pick the date and time." : eventDate.getTime() <= openedAt && "Pick a date and time that is still ahead."),
    pollOptions:
      kind === "POLL" &&
      (answers.length < SOCIAL_POLL_MIN_OPTIONS
        ? `Give at least ${SOCIAL_POLL_MIN_OPTIONS} answers.`
        : new Set(answers.map((a) => a.toLocaleLowerCase("tr"))).size !== answers.length && "Each answer can appear once."),
    jobPostingId: kind === "HIRING" && !jobPostingId && "Pick the job posting.",
  };

  async function submit() {
    if (Object.values(missing).some(Boolean)) {
      setShowMissing(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("companyId", companyId);
      fd.set("kind", kind);
      if (text) fd.set("caption", text);
      if (kind === "EVENT" || kind === "MILESTONE") fd.set("title", title.trim());
      if (kind === "EVENT") {
        fd.set("eventStartsAt", eventDate!.toISOString());
        if (eventLocation.trim()) fd.set("eventLocation", eventLocation.trim());
      }
      if (kind === "POLL") {
        fd.set("pollOptions", JSON.stringify(answers));
        fd.set("pollDays", String(pollDays));
      }
      if (kind === "HIRING") fd.set("jobPostingId", jobPostingId);
      if (photosAllowed) for (const p of picked) fd.append("files", p.file);
      await apiUpload<{ id: string }>("/social/posts", fd);
      picked.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      onPosted();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't post that.");
    } finally {
      setBusy(false);
    }
  }

  const shown = <K extends keyof typeof missing>(key: K) => showMissing && missing[key];

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-surface p-4 shadow-xs">
      <WordTabs tabs={KIND_TABS} value={kind} onChange={setKind} label="What kind of post" />

      {companies.length > 1 && (
        <Field label="Post as" htmlFor="composer-company">
          <select
            id="composer-company"
            value={companyId}
            onChange={(e) => {
              setCompanyId(e.target.value);
              setJobPostingId("");
            }}
            className={inputClass}
          >
            {companies.map((c) => (
              <option key={c.companyId} value={c.companyId}>
                {c.companyName}
              </option>
            ))}
          </select>
        </Field>
      )}

      {(kind === "EVENT" || kind === "MILESTONE") && (
        <Field label={kind === "EVENT" ? "Event name" : "What are you celebrating?"} htmlFor="composer-title" error={shown("title")}>
          <input id="composer-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={SOCIAL_POST_TITLE_MAX} className={inputClass} />
        </Field>
      )}

      {kind === "EVENT" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date and time" htmlFor="composer-event-date" error={shown("eventStartsAt")}>
            <input
              id="composer-event-date"
              type="datetime-local"
              value={eventStartsAt}
              onChange={(e) => setEventStartsAt(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Place (optional)" htmlFor="composer-event-place">
            <input
              id="composer-event-place"
              value={eventLocation}
              onChange={(e) => setEventLocation(e.target.value)}
              maxLength={SOCIAL_EVENT_LOCATION_MAX}
              className={inputClass}
            />
          </Field>
        </div>
      )}

      {kind === "HIRING" && (
        <Field label="Job posting" htmlFor="composer-job" error={shown("jobPostingId")}>
          {liveJobs === null ? (
            <div aria-hidden="true" className="h-[38px] animate-pulse rounded-lg bg-surface-muted motion-reduce:animate-none" />
          ) : liveJobs.length === 0 ? (
            <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-muted-foreground">
              This company has no live job posting. Post one from the Jobs page first.
            </p>
          ) : (
            <select id="composer-job" value={jobPostingId} onChange={(e) => setJobPostingId(e.target.value)} className={inputClass}>
              <option value="">Choose a job posting</option>
              {liveJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.jobTitle}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

      <Field label={TEXT_LABEL[kind]} htmlFor="composer-text" error={shown("text")}>
        <textarea
          id="composer-text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={kind === "UPDATE" ? "Tell us what you think !" : undefined}
          rows={kind === "POLL" ? 2 : 3}
          maxLength={1000}
          className={inputClass}
        />
      </Field>

      {kind === "POLL" && (
        <>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-[13px] font-semibold text-foreground">Answers</legend>
            {pollOptions.map((option, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  aria-label={`Answer ${i + 1}`}
                  value={option}
                  onChange={(e) => setPollOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))}
                  maxLength={SOCIAL_POLL_OPTION_MAX}
                  className={inputClass}
                />
                {pollOptions.length > SOCIAL_POLL_MIN_OPTIONS && (
                  <button
                    type="button"
                    onClick={() => setPollOptions((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`Remove answer ${i + 1}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
            {pollOptions.length < SOCIAL_POLL_MAX_OPTIONS && (
              <button
                type="button"
                onClick={() => setPollOptions((prev) => [...prev, ""])}
                className="self-start text-[13px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              >
                + Add an answer
              </button>
            )}
            {shown("pollOptions") && <p className="text-xs text-red-600 dark:text-red-300">{shown("pollOptions")}</p>}
          </fieldset>
          <Field label="Open for" htmlFor="composer-poll-days">
            <select id="composer-poll-days" value={pollDays} onChange={(e) => setPollDays(Number(e.target.value))} className={`${inputClass} sm:w-40`}>
              {SOCIAL_POLL_DAYS.map((d) => (
                <option key={d} value={d}>
                  {POLL_DAYS_LABEL[d]}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}

      {photosAllowed && (
        <div className="flex flex-col gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 self-start rounded-lg bg-surface-muted px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-border/70">
            <span className="text-lg leading-none">+</span> Add a photo{picked.length > 0 ? "" : " (or a few)"}
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/heic,image/heif"
              aria-label="Add a photo"
              className="hidden"
              onChange={(e) => {
                pickFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>

          {picked.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {picked.map((p, i) => (
                <div key={`${i}-${p.previewUrl}`} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                  <img src={p.previewUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => removePicked(i)}
                    aria-label="Remove this photo"
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background shadow-sm"
                  >
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="rounded-full bg-brand-600 px-5 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Posting..." : "Post"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
    </div>
  );
}

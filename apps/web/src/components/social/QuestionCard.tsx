"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type {
  CompanyQuestionVisibilityChoice,
  MemberIdentityMode,
  PublicSocialAnswer,
  PublicSocialQuestion,
  SocialAnswerHelpfulResult,
  SocialCommentReportReason,
} from "@iwtr/shared-types";
import { SOCIAL_ANSWER_MAX, SOCIAL_COMMENT_REPORT_REASONS, SOCIAL_COMMENT_REPORT_REASON_LABELS } from "@iwtr/shared-types";
import { apiDelete, apiPatch, apiPost, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";
import { Avatar } from "@/components/Avatar";
import { CompanyVerificationTick } from "@/components/CompanyVerificationTick";
import { shortRelativeTime } from "./socialTime";
import { QuestionIdentityPicker, useQuestionIdentity } from "./QuestionIdentityPicker";
import { useT } from "@/lib/i18n/client";

type IconProps = { className?: string };
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function ThumbUpIcon({ className, filled }: IconProps & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} fill={filled ? "currentColor" : "none"} aria-hidden="true">
      <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3Z" />
      <path d="M7 10l4.5-6.5a1.5 1.5 0 0 1 2.7.9V9h4.6a2 2 0 0 1 1.95 2.44l-1.4 6A2 2 0 0 1 17.4 19H9a2 2 0 0 1-2-2v-7Z" />
    </svg>
  );
}
function AnswersIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true">
      <path d="M4 4h16v11H8l-4 4Z" />
    </svg>
  );
}
function LinkIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </svg>
  );
}
function CheckIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} strokeWidth={2.4} aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}
function EyeIcon({ className, off }: IconProps & { off?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}
function ClockIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}
function KebabIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  );
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// "Worked there" (a member with this company in their history) and "Company"
// (the asked company's owner). Both tonal, in the one accent.
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
      {children}
    </span>
  );
}

// The "..." on a question or an answer: Delete on your own, Report on
// anyone else's. Closes on a click outside or Escape.
function ItemMenu({ label, mine, reported, onDelete, onReport }: { label: string; mine: boolean; reported: boolean; onDelete: () => void; onReport: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const item = "block w-full px-3 py-2 text-left text-sm hover:bg-surface-muted";
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
      >
        <KebabIcon className="h-4 w-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-10 mt-1 min-w-32 overflow-hidden rounded-xl bg-surface py-1 shadow-md ring-1 ring-border/60">
          {mine ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className={`${item} text-red-600 dark:text-red-300`}
            >
              Delete
            </button>
          ) : reported ? (
            <span className="block px-3 py-2 text-sm text-muted-foreground">Reported</span>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onReport();
              }}
              className={`${item} text-foreground`}
            >
              Report
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Pick one of the fixed reasons, the same ones as for a comment.
function ReportDialog({ what, onClose, onSubmit }: { what: "question" | "answer"; onClose: () => void; onSubmit: (reason: SocialCommentReportReason) => Promise<void> }) {
  const [reason, setReason] = useState<SocialCommentReportReason | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(reason);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't send the report.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Report this ${what}`}
        className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-base font-semibold text-foreground">Report this {what}</h3>
        <div className="flex flex-col gap-2">
          {SOCIAL_COMMENT_REPORT_REASONS.map((r) => (
            <label
              key={r}
              className="flex cursor-pointer items-start gap-2 rounded-xl bg-surface-muted/70 p-2.5 text-sm has-[:checked]:bg-brand-50 dark:has-[:checked]:bg-brand-950"
            >
              <input type="radio" name="question-report-reason" className="mt-0.5" checked={reason === r} onChange={() => setReason(r)} />
              <span className="text-foreground">{SOCIAL_COMMENT_REPORT_REASON_LABELS[r]}</span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Reports are anonymous. The writer never sees who reported.</p>
        {error && <p className="mt-2 text-xs text-red-600 dark:text-red-300">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full bg-surface-muted px-4 py-1.5 text-sm font-medium text-foreground transition hover:bg-border/70">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!reason || busy}
            className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "Sending..." : "Send report"}
          </button>
        </div>
      </div>
    </div>
  );
}

// The answer box. A member picks which anonymous name to write under; the
// asked company's owner has no choice (their real name) and is told so. The
// owner sends the answer with one of two buttons instead of one: the question
// is then shown to everyone, or stays between the company and its asker.
function AnswerComposer({
  questionId,
  asCompany,
  companyName,
  onPosted,
  onCancel,
}: {
  questionId: string;
  asCompany: boolean;
  companyName: string | null;
  onPosted: (answer: PublicSocialAnswer, visibility: CompanyQuestionVisibilityChoice | null) => void;
  onCancel: () => void;
}) {
  const identity = useQuestionIdentity(!asCompany);
  const [mode, setMode] = useState<MemberIdentityMode>("PERSONAL_CHOSEN");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldId = `answer-${questionId}`;

  async function submit(visibility: CompanyQuestionVisibilityChoice | null) {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      const created = await apiPost<PublicSocialAnswer>(
        `/social/questions/${questionId}/answers`,
        asCompany ? { body, visibility: visibility ?? "HIDDEN" } : { body, identityMode: mode },
      );
      onPosted(created, asCompany ? (visibility ?? "HIDDEN") : null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't post that answer.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 px-4 pb-4">
      <label htmlFor={fieldId} className="text-[13px] font-semibold text-foreground">
        Your answer
      </label>
      <textarea
        id={fieldId}
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, SOCIAL_ANSWER_MAX))}
        rows={3}
        autoFocus
        maxLength={SOCIAL_ANSWER_MAX}
        placeholder={asCompany ? "Answer for your company..." : "Share what you know..."}
        className="w-full resize-y rounded-xl border border-border bg-surface px-3 py-2 text-[15px] leading-relaxed text-foreground"
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {asCompany ? (
          <p className="text-xs text-muted-foreground">
            You answer for {companyName ?? "your company"}, under your own name. Your answer is the only thing the person who
            asked receives.
          </p>
        ) : (
          <QuestionIdentityPicker value={mode} onChange={setMode} identity={identity} verb="Answer" />
        )}
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {draft.length}/{SOCIAL_ANSWER_MAX}
        </span>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {asCompany ? (
          <>
            <button
              type="button"
              onClick={() => void submit("PUBLIC")}
              disabled={busy || draft.trim().length === 0}
              className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? "Posting..." : "Answer and show to everyone"}
            </button>
            <button
              type="button"
              onClick={() => void submit("HIDDEN")}
              disabled={busy || draft.trim().length === 0}
              className="rounded-full bg-surface-muted px-4 py-1.5 text-sm font-semibold text-foreground transition hover:bg-border/70 active:scale-[0.98] disabled:opacity-50"
            >
              Answer and keep hidden
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void submit(null)}
            disabled={busy || draft.trim().length === 0}
            className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? "Posting..." : "Post answer"}
          </button>
        )}
        <button type="button" onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * One question with its answers. In a list it carries the first couple of
 * answers (the company's own first) and a link to the rest; on the
 * question's own page it carries them all.
 *
 * Everyone here is anonymous except a company's owner answering for their
 * own company. "Worked there" marks a member who had the asked company in
 * their employment history when they answered.
 *
 * A question put to a claimed company is seen by its asker and that company
 * only until the company has answered and chosen to show it. Those two see a
 * line saying where it stands; the company's owner also gets the buttons to
 * show or hide it and to report it to the admins. Nobody else is ever sent
 * such a question, so for them this line never renders.
 */
export function QuestionCard({
  question,
  onChanged,
  onDeleted,
  // On the question's own page the time is not a link to itself.
  linkToPage = true,
  // The company's shared login reads its company's questions in the
  // dashboard but cannot answer, hide, show, delete or report (those stay
  // with the owner's own account): no buttons for any of it.
  readOnly = false,
}: {
  question: PublicSocialQuestion;
  onChanged?: (question: PublicSocialQuestion) => void;
  onDeleted?: (questionId: string) => void;
  linkToPage?: boolean;
  readOnly?: boolean;
}) {
  // Questions stay English for now; only the anonymous usernames are translated.
  const t = useT();
  const { isAuthenticated, role, openAuthModal } = useAuth();
  const isMember = isAuthenticated && role === "MEMBER";
  const [answering, setAnswering] = useState(false);
  // "question" or an answer id while its delete is being confirmed.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [reporting, setReporting] = useState<{ kind: "question" | "answer"; id: string } | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const q: PublicSocialQuestion = readOnly
    ? { ...question, canAnswer: false, canSetVisibility: false, answers: question.answers.map((a) => ({ ...a, mine: false })) }
    : question;
  const pageHref = `/social/questions/${q.id}`;
  const companyName = q.target.kind === "company" ? q.target.companyName : null;
  const hiddenAnswers = q.answerCount - q.answers.length;

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : failure);
    } finally {
      setBusy(false);
    }
  }

  function deleteQuestion() {
    return run(async () => {
      await apiDelete<{ success: true }>(`/social/questions/${q.id}`);
      onDeleted?.(q.id);
    }, "Couldn't delete the question.");
  }

  function deleteAnswer(answer: PublicSocialAnswer) {
    return run(async () => {
      await apiDelete<{ success: true }>(`/social/answers/${answer.id}`);
      setConfirming(null);
      onChanged?.({
        ...q,
        answers: q.answers.filter((a) => a.id !== answer.id),
        answerCount: Math.max(0, q.answerCount - 1),
        // Their one answer is gone, so they may write another.
        canAnswer: true,
        answersAsCompany: answer.fromCompany,
        companyAnswered: answer.fromCompany ? false : q.companyAnswered,
      });
    }, "Couldn't delete the answer.");
  }

  // Shown at once, then settled by what the API says.
  async function toggleHelpful(answer: PublicSocialAnswer) {
    if (!isAuthenticated) return openAuthModal();
    const patch = (next: Pick<PublicSocialAnswer, "helpfulCount" | "helpfulByMe">) =>
      onChanged?.({ ...q, answers: q.answers.map((a) => (a.id === answer.id ? { ...a, ...next } : a)) });
    const on = !answer.helpfulByMe;
    patch({ helpfulByMe: on, helpfulCount: Math.max(0, answer.helpfulCount + (on ? 1 : -1)) });
    try {
      const r = await apiPost<SocialAnswerHelpfulResult>(`/social/answers/${answer.id}/helpful`, {});
      patch({ helpfulByMe: r.helpfulByMe, helpfulCount: r.helpfulCount });
    } catch {
      patch({ helpfulByMe: answer.helpfulByMe, helpfulCount: answer.helpfulCount });
    }
  }

  function setVisibility(visibility: CompanyQuestionVisibilityChoice) {
    return run(async () => {
      const saved = await apiPatch<PublicSocialQuestion>(`/social/questions/${q.id}/visibility`, { visibility });
      // Only the state: this card may hold more answers than the reply carries.
      onChanged?.({ ...q, visibility: saved.visibility });
    }, "Couldn't change who sees this question.");
  }

  async function sendReport(reason: SocialCommentReportReason) {
    if (!reporting) return;
    const path = reporting.kind === "question" ? `/social/questions/${reporting.id}/report` : `/social/answers/${reporting.id}/report`;
    await apiPost(path, { reason });
    setReported((prev) => new Set(prev).add(reporting.id));
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${pageHref}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked - the time link still opens the question's page */
    }
  }

  function askToReport(kind: "question" | "answer", id: string) {
    if (!isAuthenticated) return openAuthModal();
    setReporting({ kind, id });
  }

  const confirmBox = (text: string, label: string, onConfirm: () => void) => (
    <div className="mx-4 mb-3 rounded-xl bg-surface-muted p-3">
      <p className="text-sm text-foreground">{text}</p>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? "Deleting..." : label}
        </button>
        <button type="button" onClick={() => setConfirming(null)} className="text-sm text-muted-foreground hover:text-foreground">
          Keep it
        </button>
      </div>
    </div>
  );

  const quiet = "text-muted-foreground hover:text-foreground";
  const lit = "text-brand-600 dark:text-brand-400";
  const time = shortRelativeTime(q.createdAt);

  // Where the question stands, in the reader's own terms (asker or company).
  const askedCompany = companyName ?? "the company";
  let standing: string | null = null;
  if (q.canSetVisibility) {
    standing =
      q.visibility === "PENDING"
        ? "Waiting for your answer. Only you and the person who asked can see it."
        : q.visibility === "HIDDEN"
          ? "Hidden. Only you and the person who asked can see it."
          : "Shown to everyone.";
  } else if (q.mine && q.visibility === "PENDING") {
    standing = `Sent to ${askedCompany}. Only you and the company can see it until the company answers.`;
  } else if (q.mine && q.visibility === "HIDDEN") {
    standing = `${askedCompany} keeps this question hidden. Only you and the company can see it.`;
  }
  const tonalButton =
    "rounded-full bg-surface px-3 py-1 text-xs font-semibold text-foreground shadow-xs transition hover:bg-border/70 active:scale-[0.98] disabled:opacity-50";

  return (
    <article className="rounded-2xl bg-surface shadow-xs">
      <header className="flex items-start gap-3 px-4 pt-3.5">
        <Avatar avatarKey={q.avatarKey} avatarGradient={q.avatarGradient} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug text-muted-foreground">
            <span className="font-semibold text-foreground">{q.displayUsername ? t(q.displayUsername) : "Anonymous"}</span> asked{" "}
            {q.target.kind === "company" ? (
              <Link href={`/companies/${q.target.companySlug}?tab=social`} className="font-semibold text-foreground hover:underline">
                {q.target.companyName}
                <CompanyVerificationTick badgeTier={q.target.companyBadgeTier} claimed size={14} className="ml-1 inline-block align-[-2px]" />
              </Link>
            ) : (
              <>
                everyone in <span className="font-semibold text-foreground">{workplaceTypeLabel(q.target.workType)}</span> work
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {linkToPage ? (
              <Link href={pageHref} title="Open this question" className="hover:text-foreground hover:underline">
                {time}
              </Link>
            ) : (
              time
            )}
          </p>
        </div>
        {!readOnly && (q.mine || isAuthenticated) && (
          <ItemMenu
            label="Question options"
            mine={q.mine}
            reported={reported.has(q.id)}
            onDelete={() => setConfirming("question")}
            onReport={() => askToReport("question", q.id)}
          />
        )}
      </header>

      <p className="whitespace-pre-wrap px-4 pb-3 pt-2 text-[17px] font-semibold leading-snug text-foreground">{q.body}</p>

      {standing && (
        <div className="mx-4 mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-surface-muted/70 px-3 py-2">
          <p className="flex min-w-0 flex-1 basis-56 items-start gap-2 text-[13px] leading-snug text-foreground">
            {q.visibility === "PENDING" ? (
              <ClockIcon className="mt-px h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <EyeIcon off={q.visibility === "HIDDEN"} className="mt-px h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span>{standing}</span>
          </p>
          {q.canSetVisibility && (
            <div className="flex flex-wrap items-center gap-2">
              {q.visibility === "PUBLIC" ? (
                <button type="button" onClick={() => void setVisibility("HIDDEN")} disabled={busy} className={tonalButton}>
                  Hide
                </button>
              ) : (
                // Showing it needs the company's answer on it (the API says the same).
                q.companyAnswered && (
                  <button type="button" onClick={() => void setVisibility("PUBLIC")} disabled={busy} className={tonalButton}>
                    Show to everyone
                  </button>
                )
              )}
              {reported.has(q.id) ? (
                <span className="text-xs font-medium text-muted-foreground">Reported to admin</span>
              ) : (
                <button type="button" onClick={() => askToReport("question", q.id)} className="text-xs font-semibold text-muted-foreground transition hover:text-foreground">
                  Report to admin
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {confirming === "question" && confirmBox("Delete this question? Its answers go with it.", "Delete question", () => void deleteQuestion())}

      {q.answers.length > 0 && (
        <ul className="flex flex-col gap-1 px-2 pb-1">
          {q.answers.map((a) => (
            <li key={a.id} className={`rounded-xl px-2 py-2.5 ${a.fromCompany ? "bg-surface-muted/70" : ""}`}>
              <div className="flex items-start gap-2.5">
                <Avatar avatarKey={a.avatarKey} avatarGradient={a.avatarGradient} photoUrl={a.avatarPhotoUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="text-sm font-semibold text-foreground">{a.displayUsername ? t(a.displayUsername) : "Anonymous"}</span>
                    {a.fromCompany && <Badge>{companyName ?? "Company"}</Badge>}
                    {a.workedThere && (
                      <Badge>
                        <CheckIcon className="h-3 w-3" />
                        Worked there
                      </Badge>
                    )}
                    <span>{shortRelativeTime(a.createdAt)}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{a.body}</p>
                  <button
                    type="button"
                    onClick={() => void toggleHelpful(a)}
                    // "Helpful" is the members' verdict: an employer only sees the count, and nobody marks their own answer.
                    disabled={a.mine || (isAuthenticated && !isMember)}
                    aria-pressed={a.helpfulByMe ?? false}
                    className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium transition disabled:cursor-default ${
                      a.helpfulByMe ? lit : `text-muted-foreground ${a.mine || (isAuthenticated && !isMember) ? "" : "hover:text-foreground"}`
                    }`}
                  >
                    <ThumbUpIcon className="h-4 w-4" filled={a.helpfulByMe ?? false} />
                    Helpful
                    {a.helpfulCount > 0 && <span className="tabular-nums">{a.helpfulCount}</span>}
                  </button>
                </div>
                {!readOnly && (a.mine || isAuthenticated) && (
                  <ItemMenu
                    label="Answer options"
                    mine={a.mine}
                    reported={reported.has(a.id)}
                    onDelete={() => setConfirming(a.id)}
                    onReport={() => askToReport("answer", a.id)}
                  />
                )}
              </div>
              {confirming === a.id && <div className="-mx-2 mt-2">{confirmBox("Delete your answer?", "Delete answer", () => void deleteAnswer(a))}</div>}
            </li>
          ))}
        </ul>
      )}

      {hiddenAnswers > 0 && (
        <Link href={pageHref} className="block px-4 pb-2 text-[13px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
          See {hiddenAnswers === 1 ? "1 more answer" : `${hiddenAnswers} more answers`}
        </Link>
      )}

      {error && <p className="px-4 pb-2 text-sm text-red-600 dark:text-red-300">{error}</p>}

      {answering ? (
        <AnswerComposer
          questionId={q.id}
          asCompany={q.answersAsCompany}
          companyName={companyName}
          onCancel={() => setAnswering(false)}
          onPosted={(created, visibility) => {
            setAnswering(false);
            // The company's answer leads; a member's goes to the end.
            const answers = created.fromCompany ? [created, ...q.answers] : [...q.answers, created];
            onChanged?.({
              ...q,
              answers,
              answerCount: q.answerCount + 1,
              canAnswer: false,
              answersAsCompany: false,
              companyAnswered: q.companyAnswered || created.fromCompany,
              visibility: visibility ?? q.visibility,
            });
          }}
        />
      ) : (
        <div className="flex items-center gap-5 px-4 pb-3.5 pt-1 text-sm">
          <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
            <AnswersIcon className="h-5 w-5" />
            {q.answerCount === 0 ? "No answers yet" : plural(q.answerCount, "answer")}
          </span>
          {/* A question only two people can open has no link worth copying. */}
          {q.visibility === "PUBLIC" && (
            <button type="button" onClick={() => void copyLink()} aria-label="Copy link" className={`flex items-center gap-1.5 font-medium transition ${copied ? lit : quiet}`}>
              <LinkIcon className="h-5 w-5" />
              <span aria-live="polite" className="text-xs">
                {copied ? "Link copied" : ""}
              </span>
            </button>
          )}
          {q.canAnswer && (
            <button
              type="button"
              onClick={() => setAnswering(true)}
              className="ml-auto rounded-full bg-surface-muted px-4 py-1.5 text-sm font-semibold text-foreground transition hover:bg-border/70 active:scale-[0.98]"
            >
              {q.answersAsCompany ? "Answer as company" : "Answer"}
            </button>
          )}
        </div>
      )}

      {reporting && <ReportDialog what={reporting.kind} onClose={() => setReporting(null)} onSubmit={sendReport} />}
    </article>
  );
}

// The shape of a question card while it is on the way.
export function QuestionSkeleton() {
  const bar = "rounded-full bg-surface-muted";
  return (
    <div aria-hidden="true" className="animate-pulse rounded-2xl bg-surface shadow-xs motion-reduce:animate-none">
      <div className="flex items-center gap-3 px-4 pt-3.5">
        <div className="h-8 w-8 rounded-full bg-surface-muted" />
        <div className="flex flex-1 flex-col gap-2">
          <div className={`h-3 w-48 ${bar}`} />
          <div className={`h-2.5 w-16 ${bar}`} />
        </div>
      </div>
      <div className="flex flex-col gap-2.5 px-4 py-4">
        <div className={`h-4 w-11/12 ${bar}`} />
        <div className={`h-4 w-3/5 ${bar}`} />
      </div>
      <div className="flex items-center gap-5 px-4 pb-4">
        <div className={`h-5 w-24 ${bar}`} />
        <div className={`ml-auto h-8 w-20 ${bar}`} />
      </div>
    </div>
  );
}

export function QuestionListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading questions" className="flex flex-col gap-5">
      {Array.from({ length: count }, (_, i) => (
        <QuestionSkeleton key={i} />
      ))}
    </div>
  );
}

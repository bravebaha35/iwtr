"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CategoryKey,
  CreateReviewInput,
  MyEmploymentEntry,
  MyReview,
  SubmitReviewResult,
  SurveyAnswer,
  SurveyQuestion,
  UpdateReviewInput,
  WorkplaceType,
} from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPatch, apiPost, ApiError } from "@/lib/api-client";
import { RATE_BUTTON_EMOJI } from "@/lib/rateButton";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";

const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: "corporateCulture", label: "Corporate Culture" },
  { key: "leadership", label: "Leadership & Management" },
  { key: "infrastructure", label: "Infrastructure & Resources" },
  { key: "workLifeBalance", label: "Work-Life Balance" },
  { key: "stability", label: "Organizational Stability" },
];

// Icon + color per answer, swapped in for the old "Yes"/"No"/"Prefer not to
// answer" text pills — a checkmark, an X, and a hollow (unfilled) circle, each
// "lit up" in its own color only once picked, dim/outline gray otherwise.
const ANSWER_META: Record<SurveyAnswer, { srLabel: string; litClassName: string }> = {
  YES: {
    srLabel: "Yes",
    litClassName: "border-green-500 bg-green-500/10 text-green-500",
  },
  NO: {
    srLabel: "No",
    litClassName: "border-red-500 bg-red-500/10 text-red-500",
  },
  PREFER_NOT_TO_ANSWER: {
    srLabel: "Prefer not to answer",
    litClassName: "border-amber-400 bg-amber-400/10 text-amber-400",
  },
};

const ANSWER_ORDER: SurveyAnswer[] = ["YES", "NO", "PREFER_NOT_TO_ANSWER"];

function AnswerIcon({ answer }: { answer: SurveyAnswer }) {
  if (answer === "YES") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (answer === "NO") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="7" />
    </svg>
  );
}

function AnswerButtons({
  value,
  onChange,
}: {
  value: SurveyAnswer | undefined;
  onChange: (answer: SurveyAnswer) => void;
}) {
  return (
    <div className="flex gap-2">
      {ANSWER_ORDER.map((answer) => {
        const meta = ANSWER_META[answer];
        const selected = value === answer;
        return (
          <button
            key={answer}
            type="button"
            onClick={() => onChange(answer)}
            aria-label={meta.srLabel}
            aria-pressed={selected}
            title={meta.srLabel}
            className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition ${
              selected ? meta.litClassName : "border-border text-muted-foreground hover:bg-surface-muted"
            }`}
          >
            <AnswerIcon answer={answer} />
          </button>
        );
      })}
    </div>
  );
}

/**
 * Renders for a visitor who (a) is logged in and (b) has this company in
 * their own employment history — pulled from /me/employment-history, the
 * same data the account-settings page uses. Rating is a fixed 25-question
 * yes/no/prefer-not-to-answer survey (5 questions × 5 categories, specific
 * to whichever workplaceType the review is about) — category scores are
 * computed server-side from the answers, never picked directly here.
 *
 * A company can carry up to 2 workplaceTypes (e.g. a hospital is tagged
 * SERVICE + OFFICE) — when creating a NEW review for a 2-type company, an
 * extra first step asks the reviewer which role best describes them, since
 * that decides which 25-question set they answer. Skipped entirely when the
 * company only has one type, or when editing (a review's workplaceType is
 * fixed once set — see ReviewsService.updateReview).
 *
 * If the user already has a review, the button switches to edit mode: it
 * loads their own review (GET /reviews/:id, owner-only) and PATCHes it
 * instead of POSTing a new one. The star icon (RATE_BUTTON_EMOJI) is a
 * one-file swap for later.
 */
export function RateButton({
  companyId,
  companyName,
  workplaceTypes,
}: {
  companyId: string;
  companyName: string;
  workplaceTypes: WorkplaceType[];
}) {
  const { accessToken } = useAuth();
  const router = useRouter();
  const [matchingEntry, setMatchingEntry] = useState<MyEmploymentEntry | null | undefined>(undefined);
  // Only meaningful while logged in — an anonymous visitor or one with no
  // matching employment history legitimately sees no button, so this only
  // drives an error note for the one case where hiding the button is
  // actually misleading: a logged-in fetch that failed rather than resolved.
  const [loadFailed, setLoadFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [selectedWorkplaceType, setSelectedWorkplaceType] = useState<WorkplaceType | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, SurveyAnswer>>({});
  const [generalThoughts, setGeneralThoughts] = useState("");
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitReviewResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const editing = Boolean(matchingEntry?.reviewId);
  const hasRoleStep = !editing && workplaceTypes.length > 1;
  const categoryOffset = hasRoleStep ? 1 : 0;
  const totalSteps = categoryOffset + CATEGORIES.length + 1;

  useEffect(() => {
    if (!accessToken) {
      setMatchingEntry(null);
      return;
    }
    setLoadFailed(false);
    apiGet<MyEmploymentEntry[]>("/me/employment-history", accessToken)
      .then((entries) => {
        const match = entries.find((e) => e.companyId === companyId) ?? null;
        setMatchingEntry(match);
      })
      .catch(() => {
        setMatchingEntry(null);
        setLoadFailed(true);
      });
  }, [accessToken, companyId]);

  async function loadQuestionsFor(type: WorkplaceType) {
    const questionSet = await apiGet<SurveyQuestion[]>(`/reviews/survey/${type}`, accessToken ?? undefined);
    setQuestions(questionSet);
  }

  async function handleOpen() {
    setStep(0);
    setAnswers({});
    setGeneralThoughts("");
    setError(null);
    setResult(null);
    setSelectedWorkplaceType(null);
    setQuestions(null);
    setOpen(true);
    setLoadingExisting(true);
    try {
      if (matchingEntry?.reviewId) {
        const review = await apiGet<MyReview>(`/reviews/${matchingEntry.reviewId}`, accessToken ?? undefined);
        setAnswers(review.surveyAnswers);
        setGeneralThoughts(review.generalThoughts ?? "");
        setSelectedWorkplaceType(review.workplaceType);
        await loadQuestionsFor(review.workplaceType);
      } else if (workplaceTypes.length === 1) {
        setSelectedWorkplaceType(workplaceTypes[0]);
        await loadQuestionsFor(workplaceTypes[0]);
      }
      // Otherwise: a new review on a multi-type company — the role-picker
      // step (step 0) loads questions itself once a role is chosen.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load the rating survey.");
    } finally {
      setLoadingExisting(false);
    }
  }

  async function selectRole(type: WorkplaceType) {
    setError(null);
    setAnswers({});
    setSelectedWorkplaceType(type);
    setLoadingExisting(true);
    try {
      await loadQuestionsFor(type);
      setStep(1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load the rating survey.");
    } finally {
      setLoadingExisting(false);
    }
  }

  function questionsFor(category: CategoryKey): SurveyQuestion[] {
    return (questions ?? []).filter((q) => q.category === category);
  }

  const onRoleStep = hasRoleStep && step === 0;
  const onFinalStep = step === categoryOffset + CATEGORIES.length;
  const currentCategory = !onRoleStep && !onFinalStep ? CATEGORIES[step - categoryOffset] : null;
  const currentStepAnswered = currentCategory
    ? questionsFor(currentCategory.key).every((q) => answers[q.id] !== undefined)
    : true;

  async function handleSubmit() {
    if (!matchingEntry || !questions || !selectedWorkplaceType) return;
    setError(null);
    setSubmitting(true);
    try {
      const answerList = questions.map((q) => ({ questionId: q.id, answer: answers[q.id] }));
      const content = { answers: answerList, generalThoughts: generalThoughts.trim() || undefined };
      const res = matchingEntry.reviewId
        ? await apiPatch<SubmitReviewResult>(
            `/reviews/${matchingEntry.reviewId}`,
            content satisfies UpdateReviewInput,
            accessToken ?? undefined,
          )
        : await apiPost<SubmitReviewResult>(
            "/reviews",
            {
              companyId,
              employmentHistoryId: matchingEntry.id,
              workplaceType: selectedWorkplaceType,
              ...content,
            } satisfies CreateReviewInput,
            accessToken ?? undefined,
          );
      setResult(res);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit your review.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!matchingEntry) {
    if (accessToken && loadFailed) {
      return (
        <p className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t check whether you can rate this workplace — try refreshing the page.
        </p>
      );
    }
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        {RATE_BUTTON_EMOJI} {editing ? "Edit your rating" : "Rate this workplace"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 px-4 py-8">
          <div className="w-full max-w-lg rounded-xl bg-surface p-8 shadow-xl">
            {result ? (
              <>
                <h2 className="mb-2 text-xl font-bold text-foreground">{editing ? "Updated!" : "Thanks!"}</h2>
                <p className="mb-4 text-sm text-muted-foreground">{result.message}</p>
                <ul className="mb-6 flex flex-col gap-1 text-sm">
                  {CATEGORIES.map((c) => (
                    <li key={c.key} className="flex justify-between text-foreground">
                      <span>{c.label}</span>
                      <span className="font-medium">{result.scores[c.key]}/5</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Done
                </button>
              </>
            ) : onRoleStep ? (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Step 1 of {totalSteps}
                  </p>
                  <h2 className="mb-1 text-xl font-bold text-foreground">
                    Which best describes your role here?
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    This company has more than one kind of work — pick whichever matches what you actually did.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {workplaceTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => selectRole(type)}
                      disabled={loadingExisting}
                      className="rounded-lg border border-border px-4 py-3 text-left text-sm font-medium text-foreground transition hover:border-brand-400 hover:bg-surface-muted disabled:opacity-50"
                    >
                      {workplaceTypeLabel(type)}
                    </button>
                  ))}
                </div>
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
                >
                  Cancel
                </button>
              </div>
            ) : loadingExisting || !questions ? (
              <p className="text-sm text-muted-foreground">Loading survey...</p>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Step {step + 1} of {totalSteps}
                  </p>
                  <h2 className="mb-1 text-xl font-bold text-foreground">
                    {onFinalStep
                      ? "Anything else to add?"
                      : `${editing ? "Edit your rating for" : "Rate"} ${companyName}`}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {onFinalStep
                      ? "Optional — anonymous, never linked back to you."
                      : currentCategory?.label}
                  </p>
                </div>

                {!onFinalStep && currentCategory && (
                  <div className="flex flex-col gap-4">
                    {questionsFor(currentCategory.key).map((q) => (
                      <div key={q.id} className="border-t border-border pt-3">
                        <p className="mb-2 text-sm text-foreground">{q.text}</p>
                        <AnswerButtons
                          value={answers[q.id]}
                          onChange={(answer) => setAnswers((prev) => ({ ...prev, [q.id]: answer }))}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {onFinalStep && (
                  <div className="border-t border-border pt-3">
                    <textarea
                      value={generalThoughts}
                      onChange={(e) => setGeneralThoughts(e.target.value)}
                      placeholder="Optional comment..."
                      rows={4}
                      className="w-full rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm text-foreground"
                    />
                  </div>
                )}

                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

                <div className="flex gap-2">
                  {step > 0 && (
                    <button
                      type="button"
                      onClick={() => setStep((s) => s - 1)}
                      className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
                    >
                      Back
                    </button>
                  )}
                  {onFinalStep ? (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      {submitting ? "Saving..." : editing ? "Save changes" : "Submit review"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setStep((s) => s + 1)}
                      disabled={!currentStepAnswered}
                      className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      Next
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

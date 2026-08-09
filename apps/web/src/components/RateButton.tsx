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

const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: "corporateCulture", label: "Corporate Culture" },
  { key: "leadership", label: "Leadership & Management" },
  { key: "infrastructure", label: "Infrastructure & Resources" },
  { key: "workLifeBalance", label: "Work-Life Balance" },
  { key: "stability", label: "Organizational Stability" },
];

// One extra step at the end for general thoughts + submit.
const TOTAL_STEPS = CATEGORIES.length + 1;

const ANSWER_OPTIONS: { value: SurveyAnswer; label: string }[] = [
  { value: "YES", label: "Yes" },
  { value: "NO", label: "No" },
  { value: "PREFER_NOT_TO_ANSWER", label: "Prefer not to answer" },
];

function AnswerButtons({
  value,
  onChange,
}: {
  value: SurveyAnswer | undefined;
  onChange: (answer: SurveyAnswer) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {ANSWER_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            value === opt.value
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-border text-muted-foreground hover:bg-surface-muted"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Renders for a visitor who (a) is logged in and (b) has this company in
 * their own employment history — pulled from /me/employment-history, the
 * same data the account-settings page uses. Rating is a fixed 25-question
 * yes/no/prefer-not-to-answer survey (5 questions × 5 categories, specific
 * to the company's workplaceType) — category scores are computed server-side
 * from the answers, never picked directly here. If the user already has a
 * review, the button switches to edit mode: it loads their own review (GET
 * /reviews/:id, owner-only) and PATCHes it instead of POSTing a new one.
 * The star icon (RATE_BUTTON_EMOJI) is a one-file swap for later.
 */
export function RateButton({
  companyId,
  companySlug,
  workplaceType,
}: {
  companyId: string;
  companySlug: string;
  workplaceType: WorkplaceType;
}) {
  const { accessToken } = useAuth();
  const router = useRouter();
  const [matchingEntry, setMatchingEntry] = useState<MyEmploymentEntry | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [questions, setQuestions] = useState<SurveyQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, SurveyAnswer>>({});
  const [generalThoughts, setGeneralThoughts] = useState("");
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitReviewResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const editing = Boolean(matchingEntry?.reviewId);

  useEffect(() => {
    if (!accessToken) {
      setMatchingEntry(null);
      return;
    }
    apiGet<MyEmploymentEntry[]>("/me/employment-history", accessToken)
      .then((entries) => {
        const match = entries.find((e) => e.companyId === companyId) ?? null;
        setMatchingEntry(match);
      })
      .catch(() => setMatchingEntry(null));
  }, [accessToken, companyId]);

  async function handleOpen() {
    setStep(0);
    setAnswers({});
    setGeneralThoughts("");
    setError(null);
    setResult(null);
    setOpen(true);
    setLoadingExisting(true);
    try {
      const questionSet = await apiGet<SurveyQuestion[]>(
        `/reviews/survey/${workplaceType}`,
        accessToken ?? undefined,
      );
      setQuestions(questionSet);

      if (matchingEntry?.reviewId) {
        const review = await apiGet<MyReview>(`/reviews/${matchingEntry.reviewId}`, accessToken ?? undefined);
        setAnswers(review.surveyAnswers);
        setGeneralThoughts(review.generalThoughts ?? "");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load the rating survey.");
    } finally {
      setLoadingExisting(false);
    }
  }

  function questionsFor(category: CategoryKey): SurveyQuestion[] {
    return (questions ?? []).filter((q) => q.category === category);
  }

  const onFinalStep = step === CATEGORIES.length;
  const currentCategory = onFinalStep ? null : CATEGORIES[step];
  const currentStepAnswered = currentCategory
    ? questionsFor(currentCategory.key).every((q) => answers[q.id] !== undefined)
    : true;

  async function handleSubmit() {
    if (!matchingEntry || !questions) return;
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
            { companyId, employmentHistoryId: matchingEntry.id, ...content } satisfies CreateReviewInput,
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

  if (!matchingEntry) return null;

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
            ) : loadingExisting || !questions ? (
              <p className="text-sm text-muted-foreground">Loading survey...</p>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Step {step + 1} of {TOTAL_STEPS}
                  </p>
                  <h2 className="mb-1 text-xl font-bold text-foreground">
                    {onFinalStep
                      ? "Anything else to add?"
                      : `${editing ? "Edit your rating for" : "Rate"} ${companySlug.replace(/-/g, " ")}`}
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

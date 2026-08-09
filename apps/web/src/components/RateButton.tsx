"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CreateReviewInput,
  MyEmploymentEntry,
  MyReview,
  SubmitReviewResult,
  UpdateReviewInput,
} from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPatch, apiPost, ApiError } from "@/lib/api-client";
import { RATE_BUTTON_EMOJI } from "@/lib/rateButton";

const CATEGORIES = [
  { key: "corporateCulture", label: "Corporate Culture" },
  { key: "leadership", label: "Leadership & Management" },
  { key: "infrastructure", label: "Infrastructure & Resources" },
  { key: "workLifeBalance", label: "Work-Life Balance" },
  { key: "stability", label: "Organizational Stability" },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];
type Scores = Record<CategoryKey, number>;
type Comments = Record<CategoryKey, string>;

const emptyScores: Scores = {
  corporateCulture: 0,
  leadership: 0,
  infrastructure: 0,
  workLifeBalance: 0,
  stability: 0,
};
const emptyComments: Comments = {
  corporateCulture: "",
  leadership: "",
  infrastructure: "",
  workLifeBalance: "",
  stability: "",
};

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`text-2xl leading-none transition ${
            n <= value ? "text-amber-500" : "text-muted-foreground/30 hover:text-amber-500/50"
          }`}
        >
          {RATE_BUTTON_EMOJI}
        </button>
      ))}
    </div>
  );
}

function scoresFromReview(review: MyReview): Scores {
  return {
    corporateCulture: review.corporateCultureScore,
    leadership: review.leadershipScore,
    infrastructure: review.infrastructureScore,
    workLifeBalance: review.workLifeBalanceScore,
    stability: review.stabilityScore,
  };
}
function commentsFromReview(review: MyReview): Comments {
  return {
    corporateCulture: review.corporateCultureComment ?? "",
    leadership: review.leadershipComment ?? "",
    infrastructure: review.infrastructureComment ?? "",
    workLifeBalance: review.workLifeBalanceComment ?? "",
    stability: review.stabilityComment ?? "",
  };
}

/**
 * Renders for a visitor who (a) is logged in and (b) has this company in
 * their own employment history — pulled from /me/employment-history, the
 * same data the account-settings page uses. If they've already reviewed it,
 * the button switches to edit mode: it loads their own review (GET
 * /reviews/:id, owner-only) and PATCHes it instead of POSTing a new one.
 * The star icon (RATE_BUTTON_EMOJI) is a one-file swap for later.
 */
export function RateButton({ companyId, companySlug }: { companyId: string; companySlug: string }) {
  const { accessToken } = useAuth();
  const router = useRouter();
  const [matchingEntry, setMatchingEntry] = useState<MyEmploymentEntry | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [scores, setScores] = useState<Scores>(emptyScores);
  const [comments, setComments] = useState<Comments>(emptyComments);
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

  function resetForm() {
    setScores(emptyScores);
    setComments(emptyComments);
    setGeneralThoughts("");
    setError(null);
    setResult(null);
  }

  async function handleOpen() {
    resetForm();
    setOpen(true);
    if (matchingEntry?.reviewId) {
      setLoadingExisting(true);
      try {
        const review = await apiGet<MyReview>(`/reviews/${matchingEntry.reviewId}`, accessToken ?? undefined);
        setScores(scoresFromReview(review));
        setComments(commentsFromReview(review));
        setGeneralThoughts(review.generalThoughts ?? "");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't load your existing rating.");
      } finally {
        setLoadingExisting(false);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!matchingEntry) return;
    const missing = CATEGORIES.some((c) => scores[c.key] === 0);
    if (missing) {
      setError("Please rate every category before submitting.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const content = {
        corporateCultureScore: scores.corporateCulture,
        corporateCultureComment: comments.corporateCulture.trim() || undefined,
        leadershipScore: scores.leadership,
        leadershipComment: comments.leadership.trim() || undefined,
        infrastructureScore: scores.infrastructure,
        infrastructureComment: comments.infrastructure.trim() || undefined,
        workLifeBalanceScore: scores.workLifeBalance,
        workLifeBalanceComment: comments.workLifeBalance.trim() || undefined,
        stabilityScore: scores.stability,
        stabilityComment: comments.stability.trim() || undefined,
        generalThoughts: generalThoughts.trim() || undefined,
      };
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
                <p className="mb-6 text-sm text-muted-foreground">{result.message}</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Done
                </button>
              </>
            ) : loadingExisting ? (
              <p className="text-sm text-muted-foreground">Loading your rating...</p>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <h2 className="mb-1 text-xl font-bold text-foreground">
                    {editing ? "Edit your rating for" : "Rate"} {companySlug.replace(/-/g, " ")}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Anonymous — this is never linked back to you. Comments are optional per category.
                  </p>
                </div>

                {CATEGORIES.map((c) => (
                  <div key={c.key} className="border-t border-border pt-3">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">{c.label}</p>
                      <StarPicker
                        value={scores[c.key]}
                        onChange={(n) => setScores((prev) => ({ ...prev, [c.key]: n }))}
                      />
                    </div>
                    <textarea
                      value={comments[c.key]}
                      onChange={(e) => setComments((prev) => ({ ...prev, [c.key]: e.target.value }))}
                      placeholder="Optional comment..."
                      rows={2}
                      className="w-full rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm text-foreground"
                    />
                  </div>
                ))}

                <div className="border-t border-border pt-3">
                  <p className="mb-1 text-sm font-medium text-foreground">General thoughts (optional)</p>
                  <textarea
                    value={generalThoughts}
                    onChange={(e) => setGeneralThoughts(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm text-foreground"
                  />
                </div>

                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : editing ? "Save changes" : "Submit review"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

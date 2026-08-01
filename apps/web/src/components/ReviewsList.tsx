"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicReview, VoteEligibility, VoteValue } from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";

const CATEGORY_FIELDS: { score: keyof PublicReview; comment: keyof PublicReview; label: string }[] = [
  { score: "corporateCultureScore", comment: "corporateCultureComment", label: "Corporate Culture" },
  { score: "leadershipScore", comment: "leadershipComment", label: "Leadership & Management" },
  { score: "infrastructureScore", comment: "infrastructureComment", label: "Infrastructure & Resources" },
  { score: "workLifeBalanceScore", comment: "workLifeBalanceComment", label: "Work-Life Balance" },
  { score: "stabilityScore", comment: "stabilityComment", label: "Organizational Stability" },
];

export function ReviewsList({ companySlug }: { companySlug: string }) {
  const { accessToken, isLoading: authLoading } = useAuth();
  const [reviews, setReviews] = useState<PublicReview[] | null>(null);
  const [eligibility, setEligibility] = useState<VoteEligibility | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [votingId, setVotingId] = useState<string | null>(null);

  useEffect(() => {
    apiGet<PublicReview[]>(`/companies/${companySlug}/reviews`, accessToken ?? undefined)
      .then(setReviews)
      .catch(() => setReviews([]));
  }, [companySlug, accessToken]);

  useEffect(() => {
    if (!accessToken) {
      setEligibility(null);
      return;
    }
    apiGet<VoteEligibility>("/reviews/vote-eligibility", accessToken)
      .then(setEligibility)
      .catch(() => setEligibility(null));
  }, [accessToken]);

  const vote = useCallback(
    async (reviewId: string, value: VoteValue) => {
      if (!accessToken || !reviews) return;
      setError(null);
      setVotingId(reviewId);
      try {
        const result = await apiPost<{ reviewId: string; likeCount: number; dislikeCount: number; myVote: VoteValue | null }>(
          `/reviews/${reviewId}/vote`,
          { value },
          accessToken,
        );
        setReviews((prev) =>
          (prev ?? []).map((r) =>
            r.id === reviewId
              ? { ...r, likeCount: result.likeCount, dislikeCount: result.dislikeCount, myVote: result.myVote }
              : r,
          ),
        );
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't register your vote.");
      } finally {
        setVotingId(null);
      }
    },
    [accessToken, reviews],
  );

  if (reviews === null) {
    return <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">Loading reviews...</p>;
  }

  if (reviews.length === 0) {
    return null;
  }

  const canVote = !authLoading && !!accessToken && !!eligibility?.eligible;
  const voteHint =
    !authLoading && accessToken && eligibility && !eligibility.eligible
      ? `Rate ${eligibility.requiredCompanyReviewCount} different companies to unlock voting (you have ${eligibility.distinctCompanyReviewCount}).`
      : null;

  return (
    <div className="mt-8 flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Reviews</h2>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {voteHint && <p className="text-xs text-zinc-500 dark:text-zinc-400">{voteHint}</p>}

      {reviews.map((review) => (
        <div
          key={review.id}
          className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
        >
          {review.contributorBadge && (
            <span
              className={`mb-3 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                review.contributorBadge === "TOP_CONTRIBUTOR"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                  : "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
              }`}
            >
              {review.contributorBadge === "TOP_CONTRIBUTOR" ? "Top Contributor" : "Contributor"}
            </span>
          )}
          <div className="flex flex-col gap-1 text-sm">
            {CATEGORY_FIELDS.map((f) => (
              <div key={f.label} className="text-zinc-600 dark:text-zinc-400">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {f.label}: {String(review[f.score])}/5
                </span>
                {review[f.comment] && <span> &mdash; {String(review[f.comment])}</span>}
              </div>
            ))}
            {review.generalThoughts && (
              <div className="mt-1 italic text-zinc-600 dark:text-zinc-400">
                &ldquo;{review.generalThoughts}&rdquo;
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => vote(review.id, 1)}
              disabled={!canVote || votingId === review.id}
              title={voteHint ?? (!accessToken ? "Log in to vote" : undefined)}
              className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-40 ${
                review.myVote === 1
                  ? "border-green-600 bg-green-50 text-green-700 dark:border-green-500 dark:bg-green-950 dark:text-green-400"
                  : "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              Helpful ({review.likeCount})
            </button>
            <button
              onClick={() => vote(review.id, -1)}
              disabled={!canVote || votingId === review.id}
              title={voteHint ?? (!accessToken ? "Log in to vote" : undefined)}
              className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-40 ${
                review.myVote === -1
                  ? "border-red-600 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-950 dark:text-red-400"
                  : "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              Not helpful ({review.dislikeCount})
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicReview, VoteValue } from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";

const CATEGORY_FIELDS: { score: keyof PublicReview; label: string }[] = [
  { score: "corporateCultureScore", label: "Corporate Culture" },
  { score: "leadershipScore", label: "Leadership & Management" },
  { score: "infrastructureScore", label: "Infrastructure & Resources" },
  { score: "workLifeBalanceScore", label: "Work-Life Balance" },
  { score: "stabilityScore", label: "Organizational Stability" },
];

export function ReviewsList({ companySlug }: { companySlug: string }) {
  const { accessToken, isLoading: authLoading } = useAuth();
  const [reviews, setReviews] = useState<PublicReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [votingId, setVotingId] = useState<string | null>(null);

  useEffect(() => {
    apiGet<PublicReview[]>(`/companies/${companySlug}/reviews`, accessToken ?? undefined)
      .then(setReviews)
      .catch(() => setReviews([]));
  }, [companySlug, accessToken]);

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
    return <p className="mt-8 text-sm text-muted-foreground">Loading reviews...</p>;
  }

  if (reviews.length === 0) {
    return null;
  }

  // Any logged-in, registered member can vote — no contribution gate (see
  // ReviewsService.castVote).
  const canVote = !authLoading && !!accessToken;

  return (
    <div className="mt-8 flex flex-col gap-4 compact:gap-2">
      <h2 className="text-lg font-semibold text-foreground">Reviews</h2>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {reviews.map((review) => (
        <div
          key={review.id}
          className="rounded-xl border border-border bg-surface p-5 compact:p-3"
        >
          <div className="mb-3 compact:mb-1.5 flex flex-wrap items-center gap-2">
            {/* Which of the company's (up to 2) workplaceTypes this review is
                about — matters once a company spans more than one, e.g. a
                hospital's Service and Office reviews read very differently. */}
            <span className="inline-block rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {workplaceTypeLabel(review.workplaceType)}
            </span>
            {review.contributorBadge && (
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                  review.contributorBadge === "TOP_CONTRIBUTOR"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                    : "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
                }`}
              >
                {review.contributorBadge === "TOP_CONTRIBUTOR" ? "Top Contributor" : "Contributor"}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1 text-sm compact:text-xs">
            {CATEGORY_FIELDS.map((f) => (
              <div key={f.label} className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  {f.label}: {String(review[f.score])}/5
                </span>
              </div>
            ))}
            {review.generalThoughts && (
              <div className="mt-1 italic text-muted-foreground">
                &ldquo;{review.generalThoughts}&rdquo;
              </div>
            )}
          </div>

          <div className="mt-4 compact:mt-2 flex items-center gap-3 compact:gap-2">
            <button
              onClick={() => vote(review.id, 1)}
              disabled={!canVote || votingId === review.id}
              title={!accessToken ? "Log in to vote" : undefined}
              className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-40 ${
                review.myVote === 1
                  ? "border-green-600 bg-green-50 text-green-700 dark:border-green-500 dark:bg-green-950 dark:text-green-400"
                  : "border-border text-muted-foreground hover:bg-surface-muted"
              }`}
            >
              Helpful ({review.likeCount})
            </button>
            <button
              onClick={() => vote(review.id, -1)}
              disabled={!canVote || votingId === review.id}
              title={!accessToken ? "Log in to vote" : undefined}
              className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-40 ${
                review.myVote === -1
                  ? "border-red-600 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-950 dark:text-red-400"
                  : "border-border text-muted-foreground hover:bg-surface-muted"
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

"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicReview, VoteValue, WorkplaceType } from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { workplaceTypeLabel, WORKPLACE_TYPES } from "@/lib/workplaceTypes";
import { collarBorderClass, collarPillClassName } from "@/lib/collarColors";
import { Avatar } from "@/components/Avatar";
import { SingleSelectPillTabs } from "@/components/FilterPillGroup";

const CATEGORY_FIELDS: { score: keyof PublicReview; label: string }[] = [
  { score: "corporateCultureScore", label: "Corporate Culture" },
  { score: "leadershipScore", label: "Leadership & Management" },
  { score: "infrastructureScore", label: "Infrastructure & Resources" },
  { score: "workLifeBalanceScore", label: "Work-Life Balance" },
  { score: "stabilityScore", label: "Organizational Stability" },
];

export function ReviewsList({
  companySlug,
  workplaceTypes,
}: {
  companySlug: string;
  // The company's own (up to 2) workplace-type tags, passed down from the
  // company page — drives which color-coded collar filter tabs render above
  // the review list. Optional so existing callers that predate this filter
  // still compile; the tabs simply don't render without it.
  workplaceTypes?: WorkplaceType[];
}) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [reviews, setReviews] = useState<PublicReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Distinguishes "the request failed" from "this company genuinely has no
  // published reviews yet" — both used to render as nothing at all (see the
  // reviews.length === 0 check below), which silently hid a fetch failure
  // behind what looked like an ordinary, unreviewed company.
  const [loadFailed, setLoadFailed] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);
  // null = "All" collar tab selected (no filtering).
  const [activeCollar, setActiveCollar] = useState<WorkplaceType | null>(null);

  useEffect(() => {
    setLoadFailed(false);
    apiGet<PublicReview[]>(`/companies/${companySlug}/reviews`)
      .then(setReviews)
      .catch(() => {
        setReviews([]);
        setLoadFailed(true);
      });
  }, [companySlug, isAuthenticated]);

  const vote = useCallback(
    async (reviewId: string, value: VoteValue) => {
      if (!isAuthenticated || !reviews) return;
      setError(null);
      setVotingId(reviewId);
      try {
        const result = await apiPost<{ reviewId: string; likeCount: number; dislikeCount: number; myVote: VoteValue | null }>(
          `/reviews/${reviewId}/vote`,
          { value },
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
    [isAuthenticated, reviews],
  );

  if (reviews === null) {
    return <p className="text-sm text-muted-foreground">Loading reviews...</p>;
  }

  if (reviews.length === 0) {
    if (loadFailed) {
      return (
        <p className="text-sm text-red-600 dark:text-red-400">
          Couldn&apos;t load reviews right now — try refreshing the page.
        </p>
      );
    }
    return null;
  }

  // Any logged-in, registered member can vote — no contribution gate (see
  // ReviewsService.castVote).
  const canVote = !authLoading && isAuthenticated;

  // Collar filter tabs only make sense when the company actually spans more
  // than one workplace type — a single-type company has nothing to filter,
  // so the tabs (and their color-coding) simply don't render.
  const collarOptions = WORKPLACE_TYPES.filter((t) => workplaceTypes?.includes(t.value));
  const filteredReviews = activeCollar ? reviews.filter((r) => r.workplaceType === activeCollar) : reviews;

  return (
    <div className="flex flex-col gap-4 compact:gap-2">
      <h2 className="text-lg font-semibold text-foreground">Reviews</h2>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {collarOptions.length > 1 && (
        <SingleSelectPillTabs
          options={collarOptions}
          selected={activeCollar}
          onSelect={setActiveCollar}
          pillColorClassName={collarPillClassName}
        />
      )}

      {filteredReviews.length === 0 && (
        <p className="text-sm text-muted-foreground">No reviews for this workplace type yet.</p>
      )}

      {filteredReviews.map((review) => (
        <div
          key={review.id}
          className={`rounded-xl border border-border border-l-4 bg-surface p-5 compact:p-3 ${collarBorderClass(review.workplaceType)}`}
        >
          <div className="mb-3 compact:mb-1.5 flex items-center gap-2">
            <Avatar avatarKey={review.avatarKey} avatarGradient={review.avatarGradient} size="sm" />
            {review.displayUsername && (
              <span className="shrink-0 text-xs font-medium text-muted-foreground">{review.displayUsername}</span>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {/* Which of the company's (up to 2) workplaceTypes this review
                  is about — matters once a company spans more than one, e.g.
                  a hospital's Service and Office reviews read very differently. */}
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
              title={!isAuthenticated ? "Log in to vote" : undefined}
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
              title={!isAuthenticated ? "Log in to vote" : undefined}
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

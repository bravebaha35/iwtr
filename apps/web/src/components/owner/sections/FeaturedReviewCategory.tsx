"use client";

import { useEffect, useState } from "react";
import type { PublicReview } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { SingleSelectDropdown } from "@/components/Dropdown";

function excerpt(review: PublicReview): string {
  const text = review.generalThoughts ?? "(no comment)";
  return text.length > 70 ? `${text.slice(0, 70)}…` : text;
}

/**
 * Premium Features › Featured Review Spotlight: the owner picks one of the
 * company's published reviews, and the company page pins it above every
 * other review with a "Featured" label (see ReviewsList featuredReviewId).
 */
export function FeaturedReviewCategory({
  companySlug,
  featuredReviewId,
  savedFeaturedReviewId,
  setFeaturedReviewId,
  onSave,
  saving,
  status,
  error,
}: {
  companySlug: string;
  // The pick in the dropdown, and the one currently live on the company page.
  featuredReviewId: string | null;
  savedFeaturedReviewId: string | null;
  setFeaturedReviewId: (id: string | null) => void;
  onSave: (reviewId: string | null) => void;
  saving: boolean;
  status: string | null;
  error: string | null;
}) {
  const [reviews, setReviews] = useState<PublicReview[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<PublicReview[]>(`/companies/${companySlug}/reviews`)
      .then((rows) => {
        if (!cancelled) setReviews((rows ?? []).filter((r) => r.status === "PUBLISHED"));
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, [companySlug]);

  const chosen = reviews?.find((r) => r.id === featuredReviewId) ?? null;

  return (
    <div className="rounded-xl border border-border p-6">
      <h3 className="mb-1 font-semibold text-foreground">Featured Review Spotlight</h3>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        Pick one of your published reviews. It is pinned to the top of the reviews on your company page with a
        &ldquo;Featured&rdquo; label, so visitors see it first.
      </p>

      {reviews === null ? (
        <p className="text-sm text-muted-foreground">Loading your reviews...</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">You don&apos;t have any published reviews to feature yet.</p>
      ) : (
        <div className="max-w-2xl">
          <SingleSelectDropdown
            ariaLabel="Review to feature"
            value={featuredReviewId}
            onChange={setFeaturedReviewId}
            placeholder="Choose a published review to feature"
            options={reviews.map((r) => ({ value: r.id, label: excerpt(r) }))}
          />
          {chosen && (
            <blockquote className="mt-3 rounded-lg border border-amber-300/70 bg-surface p-3 text-sm italic text-muted-foreground dark:border-amber-700/50">
              &ldquo;{chosen.generalThoughts ?? "(no comment)"}&rdquo;
            </blockquote>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSave(featuredReviewId)}
              disabled={saving || !featuredReviewId || featuredReviewId === savedFeaturedReviewId}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Pin this review
            </button>
            {savedFeaturedReviewId && (
              <button
                type="button"
                onClick={() => {
                  setFeaturedReviewId(null);
                  onSave(null);
                }}
                disabled={saving}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
              >
                Unpin
              </button>
            )}
          </div>
          {savedFeaturedReviewId && (
            <p className="mt-2 text-xs text-muted-foreground">A review is pinned on your company page right now.</p>
          )}
        </div>
      )}
      {status && <p className="mt-2 text-sm text-green-700 dark:text-green-400">{status}</p>}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p>}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { MyReviewListItem, ReviewStatus } from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiGet, ApiError } from "@/lib/api-client";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";
import { AdSlot } from "@/components/AdSlot";
import { StartConversationButton } from "@/components/messaging/StartConversationButton";
import { useIsCompanyOwner } from "@/lib/useIsCompanyOwner";
import { useI18n } from "@/lib/i18n/client";
import { intlLocale, type Locale } from "@/lib/i18n/core";

const CATEGORY_FIELDS: { score: keyof MyReviewListItem; label: string }[] = [
  { score: "corporateCultureScore", label: "Corporate Culture" },
  { score: "leadershipScore", label: "Leadership & Management" },
  { score: "infrastructureScore", label: "Infrastructure & Resources" },
  { score: "workLifeBalanceScore", label: "Work-Life Balance" },
  { score: "stabilityScore", label: "Organizational Stability" },
];

const STATUS_LABEL: Record<ReviewStatus, string> = {
  PENDING_MODERATION: "Being checked before publishing",
  PENDING_ADMIN_REVIEW: "Waiting on manual review",
  PUBLISHED: "Published",
  REJECTED: "Not published",
};

const STATUS_STYLES: Record<ReviewStatus, string> = {
  PENDING_MODERATION: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  PENDING_ADMIN_REVIEW: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  PUBLISHED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function formatDate(iso: string | null, locale: Locale): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(intlLocale(locale), { year: "numeric", month: "long", day: "numeric" });
}

export default function MyReviewsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  // Company owners get messages only through their company dashboard.
  const isCompanyOwner = useIsCompanyOwner();
  const [reviews, setReviews] = useState<MyReviewListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t, locale } = useI18n();
  // From a notification link (?review=): scroll to that review and pulse its outline.
  const [pulsingId, setPulsingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await apiGet<MyReviewListItem[]>("/me/reviews");
      setReviews(data);
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t("Couldn't load your ratings."));
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!reviews) return;
    const target = new URLSearchParams(window.location.search).get("review");
    if (!target || !reviews.some((r) => r.id === target)) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("review");
    window.history.replaceState(window.history.state, "", url.toString());
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot reaction to the loaded list + link
    setPulsingId(target);
  }, [reviews]);

  useEffect(() => {
    if (!pulsingId) return;
    document.getElementById(`review-${pulsingId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = window.setTimeout(() => setPulsingId(null), 3200);
    return () => window.clearTimeout(timer);
  }, [pulsingId]);

  if (authLoading) return null;

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("Log in to see the ratings you've submitted.")}</p>
      </div>
    );
  }

  return (
    <div className="flex w-full items-start justify-center gap-6 px-4 py-8">
      <AdSlot />

      <div className="w-full max-w-4xl">
        <h1 className="mb-1 text-4xl leading-tight text-foreground">{t("My Ratings")}</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {t("Every review you've submitted, and how it's doing. Open a company to edit a review you've already posted there.")}
        </p>

        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-300">{error}</p>}
        {reviews === null && <p className="text-sm text-muted-foreground">{t("Loading...")}</p>}
        {reviews !== null && reviews.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("You haven't rated a workplace yet - find one you've worked at and hit Rate.")}
          </p>
        )}

        <div className="flex flex-col gap-4 compact:gap-2">
          {reviews?.map((review) => (
            <div
              key={review.id}
              id={`review-${review.id}`}
              className={`scroll-mt-24 rounded-2xl bg-surface shadow-xs p-5 compact:p-3 ${
                pulsingId === review.id ? "highlight-pulse" : ""
              }`}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                {review.companySlug ? (
                  <Link
                    href={`/companies/${review.companySlug}`}
                    className="font-semibold text-foreground hover:underline"
                  >
                    {review.companyName}
                  </Link>
                ) : (
                  <span className="font-semibold text-foreground">{review.companyName}</span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[review.status]}`}>
                  {t(STATUS_LABEL[review.status])}
                </span>
              </div>

              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-block rounded-full bg-surface-muted px-2 py-0.5 font-medium">
                  {t(workplaceTypeLabel(review.workplaceType))}
                </span>
                <span>{formatDate(review.createdAt, locale)}</span>
              </div>

              <div className="flex flex-col gap-1 text-sm compact:text-xs">
                {CATEGORY_FIELDS.map((f) => (
                  <div key={f.label} className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {t(f.label)}: {String(review[f.score])}/5
                    </span>
                  </div>
                ))}
                {review.generalThoughts && (
                  <div className="mt-1 italic text-muted-foreground">&ldquo;{review.generalThoughts}&rdquo;</div>
                )}
              </div>

              {review.status === "PUBLISHED" && (
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{t("Helpful ({n})", { n: review.likeCount })}</span>
                  <span>{t("Not helpful ({n})", { n: review.dislikeCount })}</span>
                </div>
              )}

              {review.reply && (
                <div className="mt-3 rounded-lg bg-surface-muted p-3 text-sm">
                  <p className="mb-1 text-xs font-semibold text-foreground">{t("Response from {name}", { name: review.companyName })}</p>
                  <p className="text-muted-foreground">{review.reply.content}</p>
                  {review.status === "PUBLISHED" && !isCompanyOwner && (
                    <StartConversationButton
                      reviewId={review.id}
                      companyName={review.companyName}
                      conversationId={review.conversationId}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <AdSlot side="right" />
    </div>
  );
}

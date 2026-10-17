"use client";

import { useCallback, useEffect, useState } from "react";
import type { Company, CompanySocialSummary } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { useFollowedCompanies } from "@/lib/useFollowedCompanies";
import { WordTabs } from "@/components/WordTabs";
import { SOCIAL_QUESTIONS_ENABLED } from "@/lib/socialQuestionsFlag";
import { useT } from "@/lib/i18n/client";

export type CompanySocialView = "posts" | "photos" | "questions";

const VIEWS: { value: CompanySocialView; label: string }[] = [
  { value: "posts", label: "Posts" },
  { value: "photos", label: "Photos" },
  // What members have asked this company, and its answers.
  ...(SOCIAL_QUESTIONS_ENABLED ? [{ value: "questions" as const, label: "Questions" }] : []),
];

/**
 * The line above a company's own posts: how many follow it and how much it
 * has posted, and the Posts / Photos / Questions switch. The counts are bare numbers -
 * who follows a company is never shown to anyone. Following itself is the
 * button in the company page's header; the count here is read again each
 * time a follow or unfollow has been saved.
 */
export function CompanySocialHeader({
  company,
  view,
  onViewChange,
}: {
  company: Pick<Company, "slug">;
  view: CompanySocialView;
  onViewChange: (next: CompanySocialView) => void;
}) {
  const { confirmedToggles } = useFollowedCompanies();
  const [summary, setSummary] = useState<CompanySocialSummary | null>(null);
  const t = useT();

  const loadSummary = useCallback(() => {
    apiGet<CompanySocialSummary>(`/social/companies/${company.slug}/summary`)
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [company.slug]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary, confirmedToggles]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {summary ? (
          <>
            <span className="font-semibold tabular-nums text-foreground">
              {t(summary.followerCount === 1 ? "{n} follower" : "{n} followers", { n: summary.followerCount })}
            </span>{" "}
            &middot; <span className="tabular-nums">{t(summary.postCount === 1 ? "{n} post" : "{n} posts", { n: summary.postCount })}</span>
          </>
        ) : (
          <span aria-hidden="true">&nbsp;</span>
        )}
      </p>
      <WordTabs tabs={VIEWS} value={view} onChange={onViewChange} label="Posts, photos or questions" />
    </div>
  );
}

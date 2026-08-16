"use client";

import { useEffect, useState } from "react";
import type {
  CategoryKey,
  CompanySurveyStats,
  CompanyWorkplaceSurveyStats,
  SurveyQuestionStats,
} from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";

const CATEGORY_ORDER: CategoryKey[] = ["corporateCulture", "leadership", "infrastructure", "workLifeBalance", "stability"];

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  corporateCulture: "Corporate Culture",
  leadership: "Leadership & Management",
  infrastructure: "Infrastructure & Resources",
  workLifeBalance: "Work-Life Balance",
  stability: "Organizational Stability",
};

function rate(q: SurveyQuestionStats, count: number): number {
  const total = q.agreeCount + q.disagreeCount + q.preferNotCount;
  return total === 0 ? 0 : count / total;
}

function QuestionRow({ q, showCategory = true }: { q: SurveyQuestionStats; showCategory?: boolean }) {
  const total = q.agreeCount + q.disagreeCount + q.preferNotCount;
  return (
    <div>
      {showCategory && (
        <p className="text-xs font-medium text-muted-foreground">{CATEGORY_LABELS[q.category] ?? q.category}</p>
      )}
      <p className="mb-1 text-sm text-foreground">{q.text}</p>
      <p className="text-xs text-muted-foreground">
        {total === 0
          ? "No answers yet"
          : `${q.agreeCount} agreed · ${q.disagreeCount} disagreed${
              q.preferNotCount > 0 ? ` · ${q.preferNotCount} preferred not to answer` : ""
            }`}
      </p>
    </div>
  );
}

// Each category is its own collapsible dropdown within "All Questions" —
// starts collapsed (all 5 sub-lists closed) so opening "All Questions"
// doesn't immediately dump all 25 questions at once.
function CategorySection({
  category,
  questions,
  expanded,
  onToggle,
}: {
  category: CategoryKey;
  questions: SurveyQuestionStats[];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-t border-border pt-3 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-foreground"
      >
        <span>
          {CATEGORY_LABELS[category]} <span className="font-normal text-muted-foreground">({questions.length})</span>
        </span>
        <span className={`text-xs text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
      </button>
      {expanded && (
        <div className="mt-3 flex flex-col gap-3">
          {questions.map((q) => (
            <QuestionRow key={q.questionId} q={q} showCategory={false} />
          ))}
        </div>
      )}
    </div>
  );
}

// One full "most agreed / most disputed / All Questions" block for a single
// workplaceType. A company with 2 tags (e.g. a hospital: SERVICE + OFFICE)
// renders one of these per tag that actually has reviews — never merged,
// since "SERVICE.corporateCulture.1" and "OFFICE.corporateCulture.1" are
// different questions entirely.
function WorkplaceTypeSurveySection({ stats }: { stats: CompanyWorkplaceSurveyStats }) {
  const [showAll, setShowAll] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<CategoryKey>>(new Set());

  function toggleCategory(category: CategoryKey) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  const mostAgreed = [...stats.questions].sort((a, b) => rate(b, b.agreeCount) - rate(a, a.agreeCount))[0];
  const mostDisputed = [...stats.questions].sort((a, b) => rate(b, b.disagreeCount) - rate(a, a.disagreeCount))[0];

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="mb-3 text-lg font-semibold text-foreground">
        What reviewers said <span className="font-normal text-muted-foreground">— {workplaceTypeLabel(stats.workplaceType)}</span>
      </h2>
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
            Most agreed on
          </p>
          <QuestionRow q={mostAgreed} />
        </div>
        <div className="border-t border-border pt-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-400">
            Most disputed
          </p>
          <QuestionRow q={mostDisputed} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowAll((v) => !v)}
        className="mt-4 flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
      >
        All Questions
        <span className={`text-xs transition-transform ${showAll ? "rotate-180" : ""}`}>▾</span>
      </button>

      {showAll && (
        <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
          {CATEGORY_ORDER.map((category) => (
            <CategorySection
              key={category}
              category={category}
              questions={stats.questions.filter((q) => q.category === category)}
              expanded={expandedCategories.has(category)}
              onToggle={() => toggleCategory(category)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One section per Company.workplaceTypes[i] that has at least one published
 * review — each shows the single question its reviewers most agreed on and
 * the one they most disputed (by rate, not raw count, so it's fair across
 * companies with different review counts), plus an "All Questions" toggle
 * for the full 25-question breakdown. Pulled from GET
 * /companies/:slug/survey-stats, which only ever returns
 * agree/disagree/prefer-not-to-answer tallies, never which literal answer
 * was "correct".
 */
export function SurveyHighlights({ companySlug }: { companySlug: string }) {
  const [stats, setStats] = useState<CompanySurveyStats | null>(null);
  // Distinguishes "the request failed" from "no published reviews yet" —
  // both left `stats` null and rendered nothing, silently hiding a fetch
  // failure as if the company simply had no survey data.
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
    apiGet<CompanySurveyStats>(`/companies/${companySlug}/survey-stats`)
      .then(setStats)
      .catch(() => {
        setStats(null);
        setLoadFailed(true);
      });
  }, [companySlug]);

  const populated = stats?.byWorkplaceType.filter((s) => s.totalReviews > 0) ?? [];
  if (loadFailed) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Couldn&apos;t load the survey highlights right now.
      </p>
    );
  }
  if (populated.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {populated.map((s) => (
        <WorkplaceTypeSurveySection key={s.workplaceType} stats={s} />
      ))}
    </div>
  );
}

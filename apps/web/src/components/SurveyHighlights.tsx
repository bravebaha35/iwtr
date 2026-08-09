"use client";

import { useEffect, useState } from "react";
import type { CategoryKey, CompanySurveyStats, SurveyQuestionStats } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";

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

/**
 * Shows the single question reviewers most agreed on and the single question
 * they most disputed (by rate, not raw count, so it's fair across companies
 * with different review counts) — pulled from GET /companies/:slug/survey-
 * stats, which only ever returns agree/disagree/prefer-not-to-answer tallies,
 * never which literal answer was "correct". "All Questions" expands the full
 * 25-question breakdown for the company's workplaceType.
 */
export function SurveyHighlights({ companySlug }: { companySlug: string }) {
  const [stats, setStats] = useState<CompanySurveyStats | null>(null);
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

  useEffect(() => {
    apiGet<CompanySurveyStats>(`/companies/${companySlug}/survey-stats`)
      .then(setStats)
      .catch(() => setStats(null));
  }, [companySlug]);

  if (!stats || stats.totalReviews === 0 || stats.questions.length === 0) return null;

  const mostAgreed = [...stats.questions].sort((a, b) => rate(b, b.agreeCount) - rate(a, a.agreeCount))[0];
  const mostDisputed = [...stats.questions].sort((a, b) => rate(b, b.disagreeCount) - rate(a, a.disagreeCount))[0];

  return (
    <div className="mt-8 rounded-xl border border-border bg-surface p-6">
      <h2 className="mb-3 text-lg font-semibold text-foreground">What reviewers said</h2>
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

"use client";

import { useEffect, useState } from "react";
import type { CategoryKey, CompanySurveyStats, SurveyQuestionStats, WorkplaceType } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";
import { collarPillClassName } from "@/lib/collarColors";

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

// Every category header shows by default; its questions are never inline —
// clicking a topic opens a centered modal (not a below-the-row dropdown or
// a side-anchored popup), closed via the top-right "X", the Escape key, or
// clicking the backdrop.
function CategorySection({
  category,
  questions,
  open,
  onToggle,
}: {
  category: CategoryKey;
  questions: SurveyQuestionStats[];
  open: boolean;
  onToggle: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onToggle();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onToggle]);

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
        <span className={`text-muted-foreground transition-transform ${open ? "text-brand-600 dark:text-brand-400" : ""}`}>
          ›
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          {/* Backdrop — click anywhere outside the modal card to close it. */}
          <button type="button" aria-label="Close" onClick={onToggle} className="absolute inset-0 cursor-default bg-black/40" />
          <div className="relative z-10 w-80 max-w-[90vw] rounded-xl border border-border bg-surface p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">{CATEGORY_LABELS[category]}</h4>
              <button
                type="button"
                onClick={onToggle}
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex max-h-96 flex-col gap-3 overflow-y-auto pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {questions.map((q) => (
                <QuestionRow key={q.questionId} q={q} showCategory={false} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * One "What reviewers said" box per company — not one per workplaceType.
 * A company with 2 tags (e.g. a hospital: SERVICE + OFFICE) shows a small
 * color-coded toggle (reusing the collar color map from the review-list
 * filter tabs) to switch which type's breakdown is displayed, instead of
 * stacking two separate boxes. Pulled from GET /companies/:slug/survey-stats,
 * which only ever returns agree/disagree/prefer-not-to-answer tallies, never
 * which literal answer was "correct".
 */
export function SurveyHighlights({ companySlug }: { companySlug: string }) {
  const [stats, setStats] = useState<CompanySurveyStats | null>(null);
  // Distinguishes "the request failed" from "no published reviews yet" —
  // both left `stats` null and rendered nothing, silently hiding a fetch
  // failure as if the company simply had no survey data.
  const [loadFailed, setLoadFailed] = useState(false);
  const [manualActiveType, setManualActiveType] = useState<WorkplaceType | null>(null);
  // Only one category popup open at a time — opening a second one closes
  // whichever was already open, rather than stacking popups.
  const [openCategory, setOpenCategory] = useState<CategoryKey | null>(null);

  useEffect(() => {
    setLoadFailed(false);
    apiGet<CompanySurveyStats>(`/companies/${companySlug}/survey-stats`)
      .then(setStats)
      .catch(() => {
        setStats(null);
        setLoadFailed(true);
      });
  }, [companySlug]);

  function toggleCategory(category: CategoryKey) {
    setOpenCategory((prev) => (prev === category ? null : category));
  }

  if (loadFailed) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Couldn&apos;t load the survey highlights right now.
      </p>
    );
  }

  const populated = stats?.byWorkplaceType.filter((s) => s.totalReviews > 0) ?? [];
  // Falls back to the first populated type whenever nothing's been manually
  // picked yet, or the manual pick no longer applies (e.g. stats reloaded) —
  // computed at render time rather than via a setState-in-effect, so
  // clicking a toggle button is the only thing that ever changes it.
  const activeType =
    (manualActiveType && populated.some((s) => s.workplaceType === manualActiveType)
      ? manualActiveType
      : populated[0]?.workplaceType) ?? null;
  const activeStats = populated.find((s) => s.workplaceType === activeType) ?? null;

  const mostAgreed = activeStats
    ? [...activeStats.questions].sort((a, b) => rate(b, b.agreeCount) - rate(a, a.agreeCount))[0]
    : null;
  const mostDisputed = activeStats
    ? [...activeStats.questions].sort((a, b) => rate(b, b.disagreeCount) - rate(a, a.disagreeCount))[0]
    : null;

  return (
    <div className="h-full rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">
          What reviewers said
          {activeType && populated.length <= 1 && (
            <span className="font-normal text-muted-foreground"> — {workplaceTypeLabel(activeType)}</span>
          )}
        </h2>
        {populated.length > 1 && (
          <div className="flex gap-1.5">
            {populated.map((s) => (
              <button
                key={s.workplaceType}
                type="button"
                onClick={() => setManualActiveType(s.workplaceType)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${collarPillClassName(
                  s.workplaceType,
                  s.workplaceType === activeType,
                )}`}
              >
                {workplaceTypeLabel(s.workplaceType)}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeStats && mostAgreed && mostDisputed ? (
        <>
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

          <div className="mt-4 flex flex-col gap-1 border-t border-border pt-3">
            {CATEGORY_ORDER.map((category) => (
              <CategorySection
                key={category}
                category={category}
                questions={activeStats.questions.filter((q) => q.category === category)}
                open={openCategory === category}
                onToggle={() => toggleCategory(category)}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No reviews yet — be the first to answer the survey for this workplace.
        </p>
      )}
    </div>
  );
}

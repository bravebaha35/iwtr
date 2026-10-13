"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CompanyQuestionCounts, CompanyQuestionFilter, CompanyQuestionPage, PublicSocialQuestion } from "@iwtr/shared-types";
import { apiGet, ApiError } from "@/lib/api-client";
import { QuestionCard, QuestionListSkeleton } from "@/components/social/QuestionCard";

const FILTERS: { value: CompanyQuestionFilter; label: string; count?: keyof CompanyQuestionCounts }[] = [
  { value: "waiting", label: "Waiting for you", count: "waiting" },
  { value: "hidden", label: "Hidden", count: "hidden" },
  { value: "shown", label: "Shown to everyone", count: "shown" },
  { value: "all", label: "All" },
];

const EMPTY: Record<CompanyQuestionFilter, string> = {
  waiting: "Nothing is waiting for you.",
  hidden: "No hidden questions.",
  shown: "No question is shown to everyone yet.",
  all: "Nobody has asked this company anything yet.",
};

/**
 * The owner dashboard's Questions section: every question members put to
 * this company on IWT Social, whatever its state. A new one is seen by its
 * asker and the company only; the owner answers it here and picks whether it
 * is then shown to everyone or stays hidden, and can change that later. The
 * answer is the company's one way to respond - there is no message to the
 * person who asked - and a question that breaks the rules is reported to the
 * site admins from its card.
 *
 * Opens on "Waiting for you" when anything is waiting, on "All" otherwise.
 */
export function QuestionsCategory({
  companyId,
  companyName,
  onCounts,
}: {
  companyId: string;
  companyName: string;
  // Each read hands the fresh counts up, for the "N waiting" line in the side list.
  onCounts?: (counts: CompanyQuestionCounts) => void;
}) {
  // null until the first read has said whether anything is waiting.
  const [filter, setFilter] = useState<CompanyQuestionFilter | null>(null);
  const [questions, setQuestions] = useState<PublicSocialQuestion[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [counts, setCounts] = useState<CompanyQuestionCounts | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which list is on screen: the first read settles the filter itself, and
  // that must not send the same request a second time.
  const shown = useRef<CompanyQuestionFilter | null>(null);

  const read = useCallback(
    (which: CompanyQuestionFilter, after?: string) =>
      apiGet<CompanyQuestionPage>(`/social/company-questions/${companyId}?filter=${which}${after ? `&cursor=${after}` : ""}`),
    [companyId],
  );

  const takeCounts = useCallback(
    (next: CompanyQuestionCounts) => {
      setCounts(next);
      onCounts?.(next);
    },
    [onCounts],
  );

  useEffect(() => {
    if (filter !== null && shown.current === filter) return;
    let cancelled = false;
    (async () => {
      try {
        let which = filter ?? "waiting";
        let page = await read(which);
        // First visit with nothing waiting: show everything instead of an empty list.
        if (filter === null && page.counts.waiting === 0) {
          which = "all";
          page = await read(which);
        }
        if (cancelled) return;
        setQuestions(page.questions);
        setCursor(page.nextCursor);
        takeCounts(page.counts);
        setError(null);
        shown.current = which;
        if (filter === null) setFilter(which);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Couldn't load the questions.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filter, read, takeCounts]);

  function pick(next: CompanyQuestionFilter) {
    if (next === filter) return;
    setQuestions(null);
    setCursor(null);
    setFilter(next);
  }

  async function loadMore() {
    if (!cursor || !filter) return;
    setLoadingMore(true);
    try {
      const page = await read(filter, cursor);
      setQuestions((prev) => [...(prev ?? []), ...page.questions]);
      setCursor(page.nextCursor);
      takeCounts(page.counts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load more.");
    } finally {
      setLoadingMore(false);
    }
  }

  // An answer or a hide / show moves a question between the groups: the card
  // stays where the owner is looking at it, the numbers are read again.
  function changed(next: PublicSocialQuestion) {
    setQuestions((prev) => (prev ? prev.map((x) => (x.id === next.id ? next : x)) : prev));
    apiGet<CompanyQuestionCounts>(`/social/company-questions/${companyId}/counts`)
      .then(takeCounts)
      .catch(() => undefined);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl bg-surface p-7 shadow-xs">
        <h3 className="font-semibold text-foreground">Questions</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Questions people asked {companyName} on IWT Social. A new question is seen only by you and the person who asked.
          Answer it, then choose: show it to everyone on your Social tab, or keep it hidden. You can change that later.
        </p>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Your answer is the only way to reply. The person who asked stays anonymous and cannot be messaged. If a question
          breaks the rules, use &quot;Report to admin&quot; on it.
        </p>

        <div role="radiogroup" aria-label="Which questions to show" className="mt-4 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const checked = filter === f.value;
            const n = f.count && counts ? counts[f.count] : null;
            return (
              <button
                key={f.value}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => pick(f.value)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition active:scale-[0.98] ${
                  checked ? "bg-brand-600 text-white" : "bg-surface-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
                {n !== null && <span className="ml-1.5 tabular-nums">{n}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}

      <div className="flex w-full max-w-xl flex-col gap-5">
        {questions === null && !error && <QuestionListSkeleton count={2} />}
        {questions !== null && questions.length === 0 && <p className="px-1 text-sm text-muted-foreground">{EMPTY[filter ?? "all"]}</p>}
        {questions?.map((question) => (
          <QuestionCard key={question.id} question={question} onChanged={changed} />
        ))}
        {cursor && (
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="self-start rounded-full bg-surface px-4 py-1.5 text-sm font-semibold text-foreground shadow-xs transition hover:bg-border/70 disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Show more"}
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicSocialQuestion, SocialQuestionFilter, SocialQuestionPage, WorkplaceType } from "@iwtr/shared-types";
import type { CategoryGroup } from "@/lib/categoryGroups";
import { apiGet, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { AskQuestionBox } from "./AskQuestionBox";
import { QuestionCard, QuestionListSkeleton } from "./QuestionCard";
import { clearSocialCache, readQuestions, writeQuestions } from "./socialFeedCache";

type Scope = { kind: "all" } | { kind: "company"; slug: string; company: { id: string; name: string; mainPhotoUrl?: string | null } };

// One page of questions, as the API sends it (SOCIAL_QUESTION_PAGE_SIZE).
const PAGE_SIZE = 10;

const FILTERS: { value: SocialQuestionFilter; label: string; memberOnly?: boolean }[] = [
  { value: "all", label: "Newest" },
  { value: "unanswered", label: "Unanswered" },
  { value: "mine", label: "My questions", memberOnly: true },
];

/**
 * The Questions list: on IWT Social (every question, with the sidebar's
 * search and filters) and on a company's Social tab (that company's own).
 * A member gets the ask box above it. Same no-wait rules as the post feed:
 * a list already seen this visit comes back from memory and is read again
 * behind it; a first load shows question-shaped placeholders.
 */
export function QuestionsFeed({
  scope,
  q,
  workplaceType,
  categoryGroup,
}: {
  scope: Scope;
  q?: string;
  workplaceType?: WorkplaceType | null;
  categoryGroup?: CategoryGroup | null;
}) {
  const { isAuthenticated, role } = useAuth();
  const isMember = isAuthenticated && role === "MEMBER";
  const [filter, setFilter] = useState<SocialQuestionFilter>("all");
  const openFilter: SocialQuestionFilter = filter === "mine" && !isMember ? "all" : filter;

  const params = new URLSearchParams();
  if (scope.kind === "company") params.set("company", scope.slug);
  else {
    if (q?.trim()) params.set("q", q.trim());
    if (workplaceType) params.set("workplaceTypes", workplaceType);
    if (categoryGroup) params.set("categoryGroup", categoryGroup);
  }
  if (openFilter !== "all") params.set("filter", openFilter);
  const listPath = `/social/questions${params.toString() ? `?${params}` : ""}`;

  // What is in memory belongs to whoever was looking (their own answers,
  // their "helpful" marks): signing in or out empties it.
  const wasAuthenticated = useRef(isAuthenticated);
  useEffect(() => {
    if (wasAuthenticated.current !== isAuthenticated) {
      wasAuthenticated.current = isAuthenticated;
      clearSocialCache();
    }
  }, [isAuthenticated]);
  const cacheKey = `${isAuthenticated ? "in" : "out"} ${listPath}`;
  // Bumped when the member has just asked: the list starts again from memory,
  // which by then holds the new question on top.
  const [asked, setAsked] = useState(0);

  function handleAsked(created: PublicSocialQuestion) {
    const before = readQuestions(cacheKey);
    writeQuestions(cacheKey, { questions: [created, ...(before?.questions ?? [])], nextCursor: before?.nextCursor ?? null });
    setAsked((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-5">
      <div role="radiogroup" aria-label="Which questions to show" className="flex flex-wrap gap-1.5">
        {FILTERS.filter((f) => !f.memberOnly || isMember).map((f) => {
          const checked = openFilter === f.value;
          return (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition active:scale-[0.98] ${
                checked ? "bg-brand-600 text-white" : "bg-surface-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {isMember && <AskQuestionBox company={scope.kind === "company" ? scope.company : undefined} onAsked={handleAsked} />}

      <QuestionList
        key={`${cacheKey} ${asked}`}
        cacheKey={cacheKey}
        listPath={listPath}
        filter={openFilter}
        scope={scope}
        canAsk={isMember}
        filtered={Boolean(q?.trim() || workplaceType || categoryGroup)}
      />
    </div>
  );
}

function emptyText(scope: Scope, filter: SocialQuestionFilter, filtered: boolean, canAsk: boolean): string {
  if (filter === "mine") return "You haven't asked anything yet.";
  if (filter === "unanswered") return "Every question here has an answer.";
  if (filtered) return "No questions match these filters.";
  if (scope.kind === "company") {
    return canAsk ? `Nobody has asked ${scope.company.name} anything yet. Yours can be the first.` : `Nobody has asked ${scope.company.name} anything yet.`;
  }
  return canAsk ? "No questions yet. Yours can be the first." : "No questions yet.";
}

function QuestionList({
  cacheKey,
  listPath,
  filter,
  scope,
  canAsk,
  filtered,
}: {
  cacheKey: string;
  listPath: string;
  filter: SocialQuestionFilter;
  scope: Scope;
  canAsk: boolean;
  filtered: boolean;
}) {
  const [questions, setQuestions] = useState<PublicSocialQuestion[]>(() => readQuestions(cacheKey)?.questions ?? []);
  const [cursor, setCursor] = useState<string | null>(() => readQuestions(cacheKey)?.nextCursor ?? null);
  const [loading, setLoading] = useState<"first" | "more" | null>(() => (readQuestions(cacheKey) ? null : "first"));
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Read the first page (again, if memory already supplied the list). The
  // short delay only groups keystrokes in the search box.
  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(
      () => {
        apiGet<SocialQuestionPage>(listPath)
          .then((page) => {
            if (cancelled) return;
            // Pages loaded earlier stay below the fresh first page.
            const before = readQuestions(cacheKey);
            const fresh = new Set(page.questions.map((x) => x.id));
            const keepTail = before !== undefined && before.questions.length > PAGE_SIZE;
            const next = keepTail
              ? { questions: [...page.questions, ...before.questions.filter((x) => !fresh.has(x.id))], nextCursor: before.nextCursor }
              : { questions: page.questions, nextCursor: page.nextCursor };
            writeQuestions(cacheKey, next);
            setQuestions(next.questions);
            setCursor(next.nextCursor);
            setError(null);
          })
          .catch((e) => {
            if (!cancelled) setError(e instanceof ApiError ? e.message : "Couldn't load the questions.");
          })
          .finally(() => {
            if (!cancelled) setLoading(null);
          });
      },
      readQuestions(cacheKey) ? 0 : 250,
    );
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [cacheKey, listPath]);

  const loadMore = useCallback(() => {
    if (loading || !cursor) return;
    setLoading("more");
    apiGet<SocialQuestionPage>(`${listPath}${listPath.includes("?") ? "&" : "?"}cursor=${cursor}`)
      .then((page) => {
        setQuestions((prev) => {
          const next = [...prev, ...page.questions];
          writeQuestions(cacheKey, { questions: next, nextCursor: page.nextCursor });
          return next;
        });
        setCursor(page.nextCursor);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load more."))
      .finally(() => setLoading(null));
  }, [cacheKey, cursor, listPath, loading]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  // Every change made on a card is kept in memory too, so the list comes
  // back as the person left it.
  function update(change: (prev: PublicSocialQuestion[]) => PublicSocialQuestion[]) {
    setQuestions((prev) => {
      const next = change(prev);
      writeQuestions(cacheKey, { questions: next, nextCursor: cursor });
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
      {loading === "first" && <QuestionListSkeleton />}
      {!loading && !error && questions.length === 0 && (
        <p className="py-6 text-sm text-muted-foreground">{emptyText(scope, filter, filtered, canAsk)}</p>
      )}

      {questions.map((question) => (
        <QuestionCard
          key={question.id}
          question={question}
          onChanged={(next) => update((prev) => prev.map((x) => (x.id === next.id ? next : x)))}
          onDeleted={(id) => update((prev) => prev.filter((x) => x.id !== id))}
        />
      ))}

      <div ref={sentinelRef} />
      {loading === "more" && <QuestionListSkeleton count={1} />}
    </div>
  );
}

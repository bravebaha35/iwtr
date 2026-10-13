"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicSocialPost, SocialCompanySort, SocialFeedPage, WorkplaceType } from "@iwtr/shared-types";
import type { CategoryGroup } from "@/lib/categoryGroups";
import { apiGet, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { AdSlot } from "@/components/AdSlot";
import { SocialPostCard } from "./SocialPostCard";
import { SocialFeedSkeleton } from "./SocialPostSkeleton";
import { clearSocialCache, onSocialPosted, readFeed, writeFeed } from "./socialFeedCache";

type Scope = { kind: "all" } | { kind: "following" } | { kind: "company"; slug: string } | { kind: "saved" };

// Inject one AdSlot after every 7th post as the list grows.
const AD_EVERY = 7;
// One page of the feed, as the API sends it (SOCIAL_FEED_PAGE_SIZE).
const PAGE_SIZE = 10;

const EMPTY_TEXT: Record<Scope["kind"], string> = {
  all: "No posts yet.",
  following: "Nothing here yet. Follow a company and its posts show up in this tab.",
  company: "No posts yet.",
  saved: "You haven't saved any posts yet.",
};

// The search box and Work-Type / Quick Select filters live in SocialSidebar
// (owned by SocialShell) and are passed in: they apply to "all" and
// "following", which are the same endpoint. "saved" takes none of them (it's
// just the caller's own saved-posts list); "company" takes only `sort`.
//
// No waiting where it can be avoided: a list this visit has already shown
// comes straight back from memory (socialFeedCache) and is read again behind
// it; a list seen for the first time shows post-shaped placeholders.
export function SocialFeed({
  scope,
  q,
  workplaceType,
  categoryGroup,
  sort,
}: {
  scope: Scope;
  q?: string;
  workplaceType?: WorkplaceType | null;
  categoryGroup?: CategoryGroup | null;
  // Only read when scope.kind === "company" - the other feeds have no sort
  // control (see SocialSidebar's mode split).
  sort?: SocialCompanySort;
}) {
  const { isAuthenticated } = useAuth();
  const kind = scope.kind;
  const slug = scope.kind === "company" ? scope.slug : null;

  const params = new URLSearchParams();
  if (kind === "all" || kind === "following") {
    if (kind === "following") params.set("following", "1");
    if (q?.trim()) params.set("q", q.trim());
    if (workplaceType) params.set("workplaceTypes", workplaceType);
    if (categoryGroup) params.set("categoryGroup", categoryGroup);
  }
  if (kind === "company" && sort) params.set("sort", sort);
  const base = kind === "saved" ? "/me/saved-posts" : kind === "company" ? `/social/companies/${slug}/posts` : "/social/feed";
  const listPath = `${base}${params.toString() ? `?${params}` : ""}`;

  // Likes, votes and saves in memory belong to whoever was looking: a list
  // is remembered per signed-in state, and signing in or out empties the lot.
  const wasAuthenticated = useRef(isAuthenticated);
  useEffect(() => {
    if (wasAuthenticated.current !== isAuthenticated) {
      wasAuthenticated.current = isAuthenticated;
      clearSocialCache();
    }
  }, [isAuthenticated]);
  const cacheKey = `${isAuthenticated ? "in" : "out"} ${listPath}`;

  // A different list (another tab, filter or sort) is a fresh FeedList, so
  // it starts from what memory holds for that list rather than the last one.
  return <FeedList key={cacheKey} cacheKey={cacheKey} listPath={listPath} kind={kind} />;
}

function FeedList({ cacheKey, listPath, kind }: { cacheKey: string; listPath: string; kind: Scope["kind"] }) {
  const [posts, setPosts] = useState<PublicSocialPost[]>(() => readFeed(cacheKey)?.posts ?? []);
  const [cursor, setCursor] = useState<string | null>(() => readFeed(cacheKey)?.nextCursor ?? null);
  // "first" = nothing to show yet (placeholders); "more" = the next page.
  const [loading, setLoading] = useState<"first" | "more" | null>(() => (readFeed(cacheKey) ? null : "first"));
  const [error, setError] = useState<string | null>(null);
  // Bumped to read the list again from the top (a pin moves a post there, a
  // new post was just published).
  const [reloadKey, setReloadKey] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => onSocialPosted(() => setReloadKey((k) => k + 1)), []);

  // Read the first page (again, if memory already supplied the list). The
  // short delay only groups keystrokes in the search box.
  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(
      () => {
        apiGet<SocialFeedPage>(listPath)
          .then((page) => {
            if (cancelled) return;
            // Pages loaded earlier stay below the fresh first page, so a
            // list the person had scrolled down doesn't collapse under them.
            const before = readFeed(cacheKey);
            const fresh = new Set(page.posts.map((p) => p.id));
            const keepTail = before !== undefined && before.posts.length > PAGE_SIZE;
            const next = keepTail
              ? { posts: [...page.posts, ...before.posts.filter((p) => !fresh.has(p.id))], nextCursor: before.nextCursor }
              : { posts: page.posts, nextCursor: page.nextCursor };
            writeFeed(cacheKey, next);
            setPosts(next.posts);
            setCursor(next.nextCursor);
            setError(null);
          })
          .catch((e) => {
            if (!cancelled) setError(e instanceof ApiError ? e.message : "Couldn't load the feed.");
          })
          .finally(() => {
            if (!cancelled) setLoading(null);
          });
      },
      readFeed(cacheKey) ? 0 : 250,
    );
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [cacheKey, listPath, reloadKey]);

  const loadMore = useCallback(() => {
    if (loading || !cursor) return;
    setLoading("more");
    apiGet<SocialFeedPage>(`${listPath}${listPath.includes("?") ? "&" : "?"}cursor=${cursor}`)
      .then((page) => {
        setPosts((prev) => {
          const next = [...prev, ...page.posts];
          writeFeed(cacheKey, { posts: next, nextCursor: page.nextCursor });
          return next;
        });
        setCursor(page.nextCursor);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load more."))
      .finally(() => setLoading(null));
  }, [cacheKey, cursor, listPath, loading]);

  // Start on the next page a little before the end of the list comes into
  // view, so scrolling rarely catches up with it.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  // Every change made on a card (a like, a vote, an edit) is kept in memory
  // too, so the list comes back as the person left it.
  function update(change: (prev: PublicSocialPost[]) => PublicSocialPost[]) {
    setPosts((prev) => {
      const next = change(prev);
      writeFeed(cacheKey, { posts: next, nextCursor: cursor });
      return next;
    });
  }

  // One pinned post per company: pinning takes the pin off that company's
  // other posts. On the company's own feed the pinned post also leads the
  // list, so that one is read again from the top.
  function handlePinToggled(postId: string, pinned: boolean) {
    update((prev) => {
      const companyId = prev.find((p) => p.id === postId)?.companyId;
      return prev.map((p) => (p.companyId === companyId ? { ...p, pinned: p.id === postId && pinned } : p));
    });
    if (kind === "company") setReloadKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-5">
      {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
      {loading === "first" && <SocialFeedSkeleton />}
      {!loading && !error && posts.length === 0 && <p className="py-6 text-sm text-muted-foreground">{EMPTY_TEXT[kind]}</p>}

      {posts.map((post, i) => (
        <div key={post.id} className="contents">
          <SocialPostCard
            post={post}
            priority={i === 0}
            showPinned={kind === "company"}
            onChanged={(p) => update((prev) => prev.map((x) => (x.id === p.id ? p : x)))}
            onDeleted={(id) => update((prev) => prev.filter((x) => x.id !== id))}
            onPinToggled={handlePinToggled}
          />
          {(i + 1) % AD_EVERY === 0 && <AdSlot orientation="horizontal" variant={(i + 1) / AD_EVERY} />}
        </div>
      ))}

      <div ref={sentinelRef} />
      {loading === "more" && <SocialFeedSkeleton count={1} />}
    </div>
  );
}

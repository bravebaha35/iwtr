"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicSocialPost, SocialCompanySort, SocialFeedPage, WorkplaceType } from "@iwtr/shared-types";
import type { CategoryGroup } from "@/lib/categoryGroups";
import { apiGet, ApiError } from "@/lib/api-client";
import { AdSlot } from "@/components/AdSlot";
import { SocialPostCard } from "./SocialPostCard";

type Scope = { kind: "all" } | { kind: "following" } | { kind: "company"; slug: string } | { kind: "saved" };

// Inject one AdSlot after every 7th post as the list grows.
const AD_EVERY = 7;

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
  const [posts, setPosts] = useState<PublicSocialPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumped to load the list again from the top (a pin moves a post there).
  const [reloadKey, setReloadKey] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const kind = scope.kind;
  const slug = scope.kind === "company" ? scope.slug : null;

  const endpoint = useCallback(
    (nextCursor: string | null) => {
      const params = new URLSearchParams();
      if (nextCursor) params.set("cursor", nextCursor);
      if (kind === "all" || kind === "following") {
        if (kind === "following") params.set("following", "1");
        if (q?.trim()) params.set("q", q.trim());
        if (workplaceType) params.set("workplaceTypes", workplaceType);
        if (categoryGroup) params.set("categoryGroup", categoryGroup);
      }
      if (kind === "company" && sort) params.set("sort", sort);
      const base = kind === "saved" ? "/me/saved-posts" : kind === "company" ? `/social/companies/${slug}/posts` : "/social/feed";
      return `${base}${params.toString() ? `?${params}` : ""}`;
    },
    [kind, slug, q, workplaceType, categoryGroup, sort],
  );

  // Reset + reload whenever scope or any filter changes.
  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      setError(null);
      apiGet<SocialFeedPage>(endpoint(null))
        .then((page) => {
          setPosts(page.posts);
          setCursor(page.nextCursor);
          setDone(page.nextCursor === null);
        })
        .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load the feed."))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [endpoint, reloadKey]);

  const loadMore = useCallback(() => {
    if (loading || done || !cursor) return;
    setLoading(true);
    apiGet<SocialFeedPage>(endpoint(cursor))
      .then((page) => {
        setPosts((prev) => [...prev, ...page.posts]);
        setCursor(page.nextCursor);
        setDone(page.nextCursor === null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load more."))
      .finally(() => setLoading(false));
  }, [cursor, done, endpoint, loading]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore());
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  // One pinned post per company: pinning takes the pin off that company's
  // other posts. On the company's own feed the pinned post also leads the
  // list, so that one is loaded again from the top.
  function handlePinToggled(postId: string, pinned: boolean) {
    setPosts((prev) => {
      const companyId = prev.find((p) => p.id === postId)?.companyId;
      return prev.map((p) => (p.companyId === companyId ? { ...p, pinned: p.id === postId && pinned } : p));
    });
    if (kind === "company") setReloadKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-5">
      {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
      {!loading && !error && posts.length === 0 && <p className="py-6 text-sm text-muted-foreground">{EMPTY_TEXT[kind]}</p>}

      {posts.map((post, i) => (
        <div key={post.id} className="contents">
          <SocialPostCard
            post={post}
            showPinned={kind === "company"}
            onChanged={(p) => setPosts((prev) => prev.map((x) => (x.id === p.id ? p : x)))}
            onDeleted={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))}
            onPinToggled={handlePinToggled}
          />
          {(i + 1) % AD_EVERY === 0 && <AdSlot orientation="horizontal" variant={(i + 1) / AD_EVERY} />}
        </div>
      ))}

      <div ref={sentinelRef} />
      {loading && <p className="text-center text-sm text-muted-foreground">Loading...</p>}
    </div>
  );
}

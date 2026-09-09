"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicSocialPost, SocialFeedPage, WorkplaceType } from "@iwtr/shared-types";
import type { CategoryGroup } from "@/lib/categoryGroups";
import { apiGet, ApiError } from "@/lib/api-client";
import { AdSlot } from "@/components/AdSlot";
import { SocialPostCard } from "./SocialPostCard";

type Scope = { kind: "all" } | { kind: "company"; slug: string } | { kind: "saved" };

// Inject one AdSlot after every 7th post as the list grows (spec item 1).
const AD_EVERY = 7;

// Search box + Job-Category/Industry-Tag filters used to live inline here
// (kind "all" only) - now owned by SocialSidebar/SocialShell and passed in,
// since the sidebar needs the same query/filter state the feed fetches
// against. "saved" scope takes none of these (it's just the caller's own
// saved-posts list).
export function SocialFeed({
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
  const [posts, setPosts] = useState<PublicSocialPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const endpoint = useCallback(
    (nextCursor: string | null) => {
      const params = new URLSearchParams();
      if (nextCursor) params.set("cursor", nextCursor);
      if (scope.kind === "all") {
        if (q?.trim()) params.set("q", q.trim());
        if (workplaceType) params.set("workplaceTypes", workplaceType);
        if (categoryGroup) params.set("categoryGroup", categoryGroup);
      }
      const base =
        scope.kind === "all" ? "/social/feed" : scope.kind === "saved" ? "/me/saved-posts" : `/social/companies/${scope.slug}/posts`;
      return `${base}${params.toString() ? `?${params}` : ""}`;
    },
    [scope, q, workplaceType, categoryGroup],
  );

  // Reset + reload whenever scope or any filter changes (all-scope filters
  // only actually vary the query string, but the effect re-runs for every
  // scope so switching into/out of "saved" reloads too).
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
  }, [endpoint]);

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

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!loading && !error && posts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {scope.kind === "saved" ? "You haven't saved any posts yet." : "No posts yet."}
        </p>
      )}

      {posts.map((post, i) => (
        <div key={post.id} className="contents">
          <SocialPostCard
            post={post}
            onChanged={(p) => setPosts((prev) => prev.map((x) => (x.id === p.id ? p : x)))}
          />
          {(i + 1) % AD_EVERY === 0 && <AdSlot orientation="horizontal" />}
        </div>
      ))}

      <div ref={sentinelRef} />
      {loading && <p className="text-center text-sm text-muted-foreground">Loading...</p>}
    </div>
  );
}

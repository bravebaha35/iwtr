"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicSocialPost, SocialFeedPage } from "@iwtr/shared-types";
import { apiGet, ApiError } from "@/lib/api-client";
import { AdSlot } from "@/components/AdSlot";
import { SocialPostCard } from "./SocialPostCard";

type Scope = { kind: "all" } | { kind: "company"; slug: string };

// Inject one AdSlot after every 7th post as the list grows (spec item 1).
const AD_EVERY = 7;

export function SocialFeed({ scope }: { scope: Scope }) {
  const [posts, setPosts] = useState<PublicSocialPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const sentinelRef = useRef<HTMLDivElement>(null);

  const endpoint = useCallback(
    (nextCursor: string | null, q: string) => {
      const params = new URLSearchParams();
      if (nextCursor) params.set("cursor", nextCursor);
      if (scope.kind === "all" && q.trim()) params.set("q", q.trim());
      const base = scope.kind === "all" ? "/social/feed" : `/social/companies/${scope.slug}/posts`;
      return `${base}${params.toString() ? `?${params}` : ""}`;
    },
    [scope],
  );

  // Reset + reload whenever the debounced search query changes (all-scope only).
  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      setError(null);
      apiGet<SocialFeedPage>(endpoint(null, query))
        .then((page) => {
          setPosts(page.posts);
          setCursor(page.nextCursor);
          setDone(page.nextCursor === null);
        })
        .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load the feed."))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [endpoint, query]);

  const loadMore = useCallback(() => {
    if (loading || done || !cursor) return;
    setLoading(true);
    apiGet<SocialFeedPage>(endpoint(cursor, query))
      .then((page) => {
        setPosts((prev) => [...prev, ...page.posts]);
        setCursor(page.nextCursor);
        setDone(page.nextCursor === null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load more."))
      .finally(() => setLoading(false));
  }, [cursor, done, endpoint, loading, query]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore());
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  return (
    <div className="flex flex-col gap-4">
      {scope.kind === "all" && (
        // Fixed to the top-left of the feed column, company-name search only -
        // NO sort or filter dropdowns (spec item 1).
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a company by name..."
          className="w-full max-w-sm self-start rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground"
        />
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!loading && !error && posts.length === 0 && (
        <p className="text-sm text-muted-foreground">No posts yet.</p>
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

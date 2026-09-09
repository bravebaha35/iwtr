"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminCompanySummary, PublicSocialPost, SocialFeedPage } from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiDelete, apiGet, apiPatch, ApiError } from "@/lib/api-client";

// One company's expanded IWT Social feed — fetched lazily (only once its row
// is expanded) via the ADMIN-only GET /admin/social/companies/:id/posts,
// which (unlike the public GET /social/companies/:slug/posts) still works
// once the company is hidden, so a hidden company's posts stay manageable
// from here. "Remove" calls the ADMIN-only DELETE /admin/social/posts/:id
// (see AdminSocialController).
function CompanyPostsPanel({
  company,
  onWiped,
}: {
  company: AdminCompanySummary;
  onWiped: () => void;
}) {
  const [posts, setPosts] = useState<PublicSocialPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const page = await apiGet<SocialFeedPage>(`/admin/social/companies/${company.id}/posts`);
      setPosts(page.posts);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load this company's IWT Social posts.");
    }
  }, [company.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function removePost(postId: string) {
    setRemovingId(postId);
    setError(null);
    try {
      await apiDelete(`/admin/social/posts/${postId}`);
      setPosts((prev) => (prev ? prev.filter((p) => p.id !== postId) : prev));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove that post.");
    } finally {
      setRemovingId(null);
    }
  }

  async function wipeFeed() {
    if (!window.confirm(`Delete every IWT Social post for "${company.name}"? This can't be undone.`)) {
      return;
    }
    setError(null);
    try {
      await apiDelete(`/admin/social/companies/${company.id}/posts`);
      setPosts([]);
      onWiped();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't wipe this company's feed.");
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-surface-muted p-3">
      {error && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {posts === null && !error && <p className="text-sm text-muted-foreground">Loading posts...</p>}
      {posts !== null && posts.length === 0 && (
        <p className="text-sm text-muted-foreground">No IWT Social posts for this company.</p>
      )}

      {posts !== null && posts.length > 0 && (
        <>
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={wipeFeed}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
            >
              Wipe IWT Social feed
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {posts.map((post) => (
              <div
                key={post.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface p-2.5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- owner/user-submitted photo, not a static asset */}
                <img
                  src={post.imageUrls[0]}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-md object-cover"
                />
                <div className="min-w-0 flex-1">
                  {post.caption && (
                    <p className="truncate text-sm text-foreground" title={post.caption}>
                      {post.caption}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(post.createdAt).toLocaleString()} · {post.likeCount} likes · {post.commentCount}{" "}
                    comments
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removePost(post.id)}
                  disabled={removingId === post.id}
                  className="shrink-0 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CompanyRow({
  company,
  onVisibilityChanged,
}: {
  company: AdminCompanySummary;
  onVisibilityChanged: (companyId: string, hidden: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleVisibility() {
    setTogglingVisibility(true);
    setError(null);
    try {
      const nextHidden = !company.hidden;
      await apiPatch(`/admin/companies/${company.id}/visibility`, { hidden: nextHidden });
      onVisibilityChanged(company.id, nextHidden);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't change visibility.");
    } finally {
      setTogglingVisibility(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4 compact:p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{company.name}</span>
            {company.hidden && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
                Hidden
              </span>
            )}
          </div>
          {(company.city || company.district) && (
            <p className="text-xs text-muted-foreground">
              {[company.district, company.city].filter(Boolean).join(", ")}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleVisibility}
            disabled={togglingVisibility}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
              company.hidden
                ? "border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
                : "border-border text-foreground hover:bg-surface-muted"
            }`}
          >
            {company.hidden ? "Unhide" : "Hide"}
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            {expanded ? "Hide posts" : "IWT Social posts"}
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {expanded && <CompanyPostsPanel company={company} onWiped={() => {}} />}
    </div>
  );
}

export default function AdminContentPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [companies, setCompanies] = useState<AdminCompanySummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (q: string) => {
      if (!isAuthenticated) return;
      try {
        const data = await apiGet<AdminCompanySummary[]>(
          `/admin/companies${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`,
        );
        setCompanies(data);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load companies.");
      }
    },
    [isAuthenticated],
  );

  useEffect(() => {
    void load(query);
    // Only re-fetch when auth resolves or on an explicit search submit —
    // not on every keystroke, matching the debounce-free "type then submit"
    // convention the admin dashboard's own company search box uses.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  function onVisibilityChanged(companyId: string, hidden: boolean) {
    setCompanies((prev) => (prev ? prev.map((c) => (c.id === companyId ? { ...c, hidden } : c)) : prev));
  }

  if (isLoading) return null;

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Log in as an admin to view this page.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold text-foreground">Content moderation</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Hide a company from every public surface, wipe its IWT Social feed, or remove individual posts.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load(query);
        }}
        className="mb-6 flex gap-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search companies by name..."
          className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted"
        >
          Search
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {companies === null && !error && <p className="text-sm text-muted-foreground">Loading...</p>}
      {companies !== null && companies.length === 0 && (
        <p className="text-sm text-muted-foreground">No companies match that search.</p>
      )}

      <div className="flex flex-col gap-3 compact:gap-2">
        {companies?.map((company) => (
          <CompanyRow key={company.id} company={company} onVisibilityChanged={onVisibilityChanged} />
        ))}
      </div>
    </div>
  );
}

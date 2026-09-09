"use client";

import { useEffect, useState } from "react";
import type { PublicSocialComment, SocialCommentVoteResult } from "@iwtr/shared-types";
import { apiGet, apiPost, apiDelete, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/Avatar";
import { shortRelativeTime } from "./socialTime";

// Same glyphs as the review Helpful/Not-Helpful buttons (ReviewsList.tsx),
// icon-only per the brief - no "Helpful"/"Not Helpful" text, just the
// thumb, shown on every comment by default rather than a hover-reveal.
function ThumbUpIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3Z" />
      <path d="M7 10l4.5-6.5a1.5 1.5 0 0 1 2.7.9V9h4.6a2 2 0 0 1 1.95 2.44l-1.4 6A2 2 0 0 1 17.4 19H9a2 2 0 0 1-2-2v-7Z" />
    </svg>
  );
}
function ThumbDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 14V3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3Z" />
      <path d="M17 14l-4.5 6.5a1.5 1.5 0 0 1-2.7-.9V15H5.2a2 2 0 0 1-1.95-2.44l1.4-6A2 2 0 0 1 6.6 5H15a2 2 0 0 1 2 2v7Z" />
    </svg>
  );
}

export function SocialComments({ postId, onCountChange }: { postId: string; onCountChange: (n: number) => void }) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [comments, setComments] = useState<PublicSocialComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<PublicSocialComment[]>(`/social/posts/${postId}/comments`)
      .then((rows) => {
        setComments(rows);
        onCountChange(rows.length);
      })
      .catch(() => setComments([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onCountChange is a fresh closure each render; re-running on postId change only is correct here
  }, [postId]);

  async function submit() {
    if (!isAuthenticated) return openAuthModal();
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await apiPost<PublicSocialComment>(`/social/posts/${postId}/comments`, { body: draft.trim() });
      const next = [...(comments ?? []), created];
      setComments(next);
      onCountChange(next.length);
      setDraft("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't post that comment.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await apiDelete(`/social/comments/${id}`);
      const next = (comments ?? []).filter((c) => c.id !== id);
      setComments(next);
      onCountChange(next.length);
    } catch {
      /* leave it; a failed delete is non-destructive */
    }
  }

  async function vote(commentId: string, value: 1 | -1) {
    if (!isAuthenticated) return openAuthModal();
    if (votingId) return;
    setVotingId(commentId);
    try {
      const result = await apiPost<SocialCommentVoteResult>(`/social/comments/${commentId}/vote`, { value });
      setComments((prev) =>
        (prev ?? []).map((c) =>
          c.id === commentId
            ? { ...c, helpfulCount: result.helpfulCount, notHelpfulCount: result.notHelpfulCount, myVote: result.myVote }
            : c,
        ),
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) openAuthModal();
    } finally {
      setVotingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border p-3">
      {comments?.map((c) => (
        <div key={c.id} className="flex items-start gap-2">
          <Avatar avatarKey={c.avatarKey} avatarGradient={c.avatarGradient} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">
              {c.displayUsername ?? "Anonymous"} - {shortRelativeTime(c.createdAt)}
            </p>
            <p className="whitespace-pre-wrap text-sm text-foreground">{c.body}</p>

            {/* Same red/green as ReviewsList's Helpful/Not Helpful, but
                icon-only and shown for every comment by default. */}
            <div className="mt-1 flex items-center gap-3">
              <button
                type="button"
                onClick={() => vote(c.id, 1)}
                disabled={votingId === c.id}
                aria-label="Helpful"
                aria-pressed={c.myVote === 1}
                title={!isAuthenticated ? "Log in to vote" : "Helpful"}
                className={`flex items-center gap-1 text-xs transition disabled:opacity-40 ${
                  c.myVote === 1
                    ? "text-green-600 dark:text-green-400"
                    : "text-muted-foreground hover:text-green-600 dark:hover:text-green-400"
                }`}
              >
                <ThumbUpIcon className="h-4 w-4" />
                {c.helpfulCount}
              </button>
              <button
                type="button"
                onClick={() => vote(c.id, -1)}
                disabled={votingId === c.id}
                aria-label="Not Helpful"
                aria-pressed={c.myVote === -1}
                title={!isAuthenticated ? "Log in to vote" : "Not Helpful"}
                className={`flex items-center gap-1 text-xs transition disabled:opacity-40 ${
                  c.myVote === -1
                    ? "text-red-600 dark:text-red-400"
                    : "text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                }`}
              >
                <ThumbDownIcon className="h-4 w-4" />
                {c.notHelpfulCount}
              </button>
            </div>
          </div>
          {c.mine && (
            <button type="button" onClick={() => remove(c.id)} className="text-xs text-muted-foreground hover:text-foreground">
              Delete
            </button>
          )}
        </div>
      ))}

      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => { if (!isAuthenticated) openAuthModal(); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Add a comment..."
          maxLength={1000}
          className="flex-1 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          Post
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

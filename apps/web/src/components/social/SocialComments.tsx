"use client";

import { useEffect, useState } from "react";
import type { PublicSocialComment } from "@iwtr/shared-types";
import { apiGet, apiPost, apiDelete, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/Avatar";
import { shortRelativeTime } from "./socialTime";

export function SocialComments({ postId, onCountChange }: { postId: string; onCountChange: (n: number) => void }) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [comments, setComments] = useState<PublicSocialComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
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

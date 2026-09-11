"use client";

import { useEffect, useRef, useState } from "react";
import type {
  CommentIdentityMode,
  PublicSocialComment,
  SocialCommentIdentityContext,
  SocialCommentVoteResult,
} from "@iwtr/shared-types";
import { RANDOMIZED_IDENTITY_AVATAR_GRADIENT, RANDOMIZED_IDENTITY_AVATAR_KEY } from "@iwtr/shared-types";
import { apiGet, apiPost, apiDelete, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/Avatar";
import { shortRelativeTime } from "./socialTime";

const MAX_COMMENT_LENGTH = 1250;

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
// Dual-arrow "switch identity" glyph for the composer's avatar toggle.
function SwapIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 7h12l-3.5-3.5" />
      <path d="M17 17H5l3.5 3.5" />
    </svg>
  );
}
// Simple up/down chevron - the top-of-list "show earlier comments" toggle.
function ChevronIcon({ className, direction }: { className?: string; direction: "up" | "down" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={direction === "up" ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
    </svg>
  );
}
// The "..." per-comment options menu (Delete own / Report others').
function KebabIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}

// What the composer's avatar/label should show right now, given the
// identity context fetched from the API and (only while unlocked) which
// option the user currently has toggled to. Kept as a plain function rather
// than inline ternaries in JSX so TypeScript can actually narrow
// SocialCommentIdentityContext's discriminated union on `locked`.
function composerIdentityPreview(
  context: SocialCommentIdentityContext | null,
  selectedMode: "PERSONAL_CHOSEN" | "PERSONAL_RANDOM",
): { avatarKey: string | null; avatarGradient: string | null; photoUrl: string | null; label: string | null } {
  if (!context) return { avatarKey: null, avatarGradient: null, photoUrl: null, label: null };
  if (context.locked) {
    return {
      avatarKey: context.avatarKey,
      avatarGradient: context.avatarGradient,
      photoUrl: context.avatarPhotoUrl,
      label: context.displayUsername,
    };
  }
  if (selectedMode === "PERSONAL_RANDOM") {
    return {
      avatarKey: RANDOMIZED_IDENTITY_AVATAR_KEY,
      avatarGradient: RANDOMIZED_IDENTITY_AVATAR_GRADIENT,
      photoUrl: null,
      label: "a new anonymous name",
    };
  }
  return {
    avatarKey: context.chosen.avatarKey,
    avatarGradient: context.chosen.avatarGradient,
    photoUrl: null,
    label: context.chosen.displayUsername,
  };
}

export function SocialComments({ postId, onCountChange }: { postId: string; onCountChange: (n: number) => void }) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [comments, setComments] = useState<PublicSocialComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [identityContext, setIdentityContext] = useState<SocialCommentIdentityContext | null>(null);
  const [selectedMode, setSelectedMode] = useState<"PERSONAL_CHOSEN" | "PERSONAL_RANDOM">("PERSONAL_CHOSEN");
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  // Collapsed by default: only the 3 most recent comments show, with a
  // toggle above them to reveal the rest (see the render below).
  const [showAllComments, setShowAllComments] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grows the composer line-by-line as its content wraps or gains newlines,
  // instead of scrolling inside a fixed-height box - re-runs on every draft
  // change, typed or programmatic (e.g. clearing it after a successful post).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  useEffect(() => {
    apiGet<PublicSocialComment[]>(`/social/posts/${postId}/comments`)
      .then((rows) => {
        setComments(rows);
        onCountChange(rows.length);
      })
      .catch(() => setComments([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onCountChange is a fresh closure each render; re-running on postId change only is correct here
  }, [postId]);

  // What identity this viewer would comment as on THIS post - only a company
  // owner or a member who hasn't commented here yet ever gets a real choice
  // (see SocialCommentIdentityContext); fetched once per post, not per
  // keystroke, since it can't change except by actually posting.
  useEffect(() => {
    if (!isAuthenticated) {
      setIdentityContext(null);
      return;
    }
    let cancelled = false;
    apiGet<SocialCommentIdentityContext>(`/social/posts/${postId}/comment-identity`)
      .then((ctx) => {
        if (!cancelled) setIdentityContext(ctx);
      })
      .catch(() => {
        /* composer still works without a preview - the server enforces the real rule regardless */
      });
    return () => {
      cancelled = true;
    };
  }, [postId, isAuthenticated]);

  async function submit() {
    if (!isAuthenticated) return openAuthModal();
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      const identityMode: CommentIdentityMode | undefined =
        identityContext && !identityContext.locked ? selectedMode : undefined;
      const created = await apiPost<PublicSocialComment>(`/social/posts/${postId}/comments`, {
        body,
        ...(identityMode ? { identityMode } : {}),
      });
      const next = [...(comments ?? []), created];
      setComments(next);
      onCountChange(next.length);
      setDraft("");
      // Now locked to whatever was just posted as - update the preview
      // in place so the toggle disappears without a second round trip.
      setIdentityContext({
        locked: true,
        identityMode: created.identityMode,
        displayUsername: created.displayUsername,
        avatarKey: created.avatarKey,
        avatarGradient: created.avatarGradient,
        avatarPhotoUrl: created.avatarPhotoUrl,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't post that comment.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setOpenMenuFor(null);
    try {
      await apiDelete(`/social/comments/${id}`);
      const next = (comments ?? []).filter((c) => c.id !== id);
      setComments(next);
      onCountChange(next.length);
    } catch {
      /* leave it; a failed delete is non-destructive */
    }
  }

  async function report(id: string) {
    setOpenMenuFor(null);
    if (!isAuthenticated) return openAuthModal();
    try {
      await apiPost(`/social/comments/${id}/report`, {});
      setReportedIds((prev) => new Set(prev).add(id));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) openAuthModal();
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

  const showIdentityToggle = isAuthenticated && identityContext !== null && !identityContext.locked;
  const preview = composerIdentityPreview(identityContext, selectedMode);
  // Oldest-first from the API, so "the last 3" (most recent) are the last
  // 3 array entries - collapsed by default, the rest revealed by the
  // up-arrow toggle below.
  const hiddenCount = comments ? Math.max(0, comments.length - 3) : 0;
  const visibleComments = comments ? (showAllComments ? comments : comments.slice(-3)) : [];

  return (
    <div className="flex flex-col gap-3 border-t border-border p-3">
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAllComments((v) => !v)}
          className="flex items-center justify-center gap-1 self-center rounded-full px-3 py-1 text-xs text-muted-foreground hover:bg-surface-muted hover:text-foreground"
        >
          <ChevronIcon direction={showAllComments ? "down" : "up"} className="h-3.5 w-3.5" />
          {showAllComments ? "Show fewer comments" : `Show ${hiddenCount} earlier comment${hiddenCount === 1 ? "" : "s"}`}
        </button>
      )}
      {visibleComments.map((c) => (
        <div key={c.id} className="flex items-start gap-2">
          <Avatar avatarKey={c.avatarKey} avatarGradient={c.avatarGradient} photoUrl={c.avatarPhotoUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">
              {c.displayUsername ?? "Anonymous"} · {shortRelativeTime(c.createdAt)}
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

          {/* "..." menu: Delete for the caller's own comment, Report for
              anyone else's - never both on the same comment. */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setOpenMenuFor((cur) => (cur === c.id ? null : c.id))}
              aria-label="Comment options"
              aria-haspopup="menu"
              aria-expanded={openMenuFor === c.id}
              className="rounded p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            >
              <KebabIcon className="h-4 w-4" />
            </button>
            {openMenuFor === c.id && (
              <div
                role="menu"
                className="absolute right-0 top-full z-10 mt-1 min-w-28 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-md"
              >
                {c.mine ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => remove(c.id)}
                    className="block w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-surface-muted dark:text-red-400"
                  >
                    Delete
                  </button>
                ) : reportedIds.has(c.id) ? (
                  <span className="block px-3 py-1.5 text-left text-xs text-muted-foreground">Reported</span>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => report(c.id)}
                    className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-surface-muted"
                  >
                    Report
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      <div className="flex items-start gap-2">
        <div className="relative shrink-0">
          <Avatar avatarKey={preview.avatarKey} avatarGradient={preview.avatarGradient} photoUrl={preview.photoUrl} size="sm" />
          {showIdentityToggle && (
            <button
              type="button"
              onClick={() => setSelectedMode((m) => (m === "PERSONAL_CHOSEN" ? "PERSONAL_RANDOM" : "PERSONAL_CHOSEN"))}
              aria-label="Switch commenting identity"
              title="Switch commenting identity"
              className="absolute -bottom-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground hover:text-foreground"
            >
              <SwapIcon className="h-2.5 w-2.5" />
            </button>
          )}
        </div>

        {/* Full-width like the original composer - only the avatar (and its
            toggle) sitting flush over the input's own outline is new. */}
        <div className="min-w-0 flex-1">
          {preview.label && <p className="mb-1 truncate text-[11px] text-muted-foreground">Commenting as {preview.label}</p>}
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
              onFocus={() => {
                if (!isAuthenticated) openAuthModal();
              }}
              placeholder="Add a comment..."
              maxLength={MAX_COMMENT_LENGTH}
              rows={1}
              className="min-h-9 flex-1 resize-none overflow-hidden rounded-2xl border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
            />
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="shrink-0 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              Post
            </button>
          </div>
          <p className="mt-0.5 text-right text-[10px] text-muted-foreground">
            {draft.length}/{MAX_COMMENT_LENGTH}
          </p>
        </div>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

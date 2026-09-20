"use client";

import { useEffect, useRef, useState } from "react";
import type {
  CommentIdentityMode,
  PublicSocialComment,
  SocialCommentIdentityContext,
  SocialCommentReportReason,
  SocialCommentVoteResult,
} from "@iwtr/shared-types";
import {
  RANDOMIZED_IDENTITY_AVATAR_GRADIENT,
  RANDOMIZED_IDENTITY_AVATAR_KEY,
  SOCIAL_COMMENT_REPORT_REASONS,
  SOCIAL_COMMENT_REPORT_REASON_LABELS,
} from "@iwtr/shared-types";
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
// Simple up/down chevron - the top-of-list "show earlier comments" toggle
// and the per-comment "show replies" toggle.
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

// What a composer's avatar/label should show right now, given the identity
// context fetched from the API and (only while unlocked) which option the
// user currently has toggled to. Kept as a plain function rather than
// inline ternaries in JSX so TypeScript can actually narrow
// SocialCommentIdentityContext's discriminated union on `locked`. Shared by
// the top-level composer and every reply composer - identity is locked per
// (user, post), not per-comment, so the same context applies to both.
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

// One comment or reply - identical rendering either way (avatar, byline,
// body, vote row, "..." menu). Replies are rendered slightly indented by
// their container, not by this component itself.
function CommentRow({
  comment,
  isAuthenticated,
  votingId,
  menuOpen,
  reported,
  onVote,
  onDelete,
  onReport,
  onToggleMenu,
  replyToggle,
}: {
  comment: PublicSocialComment;
  isAuthenticated: boolean;
  votingId: string | null;
  menuOpen: boolean;
  reported: boolean;
  onVote: (id: string, value: 1 | -1) => void;
  onDelete: (id: string) => void;
  onReport: (id: string) => void;
  onToggleMenu: (id: string) => void;
  // Only top-level comments can have replies - a reply row (rendered via
  // this same component) never gets this prop, since replies don't nest.
  replyToggle?: { replyCount: number; expanded: boolean; onToggle: () => void };
}) {
  const c = comment;
  return (
    <div className="flex items-start gap-2">
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
            onClick={() => onVote(c.id, 1)}
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
            onClick={() => onVote(c.id, -1)}
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
          {replyToggle &&
            (replyToggle.replyCount > 0 ? (
              <button
                type="button"
                onClick={replyToggle.onToggle}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronIcon direction={replyToggle.expanded ? "up" : "down"} className="h-3 w-3" />
                {replyToggle.expanded
                  ? "Hide replies"
                  : `Reply · ${replyToggle.replyCount} repl${replyToggle.replyCount === 1 ? "y" : "ies"}`}
              </button>
            ) : (
              <button
                type="button"
                onClick={replyToggle.onToggle}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Reply
              </button>
            ))}
        </div>
      </div>

      {/* "..." menu: Delete for the caller's own comment, Report for
          anyone else's - never both on the same comment. */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => onToggleMenu(c.id)}
          aria-label="Comment options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="rounded p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
        >
          <KebabIcon className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-10 mt-1 min-w-28 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-md"
          >
            {c.mine ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => onDelete(c.id)}
                className="block w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-surface-muted dark:text-red-400"
              >
                Delete
              </button>
            ) : reported ? (
              <span className="block px-3 py-1.5 text-left text-xs text-muted-foreground">Reported</span>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => onReport(c.id)}
                className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-surface-muted"
              >
                Report
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// A composer (auto-growing textarea + identity toggle + Post button) - used
// for both the top-level "add a comment" box and a per-comment reply box.
// Identity is per-POST, not per-comment, so both share the same
// identityContext/selectedMode from the parent.
function Composer({
  isAuthenticated,
  openAuthModal,
  identityContext,
  selectedMode,
  onToggleMode,
  onSubmit,
  placeholder,
  autoFocus,
}: {
  isAuthenticated: boolean;
  openAuthModal: () => void;
  identityContext: SocialCommentIdentityContext | null;
  selectedMode: "PERSONAL_CHOSEN" | "PERSONAL_RANDOM";
  onToggleMode: () => void;
  onSubmit: (body: string) => Promise<void>;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grows line-by-line as content wraps or gains newlines, instead of
  // scrolling inside a fixed-height box.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  const showIdentityToggle = isAuthenticated && identityContext !== null && !identityContext.locked;
  const preview = composerIdentityPreview(identityContext, selectedMode);

  async function submit() {
    if (!isAuthenticated) return openAuthModal();
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(body);
      setDraft("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't post that comment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start gap-2">
      <div className="relative shrink-0">
        <Avatar avatarKey={preview.avatarKey} avatarGradient={preview.avatarGradient} photoUrl={preview.photoUrl} size="sm" />
        {showIdentityToggle && (
          <button
            type="button"
            onClick={onToggleMode}
            aria-label="Switch commenting identity"
            title="Switch commenting identity"
            className="absolute -bottom-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground hover:text-foreground"
          >
            <SwapIcon className="h-2.5 w-2.5" />
          </button>
        )}
      </div>

      {/* Full-width, like the original composer - only the avatar (and its
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
            placeholder={placeholder}
            maxLength={MAX_COMMENT_LENGTH}
            rows={1}
            autoFocus={autoFocus}
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
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}

export function SocialComments({ postId, onCountChange }: { postId: string; onCountChange: (n: number) => void }) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [comments, setComments] = useState<PublicSocialComment[] | null>(null);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [identityContext, setIdentityContext] = useState<SocialCommentIdentityContext | null>(null);
  const [selectedMode, setSelectedMode] = useState<"PERSONAL_CHOSEN" | "PERSONAL_RANDOM">("PERSONAL_CHOSEN");
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  // The comment currently in the "Report" pop-up (null = closed). A reason
  // must be picked before Submit enables - see reportSocialCommentInputSchema.
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<SocialCommentReportReason | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  // Brief "Report submitted" confirmation after a successful submit - fades
  // in on its own, auto-dismisses a couple seconds later.
  const [showReportToast, setShowReportToast] = useState(false);
  // Collapsed by default: only the 3 most recent comments show, with a
  // toggle above them to reveal the rest (see the render below).
  const [showAllComments, setShowAllComments] = useState(false);
  // Per top-level comment: whether its reply section (existing replies +
  // reply composer) is expanded, and the replies themselves once fetched
  // (undefined = not fetched yet, fetched lazily on first expand).
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [repliesByComment, setRepliesByComment] = useState<Record<string, PublicSocialComment[] | undefined>>({});

  useEffect(() => {
    apiGet<PublicSocialComment[]>(`/social/posts/${postId}/comments`)
      .then((rows) => {
        setComments(rows);
        onCountChange(rows.length);
      })
      .catch(() => setComments([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onCountChange is a fresh closure each render; re-running on postId change only is correct here
  }, [postId]);

  // What identity this viewer would comment (or reply) as on THIS post -
  // only a company owner or a member who hasn't commented here yet ever
  // gets a real choice (see SocialCommentIdentityContext); fetched once per
  // post, not per keystroke, since it can't change except by actually
  // posting. Shared by the top-level composer and every reply composer -
  // identity is locked per (user, post), never per-comment.
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

  function applyCreatedIdentity(created: PublicSocialComment) {
    // Now locked to whatever was just posted as - update the preview in
    // place so the toggle disappears without a second round trip.
    setIdentityContext({
      locked: true,
      identityMode: created.identityMode,
      displayUsername: created.displayUsername,
      avatarKey: created.avatarKey,
      avatarGradient: created.avatarGradient,
      avatarPhotoUrl: created.avatarPhotoUrl,
    });
  }

  async function submitComment(body: string) {
    const identityMode: CommentIdentityMode | undefined = identityContext && !identityContext.locked ? selectedMode : undefined;
    const created = await apiPost<PublicSocialComment>(`/social/posts/${postId}/comments`, {
      body,
      ...(identityMode ? { identityMode } : {}),
    });
    const next = [...(comments ?? []), created];
    setComments(next);
    onCountChange(next.length);
    applyCreatedIdentity(created);
  }

  async function submitReply(parentId: string, body: string) {
    const identityMode: CommentIdentityMode | undefined = identityContext && !identityContext.locked ? selectedMode : undefined;
    const created = await apiPost<PublicSocialComment>(`/social/comments/${parentId}/replies`, {
      body,
      ...(identityMode ? { identityMode } : {}),
    });
    setRepliesByComment((prev) => ({ ...prev, [parentId]: [...(prev[parentId] ?? []), created] }));
    setComments((prev) => (prev ?? []).map((c) => (c.id === parentId ? { ...c, replyCount: c.replyCount + 1 } : c)));
    applyCreatedIdentity(created);
  }

  async function toggleReplies(parentId: string) {
    setExpandedReplies((prev) => ({ ...prev, [parentId]: !prev[parentId] }));
    if (repliesByComment[parentId] === undefined) {
      try {
        const rows = await apiGet<PublicSocialComment[]>(`/social/comments/${parentId}/replies`);
        setRepliesByComment((prev) => ({ ...prev, [parentId]: rows }));
      } catch {
        setRepliesByComment((prev) => ({ ...prev, [parentId]: [] }));
      }
    }
  }

  async function remove(id: string, parentId?: string) {
    setOpenMenuFor(null);
    try {
      await apiDelete(`/social/comments/${id}`);
      if (parentId) {
        setRepliesByComment((prev) => ({ ...prev, [parentId]: (prev[parentId] ?? []).filter((c) => c.id !== id) }));
        setComments((prev) => (prev ?? []).map((c) => (c.id === parentId ? { ...c, replyCount: Math.max(0, c.replyCount - 1) } : c)));
      } else {
        const next = (comments ?? []).filter((c) => c.id !== id);
        setComments(next);
        onCountChange(next.length);
      }
    } catch {
      /* leave it; a failed delete is non-destructive */
    }
  }

  function openReportModal(id: string) {
    setOpenMenuFor(null);
    if (!isAuthenticated) return openAuthModal();
    setReportTargetId(id);
    setReportReason(null);
    setReportError(null);
  }

  function closeReportModal() {
    setReportTargetId(null);
    setReportReason(null);
    setReportError(null);
  }

  // Auto-dismiss the "Report submitted" toast a couple seconds after it appears.
  useEffect(() => {
    if (!showReportToast) return;
    const handle = setTimeout(() => setShowReportToast(false), 2500);
    return () => clearTimeout(handle);
  }, [showReportToast]);

  async function submitReport() {
    if (!reportTargetId || !reportReason) return;
    setReportBusy(true);
    setReportError(null);
    try {
      await apiPost(`/social/comments/${reportTargetId}/report`, { reason: reportReason });
      setReportedIds((prev) => new Set(prev).add(reportTargetId));
      closeReportModal();
      setShowReportToast(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        closeReportModal();
        openAuthModal();
        return;
      }
      setReportError(e instanceof ApiError ? e.message : "Couldn't submit that report.");
    } finally {
      setReportBusy(false);
    }
  }

  async function vote(commentId: string, value: 1 | -1, parentId?: string) {
    if (!isAuthenticated) return openAuthModal();
    if (votingId) return;
    setVotingId(commentId);
    try {
      const result = await apiPost<SocialCommentVoteResult>(`/social/comments/${commentId}/vote`, { value });
      const patch = (c: PublicSocialComment) =>
        c.id === commentId
          ? { ...c, helpfulCount: result.helpfulCount, notHelpfulCount: result.notHelpfulCount, myVote: result.myVote }
          : c;
      if (parentId) {
        setRepliesByComment((prev) => ({ ...prev, [parentId]: (prev[parentId] ?? []).map(patch) }));
      } else {
        setComments((prev) => (prev ?? []).map(patch));
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) openAuthModal();
    } finally {
      setVotingId(null);
    }
  }

  function toggleMode() {
    setSelectedMode((m) => (m === "PERSONAL_CHOSEN" ? "PERSONAL_RANDOM" : "PERSONAL_CHOSEN"));
  }

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
        <div key={c.id} className="flex flex-col gap-2">
          <CommentRow
            comment={c}
            isAuthenticated={isAuthenticated}
            votingId={votingId}
            menuOpen={openMenuFor === c.id}
            reported={reportedIds.has(c.id)}
            onVote={(id, value) => vote(id, value)}
            onDelete={(id) => remove(id)}
            onReport={openReportModal}
            onToggleMenu={(id) => setOpenMenuFor((cur) => (cur === id ? null : id))}
            replyToggle={{
              replyCount: c.replyCount,
              expanded: !!expandedReplies[c.id],
              onToggle: () => toggleReplies(c.id),
            }}
          />

          {/* Replies: hidden by default, left-below the comment, count-aware.
              The Reply/View-replies trigger itself lives in CommentRow's vote
              row, next to Like/Dislike - this block only renders the
              expanded thread (existing replies + reply composer). */}
          <div className="ml-10">
            {expandedReplies[c.id] && (
              <div className="mt-2 flex flex-col gap-2">
                {(repliesByComment[c.id] ?? []).map((r) => (
                  <CommentRow
                    key={r.id}
                    comment={r}
                    isAuthenticated={isAuthenticated}
                    votingId={votingId}
                    menuOpen={openMenuFor === r.id}
                    reported={reportedIds.has(r.id)}
                    onVote={(id, value) => vote(id, value, c.id)}
                    onDelete={(id) => remove(id, c.id)}
                    onReport={openReportModal}
                    onToggleMenu={(id) => setOpenMenuFor((cur) => (cur === id ? null : id))}
                  />
                ))}
                <Composer
                  isAuthenticated={isAuthenticated}
                  openAuthModal={openAuthModal}
                  identityContext={identityContext}
                  selectedMode={selectedMode}
                  onToggleMode={toggleMode}
                  onSubmit={(body) => submitReply(c.id, body)}
                  placeholder="Write a reply..."
                  autoFocus
                />
              </div>
            )}
          </div>
        </div>
      ))}

      <Composer
        isAuthenticated={isAuthenticated}
        openAuthModal={openAuthModal}
        identityContext={identityContext}
        selectedMode={selectedMode}
        onToggleMode={toggleMode}
        onSubmit={submitComment}
        placeholder="Add a comment..."
      />

      {reportTargetId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={closeReportModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Report this comment"
            className="w-full max-w-sm rounded-xl bg-surface p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-sm font-semibold text-foreground">Report this comment</h3>
            <div className="flex flex-col gap-2">
              {SOCIAL_COMMENT_REPORT_REASONS.map((reason) => (
                <label
                  key={reason}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2 text-sm has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 dark:has-[:checked]:bg-brand-950"
                >
                  <input
                    type="radio"
                    name="report-reason"
                    className="mt-0.5"
                    checked={reportReason === reason}
                    onChange={() => setReportReason(reason)}
                  />
                  <span className="text-foreground">{SOCIAL_COMMENT_REPORT_REASON_LABELS[reason]}</span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Reports are anonymous - the comment&apos;s author will never see who reported it.
            </p>
            {reportError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{reportError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeReportModal}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReport}
                disabled={!reportReason || reportBusy}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Submit report
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportToast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
          <div className="rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background shadow-lg">
            Report submitted
          </div>
        </div>
      )}
    </div>
  );
}

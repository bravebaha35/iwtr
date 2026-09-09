"use client";

import { useState } from "react";
import Link from "next/link";
import type { PublicSocialPost, SavedPostToggleResult, SocialPostLikeResult } from "@iwtr/shared-types";
import { apiPost, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { CompanyLogo } from "@/components/CompanyLogo";
import { tickSrcForOwnerTier, badgeLabelForOwnerTier } from "@/lib/pricingTiers";
import { useFollowedCompanies } from "@/lib/useFollowedCompanies";
import { shortRelativeTime } from "./socialTime";
import { SocialComments } from "./SocialComments";

// Universally-recognized social glyphs (spec item 2) instead of the old
// text buttons - heart/speech-bubble/bookmark, filled once active. No save
// *count* is shown next to the bookmark: PublicSocialPost has no such field
// (SavedPost is a private per-user preference on the API side, never a
// public tally - see REVIEW.md) and this task's own top constraint is not
// to touch backend code, so there is no real number to display here.
function HeartIcon({ className, filled }: { className?: string; filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7.5-4.6-10-9.2C.5 8.3 2.3 5 5.6 5c1.8 0 3.3.9 4.4 2.4C11.1 5.9 12.6 5 14.4 5c3.3 0 5.1 3.3 3.6 6.8C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}
function CommentIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v11H8l-4 4Z" />
    </svg>
  );
}
function BookmarkIcon({ className, filled }: { className?: string; filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

export function SocialPostCard({
  post,
  onChanged,
}: {
  post: PublicSocialPost;
  onChanged?: (p: PublicSocialPost) => void;
}) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const { followedIds, canFollow, toggleFollow } = useFollowedCompanies();
  const [showComments, setShowComments] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  async function toggleLike() {
    if (!isAuthenticated) return openAuthModal();
    if (likeBusy) return;
    setLikeBusy(true);
    // optimistic
    const optimistic: PublicSocialPost = {
      ...post,
      likedByMe: !post.likedByMe,
      likeCount: post.likeCount + (post.likedByMe ? -1 : 1),
    };
    onChanged?.(optimistic);
    try {
      const r = await apiPost<SocialPostLikeResult>(`/social/posts/${post.id}/like`, {});
      onChanged?.({ ...post, likedByMe: r.likedByMe, likeCount: r.likeCount });
    } catch (e) {
      onChanged?.(post); // revert
      if (e instanceof ApiError && e.status === 401) openAuthModal();
    } finally {
      setLikeBusy(false);
    }
  }

  async function toggleSave() {
    if (!isAuthenticated) return openAuthModal();
    if (saveBusy) return;
    setSaveBusy(true);
    const optimistic: PublicSocialPost = { ...post, savedByMe: !post.savedByMe };
    onChanged?.(optimistic);
    try {
      const r = await apiPost<SavedPostToggleResult>(`/social/posts/${post.id}/save`, {});
      onChanged?.({ ...post, savedByMe: r.saved });
    } catch (e) {
      onChanged?.(post); // revert
      if (e instanceof ApiError && e.status === 401) openAuthModal();
    } finally {
      setSaveBusy(false);
    }
  }

  function handleFollowClick() {
    if (!isAuthenticated) return openAuthModal();
    // Optimistic - toggleFollow flips the shared cache instantly and every
    // other Follow button/the sidebar's Following list re-render off it.
    void toggleFollow(post.companyId, {
      companyName: post.companyName,
      companySlug: post.companySlug,
      mainPhotoUrl: post.companyLogoUrl,
      badgeTier: post.companyBadgeTier,
    });
  }

  const following = followedIds.has(post.companyId);
  // An owner/admin genuinely can't follow (RolesGuard is MEMBER-only) - no
  // point showing a button that would 403, so it's hidden rather than
  // disabled once we know the caller's real role. Anonymous visitors still
  // see it (same "show it, open the auth modal on click" UX as Like).
  const showFollowButton = !isAuthenticated || canFollow;
  const tickSrc = tickSrcForOwnerTier(post.companyBadgeTier);

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface">
      <header className="flex items-center justify-between gap-3 p-3">
        <Link href={`/social/${post.companySlug}`} className="flex min-w-0 items-center gap-3">
          <CompanyLogo name={post.companyName} mainPhotoUrl={post.companyLogoUrl} size="sm" />
          <div className="min-w-0">
            <p className="flex min-w-0 items-center truncate text-sm font-semibold text-foreground">
              {post.companyName}
              {tickSrc && (
                // eslint-disable-next-line @next/next/no-img-element -- small local static badge asset
                <img src={tickSrc} alt={`${badgeLabelForOwnerTier(post.companyBadgeTier)} verified employer badge`} width={16} height={16} className="ml-1.5 inline-block shrink-0 align-middle" />
              )}
            </p>
            <p className="text-xs text-muted-foreground">{shortRelativeTime(post.createdAt)}</p>
          </div>
        </Link>

        {showFollowButton && (
          <button
            type="button"
            onClick={handleFollowClick}
            aria-pressed={following}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${
              following
                ? "bg-surface-muted text-muted-foreground"
                : "border border-brand-600 text-brand-600 hover:bg-brand-50 dark:border-brand-400 dark:text-brand-400 dark:hover:bg-brand-950"
            }`}
          >
            {following ? "Following" : "+ Follow"}
          </button>
        )}
      </header>

      {/* eslint-disable-next-line @next/next/no-img-element -- server-produced WebP under our own /uploads */}
      <img src={post.imageUrl} alt={post.caption ?? `${post.companyName} post`} className="w-full bg-surface-muted object-cover" />

      {post.caption && <p className="whitespace-pre-wrap px-3 pt-3 text-sm text-foreground">{post.caption}</p>}

      <div className="flex items-center gap-4 p-3 text-sm">
        <button
          type="button"
          onClick={toggleLike}
          aria-label="Like"
          aria-pressed={post.likedByMe ?? false}
          className={`flex items-center gap-1.5 font-medium transition ${post.likedByMe ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground hover:text-foreground"}`}
        >
          <HeartIcon className="h-5 w-5" filled={post.likedByMe ?? false} />
          {post.likeCount}
        </button>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          aria-label="Comment"
          className="flex items-center gap-1.5 font-medium text-muted-foreground transition hover:text-foreground"
        >
          <CommentIcon className="h-5 w-5" />
          {post.commentCount}
        </button>
        <button
          type="button"
          onClick={toggleSave}
          aria-label="Save"
          aria-pressed={post.savedByMe ?? false}
          className={`ml-auto flex items-center gap-1.5 font-medium transition ${post.savedByMe ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground hover:text-foreground"}`}
        >
          <BookmarkIcon className="h-5 w-5" filled={post.savedByMe ?? false} />
        </button>
      </div>

      {showComments && (
        <SocialComments
          postId={post.id}
          onCountChange={(n) => onChanged?.({ ...post, commentCount: n })}
        />
      )}
    </article>
  );
}

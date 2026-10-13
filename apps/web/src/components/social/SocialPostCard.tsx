"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PublicSocialPost, SavedPostToggleResult, SocialPostLikeResult, SocialPostPinResult } from "@iwtr/shared-types";
import { apiDelete, apiPatch, apiPost, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CompanyVerificationTick } from "@/components/CompanyVerificationTick";
import { useFollowedCompanies } from "@/lib/useFollowedCompanies";
import { WorkTypeLabel } from "@/components/WorkTypeLabel";
import { shortRelativeTime } from "./socialTime";
import { SocialComments } from "./SocialComments";
import { ImageLightbox } from "./ImageLightbox";
import { HeartIcon } from "@/components/icons/HeartIcon";

const CAPTION_MAX = 1000;

// Universally-recognized social glyphs instead of text buttons -
// heart/speech-bubble/link/bookmark, filled once active. No save *count* is
// shown next to the bookmark: PublicSocialPost has no such field (SavedPost
// is a private per-user preference on the API side, never a public tally -
// see REVIEW.md).
function CommentIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4h16v11H8l-4 4Z" />
    </svg>
  );
}
function BookmarkIcon({ className, filled }: { className?: string; filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}
function LinkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </svg>
  );
}
function PinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 17v5" />
      <path d="M9 3h6l-1 6 3 3v2H7v-2l3-3Z" />
    </svg>
  );
}
function ChevronIcon({ className, direction }: { className?: string; direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === "left" ? "M15 5 8 12l7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

// Minimum horizontal drag distance (px) before a touch gesture counts as a
// swipe rather than a tap - low enough to feel responsive, high enough that
// a slightly wobbly tap on the image itself doesn't flip pages.
const SWIPE_THRESHOLD_PX = 40;

// Instagram-style photo carousel - a left/right arrow on each side, both
// vertically centered on the image, plus a touch-swipe gesture. Arrows only
// render once there's more than one photo; a single-photo post is just a
// plain image. Flush with the card's edges: the card supplies the corners.
function PostImageCarousel({ imageUrls, alt }: { imageUrls: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const many = imageUrls.length > 1;

  function go(delta: number) {
    setIndex((i) => Math.min(imageUrls.length - 1, Math.max(0, i + delta)));
  }

  return (
    <div
      className="relative"
      onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStartX === null) return;
        const delta = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(delta) >= SWIPE_THRESHOLD_PX) go(delta < 0 ? 1 : -1);
        setTouchStartX(null);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- server-produced WebP under our own /uploads */}
      <img
        src={imageUrls[index]}
        alt={alt}
        onClick={() => setLightboxOpen(true)}
        className="w-full cursor-zoom-in bg-surface-muted object-cover"
      />

      {many && index > 0 && (
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous photo"
          className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60"
        >
          <ChevronIcon className="h-5 w-5" direction="left" />
        </button>
      )}
      {many && index < imageUrls.length - 1 && (
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next photo"
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60"
        >
          <ChevronIcon className="h-5 w-5" direction="right" />
        </button>
      )}
      {many && (
        <span className="absolute right-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">
          {index + 1}/{imageUrls.length}
        </span>
      )}

      {lightboxOpen && (
        <ImageLightbox
          imageUrls={imageUrls}
          index={index}
          alt={alt}
          onIndexChange={setIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}

// The "..." menu an approved owner of the post's company gets on the card.
function OwnerMenu({
  pinned,
  onEdit,
  onTogglePin,
  onDelete,
}: {
  pinned: boolean;
  onEdit: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemClass = "block w-full rounded-lg px-3 py-2 text-left text-sm text-foreground transition hover:bg-surface-muted";
  const pick = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Post options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-9 z-20 w-44 rounded-xl bg-surface p-1 shadow-lg ring-1 ring-border/60">
          <button type="button" role="menuitem" onClick={pick(onEdit)} className={itemClass}>
            Edit caption
          </button>
          <button type="button" role="menuitem" onClick={pick(onTogglePin)} className={itemClass}>
            {pinned ? "Unpin" : "Pin to top"}
          </button>
          <button type="button" role="menuitem" onClick={pick(onDelete)} className={`${itemClass} text-red-600 dark:text-red-400`}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * One post: a soft separated card (the same family as the job and company
 * cards) with the photo flush between its header and footer. The time is a
 * link to the post's own page; an approved owner of the post's company gets
 * the "..." menu (edit caption, pin, delete).
 */
export function SocialPostCard({
  post,
  onChanged,
  onDeleted,
  onPinToggled,
  showPinned = false,
  defaultCommentsOpen = false,
}: {
  post: PublicSocialPost;
  onChanged?: (p: PublicSocialPost) => void;
  onDeleted?: (postId: string) => void;
  // Pinning one post unpins the company's other one, so a list showing
  // several of that company's posts needs to hear about it.
  onPinToggled?: (postId: string, pinned: boolean) => void;
  // The "Pinned" label only means something where the pin has an effect:
  // the company's own feed.
  showPinned?: boolean;
  defaultCommentsOpen?: boolean;
}) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const { followedIds, canFollow, toggleFollow } = useFollowedCompanies();
  const [showComments, setShowComments] = useState(defaultCommentsOpen);
  const [likeBusy, setLikeBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [ownerBusy, setOwnerBusy] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);

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

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/social/posts/${post.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked - the time link still opens the post's page */
    }
  }

  // The three owner actions share one busy flag and one error line.
  async function ownerAction(run: () => Promise<void>, failure: string) {
    setOwnerBusy(true);
    setOwnerError(null);
    try {
      await run();
    } catch (e) {
      setOwnerError(e instanceof ApiError ? e.message : failure);
    } finally {
      setOwnerBusy(false);
    }
  }

  function saveCaption() {
    return ownerAction(async () => {
      const updated = await apiPatch<PublicSocialPost>(`/social/posts/${post.id}`, { caption: draft.trim() });
      onChanged?.(updated);
      setEditing(false);
    }, "Couldn't save the caption.");
  }

  function togglePin() {
    return ownerAction(async () => {
      const r = await apiPost<SocialPostPinResult>(`/social/posts/${post.id}/pin`, {});
      onChanged?.({ ...post, pinned: r.pinned });
      onPinToggled?.(post.id, r.pinned);
    }, "Couldn't change the pin.");
  }

  function deletePost() {
    return ownerAction(async () => {
      await apiDelete<{ success: true }>(`/social/posts/${post.id}`);
      onDeleted?.(post.id);
    }, "Couldn't delete the post.");
  }

  const following = followedIds.has(post.companyId);
  // An owner/admin genuinely can't follow (RolesGuard is MEMBER-only) - no
  // point showing a button that would 403, so it's hidden rather than
  // disabled once we know the caller's real role. Anonymous visitors still
  // see it (same "show it, open the auth modal on click" UX as Like).
  const showFollowButton = !isAuthenticated || canFollow;
  const actionClass = "flex items-center gap-1.5 font-medium transition";
  const quiet = "text-muted-foreground hover:text-foreground";
  const lit = "text-brand-600 dark:text-brand-400";

  return (
    <article className="rounded-2xl bg-surface shadow-xs">
      {showPinned && post.pinned && (
        <p className="flex items-center gap-1.5 px-4 pt-3 text-xs font-semibold text-muted-foreground">
          <PinIcon className="h-3.5 w-3.5" />
          Pinned
        </p>
      )}

      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={`/companies/${post.companySlug}?tab=social`} className="shrink-0">
            <CompanyLogo name={post.companyName} mainPhotoUrl={post.companyLogoUrl} size="sm" />
          </Link>
          <div className="min-w-0">
            <Link
              href={`/companies/${post.companySlug}?tab=social`}
              className="flex min-w-0 items-center text-sm font-semibold text-foreground hover:underline"
            >
              <span className="truncate">{post.companyName}</span>
              {/* A post can only come from an approved owner, so the company
                  is always claimed - a Free-tier one gets the minimal check-mark. */}
              <CompanyVerificationTick badgeTier={post.companyBadgeTier} claimed size={16} className="ml-1.5 shrink-0" />
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              <WorkTypeLabel workplaceTypes={post.companyWorkplaceTypes} /> &middot;{" "}
              <Link href={`/social/posts/${post.id}`} title="Open this post" className="hover:text-foreground hover:underline">
                {shortRelativeTime(post.createdAt)}
              </Link>
              {post.edited && <> &middot; Edited</>}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {showFollowButton && (
            <button
              type="button"
              onClick={handleFollowClick}
              aria-pressed={following}
              className={`px-1.5 py-1 text-[13px] font-semibold transition ${
                following ? "text-muted-foreground hover:text-foreground" : "text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              }`}
            >
              {following ? "Following" : "+ Follow"}
            </button>
          )}
          {post.canManage && (
            <OwnerMenu
              pinned={post.pinned}
              onEdit={() => {
                setDraft(post.caption ?? "");
                setOwnerError(null);
                setEditing(true);
              }}
              onTogglePin={() => void togglePin()}
              onDelete={() => {
                setOwnerError(null);
                setConfirmingDelete(true);
              }}
            />
          )}
        </div>
      </header>

      <PostImageCarousel imageUrls={post.imageUrls} alt={post.caption ?? `${post.companyName} post`} />

      {editing ? (
        <div className="px-4 pt-3">
          <label htmlFor={`caption-${post.id}`} className="sr-only">
            Caption
          </label>
          <textarea
            id={`caption-${post.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={CAPTION_MAX}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void saveCaption()}
              disabled={ownerBusy}
              className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {ownerBusy ? "Saving..." : "Save caption"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-sm text-muted-foreground hover:text-foreground">
              Cancel
            </button>
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">
              {draft.length}/{CAPTION_MAX}
            </span>
          </div>
        </div>
      ) : (
        post.caption && <p className="whitespace-pre-wrap px-4 pt-3 text-[15px] leading-relaxed text-foreground">{post.caption}</p>
      )}

      {confirmingDelete && (
        <div className="mx-4 mt-3 rounded-xl bg-surface-muted p-3">
          <p className="text-sm text-foreground">Delete this post? Its comments and likes go with it.</p>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void deletePost()}
              disabled={ownerBusy}
              className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {ownerBusy ? "Deleting..." : "Delete post"}
            </button>
            <button type="button" onClick={() => setConfirmingDelete(false)} className="text-sm text-muted-foreground hover:text-foreground">
              Keep it
            </button>
          </div>
        </div>
      )}

      {ownerError && <p className="px-4 pt-2 text-sm text-red-600 dark:text-red-300">{ownerError}</p>}

      <div className="flex items-center gap-5 px-4 py-3 text-sm">
        <button
          type="button"
          onClick={toggleLike}
          aria-label="Like"
          aria-pressed={post.likedByMe ?? false}
          className={`${actionClass} ${post.likedByMe ? lit : quiet}`}
        >
          <HeartIcon className="h-5 w-5" filled={post.likedByMe ?? false} />
          <span className="tabular-nums">{post.likeCount}</span>
        </button>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          aria-label="Comment"
          aria-expanded={showComments}
          className={`${actionClass} ${quiet}`}
        >
          <CommentIcon className="h-5 w-5" />
          <span className="tabular-nums">{post.commentCount}</span>
        </button>
        <button type="button" onClick={() => void copyLink()} aria-label="Copy link" className={`${actionClass} ${copied ? lit : quiet}`}>
          <LinkIcon className="h-5 w-5" />
          <span aria-live="polite" className="text-xs">
            {copied ? "Link copied" : ""}
          </span>
        </button>
        <button
          type="button"
          onClick={toggleSave}
          aria-label="Save"
          aria-pressed={post.savedByMe ?? false}
          className={`ml-auto ${actionClass} ${post.savedByMe ? lit : quiet}`}
        >
          <BookmarkIcon className="h-5 w-5" filled={post.savedByMe ?? false} />
        </button>
      </div>

      {showComments && (
        <div className="border-t border-border/60">
          <SocialComments postId={post.id} onCountChange={(n) => onChanged?.({ ...post, commentCount: n })} />
        </div>
      )}
    </article>
  );
}

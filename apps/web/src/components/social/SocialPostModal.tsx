"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { PublicSocialPost, SocialReaction } from "@iwtr/shared-types";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CompanyVerificationTick } from "@/components/CompanyVerificationTick";
import { useI18n } from "@/lib/i18n/client";
import { PhotoSlider } from "./PhotoSlider";
import { ReactionButton } from "./ReactionButton";
import { SocialComments } from "./SocialComments";
import { BookmarkIcon, CommentIcon, LinkIcon } from "./socialIcons";
import { shortRelativeTime } from "./socialTime";

// How wide the photo side may be relative to its height: a very tall photo
// is not squeezed into a sliver, a very wide one doesn't push the comments off.
const MIN_STAGE_RATIO = 0.8;
const MAX_STAGE_RATIO = 1.25;

/**
 * A post opened from its photo, Instagram style: the photos on the left (a
 * slider when there are several), the company, caption, comments, reactions
 * and a comment box on the right. On a phone the photos sit on top and the
 * rest scrolls under them. Escape, the X or a click outside closes it; the
 * arrow keys move through the photos. Everything it changes (reactions,
 * saving, following, the comment count) goes through the card's own handlers,
 * so the card behind it is always in step.
 */
export function SocialPostModal({
  post,
  index,
  onIndexChange,
  onClose,
  onReact,
  onToggleSave,
  onCommentCount,
  onCopyLink,
  copied,
  following,
  showFollowButton,
  onFollow,
}: {
  post: PublicSocialPost;
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
  onReact: (reaction: SocialReaction) => void;
  onToggleSave: () => void;
  onCommentCount: (n: number) => void;
  onCopyLink: () => void;
  copied: boolean;
  following: boolean;
  showFollowButton: boolean;
  onFollow: () => void;
}) {
  const { t, locale } = useI18n();
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const count = post.imageUrls.length;
  const firstRatio = post.imageAspectRatios[0] ?? 1;
  const stageRatio = Math.min(MAX_STAGE_RATIO, Math.max(MIN_STAGE_RATIO, firstRatio));
  const alt = post.caption ?? post.title ?? t("{name} post", { name: post.companyName });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Typing a comment uses the arrow keys too.
      const typing = e.target instanceof HTMLElement && (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT");
      if (e.key === "Escape") onClose();
      else if (!typing && e.key === "ArrowRight" && index < count - 1) onIndexChange(index + 1);
      else if (!typing && e.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, count, onIndexChange, onClose]);

  // The page behind stays put while the view is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const caption = post.caption ? (
    <div className="flex gap-3 pb-1">
      <CompanyLogo name={post.companyName} mainPhotoUrl={post.companyLogoUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          <span className="mr-1.5 font-semibold">{post.companyName}</span>
          {post.caption}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {shortRelativeTime(post.createdAt, locale)}
          {post.edited && <> &middot; {t("Edited")}</>}
        </p>
      </div>
    </div>
  ) : null;

  const quiet = "text-muted-foreground transition hover:text-foreground";
  const lit = "text-brand-600 dark:text-brand-400";
  const actions = (
    <div className="border-t border-border/70 px-4 pb-1 pt-3">
      <div className="flex items-center gap-5 text-sm">
        <ReactionButton counts={post.reactionCounts} total={post.likeCount} mine={post.myReaction} onReact={onReact} />
        <span className="flex items-center gap-1.5 font-medium text-muted-foreground" title={t("Comment")}>
          <CommentIcon className="h-5 w-5" />
          <span className="tabular-nums">{post.commentCount}</span>
        </span>
        <button type="button" onClick={onCopyLink} aria-label={t("Copy link")} className={`flex items-center gap-1.5 font-medium ${copied ? lit : quiet}`}>
          <LinkIcon className="h-5 w-5" />
          <span aria-live="polite" className="text-xs">
            {copied ? t("Link copied") : ""}
          </span>
        </button>
        <button
          type="button"
          onClick={onToggleSave}
          aria-label={t("Save")}
          aria-pressed={post.savedByMe ?? false}
          className={`ml-auto flex items-center font-medium ${post.savedByMe ? lit : quiet}`}
        >
          <BookmarkIcon className="h-5 w-5" filled={post.savedByMe ?? false} />
        </button>
      </div>
      {!post.caption && <p className="mt-2 text-xs text-muted-foreground">{shortRelativeTime(post.createdAt, locale)}</p>}
    </div>
  );

  return createPortal(
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-950/55 backdrop-blur-[3px] md:p-8"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t("Close")}
        className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white transition hover:bg-black/55 md:right-5 md:top-5"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>

      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("{name} post", { name: post.companyName })}
        tabIndex={-1}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full flex-col overflow-hidden bg-surface shadow-2xl outline-none md:h-[min(88vh,820px)] md:w-auto md:max-w-[min(1240px,94vw)] md:flex-row md:rounded-2xl"
      >
        <div
          className="relative h-[52vh] w-full shrink-0 bg-neutral-950 md:h-full md:w-[var(--stage-w)] md:max-w-[62vw]"
          style={{ "--stage-w": `calc(min(88vh, 820px) * ${stageRatio})` } as React.CSSProperties}
        >
          <PhotoSlider imageUrls={post.imageUrls} alt={alt} index={index} onIndexChange={onIndexChange} variant="stage" />
        </div>

        <div className="flex min-h-0 w-full flex-1 flex-col md:w-[380px] md:flex-none">
          <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
            <Link href={`/companies/${post.companySlug}?tab=social`} className="flex min-w-0 items-center gap-3">
              <CompanyLogo name={post.companyName} mainPhotoUrl={post.companyLogoUrl} size="sm" />
              <span className="flex min-w-0 items-center text-sm font-semibold text-foreground hover:underline">
                <span className="truncate">{post.companyName}</span>
                <CompanyVerificationTick badgeTier={post.companyBadgeTier} claimed size={16} className="ml-1.5 shrink-0" />
              </span>
            </Link>
            {showFollowButton && (
              <button
                type="button"
                onClick={onFollow}
                aria-pressed={following}
                className={`shrink-0 px-1.5 py-1 text-[13px] font-semibold transition ${
                  following ? "text-muted-foreground hover:text-foreground" : "text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                }`}
              >
                {following ? t("Following@@button") : `+ ${t("Follow")}`}
              </button>
            )}
          </header>

          <SocialComments postId={post.id} onCountChange={onCommentCount} panel={{ top: caption, actions }} />
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

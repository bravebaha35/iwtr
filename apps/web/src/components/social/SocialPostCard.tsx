"use client";

import { useState } from "react";
import Link from "next/link";
import type { PublicSocialPost, SocialPostLikeResult } from "@iwtr/shared-types";
import { apiPost, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { CompanyLogo } from "@/components/CompanyLogo";
import { shortRelativeTime } from "./socialTime";
import { SocialComments } from "./SocialComments";

export function SocialPostCard({
  post,
  onChanged,
}: {
  post: PublicSocialPost;
  onChanged?: (p: PublicSocialPost) => void;
}) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

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

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface">
      <header className="flex items-center gap-3 p-3">
        <Link href={`/social/${post.companySlug}`} className="flex min-w-0 items-center gap-3">
          <CompanyLogo name={post.companyName} mainPhotoUrl={post.companyLogoUrl} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{post.companyName}</p>
            <p className="text-xs text-muted-foreground">{shortRelativeTime(post.createdAt)}</p>
          </div>
        </Link>
      </header>

      {/* eslint-disable-next-line @next/next/no-img-element -- server-produced WebP under our own /uploads */}
      <img src={post.imageUrl} alt={post.caption ?? `${post.companyName} post`} className="w-full bg-surface-muted object-cover" />

      {post.caption && <p className="whitespace-pre-wrap px-3 pt-3 text-sm text-foreground">{post.caption}</p>}

      <div className="flex items-center gap-4 p-3 text-sm">
        <button
          type="button"
          onClick={toggleLike}
          aria-pressed={post.likedByMe ?? false}
          className={`font-medium transition ${post.likedByMe ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground hover:text-foreground"}`}
        >
          Like ({post.likeCount})
        </button>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="font-medium text-muted-foreground transition hover:text-foreground"
        >
          Comment ({post.commentCount})
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

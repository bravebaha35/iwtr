"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PublicSocialPost } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { SocialPostCard } from "./SocialPostCard";
import { SocialPostSkeleton } from "./SocialPostSkeleton";

/**
 * One post on its own page (/social/posts/:id) - where a copied link and a
 * card's time link lead. The comments are open from the start.
 */
export function SocialPostView({ postId }: { postId: string }) {
  const router = useRouter();
  // undefined = still loading, null = not there (deleted, or its company hidden).
  const [post, setPost] = useState<PublicSocialPost | null | undefined>(undefined);

  useEffect(() => {
    apiGet<PublicSocialPost>(`/social/posts/${postId}`)
      .then(setPost)
      .catch(() => setPost(null));
  }, [postId]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <Link href="/social" className="self-start text-sm font-semibold text-muted-foreground transition hover:text-foreground">
        <span aria-hidden="true">&larr;</span> IWT Social
      </Link>

      {post === undefined && (
        <div role="status" aria-label="Loading the post">
          <SocialPostSkeleton />
        </div>
      )}
      {post === null && (
        <p className="py-6 text-sm text-muted-foreground">This post isn&apos;t available any more.</p>
      )}
      {post && (
        <SocialPostCard
          post={post}
          showPinned
          defaultCommentsOpen
          priority
          onChanged={setPost}
          onDeleted={() => router.push(`/companies/${post.companySlug}?tab=social`)}
        />
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import type { PublicSocialPost } from "@iwtr/shared-types";
import { CompanyLogo } from "@/components/CompanyLogo";
import { shortRelativeTime } from "./socialTime";

export function SocialPostCard({ post }: { post: PublicSocialPost; onChanged?: (p: PublicSocialPost) => void }) {
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface">
      <header className="flex items-center gap-3 p-3">
        <Link href={`/social/${post.companySlug}`} className="flex items-center gap-3 min-w-0">
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

      {/* Like / Comment row - real behavior added in Task 4 */}
      <div className="flex items-center gap-4 p-3 text-sm text-muted-foreground">
        <span>{post.likeCount} likes</span>
        <span>{post.commentCount} comments</span>
      </div>
    </article>
  );
}

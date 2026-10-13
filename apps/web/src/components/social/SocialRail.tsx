"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { SocialRail as SocialRailData } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useFollowedCompanies } from "@/lib/useFollowedCompanies";
import { AdSlot } from "@/components/AdSlot";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CompanyVerificationTick } from "@/components/CompanyVerificationTick";
import { WorkTypeLabel } from "@/components/WorkTypeLabel";
import { readRail, writeRail } from "./socialFeedCache";

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface p-4 shadow-xs">
      <h2 className="mb-3 text-[13px] font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

/**
 * The column to the right of the IWT Social feed: what's busy this week,
 * companies worth following and fresh job ads, each a quiet panel that isn't
 * shown at all while it has nothing in it. The page's right-hand ad sits
 * under them. Hidden below `lg`, where there's no room beside the feed.
 * One request fills all three; what it last answered is shown straight away
 * on a return visit and read again behind it.
 */
export function SocialRail() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const { followedIds, canFollow, toggleFollow } = useFollowedCompanies();
  const [rail, setRail] = useState<SocialRailData | null>(readRail);

  useEffect(() => {
    apiGet<SocialRailData>("/social/rail")
      .then((data) => {
        writeRail(data);
        setRail(data);
      })
      .catch(() => undefined);
  }, []);

  const trending = rail?.trending ?? [];
  const suggested = rail?.suggestedCompanies ?? [];
  const hiring = rail?.hiringNow ?? [];
  // Same rule as the post card: a member can follow, a logged-out visitor is
  // asked to sign in. An owner or admin can't follow anyone, so they get no
  // "Companies to follow" panel at all.
  const showFollow = !isAuthenticated || canFollow;

  return (
    <aside aria-label="More on IWT Social" className="hidden w-72 shrink-0 flex-col gap-5 lg:flex">
      {trending.length > 0 && (
        <Panel title="Trending this week">
          <ol className="flex flex-col gap-3">
            {trending.map((post) => (
              <li key={post.postId}>
                <Link href={`/social/posts/${post.postId}`} className="group flex items-center gap-3">
                  {post.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- server-produced WebP under our own /uploads
                    <img
                      src={post.thumbUrl}
                      alt=""
                      width={44}
                      height={44}
                      loading="lazy"
                      decoding="async"
                      className="h-11 w-11 shrink-0 rounded-lg bg-surface-muted object-cover"
                    />
                  ) : (
                    // A post without a photo (a text update, a poll) shows its company instead.
                    <CompanyLogo name={post.companyName} mainPhotoUrl={post.companyLogoUrl} size="sm" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground group-hover:underline">{post.companyName}</span>
                    {post.caption && <span className="block truncate text-xs text-muted-foreground">{post.caption}</span>}
                    <span className="block text-xs tabular-nums text-muted-foreground">
                      {plural(post.likeCount, "like")} &middot; {plural(post.commentCount, "comment")}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      {showFollow && suggested.length > 0 && (
        <Panel title="Companies to follow">
          <ul className="flex flex-col gap-3">
            {suggested.map((c) => {
              const following = followedIds.has(c.companyId);
              return (
                <li key={c.companyId} className="flex items-center gap-3">
                  <Link href={`/companies/${c.companySlug}?tab=social`} className="flex min-w-0 flex-1 items-center gap-3">
                    <CompanyLogo name={c.companyName} mainPhotoUrl={c.companyLogoUrl} size="sm" />
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center text-sm font-semibold text-foreground">
                        <span className="truncate">{c.companyName}</span>
                        <CompanyVerificationTick badgeTier={c.companyBadgeTier} claimed size={14} className="ml-1 shrink-0" />
                      </span>
                      <WorkTypeLabel workplaceTypes={c.companyWorkplaceTypes} className="block truncate text-xs text-muted-foreground" />
                    </span>
                  </Link>
                  <button
                      type="button"
                      aria-pressed={following}
                      aria-label={`${following ? "Following" : "Follow"} ${c.companyName}`}
                      onClick={() => {
                        if (!isAuthenticated) return openAuthModal();
                        void toggleFollow(c.companyId, {
                          companyName: c.companyName,
                          companySlug: c.companySlug,
                          mainPhotoUrl: c.companyLogoUrl,
                          badgeTier: c.companyBadgeTier,
                        });
                      }}
                      className={`shrink-0 text-[13px] font-semibold transition ${
                        following
                          ? "text-muted-foreground hover:text-foreground"
                          : "text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                      }`}
                    >
                      {following ? "Following" : "+ Follow"}
                    </button>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {hiring.length > 0 && (
        <Panel title="Hiring this week">
          <ul className="flex flex-col gap-3">
            {hiring.map((job) => (
              <li key={job.jobPostingId}>
                <Link href={`/companies/${job.companySlug}?tab=jobs`} className="group flex items-center gap-3">
                  <CompanyLogo name={job.companyName} mainPhotoUrl={job.companyLogoUrl} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground group-hover:underline">{job.jobTitle}</span>
                    <span className="block truncate text-xs text-muted-foreground">{job.companyName}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/jobs" className="mt-3 inline-block text-[13px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
            See all jobs
          </Link>
        </Panel>
      )}

      <div className="flex justify-center">
        <AdSlot side="right" />
      </div>
    </aside>
  );
}

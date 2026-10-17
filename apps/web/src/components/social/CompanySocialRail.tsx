"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { CompanySocialRail as CompanySocialRailData } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";
import { SOCIAL_QUESTIONS_ENABLED } from "@/lib/socialQuestionsFlag";
import { onSocialPosted, readCompanyRail, writeCompanyRail } from "./socialFeedCache";
import { useT } from "@/lib/i18n/client";

function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  const t = useT();
  return (
    <section className="rounded-2xl bg-surface p-4 shadow-xs">
      <h2 className="mb-3 text-[13px] font-semibold text-foreground">{t(title)}</h2>
      {children}
      {action}
    </section>
  );
}

const moreClass =
  "mt-3 inline-block text-[13px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300";

/**
 * The column to the right of a company's own Social tab, the counterpart of
 * IWT Social's SocialRail: its most talked-about posts, its newest photos,
 * its open job ads and the questions put to it that nobody has answered.
 * Each panel is left out while it has nothing in it. One request fills them
 * all (the API keeps each company's answer for a minute); what it last
 * answered for this company shows at once on a return visit.
 */
export function CompanySocialRail({
  slug,
  companyName,
  onOpenPhotos,
  onOpenQuestions,
  onOpenJobs,
}: {
  slug: string;
  companyName: string;
  onOpenPhotos: () => void;
  onOpenQuestions: () => void;
  onOpenJobs: () => void;
}) {
  const [rail, setRail] = useState<CompanySocialRailData | null>(() => readCompanyRail(slug));
  const [loaded, setLoaded] = useState(rail !== null);
  const t = useT();

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      apiGet<CompanySocialRailData>(`/social/companies/${slug}/rail`)
        .then((data) => {
          writeCompanyRail(slug, data);
          if (!cancelled) setRail(data);
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setLoaded(true);
        });
    void load();
    const off = onSocialPosted(() => void load());
    return () => {
      cancelled = true;
      off();
    };
  }, [slug]);

  const topPosts = rail?.topPosts ?? [];
  const photos = rail?.photos ?? [];
  const roles = rail?.openRoles ?? [];
  const questions = SOCIAL_QUESTIONS_ENABLED ? (rail?.openQuestions ?? []) : [];
  const empty = topPosts.length + photos.length + roles.length + questions.length === 0;

  return (
    <aside aria-label={t("More from {name}", { name: companyName })} className="hidden w-full max-w-72 flex-col gap-5 lg:flex">
      {!loaded && (
        <div className="flex flex-col gap-5" aria-hidden="true">
          <div className="h-40 animate-pulse rounded-2xl bg-surface-muted" />
          <div className="h-32 animate-pulse rounded-2xl bg-surface-muted" />
        </div>
      )}

      {topPosts.length > 0 && (
        <Panel title="Most talked about">
          <ol className="flex flex-col gap-3">
            {topPosts.map((post) => (
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
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 6h14M5 11h14M5 16h9" />
                      </svg>
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground group-hover:underline">{post.caption || t("Untitled post")}</span>
                    <span className="block text-xs tabular-nums text-muted-foreground">
                      {t(post.likeCount === 1 ? "{n} reaction" : "{n} reactions", { n: post.likeCount })} &middot;{" "}
                      {t(post.commentCount === 1 ? "{n} comment" : "{n} comments", { n: post.commentCount })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Panel>
      )}

      {photos.length > 0 && (
        <Panel
          title="Photos"
          action={
            <button type="button" onClick={onOpenPhotos} className={moreClass}>
              {t("See all photos")}
            </button>
          }
        >
          <ul className="grid grid-cols-3 gap-1.5">
            {photos.map((photo) => (
              <li key={photo.postId}>
                <Link href={`/social/posts/${photo.postId}`} className="block overflow-hidden rounded-lg bg-surface-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element -- server-produced WebP under our own /uploads */}
                  <img src={photo.url} alt="" loading="lazy" decoding="async" className="aspect-square w-full object-cover transition duration-300 hover:scale-105" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {roles.length > 0 && (
        <Panel
          title="Hiring now"
          action={
            <button type="button" onClick={onOpenJobs} className={moreClass}>
              {t("See open roles")}
            </button>
          }
        >
          <ul className="flex flex-col gap-2.5">
            {roles.map((role) => (
              <li key={role.jobPostingId}>
                <button type="button" onClick={onOpenJobs} className="group block w-full text-left">
                  <span className="block truncate text-sm font-semibold text-foreground group-hover:underline">{role.jobTitle}</span>
                  {role.workType && <span className="block text-xs text-muted-foreground">{t(workplaceTypeLabel(role.workType))}</span>}
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {questions.length > 0 && (
        <Panel
          title="Waiting for an answer"
          action={
            <button type="button" onClick={onOpenQuestions} className={moreClass}>
              See all questions
            </button>
          }
        >
          <ul className="flex flex-col gap-3">
            {questions.map((q) => (
              <li key={q.questionId}>
                <Link href={`/social/questions/${q.questionId}`} className="line-clamp-2 text-sm font-semibold leading-snug text-foreground hover:underline">
                  {q.body}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {loaded && empty && (
        <Panel title={t("{name} on IWT Social", { name: companyName })}>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("Its most talked-about posts, newest photos and open roles will show here once it starts posting.")}
          </p>
        </Panel>
      )}
    </aside>
  );
}

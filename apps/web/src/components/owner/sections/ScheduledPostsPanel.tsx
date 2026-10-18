"use client";

import { useI18n, useT } from "@/lib/i18n/client";
import { useCallback, useEffect, useState } from "react";
import type { OwnedCompany, ScheduledSocialPost, ScheduledSocialPostList, SocialPostKind } from "@iwtr/shared-types";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "@/lib/api-client";
import { planNameForOwnerTier } from "@/lib/pricingTiers";
import { SocialComposer, localInputValue } from "@/components/social/SocialComposer";
import { formatScheduledTime } from "@/components/social/socialTime";

const KIND_LABEL: Record<SocialPostKind, string> = {
  PHOTO: "Photo",
  UPDATE: "Update",
  POLL: "Poll",
  EVENT: "Event",
  MILESTONE: "Milestone",
  HIRING: "Hiring",
};

// A waiting post goes out within half a minute of its time, so the list is
// read again this often while anything is waiting.
const REFRESH_MS = 30_000;

const quietButton = "rounded-full bg-surface-muted px-3 py-1 text-[13px] font-semibold text-foreground transition hover:bg-border/70 active:scale-[0.98] disabled:opacity-50";

function Row({ post, onChanged, readOnly }: { post: ScheduledSocialPost; onChanged: () => void; readOnly: boolean }) {
  const [mode, setMode] = useState<"idle" | "time" | "delete">("idle");
  const [time, setTime] = useState(() => localInputValue(new Date(post.publishAt)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t, locale } = useI18n();

  async function run(work: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await work();
      setMode("idle");
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? t(err.message) : t(fallback));
    } finally {
      setBusy(false);
    }
  }

  const failed = post.status === "FAILED";
  const text = post.title ?? post.caption ?? t("{kind} post", { kind: t(KIND_LABEL[post.kind]) });
  return (
    <li className="flex flex-col gap-2 border-t border-border py-4 first:border-t-0 first:pt-0">
      <div className="flex min-w-0 items-start gap-3">
        {post.imageUrls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element -- server-produced WebP under our own /uploads
          <img src={post.imageUrls[0]} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
        ) : (
          <span aria-hidden="true" className="h-12 w-12 shrink-0 rounded-lg bg-surface-muted" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {failed ? t("Did not go out") : formatScheduledTime(post.publishAt, locale)}
            <span className="font-normal text-muted-foreground"> &middot; {t(KIND_LABEL[post.kind])}</span>
          </p>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{text}</p>
          {post.pollOptions.length > 0 && <p className="mt-0.5 truncate text-xs text-muted-foreground">{post.pollOptions.join(" / ")}</p>}
          {failed && post.failureReason && <p className="mt-1 text-[13px] text-red-600 dark:text-red-300">{t(post.failureReason)}</p>}
        </div>
      </div>

      {mode === "idle" && !readOnly && (
        <div className="flex flex-wrap gap-1.5 pl-[3.75rem]">
          <button type="button" onClick={() => setMode("time")} disabled={busy} className={quietButton}>
            {failed ? t("Pick a new time") : t("Change time")}
          </button>
          <button
            type="button"
            onClick={() => void run(() => apiPost(`/social/scheduled-posts/${post.id}/publish-now`, {}), "Couldn't post that.")}
            disabled={busy}
            className={quietButton}
          >
            {t("Post now")}
          </button>
          <button type="button" onClick={() => setMode("delete")} disabled={busy} className={quietButton}>
            {t("Delete")}
          </button>
        </div>
      )}

      {mode === "time" && (
        <div className="flex flex-wrap items-center gap-2 pl-[3.75rem]">
          <input
            type="datetime-local"
            aria-label={t("New date and time")}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
          />
          <button
            type="button"
            disabled={busy || !time}
            onClick={() => void run(() => apiPatch(`/social/scheduled-posts/${post.id}`, { publishAt: new Date(time).toISOString() }), "Couldn't change the time.")}
            className="rounded-full bg-brand-600 px-4 py-1 text-[13px] font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50"
          >
            {t("Save")}
          </button>
          <button type="button" onClick={() => setMode("idle")} className="text-[13px] text-muted-foreground hover:text-foreground">
            {t("Cancel")}
          </button>
        </div>
      )}

      {mode === "delete" && (
        <div className="flex flex-wrap items-center gap-2 pl-[3.75rem]">
          <span className="text-[13px] text-foreground">{t("Delete this post? It will not go out.")}</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => apiDelete(`/social/scheduled-posts/${post.id}`), "Couldn't delete that.")}
            className="rounded-full bg-red-600 px-4 py-1 text-[13px] font-semibold text-white transition hover:bg-red-700 active:scale-[0.98] disabled:opacity-50"
          >
            {t("Delete")}
          </button>
          <button type="button" onClick={() => setMode("idle")} className="text-[13px] text-muted-foreground hover:text-foreground">
            {t("Keep it")}
          </button>
        </div>
      )}

      {error && <p className="pl-[3.75rem] text-[13px] text-red-600 dark:text-red-300">{error}</p>}
    </li>
  );
}

/**
 * Posts written now to go out later. The owner schedules one with the same
 * form as a post, and can move its time, publish it at once or delete it
 * while it waits. A post that could not go out (its job ad closed, say)
 * stays in the list with the reason. How many may wait at a time comes from
 * the plan; Free has none. `readOnly` (the shared company login) lists the
 * waiting posts without any of the buttons.
 */
export function ScheduledPostsPanel({
  company,
  onOpenPricing,
  readOnly = false,
}: {
  company: OwnedCompany;
  onOpenPricing: () => void;
  readOnly?: boolean;
}) {
  const [list, setList] = useState<ScheduledSocialPostList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const t = useT();

  const load = useCallback(() => {
    apiGet<ScheduledSocialPostList>(`/social/company-scheduled/${company.companyId}`)
      .then((next) => {
        setList(next);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? t(err.message) : t("Couldn't load the scheduled posts.")));
  }, [company.companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const waiting = list?.waiting ?? 0;
  useEffect(() => {
    if (waiting === 0) return;
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [waiting, load]);

  const onPlan = list !== null && list.limit > 0;
  const full = list !== null && list.waiting >= list.limit;

  return (
    <div className="rounded-2xl bg-surface p-7 shadow-xs">
      <h3 className="font-semibold text-foreground">{t("Scheduled posts")}</h3>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        {readOnly
          ? t("Posts written to go out later, and when. Scheduling them is done from the company owner's own account.")
          : t("Write a post now and pick when it goes out. Until then nobody sees it.")}
        {onPlan && (
          <>
            {" "}
            {t("Your {plan} plan keeps up to {n} waiting;", { plan: t(planNameForOwnerTier(list.tier)), n: list.limit })}{" "}
            <span className="font-semibold text-foreground">{t("{n} waiting now", { n: list.waiting })}</span>.
          </>
        )}
      </p>

      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-300">{error}</p>}
      {!list && !error && <div aria-hidden="true" className="mt-5 h-16 animate-pulse rounded-lg bg-surface-muted motion-reduce:animate-none" />}

      {list && !onPlan && (
        <p className="mt-4 text-sm text-foreground">
          {t("Posting later is part of the Starter plan and above.")}{" "}
          <button type="button" onClick={onOpenPricing} className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
            {t("Compare plans")}
          </button>
        </p>
      )}

      {onPlan && !writing && !readOnly && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setWriting(true)}
            disabled={full}
            className="rounded-full bg-brand-600 px-5 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50"
          >
            {t("Schedule a post")}
          </button>
          {full && <p className="mt-2 text-[13px] text-muted-foreground">{t("That is the most your plan keeps waiting. Delete one, or wait for one to go out.")}</p>}
        </div>
      )}

      {onPlan && writing && !readOnly && (
        <div className="mt-4 max-w-xl rounded-2xl bg-surface-muted/50 p-1">
          <SocialComposer
            companies={[company]}
            alwaysLater
            onPosted={() => setWriting(false)}
            onScheduled={() => {
              setWriting(false);
              load();
            }}
            onCancel={() => setWriting(false)}
          />
        </div>
      )}

      {list && list.posts.length > 0 && (
        <ul className="mt-6 border-t border-border pt-4">
          {list.posts.map((post) => (
            <Row key={`${post.id}:${post.publishAt}:${post.status}`} post={post} onChanged={load} readOnly={readOnly} />
          ))}
        </ul>
      )}
      {onPlan && list.posts.length === 0 && !writing && <p className="mt-4 text-sm text-muted-foreground">{t("Nothing is waiting to go out.")}</p>}
    </div>
  );
}

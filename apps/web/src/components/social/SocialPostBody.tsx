"use client";

import { useState } from "react";
import Link from "next/link";
import type { PublicSocialPost } from "@iwtr/shared-types";
import { apiPost, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { WorkTypeLabel } from "@/components/WorkTypeLabel";
import { jobPositionLabel } from "@/lib/jobPositions";

// The part of a post card that depends on what kind of post it is: a poll's
// answers, an event's date and place, a milestone's headline, the job ad a
// "we're hiring" post points at. A plain photo or text post has none.

const panel = "mx-4 mt-3 rounded-xl bg-surface-muted p-3.5";
const headline = "font-display text-lg leading-snug text-foreground";

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function pollTimeLeft(endsAt: string, now: number): string {
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return "Poll closed";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "Less than an hour left";
  if (hours < 24) return `${plural(hours, "hour")} left`;
  return `${plural(Math.floor(hours / 24), "day")} left`;
}

function PollBody({ post, onChanged }: { post: PublicSocialPost; onChanged?: (p: PublicSocialPost) => void }) {
  const { isAuthenticated, role, openAuthModal } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "Now" as of when the card appeared - good enough for "2 days left".
  const [now] = useState(() => Date.now());
  const poll = post.poll!;
  // A poll asks the people who work there: members vote, employers and
  // admins only look. A logged-out visitor is asked to sign in on a click.
  const canVote = !poll.closed && (!isAuthenticated || role === "MEMBER");
  const showResults = poll.options.some((o) => o.votes !== null);

  async function vote(optionId: string) {
    if (!isAuthenticated) return openAuthModal();
    if (busy || optionId === poll.myOptionId) return;
    setBusy(true);
    setError(null);
    try {
      onChanged?.(await apiPost<PublicSocialPost>(`/social/posts/${post.id}/poll-vote`, { optionId }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save your vote.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 pt-3">
      <ul className="flex flex-col gap-2">
        {poll.options.map((option) => {
          const mine = option.id === poll.myOptionId;
          const share = showResults && poll.totalVotes > 0 ? (option.votes ?? 0) / poll.totalVotes : 0;
          const row = (
            <>
              {/* The share of votes, drawn as a wash across the row. scaleX
                  keeps it on the compositor instead of animating a width. */}
              {showResults && (
                <span
                  aria-hidden="true"
                  className={`absolute inset-0 origin-left transition-transform duration-500 motion-reduce:transition-none ${
                    mine ? "bg-brand-600/25 dark:bg-brand-400/30" : "bg-foreground/10"
                  }`}
                  style={{ transform: `scaleX(${share})` }}
                />
              )}
              <span className={`relative flex min-w-0 items-center gap-2 ${mine ? "font-semibold" : ""}`}>
                {mine && (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                )}
                <span className="min-w-0 break-words">{option.text}</span>
                {mine && <span className="sr-only">(your vote)</span>}
              </span>
              {showResults && <span className="relative shrink-0 tabular-nums text-muted-foreground">{Math.round(share * 100)}%</span>}
            </>
          );
          const rowClass = "relative flex min-h-11 w-full items-center justify-between gap-3 overflow-hidden rounded-xl bg-surface-muted px-3.5 py-2 text-left text-sm text-foreground";
          return (
            <li key={option.id}>
              {canVote ? (
                <button
                  type="button"
                  onClick={() => void vote(option.id)}
                  disabled={busy}
                  aria-pressed={mine}
                  className={`${rowClass} transition hover:bg-border/70 active:scale-[0.99] disabled:opacity-70`}
                >
                  {row}
                </button>
              ) : (
                <div className={rowClass}>{row}</div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        <span className="tabular-nums">{plural(poll.totalVotes, "vote")}</span> &middot; {poll.closed ? "Poll closed" : pollTimeLeft(poll.endsAt, now)}
        {!poll.closed && isAuthenticated && role !== "MEMBER" && <> &middot; Only members can vote</>}
      </p>
      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-300">{error}</p>}
    </div>
  );
}

function EventBody({ post }: { post: PublicSocialPost }) {
  const [now] = useState(() => Date.now());
  const startsAt = new Date(post.eventStartsAt!);
  const past = startsAt.getTime() < now;
  return (
    <div className={`${panel} flex items-center gap-4`}>
      <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-surface py-1.5 text-center">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
          {startsAt.toLocaleDateString("en-GB", { month: "short" })}
        </span>
        <span className="font-display text-2xl leading-none text-foreground tabular-nums">{startsAt.getDate()}</span>
      </div>
      <div className="min-w-0">
        <p className={headline}>{post.title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          <time dateTime={post.eventStartsAt!}>
            {startsAt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })},{" "}
            {startsAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </time>
          {post.eventLocation && <> &middot; {post.eventLocation}</>}
        </p>
        {past && <p className="mt-0.5 text-xs text-muted-foreground">This event has taken place.</p>}
      </div>
    </div>
  );
}

function MilestoneBody({ post }: { post: PublicSocialPost }) {
  return (
    <div className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-brand-600/10 p-3.5 dark:bg-brand-400/15">
      {/* eslint-disable-next-line @next/next/no-img-element -- a 3 KB static WebP at a fixed size */}
      <img src="/reactions/well-done.webp" alt="" width={52} height={52} loading="lazy" decoding="async" className="shrink-0" style={{ width: 52, height: 52 }} />
      <p className={headline}>{post.title}</p>
    </div>
  );
}

function HiringBody({ post }: { post: PublicSocialPost }) {
  const job = post.job!;
  return (
    <div className={panel}>
      <p className="text-xs font-semibold text-brand-700 dark:text-brand-300">We&apos;re hiring</p>
      {job.jobPostingId ? (
        <>
          <p className={`mt-0.5 ${headline}`}>{job.jobTitle}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {job.workType && <WorkTypeLabel workplaceTypes={[job.workType]} />}
            {job.workType && job.positions.length > 0 && <> &middot; </>}
            {job.positions.map(jobPositionLabel).join(", ")}
          </p>
        </>
      ) : null}
      {job.live ? (
        <Link
          href={`/companies/${post.companySlug}?tab=jobs`}
          className="mt-2 inline-block text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
        >
          See the job
        </Link>
      ) : (
        <p className="mt-1.5 text-sm text-muted-foreground">This position is no longer open.</p>
      )}
    </div>
  );
}

export function SocialPostBody({ post, onChanged }: { post: PublicSocialPost; onChanged?: (p: PublicSocialPost) => void }) {
  if (post.kind === "POLL" && post.poll) return <PollBody post={post} onChanged={onChanged} />;
  if (post.kind === "EVENT" && post.eventStartsAt) return <EventBody post={post} />;
  if (post.kind === "MILESTONE" && post.title) return <MilestoneBody post={post} />;
  if (post.kind === "HIRING" && post.job) return <HiringBody post={post} />;
  return null;
}

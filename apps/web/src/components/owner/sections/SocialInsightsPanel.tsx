"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SocialInsights, SocialInsightsDay, SocialPostKind } from "@iwtr/shared-types";
import { SOCIAL_INSIGHTS_PERIODS } from "@iwtr/shared-types";
import { apiGet, ApiError } from "@/lib/api-client";
import { planNameForOwnerTier } from "@/lib/pricingTiers";

type Period = (typeof SOCIAL_INSIGHTS_PERIODS)[number];

const PERIOD_LABEL: Record<Period, string> = { 7: "7 days", 30: "30 days", 60: "60 days", 90: "90 days" };

const KIND_LABEL: Record<SocialPostKind, string> = {
  PHOTO: "Photo",
  UPDATE: "Update",
  POLL: "Poll",
  EVENT: "Event",
  MILESTONE: "Milestone",
  HIRING: "Hiring",
};

// What this visit has already read, so coming back to the section (or to a
// period already looked at) shows numbers at once and reads them again behind.
const remembered = new Map<string, SocialInsights>();

/** For tests. */
export function forgetSocialInsights(): void {
  remembered.clear();
}

const number = (n: number) => n.toLocaleString("en-GB");
const shortDay = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

// The chart's own size; it stretches to the width it is given.
const W = 600;
const H = 150;

/** Followers at the end of each day: a line over a soft fill. */
function FollowersChart({ series }: { series: SocialInsightsDay[] }) {
  const values = series.map((d) => d.followers);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const x = (i: number) => (series.length === 1 ? W / 2 : (i / (series.length - 1)) * W);
  // A flat line sits in the middle rather than on the floor.
  const y = (v: number) => (high === low ? H / 2 : H - 8 - ((v - low) / span) * (H - 16));
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const first = series[0];
  const last = series[series.length - 1];
  return (
    <figure className="min-w-0">
      <figcaption className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="font-semibold text-foreground">Followers</span>
        <span className="tabular-nums text-muted-foreground">
          {number(first.followers)} to {number(last.followers)}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Followers went from ${first.followers} on ${shortDay(first.day)} to ${last.followers} on ${shortDay(last.day)}.`}
        className="mt-2 block h-36 w-full text-brand-600 dark:text-brand-400"
      >
        <path d={`${line} L${W} ${H} L0 ${H} Z`} fill="currentColor" opacity="0.1" />
        <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <ChartDates from={first.day} to={last.day} />
    </figure>
  );
}

/** How often the company's posts were seen: a bar a day, or a bar a week over a year. */
function ViewsChart({ series }: { series: SocialInsightsDay[] }) {
  const weekly = series.length > 90;
  const bars: { label: string; views: number }[] = [];
  if (weekly) {
    for (let i = 0; i < series.length; i += 7) {
      const week = series.slice(i, i + 7);
      bars.push({ label: `Week of ${shortDay(week[0].day)}`, views: week.reduce((sum, d) => sum + d.views, 0) });
    }
  } else {
    for (const d of series) bars.push({ label: shortDay(d.day), views: d.views });
  }
  const top = Math.max(1, ...bars.map((b) => b.views));
  const step = W / bars.length;
  const total = bars.reduce((sum, b) => sum + b.views, 0);
  return (
    <figure className="min-w-0">
      <figcaption className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="font-semibold text-foreground">Post views {weekly ? "per week" : "per day"}</span>
        <span className="tabular-nums text-muted-foreground">most {number(top === 1 && total === 0 ? 0 : top)}</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${total} post views between ${shortDay(series[0].day)} and ${shortDay(series[series.length - 1].day)}.`}
        className="mt-2 block h-36 w-full text-brand-600 dark:text-brand-400"
      >
        {/* The floor, so an empty period still reads as a chart. */}
        <rect x="0" y={H - 1} width={W} height="1" fill="currentColor" opacity="0.25" />
        {bars.map((b, i) => {
          const height = (b.views / top) * (H - 8);
          return (
            <rect key={i} x={i * step + step * 0.15} y={H - height} width={step * 0.7} height={height} fill="currentColor" opacity="0.85">
              <title>{`${b.label}: ${number(b.views)} ${b.views === 1 ? "view" : "views"}`}</title>
            </rect>
          );
        })}
      </svg>
      <ChartDates from={series[0].day} to={series[series.length - 1].day} />
    </figure>
  );
}

function ChartDates({ from, to }: { from: string; to: string }) {
  return (
    <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
      <span>{shortDay(from)}</span>
      <span>{shortDay(to)}</span>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-display text-3xl font-semibold tabular-nums leading-none text-foreground">{number(value)}</dd>
      <dd className="mt-1.5 text-xs text-muted-foreground">{note}</dd>
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-hidden="true" className="mt-6 flex animate-pulse flex-col gap-6 motion-reduce:animate-none">
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[4.5rem] rounded-lg bg-surface-muted" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="h-48 rounded-lg bg-surface-muted" />
        <div className="h-48 rounded-lg bg-surface-muted" />
      </div>
    </div>
  );
}

/**
 * The owner's IWT Social numbers: followers, how often posts were seen,
 * reactions and comments over a chosen period, and the period's posts by
 * views. Every figure is a count - the page says so, because an owner should
 * know there is no list of who behind any of them. How far back the period
 * can reach comes from the plan.
 */
export function SocialInsightsPanel({
  companyId,
  companyName,
  onOpenPricing,
}: {
  companyId: string;
  companyName: string;
  onOpenPricing: () => void;
}) {
  // What the owner picked; null until they pick, and the first read settles it.
  const [picked, setPicked] = useState<Period | null>(null);
  const asked = picked ?? 30;
  const [data, setData] = useState<SocialInsights | null>(() => remembered.get(`${companyId}:${asked}`) ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<SocialInsights>(`/social/company-insights/${companyId}?days=${asked}`)
      .then((next) => {
        remembered.set(`${companyId}:${asked}`, next);
        remembered.set(`${companyId}:${next.days}`, next);
        if (cancelled) return;
        setData(next);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Couldn't load the numbers.");
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, asked]);

  function pick(period: Period) {
    if (data && period > data.maxDays) return onOpenPricing();
    setData(remembered.get(`${companyId}:${period}`) ?? null);
    setPicked(period);
  }

  const shownPeriod = (data?.days ?? asked) as Period;
  const period = `in the last ${PERIOD_LABEL[shownPeriod]}`;
  const quiet = data !== null && data.posts === 0 && data.views === 0 && data.followers.now === 0;

  return (
    <div className="rounded-2xl bg-surface p-7 shadow-xs">
      <h3 className="font-semibold text-foreground">Insights</h3>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        How {companyName} is doing on IWT Social. These are counts only: nobody, you included, can see who viewed a post, who
        reacted or who follows you.
      </p>

      <div role="radiogroup" aria-label="Period" className="mt-4 flex flex-wrap gap-1.5">
        {SOCIAL_INSIGHTS_PERIODS.map((p) => {
          const checked = shownPeriod === p;
          const locked = data !== null && p > data.maxDays;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={checked}
              title={locked ? "Needs a higher plan" : undefined}
              onClick={() => pick(p)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition active:scale-[0.98] ${
                checked
                  ? "bg-brand-600 text-white"
                  : locked
                    ? "bg-surface-muted text-muted-foreground/60"
                    : "bg-surface-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          );
        })}
      </div>
      {data && data.maxDays < Math.max(...SOCIAL_INSIGHTS_PERIODS) && (
        <p className="mt-2 text-[13px] text-muted-foreground">
          Your {planNameForOwnerTier(data.tier)} plan looks back {PERIOD_LABEL[data.maxDays as Period]}.{" "}
          <button type="button" onClick={onOpenPricing} className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
            See plans that look back further
          </button>
        </p>
      )}

      {error && <p className="mt-4 text-sm text-red-600 dark:text-red-300">{error}</p>}
      {!data && !error && <Skeleton />}

      {data && (
        <>
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-border pt-6 lg:grid-cols-4">
            <Stat
              label="Followers"
              value={data.followers.now}
              note={`${number(data.followers.gained)} new, ${number(data.followers.lost)} left ${period}`}
            />
            <Stat label="Post views" value={data.views} note={period} />
            <Stat label="Reactions" value={data.reactions} note={period} />
            <Stat label="Comments" value={data.comments} note={period} />
          </dl>

          {quiet ? (
            <p className="mt-6 border-t border-border pt-6 text-sm text-muted-foreground">
              Nothing to show yet. Once you post on{" "}
              <Link href="/social" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
                IWT Social
              </Link>{" "}
              and people see it, the numbers appear here.
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-8 border-t border-border pt-6 lg:grid-cols-2">
              <FollowersChart series={data.series} />
              <ViewsChart series={data.series} />
            </div>
          )}

          {data.topPosts.length > 0 && (
            <div className="mt-6 border-t border-border pt-6">
              <h4 className="text-[13px] font-semibold text-foreground">
                Posts {period}, most seen first
                {data.posts > data.topPosts.length && <span className="font-normal text-muted-foreground"> (top {data.topPosts.length} of {data.posts})</span>}
              </h4>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[26rem] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-2 font-medium">
                        Post
                      </th>
                      <th scope="col" className="w-20 py-2 text-right font-medium">
                        Views
                      </th>
                      <th scope="col" className="w-20 py-2 text-right font-medium">
                        Reactions
                      </th>
                      <th scope="col" className="w-24 py-2 text-right font-medium">
                        Comments
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topPosts.map((post) => (
                      <tr key={post.postId} className="border-t border-border">
                        <td className="py-2.5 pr-3">
                          <Link href={`/social/posts/${post.postId}`} className="group flex min-w-0 items-center gap-3">
                            {post.thumbUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element -- server-produced WebP under our own /uploads
                              <img src={post.thumbUrl} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                            ) : (
                              <span aria-hidden="true" className="h-10 w-10 shrink-0 rounded-lg bg-surface-muted" />
                            )}
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-foreground group-hover:underline">
                                {post.text ?? `${KIND_LABEL[post.kind]} post`}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {KIND_LABEL[post.kind]} &middot;{" "}
                                {new Date(post.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                              </span>
                            </span>
                          </Link>
                        </td>
                        <td className="py-2.5 text-right font-semibold tabular-nums text-foreground">{number(post.views)}</td>
                        <td className="py-2.5 text-right tabular-nums text-muted-foreground">{number(post.reactions)}</td>
                        <td className="py-2.5 text-right tabular-nums text-muted-foreground">{number(post.comments)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

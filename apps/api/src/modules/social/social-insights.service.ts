import { ForbiddenException, Injectable } from "@nestjs/common";
import {
  SOCIAL_DAY_KEEP_DAYS,
  SOCIAL_INSIGHTS_DAYS,
  SOCIAL_INSIGHTS_PERIODS,
  type OwnerTier,
  type SocialInsights,
  type UserRole,
} from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { PUBLIC_COMPANY_WHERE } from "../companies/company-visibility";
import { toUtcHour } from "../../common/time/day-precision.util";
import { bumpSocialDay, dayKey, socialDay, socialDayStart } from "./social-day.util";

// The same member seeing the same post again counts once in this long.
export const VIEW_REPEAT_MS = 12 * 60 * 60 * 1000;
// How many "already counted" marks are kept before the oldest are dropped.
const SEEN_CAP = 100_000;
const TOP_POSTS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Phase 4 of IWT Social: how often a company's posts are seen, and the
 * numbers an owner reads in the dashboard. Everything here is a count. A view
 * is added to a counter on the post and on the company's day
 * (CompanySocialDay) - no row anywhere records which member saw what.
 */
@Injectable()
export class SocialInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  // "member:post" -> when that pair may count again. Held in this process's
  // memory only and never written anywhere: it exists so that scrolling past
  // the same post twice, or a script calling the route in a loop, does not
  // inflate the number.
  private readonly seen = new Map<string, number>();

  /**
   * The page says a signed-in member has had these posts on screen. Only
   * members count: an owner or admin looking at the feed is not the audience.
   * Unknown ids and posts of a hidden company are ignored.
   */
  async recordViews(viewer: { id: string; role: UserRole }, postIds: string[]): Promise<void> {
    if (viewer.role !== "MEMBER") return;
    const now = Date.now();
    const fresh = [...new Set(postIds)].filter((postId) => (this.seen.get(`${viewer.id}:${postId}`) ?? 0) <= now);
    if (fresh.length === 0) return;

    const posts = await this.prisma.socialPost.findMany({
      where: { id: { in: fresh }, company: PUBLIC_COMPANY_WHERE },
      select: { id: true, companyId: true },
    });
    if (posts.length === 0) return;

    const perCompany = new Map<string, number>();
    for (const post of posts) {
      this.markSeen(`${viewer.id}:${post.id}`, now + VIEW_REPEAT_MS);
      perCompany.set(post.companyId, (perCompany.get(post.companyId) ?? 0) + 1);
    }
    await this.prisma.$transaction([
      this.prisma.socialPost.updateMany({ where: { id: { in: posts.map((p) => p.id) } }, data: { viewCount: { increment: 1 } } }),
      ...[...perCompany].map(([companyId, views]) => bumpSocialDay(this.prisma, companyId, "postViews", views)),
    ]);
  }

  private markSeen(key: string, until: number): void {
    if (this.seen.size >= SEEN_CAP) {
      const now = Date.now();
      for (const [k, expires] of this.seen) if (expires <= now) this.seen.delete(k);
      // Still full of live marks: let the oldest tenth go (a Map keeps the
      // order things were added in).
      if (this.seen.size >= SEEN_CAP) {
        let drop = SEEN_CAP / 10;
        for (const k of this.seen.keys()) {
          this.seen.delete(k);
          if (--drop <= 0) break;
        }
      }
    }
    this.seen.set(key, until);
  }

  /**
   * Drops the per-day counters no Insights period can reach any more
   * (SOCIAL_DAY_KEEP_DAYS), so the table stays one short window per company.
   * Run now and then by SocialScheduleWorker. Returns how many rows went.
   */
  async pruneOldDays(): Promise<number> {
    const cutoff = new Date(socialDay().getTime() - SOCIAL_DAY_KEEP_DAYS * DAY_MS);
    const { count } = await this.prisma.companySocialDay.deleteMany({ where: { day: { lt: cutoff } } });
    return count;
  }

  /**
   * A company's IWT Social numbers for the last `daysAsked` days, for an
   * approved owner of it (or its shared company login). How far back it
   * reaches depends on the plan (SOCIAL_INSIGHTS_DAYS); asking for more gives
   * the plan's own reach, and the answer says which period it is. Free has no
   * Insights: Post Scheduling is a Starter-and-up section.
   */
  async insights(userId: string, companyId: string, daysAsked: number | undefined): Promise<SocialInsights> {
    const ownership = await this.prisma.companyOwner.findUnique({
      where: { userId_companyId: { userId, companyId } },
      select: { claimStatus: true, tier: true, planStatus: true },
    });
    if (!ownership || ownership.claimStatus !== "APPROVED") {
      throw new ForbiddenException("You are not an approved owner of this company.");
    }
    // A lapsed paid plan counts as Free, as everywhere else.
    const tier: OwnerTier = ownership.planStatus === "ACTIVE" ? ownership.tier : "FREE";
    const maxDays = SOCIAL_INSIGHTS_DAYS[tier];
    if (maxDays === 0) {
      throw new ForbiddenException("Insights come with the Starter, Pro and Enterprise plans.");
    }
    const wanted = (SOCIAL_INSIGHTS_PERIODS as readonly number[]).includes(daysAsked ?? NaN) ? daysAsked! : 30;
    const days = Math.min(wanted, maxDays);

    const today = socialDay();
    const firstDay = new Date(today.getTime() - (days - 1) * DAY_MS);
    // Reactions, comments and posts carry a moment, not a day.
    const inPeriod = { gte: socialDayStart(firstDay) };

    // SECURITY (REVIEW.md): counts only. Nothing below selects a user id.
    const [followersNow, dayRows, reactions, comments, posts, topRows] = await Promise.all([
      this.prisma.companyFollow.count({ where: { companyId } }),
      this.prisma.companySocialDay.findMany({
        where: { companyId, day: { gte: firstDay } },
        select: { day: true, postViews: true, followersGained: true, followersLost: true },
      }),
      this.prisma.socialPostLike.count({ where: { post: { companyId }, createdAt: inPeriod } }),
      this.prisma.socialComment.count({ where: { post: { companyId }, createdAt: inPeriod } }),
      this.prisma.socialPost.count({ where: { companyId, createdAt: inPeriod } }),
      this.prisma.socialPost.findMany({
        where: { companyId, createdAt: inPeriod },
        orderBy: [{ viewCount: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        take: TOP_POSTS,
        select: {
          id: true,
          kind: true,
          caption: true,
          title: true,
          imageUrls: true,
          createdAt: true,
          viewCount: true,
          _count: { select: { likes: true, comments: true } },
        },
      }),
    ]);

    const byDay = new Map(dayRows.map((r) => [dayKey(r.day), r]));
    // Followers at the end of each day, worked back from today's count.
    const series: SocialInsights["series"] = [];
    let followers = followersNow;
    let views = 0;
    let gained = 0;
    let lost = 0;
    for (let i = 0; i < days; i++) {
      const key = dayKey(new Date(today.getTime() - i * DAY_MS));
      const row = byDay.get(key);
      series.push({ day: key, followers: Math.max(0, followers), views: row?.postViews ?? 0 });
      views += row?.postViews ?? 0;
      gained += row?.followersGained ?? 0;
      lost += row?.followersLost ?? 0;
      followers -= (row?.followersGained ?? 0) - (row?.followersLost ?? 0);
    }
    series.reverse();

    return {
      tier,
      days,
      maxDays,
      followers: { now: followersNow, gained, lost },
      views,
      reactions,
      comments,
      posts,
      series,
      topPosts: topRows.map((p) => ({
        postId: p.id,
        kind: p.kind,
        text: p.caption ?? p.title,
        thumbUrl: p.imageUrls[0] ?? null,
        createdAt: toUtcHour(p.createdAt).toISOString(),
        views: p.viewCount,
        reactions: p._count.likes,
        comments: p._count.comments,
      })),
    };
  }
}

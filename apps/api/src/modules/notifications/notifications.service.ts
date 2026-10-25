import { Injectable } from "@nestjs/common";
import type { Notification, NotificationType } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { daysRemaining } from "../job-postings/job-postings.util";
import { toUtcHour } from "../../common/time/day-precision.util";
import { socialQuestionsEnabled } from "../social/social-questions.flag";

const MAX_NOTIFICATIONS = 30;

// One derived event, before the caller's read state is attached.
type NotificationEvent = Omit<Notification, "read">;
const RECENT_WINDOW_MS = 30 * 86_400_000;
// RATED_COMPANY_IMPROVING (see ratingRiseEvents).
const RATING_RISE_MAX_REVIEWS = 10;
const RATING_RISE_MIN_NEWER_REVIEWS = 3;
const RATING_RISE_MIN = 0.3;

const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

// Where a review-related notification lands: the review itself on its
// company page, which scrolls to it and pulses its outline (ReviewsList
// reads ?review=). Review ids are already public (every published review
// carries its id for voting), so this reveals nothing new.
const reviewHref = (companySlug: string | undefined, reviewId: string) =>
  companySlug ? `/companies/${companySlug}?review=${reviewId}` : `/me/reviews?review=${reviewId}`;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Derived, not stored (see notification.ts in shared-types) — pulled live
   * from ReviewVote and CompanyReply rows attached to the caller's own
   * reviews, plus (independently — a job posting has nothing to do with the
   * caller's own reviews) their own published JobPosting rows, plus
   * (independently again) the 3 COMPANY_* kinds derived from companies the
   * caller follows (CompanyFollow) — merged and re-sorted every time the
   * dropdown opens. Each event's read flag comes from NotificationRead
   * (the ids this account already opened or marked read).
   */
  async list(userId: string): Promise<Notification[]> {
    const myReviews = await this.prisma.review.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        publishedAt: true,
        createdAt: true,
        companyId: true,
        corporateCultureScore: true,
        leadershipScore: true,
        infrastructureScore: true,
        workLifeBalanceScore: true,
        stabilityScore: true,
        company: { select: { name: true, slug: true } },
      },
    });
    const reviewIds = myReviews.map((r) => r.id);
    const companyByReview = new Map(myReviews.map((r) => [r.id, r.company]));

    const follows = await this.prisma.companyFollow.findMany({
      where: { userId },
      select: { companyId: true },
    });
    const followedCompanyIds = follows.map((f) => f.companyId);

    const ownerships = await this.prisma.companyOwner.findMany({
      where: { userId, claimStatus: "APPROVED" },
      select: { companyId: true },
    });
    const ownedCompanyIds = ownerships.map((o) => o.companyId);

    const [
      votes,
      replies,
      jobPostings,
      followedStatusUpdates,
      followedPosts,
      followedHiring,
      readyReports,
      readyHrReports,
      myConversations,
      companyConversations,
    ] = await Promise.all([
      reviewIds.length > 0
        ? this.prisma.reviewVote.findMany({
            where: { reviewId: { in: reviewIds } },
            orderBy: { createdAt: "desc" },
            take: MAX_NOTIFICATIONS,
          })
        : Promise.resolve([]),
      reviewIds.length > 0
        ? this.prisma.companyReply.findMany({
            where: { reviewId: { in: reviewIds } },
            orderBy: { createdAt: "desc" },
            take: MAX_NOTIFICATIONS,
          })
        : Promise.resolve([]),
      // Fires the moment a posting becomes PUBLISHED, whether that happened
      // immediately at creation or later via admin approval (see
      // JobPostingsService) — this is a live read, not an event this service
      // has to be told about separately.
      this.prisma.jobPosting.findMany({
        where: { createdByUserId: userId, status: "PUBLISHED" },
        select: { id: true, createdAt: true, company: { select: { name: true, slug: true } } },
        orderBy: { createdAt: "desc" },
        take: MAX_NOTIFICATIONS,
      }),
      // "Status update" = the followed company's CompanyAggregateScore was
      // recomputed (a new review published) — a singleton row per company,
      // so this is inherently "the latest update" already, never a log of
      // every past one. A hidden company never surfaces here.
      followedCompanyIds.length > 0
        ? this.prisma.companyAggregateScore.findMany({
            where: { companyId: { in: followedCompanyIds }, company: { hiddenAt: null } },
            select: { companyId: true, updatedAt: true, company: { select: { name: true, slug: true } } },
            orderBy: { updatedAt: "desc" },
            take: MAX_NOTIFICATIONS,
          })
        : Promise.resolve([]),
      followedCompanyIds.length > 0
        ? this.prisma.socialPost.findMany({
            where: { companyId: { in: followedCompanyIds }, company: { hiddenAt: null } },
            select: { id: true, createdAt: true, company: { select: { name: true, slug: true } } },
            orderBy: { createdAt: "desc" },
            take: MAX_NOTIFICATIONS,
          })
        : Promise.resolve([]),
      followedCompanyIds.length > 0
        ? this.prisma.jobPosting
            .findMany({
              where: { companyId: { in: followedCompanyIds }, status: "PUBLISHED", company: { hiddenAt: null } },
              select: {
                id: true,
                createdAt: true,
                lastResharedAt: true,
                filledAt: true,
                autoReshareEnabled: true,
                status: true,
                company: { select: { name: true, slug: true } },
              },
              orderBy: { createdAt: "desc" },
              // Over-fetch: some rows get filtered out below for having
              // naturally lapsed (still PUBLISHED in the DB, no longer
              // live — see job-postings.util.ts). events.slice(0,
              // MAX_NOTIFICATIONS) at the end of this method still caps the
              // combined total across all 6 notification sources.
              take: MAX_NOTIFICATIONS * 3,
            })
            .then((rows) => rows.filter((r) => daysRemaining(r) > 0).slice(0, MAX_NOTIFICATIONS))
        : Promise.resolve([]),
      // Sector Benchmark Reports this user ordered that finished building
      // and can still be downloaded (see BenchmarkReportWorker).
      this.prisma.benchmarkReportJob.findMany({
        where: { requestedByUserId: userId, status: "READY", expiresAt: { gt: new Date() } },
        select: { id: true, companyId: true, completedAt: true, company: { select: { name: true, slug: true } } },
        orderBy: { completedAt: "desc" },
        take: MAX_NOTIFICATIONS,
      }),
      // ...and HR Analytics Reports (see HrAnalyticsReportWorker).
      this.prisma.hrAnalyticsReportJob.findMany({
        where: { requestedByUserId: userId, status: "READY", expiresAt: { gt: new Date() } },
        select: { id: true, companyId: true, completedAt: true, company: { select: { name: true, slug: true } } },
        orderBy: { completedAt: "desc" },
        take: MAX_NOTIFICATIONS,
      }),
      // Private review conversations (MessagingService): one notification
      // per conversation whose newest message from the OTHER side is past
      // the caller's read marker. As reviewer here (never for a company
      // owner: they have no personal inbox, see MessagingService.listMine)...
      ownedCompanyIds.length === 0
        ? this.prisma.reviewConversation.findMany({
            where: { reviewerUserId: userId },
            select: {
              id: true,
              companyId: true,
              reviewerLastReadSeq: true,
              company: { select: { name: true, slug: true } },
              messages: {
                where: { side: "COMPANY" },
                orderBy: { seq: "desc" },
                take: 1,
                select: { id: true, seq: true, createdAt: true },
              },
            },
            take: MAX_NOTIFICATIONS,
          })
        : Promise.resolve([]),
      // ...and as an approved owner of the reviewed company.
      ownedCompanyIds.length > 0
        ? this.prisma.reviewConversation.findMany({
            where: { companyId: { in: ownedCompanyIds } },
            select: {
              id: true,
              companyId: true,
              companyLastReadSeq: true,
              company: { select: { name: true, slug: true } },
              messages: {
                where: { side: "REVIEWER" },
                orderBy: { seq: "desc" },
                take: 1,
                select: { id: true, seq: true, createdAt: true },
              },
            },
            take: MAX_NOTIFICATIONS * 3,
          })
        : Promise.resolve([]),
    ]);

    const events: NotificationEvent[] = [
      ...votes.map((v) => ({
        id: `vote-${v.id}`,
        type: (v.value === 1 ? "VOTE_HELPFUL" : "VOTE_NOT_HELPFUL") as NotificationType,
        companyName: companyByReview.get(v.reviewId)?.name ?? "",
        companySlug: companyByReview.get(v.reviewId)?.slug ?? null,
        createdAt: v.createdAt.toISOString(),
        href: reviewHref(companyByReview.get(v.reviewId)?.slug, v.reviewId),
      })),
      ...replies.map((r) => ({
        id: `reply-${r.id}`,
        type: "COMPANY_REPLY" as NotificationType,
        companyName: companyByReview.get(r.reviewId)?.name ?? "",
        companySlug: companyByReview.get(r.reviewId)?.slug ?? null,
        createdAt: r.createdAt.toISOString(),
        href: reviewHref(companyByReview.get(r.reviewId)?.slug, r.reviewId),
      })),
      ...jobPostings.map((p) => ({
        id: `job-posting-${p.id}`,
        type: "JOB_POSTING_PUBLISHED" as NotificationType,
        companyName: p.company.name,
        companySlug: p.company.slug,
        createdAt: p.createdAt.toISOString(),
      })),
      ...followedStatusUpdates.map((a) => ({
        id: `company-status-${a.companyId}-${a.updatedAt.getTime()}`,
        type: "COMPANY_STATUS_UPDATE" as NotificationType,
        companyName: a.company.name,
        companySlug: a.company.slug,
        createdAt: a.updatedAt.toISOString(),
      })),
      ...followedPosts.map((p) => ({
        id: `company-post-${p.id}`,
        type: "COMPANY_NEW_SOCIAL_POST" as NotificationType,
        companyName: p.company.name,
        companySlug: p.company.slug,
        // Hour precision, same as the post itself on IWT Social.
        createdAt: toUtcHour(p.createdAt).toISOString(),
      })),
      ...followedHiring.map((j) => ({
        id: `company-hiring-${j.id}`,
        type: "COMPANY_HIRING" as NotificationType,
        companyName: j.company.name,
        companySlug: j.company.slug,
        createdAt: j.createdAt.toISOString(),
      })),
      ...readyReports.map((job) => ({
        id: `benchmark-${job.id}`,
        type: "BENCHMARK_REPORT_READY" as NotificationType,
        companyName: job.company.name,
        companySlug: job.company.slug,
        createdAt: (job.completedAt ?? new Date()).toISOString(),
        // Through the web app's same-origin auth proxy, which attaches the
        // session; the API re-checks ownership and expiry on download.
        href: `/api/proxy/my-companies/${job.companyId}/sector-benchmark/${job.id}/download`,
      })),
      ...readyHrReports.map((job) => ({
        id: `hr-report-${job.id}`,
        type: "HR_REPORT_READY" as NotificationType,
        companyName: job.company.name,
        companySlug: job.company.slug,
        createdAt: (job.completedAt ?? new Date()).toISOString(),
        href: `/api/proxy/my-companies/${job.companyId}/hr-analytics-report/${job.id}/download`,
      })),
      ...myConversations
        .filter((c) => c.messages[0] && c.messages[0].seq > c.reviewerLastReadSeq)
        .map((c) => ({
          id: `conversation-${c.messages[0].id}`,
          type: "CONVERSATION_MESSAGE_FROM_COMPANY" as NotificationType,
          companyName: c.company.name,
          companySlug: c.company.slug,
          createdAt: c.messages[0].createdAt.toISOString(),
          href: `/social?openChat=${c.id}`,
        })),
      ...companyConversations
        .filter((c) => c.messages[0] && c.messages[0].seq > c.companyLastReadSeq)
        .map((c) => ({
          id: `conversation-${c.messages[0].id}`,
          type: "CONVERSATION_MESSAGE_FROM_REVIEWER" as NotificationType,
          companyName: c.company.name,
          companySlug: c.company.slug,
          createdAt: c.messages[0].createdAt.toISOString(),
          href: `/social?openChat=${c.id}`,
        })),
    ];

    events.push(...(await this.reviewClaimAndOwnerEvents(userId, myReviews, ownedCompanyIds)));
    if (socialQuestionsEnabled()) events.push(...(await this.questionEvents(userId, ownedCompanyIds)));
    events.push(...(await this.scheduledPostEvents(ownedCompanyIds)));
    events.push(...(await this.ratingRiseEvents(myReviews)));

    events.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const latest = events.slice(0, MAX_NOTIFICATIONS);
    const reads =
      latest.length > 0
        ? await this.prisma.notificationRead.findMany({
            where: { userId, notificationId: { in: latest.map((e) => e.id) } },
            select: { notificationId: true },
          })
        : [];
    const readIds = new Set(reads.map((r) => r.notificationId));
    return latest.map((e) => ({ ...e, read: readIds.has(e.id) }));
  }

  /**
   * Remembers that this account read these notifications (one opened, or
   * every one shown for "Mark all as read"). Ids are opaque strings scoped
   * to the caller's own rows, so an id that isn't one of theirs just never
   * matches anything. Repeats are ignored.
   */
  async markRead(userId: string, ids: string[]): Promise<{ ok: true }> {
    await this.prisma.notificationRead.createMany({
      data: [...new Set(ids)].map((notificationId) => ({ userId, notificationId })),
      skipDuplicates: true,
    });
    return { ok: true };
  }

  /**
   * For an approved owner: scheduled IWT Social posts that could not go out
   * (see SocialScheduleService). Each stays until the owner gives the post a
   * new time or deletes it; it opens the dashboard section that says why.
   */
  private async scheduledPostEvents(ownedCompanyIds: string[]): Promise<NotificationEvent[]> {
    if (ownedCompanyIds.length === 0) return [];
    const failed = await this.prisma.scheduledSocialPost.findMany({
      where: { companyId: { in: ownedCompanyIds }, status: "FAILED" },
      select: { id: true, companyId: true, publishAt: true, company: { select: { name: true, slug: true } } },
      orderBy: { publishAt: "desc" },
      take: MAX_NOTIFICATIONS,
    });
    const now = Date.now();
    return failed.map((p) => ({
      id: `scheduled-post-failed-${p.id}`,
      type: "SCHEDULED_POST_FAILED" as NotificationType,
      companyName: p.company.name,
      companySlug: p.company.slug,
      // The time it was due (never ahead of now, for a post sent out early by hand).
      createdAt: new Date(Math.min(p.publishAt.getTime(), now)).toISOString(),
      href: `/my/companies?company=${p.companyId}&category=social`,
    }));
  }

  /**
   * IWT Social Questions, last 30 days: answers to the caller's own
   * questions and - for an approved owner - questions put to their companies.
   * The asker's opens the question's own page; the owner's opens the
   * dashboard's Questions section, where it is answered and then hidden or
   * shown to everyone. Hour precision, like the question.
   */
  private async questionEvents(userId: string, ownedCompanyIds: string[]): Promise<NotificationEvent[]> {
    const since = new Date(Date.now() - RECENT_WINDOW_MS);
    const [answers, asked] = await Promise.all([
      this.prisma.socialAnswer.findMany({
        where: { question: { authorUserId: userId }, authorUserId: { not: userId }, createdAt: { gte: since } },
        select: { id: true, questionId: true, createdAt: true, question: { select: { company: { select: { name: true, slug: true } } } } },
        orderBy: { createdAt: "desc" },
        take: MAX_NOTIFICATIONS,
      }),
      ownedCompanyIds.length > 0
        ? this.prisma.socialQuestion.findMany({
            where: { companyId: { in: ownedCompanyIds }, createdAt: { gte: since } },
            select: { id: true, companyId: true, createdAt: true, company: { select: { name: true, slug: true } } },
            orderBy: { createdAt: "desc" },
            take: MAX_NOTIFICATIONS,
          })
        : Promise.resolve([]),
    ]);
    return [
      ...answers.map((a) => ({
        id: `question-answer-${a.id}`,
        type: "QUESTION_ANSWERED" as NotificationType,
        // Empty for a question put to a kind of work rather than a company.
        companyName: a.question.company?.name ?? "",
        companySlug: a.question.company?.slug ?? null,
        createdAt: toUtcHour(a.createdAt).toISOString(),
        href: `/social/questions/${a.questionId}`,
      })),
      ...asked.map((q) => ({
        id: `company-question-${q.id}`,
        type: "COMPANY_QUESTION_ASKED" as NotificationType,
        companyName: q.company?.name ?? "",
        companySlug: q.company?.slug ?? null,
        createdAt: toUtcHour(q.createdAt).toISOString(),
        href: `/my/companies?company=${q.companyId}&category=questions`,
      })),
    ];
  }

  /**
   * Review outcomes (from the caller's own reviews, already loaded), resolved
   * company claims, and - for approved owners only - new CV applications and
   * newly published reviews of their companies from the last 30 days.
   */
  /**
   * RATED_COMPANY_IMPROVING: for each company the caller reviewed (newest
   * reviews first, at most 10), compare the company's average back when the
   * review was published (every published review up to and including it)
   * with its average now. It fires when at least 3 reviews have come in
   * since, the average has risen by 0.3 or more, and it is now above the
   * score the caller gave - so they may want to look again and update their
   * rating. The id carries the current half-point step (3.5, 4.0, ...), so a
   * further rise notifies again but the same level never does twice. Dated
   * to the day, like COMPANY_REVIEWED, so it can't point at one new review.
   */
  private async ratingRiseEvents(
    myReviews: {
      id: string;
      status: string;
      publishedAt: Date | null;
      companyId: string;
      corporateCultureScore: number;
      leadershipScore: number;
      infrastructureScore: number;
      workLifeBalanceScore: number;
      stabilityScore: number;
      company: { name: string; slug: string };
    }[],
  ): Promise<NotificationEvent[]> {
    const published = myReviews
      .filter((r): r is typeof r & { publishedAt: Date } => r.status === "PUBLISHED" && r.publishedAt !== null)
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
      .slice(0, RATING_RISE_MAX_REVIEWS);
    if (published.length === 0) return [];

    const aggregates = await this.prisma.companyAggregateScore.findMany({
      where: { companyId: { in: published.map((r) => r.companyId) }, company: { hiddenAt: null } },
      select: { companyId: true, overallAvg: true, reviewCount: true, updatedAt: true },
    });
    const aggregateByCompany = new Map(aggregates.map((a) => [a.companyId, a]));

    const events: NotificationEvent[] = [];
    for (const review of published) {
      const now = aggregateByCompany.get(review.companyId);
      if (!now || now.reviewCount === 0) continue;
      const mine =
        (review.corporateCultureScore + review.leadershipScore + review.infrastructureScore + review.workLifeBalanceScore + review.stabilityScore) / 5;
      if (now.overallAvg <= mine) continue;

      const then = await this.prisma.review.aggregate({
        where: { companyId: review.companyId, status: "PUBLISHED", publishedAt: { lte: review.publishedAt } },
        _avg: {
          corporateCultureScore: true,
          leadershipScore: true,
          infrastructureScore: true,
          workLifeBalanceScore: true,
          stabilityScore: true,
        },
        _count: { _all: true },
      });
      const newer = now.reviewCount - then._count._all;
      if (newer < RATING_RISE_MIN_NEWER_REVIEWS) continue;
      const a = then._avg;
      const thenAvg =
        ((a.corporateCultureScore ?? 0) + (a.leadershipScore ?? 0) + (a.infrastructureScore ?? 0) + (a.workLifeBalanceScore ?? 0) + (a.stabilityScore ?? 0)) / 5;
      if (now.overallAvg - thenAvg < RATING_RISE_MIN) continue;

      events.push({
        id: `rating-up-${review.id}-${Math.floor(now.overallAvg * 2)}`,
        type: "RATED_COMPANY_IMPROVING" as NotificationType,
        companyName: review.company.name,
        companySlug: review.company.slug,
        createdAt: startOfUtcDay(now.updatedAt).toISOString(),
        href: reviewHref(review.company.slug, review.id),
      });
    }
    return events;
  }

  private async reviewClaimAndOwnerEvents(
    userId: string,
    myReviews: {
      id: string;
      status: string;
      publishedAt: Date | null;
      createdAt: Date;
      company: { name: string; slug: string };
    }[],
    ownedCompanyIds: string[],
  ): Promise<NotificationEvent[]> {
    const since = new Date(Date.now() - RECENT_WINDOW_MS);
    const owner = ownedCompanyIds.length > 0;
    const [claims, applications, companyReviews] = await Promise.all([
      this.prisma.companyOwner.findMany({
        where: { userId, claimStatus: { in: ["APPROVED", "REJECTED"] }, resolvedAt: { not: null } },
        select: { id: true, claimStatus: true, resolvedAt: true, company: { select: { name: true, slug: true } } },
        orderBy: { resolvedAt: "desc" },
        take: MAX_NOTIFICATIONS,
      }),
      owner
        ? this.prisma.jobApplication.findMany({
            where: { companyId: { in: ownedCompanyIds }, createdAt: { gte: since } },
            select: {
              id: true,
              companyId: true,
              createdAt: true,
              jobPosting: { select: { jobTitle: true } },
              company: { select: { name: true, slug: true } },
            },
            orderBy: { createdAt: "desc" },
            take: MAX_NOTIFICATIONS,
          })
        : Promise.resolve([]),
      owner
        ? this.prisma.review.findMany({
            where: {
              companyId: { in: ownedCompanyIds },
              userId: { not: userId },
              status: "PUBLISHED",
              publishedAt: { gte: since },
            },
            select: { id: true, publishedAt: true, company: { select: { name: true, slug: true } } },
            orderBy: { publishedAt: "desc" },
            take: MAX_NOTIFICATIONS,
          })
        : Promise.resolve([]),
    ]);

    return [
      ...myReviews
        .filter((r) => r.status === "PUBLISHED" && r.publishedAt)
        .map((r) => ({
          id: `review-published-${r.id}`,
          type: "REVIEW_PUBLISHED" as NotificationType,
          companyName: r.company.name,
          companySlug: r.company.slug,
          createdAt: r.publishedAt!.toISOString(),
          href: reviewHref(r.company.slug, r.id),
        })),
      ...myReviews
        .filter((r) => r.status === "REJECTED")
        .map((r) => ({
          id: `review-rejected-${r.id}`,
          type: "REVIEW_NOT_PUBLISHED" as NotificationType,
          companyName: r.company.name,
          companySlug: r.company.slug,
          createdAt: r.createdAt.toISOString(),
          // Not public, so it opens on the reviewer's own My Ratings page.
          href: `/me/reviews?review=${r.id}`,
        })),
      ...claims.map((c) => ({
        id: `claim-${c.id}`,
        type: (c.claimStatus === "APPROVED" ? "CLAIM_APPROVED" : "CLAIM_REJECTED") as NotificationType,
        companyName: c.company.name,
        companySlug: c.company.slug,
        createdAt: (c.resolvedAt ?? new Date()).toISOString(),
        href: c.claimStatus === "APPROVED" ? "/my/companies" : `/companies/${c.company.slug}`,
      })),
      ...applications.map((a) => ({
        id: `application-${a.id}`,
        type: "JOB_APPLICATION_RECEIVED" as NotificationType,
        companyName: a.company.name,
        companySlug: a.company.slug,
        createdAt: a.createdAt.toISOString(),
        jobTitle: a.jobPosting.jobTitle,
        href: `/my/companies?category=applications&company=${a.companyId}`,
      })),
      ...companyReviews.map((r) => ({
        id: `company-review-${r.id}`,
        type: "COMPANY_REVIEWED" as NotificationType,
        companyName: r.company.name,
        companySlug: r.company.slug,
        createdAt: startOfUtcDay(r.publishedAt!).toISOString(),
        href: reviewHref(r.company.slug, r.id),
      })),
    ];
  }
}

import { Injectable } from "@nestjs/common";
import type { Notification, NotificationType } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { daysRemaining } from "../job-postings/job-postings.util";

const MAX_NOTIFICATIONS = 30;

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
   * dropdown opens. No read/unread state yet, just the most recent events
   * across all sources.
   */
  async list(userId: string): Promise<Notification[]> {
    const myReviews = await this.prisma.review.findMany({
      where: { userId },
      select: { id: true, company: { select: { name: true, slug: true } } },
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

    const events: Notification[] = [
      ...votes.map((v) => ({
        id: `vote-${v.id}`,
        type: (v.value === 1 ? "VOTE_HELPFUL" : "VOTE_NOT_HELPFUL") as NotificationType,
        companyName: companyByReview.get(v.reviewId)?.name ?? "",
        companySlug: companyByReview.get(v.reviewId)?.slug ?? null,
        createdAt: v.createdAt.toISOString(),
      })),
      ...replies.map((r) => ({
        id: `reply-${r.id}`,
        type: "COMPANY_REPLY" as NotificationType,
        companyName: companyByReview.get(r.reviewId)?.name ?? "",
        companySlug: companyByReview.get(r.reviewId)?.slug ?? null,
        createdAt: r.createdAt.toISOString(),
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
        createdAt: p.createdAt.toISOString(),
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
      ...myConversations
        .filter((c) => c.messages[0] && c.messages[0].seq > c.reviewerLastReadSeq)
        .map((c) => ({
          id: `conversation-${c.messages[0].id}`,
          type: "CONVERSATION_MESSAGE_FROM_COMPANY" as NotificationType,
          companyName: c.company.name,
          companySlug: c.company.slug,
          createdAt: c.messages[0].createdAt.toISOString(),
          href: `/me?tab=messages&c=${c.id}`,
        })),
      ...companyConversations
        .filter((c) => c.messages[0] && c.messages[0].seq > c.companyLastReadSeq)
        .map((c) => ({
          id: `conversation-${c.messages[0].id}`,
          type: "CONVERSATION_MESSAGE_FROM_REVIEWER" as NotificationType,
          companyName: c.company.name,
          companySlug: c.company.slug,
          createdAt: c.messages[0].createdAt.toISOString(),
          href: `/my/companies?category=messages&company=${c.companyId}&c=${c.id}`,
        })),
    ];

    events.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return events.slice(0, MAX_NOTIFICATIONS);
  }
}

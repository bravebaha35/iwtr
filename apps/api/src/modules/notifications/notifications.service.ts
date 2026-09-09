import { Injectable } from "@nestjs/common";
import type { Notification, NotificationType } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";

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

    const [votes, replies, jobPostings, followedStatusUpdates, followedPosts, followedHiring] = await Promise.all([
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
        ? this.prisma.jobPosting.findMany({
            where: { companyId: { in: followedCompanyIds }, status: "PUBLISHED", company: { hiddenAt: null } },
            select: { id: true, createdAt: true, company: { select: { name: true, slug: true } } },
            orderBy: { createdAt: "desc" },
            take: MAX_NOTIFICATIONS,
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
    ];

    events.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return events.slice(0, MAX_NOTIFICATIONS);
  }
}

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
   * reviews every time the dropdown opens, then merged and re-sorted. No
   * read/unread state yet, just the most recent events across both sources.
   */
  async list(userId: string): Promise<Notification[]> {
    const myReviews = await this.prisma.review.findMany({
      where: { userId },
      select: { id: true, company: { select: { name: true, slug: true } } },
    });
    if (myReviews.length === 0) return [];

    const reviewIds = myReviews.map((r) => r.id);
    const companyByReview = new Map(myReviews.map((r) => [r.id, r.company]));

    const [votes, replies] = await Promise.all([
      this.prisma.reviewVote.findMany({
        where: { reviewId: { in: reviewIds } },
        orderBy: { createdAt: "desc" },
        take: MAX_NOTIFICATIONS,
      }),
      this.prisma.companyReply.findMany({
        where: { reviewId: { in: reviewIds } },
        orderBy: { createdAt: "desc" },
        take: MAX_NOTIFICATIONS,
      }),
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
    ];

    events.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return events.slice(0, MAX_NOTIFICATIONS);
  }
}

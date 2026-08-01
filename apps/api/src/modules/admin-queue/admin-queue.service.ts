import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { AdminQueueItem, QueueStatus } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ReviewsService } from "../reviews/reviews.service";
import { PiiVaultService } from "../pii-vault/pii-vault.service";

@Injectable()
export class AdminQueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewsService,
    private readonly piiVault: PiiVaultService,
  ) {}

  async list(status: QueueStatus = "OPEN"): Promise<AdminQueueItem[]> {
    const items = await this.prisma.moderationQueueItem.findMany({
      where: { status },
      orderBy: { createdAt: "asc" },
      include: { review: { include: { company: true } } },
    });

    return items.map((item) => ({
      id: item.id,
      reviewId: item.reviewId,
      reason: item.reason as AdminQueueItem["reason"],
      aiSummary: item.aiSummary,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      companyName: item.review.company.name,
      review: {
        corporateCultureScore: item.review.corporateCultureScore,
        corporateCultureComment: item.review.corporateCultureComment,
        leadershipScore: item.review.leadershipScore,
        leadershipComment: item.review.leadershipComment,
        infrastructureScore: item.review.infrastructureScore,
        infrastructureComment: item.review.infrastructureComment,
        workLifeBalanceScore: item.review.workLifeBalanceScore,
        workLifeBalanceComment: item.review.workLifeBalanceComment,
        stabilityScore: item.review.stabilityScore,
        stabilityComment: item.review.stabilityComment,
        generalThoughts: item.review.generalThoughts,
      },
    }));
  }

  async approve(id: string): Promise<void> {
    const item = await this.getOpenItemOrThrow(id);

    const priorPublished = await this.prisma.review.count({
      where: { userId: item.review.userId, status: "PUBLISHED" },
    });

    await this.prisma.review.update({
      where: { id: item.reviewId },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
    await this.prisma.moderationQueueItem.update({
      where: { id },
      data: { status: "APPROVED", resolvedAt: new Date() },
    });

    await this.reviews.recomputeAggregate(item.review.companyId);
    if (priorPublished === 0) {
      await this.piiVault.purgeTcKimlikNoIfPresent(item.review.userId);
    }
  }

  async reject(id: string): Promise<void> {
    const item = await this.getOpenItemOrThrow(id);
    await this.prisma.review.update({ where: { id: item.reviewId }, data: { status: "REJECTED" } });
    await this.prisma.moderationQueueItem.update({
      where: { id },
      data: { status: "REJECTED", resolvedAt: new Date() },
    });
  }

  async requestSgkDoc(id: string): Promise<void> {
    await this.getOpenItemOrThrow(id);
    await this.prisma.moderationQueueItem.update({
      where: { id },
      data: { status: "ASKED_FOR_SGK_DOC" },
    });
  }

  private async getOpenItemOrThrow(id: string) {
    const item = await this.prisma.moderationQueueItem.findUnique({
      where: { id },
      include: { review: true },
    });
    if (!item) throw new NotFoundException("Queue item not found");
    if (item.status === "APPROVED" || item.status === "REJECTED") {
      throw new BadRequestException("This queue item has already been resolved");
    }
    return item;
  }
}

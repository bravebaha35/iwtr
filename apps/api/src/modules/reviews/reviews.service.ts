import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import type { CreateReviewInput, MyEmploymentEntry, SubmitReviewResult } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ModerationService } from "../moderation/moderation.service";
import { PiiVaultService } from "../pii-vault/pii-vault.service";

const AUTO_PUBLISH_THRESHOLD = 0.8;
const MID_THRESHOLD = 0.5;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
    private readonly piiVault: PiiVaultService,
  ) {}

  async myEmploymentHistory(userId: string): Promise<MyEmploymentEntry[]> {
    const entries = await this.prisma.employmentHistory.findMany({
      where: { userId },
      include: { company: true, reviews: { select: { id: true } } },
      orderBy: { createdAt: "asc" },
    });

    return entries.map((e) => ({
      id: e.id,
      rawCompanyName: e.rawCompanyName,
      companyId: e.companyId,
      companySlug: e.company?.slug ?? null,
      hasReview: e.reviews.length > 0,
    }));
  }

  async submitReview(userId: string, input: CreateReviewInput): Promise<SubmitReviewResult> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.status !== "ACTIVE") {
      throw new ForbiddenException("Complete onboarding before submitting a review");
    }

    const employment = await this.prisma.employmentHistory.findUnique({
      where: { id: input.employmentHistoryId },
    });
    if (!employment || employment.userId !== userId || employment.companyId !== input.companyId) {
      throw new ForbiddenException(
        "You can only rate a company that appears in your own employment history",
      );
    }

    const existing = await this.prisma.review.findUnique({
      where: { userId_companyId: { userId, companyId: input.companyId } },
    });
    if (existing) {
      throw new ConflictException("You have already reviewed this company");
    }

    const contentCheck = this.moderation.checkContent([
      input.corporateCultureComment ?? "",
      input.leadershipComment ?? "",
      input.infrastructureComment ?? "",
      input.workLifeBalanceComment ?? "",
      input.stabilityComment ?? "",
      input.generalThoughts ?? "",
    ]);

    if (contentCheck.violates && contentCheck.confidence >= 0.9) {
      throw new BadRequestException({
        message: `Your review couldn't be published: ${contentCheck.violationTypes.join(", ")}. Please remove any names, job titles, or inappropriate language and try again.`,
        violationTypes: contentCheck.violationTypes,
      });
    }

    const [priorPublished, priorRejected] = await Promise.all([
      this.prisma.review.count({ where: { userId, status: "PUBLISHED" } }),
      this.prisma.review.count({ where: { userId, status: "REJECTED" } }),
    ]);

    const accountAgeDays = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const employmentDatesPlausible =
      !employment.startDate ||
      !employment.endDate ||
      employment.startDate <= employment.endDate;

    const trustScore = this.moderation.scoreTrust({
      accountAgeDays,
      priorPublishedReviewCount: priorPublished,
      priorRejectedReviewCount: priorRejected,
      employmentDatesPlausible,
    });

    let status: "PUBLISHED" | "PENDING_ADMIN_REVIEW";
    let queueReason: "CONTENT_FLAGGED" | "LOW_TRUST_SCORE" | "NEW_USER" | null = null;

    if (contentCheck.violates) {
      status = "PENDING_ADMIN_REVIEW";
      queueReason = "CONTENT_FLAGGED";
    } else if (trustScore.score >= AUTO_PUBLISH_THRESHOLD) {
      status = "PUBLISHED";
    } else if (trustScore.score >= MID_THRESHOLD) {
      status = "PENDING_ADMIN_REVIEW";
      queueReason = "LOW_TRUST_SCORE";
    } else {
      status = "PENDING_ADMIN_REVIEW";
      queueReason = priorPublished === 0 ? "NEW_USER" : "LOW_TRUST_SCORE";
    }

    const review = await this.prisma.review.create({
      data: {
        userId,
        companyId: input.companyId,
        employmentHistoryId: input.employmentHistoryId,
        corporateCultureScore: input.corporateCultureScore,
        corporateCultureComment: input.corporateCultureComment,
        leadershipScore: input.leadershipScore,
        leadershipComment: input.leadershipComment,
        infrastructureScore: input.infrastructureScore,
        infrastructureComment: input.infrastructureComment,
        workLifeBalanceScore: input.workLifeBalanceScore,
        workLifeBalanceComment: input.workLifeBalanceComment,
        stabilityScore: input.stabilityScore,
        stabilityComment: input.stabilityComment,
        generalThoughts: input.generalThoughts,
        status,
        aiModerationScore: contentCheck.confidence,
        aiTrustScore: trustScore.score,
        moderationDetails: { contentCheck, trustScore } as object,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
      },
    });

    if (queueReason) {
      await this.prisma.moderationQueueItem.create({
        data: {
          reviewId: review.id,
          reason: queueReason,
          aiSummary: `Content check: ${JSON.stringify(contentCheck)}. Trust score: ${trustScore.score.toFixed(2)} (${trustScore.factors.join(", ")}).`,
        },
      });
    }

    if (status === "PUBLISHED") {
      await this.recomputeAggregate(input.companyId);
      if (priorPublished === 0) {
        await this.piiVault.purgeTcKimlikNoIfPresent(userId);
      }
    }

    return {
      reviewId: review.id,
      status,
      message:
        status === "PUBLISHED"
          ? "Your review is live."
          : "Your review is being reviewed before publishing. This usually takes a short while.",
    };
  }

  async recomputeAggregate(companyId: string): Promise<void> {
    const published = await this.prisma.review.findMany({
      where: { companyId, status: "PUBLISHED" },
      select: {
        corporateCultureScore: true,
        leadershipScore: true,
        infrastructureScore: true,
        workLifeBalanceScore: true,
        stabilityScore: true,
      },
    });

    const count = published.length;
    const avg = (key: keyof (typeof published)[number]) =>
      count === 0 ? 0 : published.reduce((sum, r) => sum + r[key], 0) / count;

    const corporateCultureAvg = avg("corporateCultureScore");
    const leadershipAvg = avg("leadershipScore");
    const infrastructureAvg = avg("infrastructureScore");
    const workLifeBalanceAvg = avg("workLifeBalanceScore");
    const stabilityAvg = avg("stabilityScore");
    const overallAvg =
      count === 0
        ? 0
        : (corporateCultureAvg + leadershipAvg + infrastructureAvg + workLifeBalanceAvg + stabilityAvg) / 5;

    await this.prisma.companyAggregateScore.upsert({
      where: { companyId },
      create: {
        companyId,
        overallAvg,
        corporateCultureAvg,
        leadershipAvg,
        infrastructureAvg,
        workLifeBalanceAvg,
        stabilityAvg,
        reviewCount: count,
      },
      update: {
        overallAvg,
        corporateCultureAvg,
        leadershipAvg,
        infrastructureAvg,
        workLifeBalanceAvg,
        stabilityAvg,
        reviewCount: count,
      },
    });
  }
}

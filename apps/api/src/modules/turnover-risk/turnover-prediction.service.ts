import { ForbiddenException, Injectable } from "@nestjs/common";
import type { WorkplaceType } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { FlagCalculatorService } from "../flags/flag-calculator.service";
import { getQuestionsFor } from "../reviews/survey-questions.data";
import { tallyQuestions } from "../reviews/survey-tally.util";
import { computeTurnoverRisk, type TurnoverRiskAssessment } from "./turnover-risk.util";

const HAZARD_CATEGORIES = new Set(["stability", "workLifeBalance"]);

export interface SectorTurnoverRisk {
  // 0-100, review-count-weighted across the sector's workplace types.
  turnoverRiskPercentage: number;
  spikeDetected: boolean;
  sampleSizeWarning: boolean;
  reviewsInWindow: number;
  // Plain-language reading of the numbers above, printed in the PDF.
  explanation: string;
}

type ReviewForRisk = { workplaceType: WorkplaceType; surveyAnswers: unknown; publishedAt: Date | null };

@Injectable()
export class TurnoverPredictionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flagCalculator: FlagCalculatorService,
  ) {}

  /**
   * Owner-only: assesses the caller's own company's turnover risk for one
   * workplaceType, as of now. Splits the trailing 12 published-review
   * months into "recent quarter" (last 3 months) vs. "baseline" (the 9
   * months before that) and hands both to the pure computeTurnoverRisk.
   */
  async assessRisk(userId: string, companyId: string, workplaceType: WorkplaceType): Promise<TurnoverRiskAssessment> {
    await this.requireApprovedOwnership(userId, companyId);

    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const reviews = await this.prisma.review.findMany({
      where: {
        companyId,
        workplaceType,
        status: "PUBLISHED",
        publishedAt: { gte: twelveMonthsAgo, lt: now },
      },
      select: { surveyAnswers: true, publishedAt: true },
    });

    return this.assessFromReviews(workplaceType, reviews, threeMonthsAgo);
  }

  /**
   * Sector-wide turnover risk for the Sector Benchmark Report: the same
   * model as assessRisk, run over every company's reviews in the sector
   * pooled together, once per workplace type (each has its own question
   * set), then averaged weighted by how many reviews each type has. Pure —
   * the caller passes in the already-scoped PUBLISHED reviews.
   */
  assessSectorRisk(reviews: ReviewForRisk[], now: Date = new Date()): SectorTurnoverRisk {
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const inWindow = reviews.filter((r) => r.publishedAt && r.publishedAt >= twelveMonthsAgo && r.publishedAt < now);
    const byType = new Map<WorkplaceType, ReviewForRisk[]>();
    for (const review of inWindow) {
      byType.set(review.workplaceType, [...(byType.get(review.workplaceType) ?? []), review]);
    }

    const assessments = [...byType.entries()].map(([workplaceType, typeReviews]) => ({
      weight: typeReviews.length,
      assessment: this.assessFromReviews(workplaceType, typeReviews, threeMonthsAgo),
    }));
    const totalWeight = assessments.reduce((sum, a) => sum + a.weight, 0);
    const turnoverRiskPercentage =
      totalWeight === 0
        ? 0
        : Math.round(assessments.reduce((sum, a) => sum + a.assessment.turnoverRiskPercentage * a.weight, 0) / totalWeight);
    const spikeDetected = assessments.some((a) => a.assessment.spikeDetected);
    const sampleSizeWarning = inWindow.length < 5;

    return {
      turnoverRiskPercentage,
      spikeDetected,
      sampleSizeWarning,
      reviewsInWindow: inWindow.length,
      explanation: explainSectorRisk(turnoverRiskPercentage, spikeDetected, sampleSizeWarning, inWindow.length),
    };
  }

  private assessFromReviews(
    workplaceType: WorkplaceType,
    reviews: { surveyAnswers: unknown; publishedAt: Date | null }[],
    threeMonthsAgo: Date,
  ): TurnoverRiskAssessment {
    const recentReviews = reviews.filter((r) => r.publishedAt! >= threeMonthsAgo);
    const baselineReviews = reviews.filter((r) => r.publishedAt! < threeMonthsAgo);

    const hazardQuestions = getQuestionsFor(workplaceType).filter((q) => HAZARD_CATEGORIES.has(q.category));
    const recentTallies = tallyQuestions(recentReviews, hazardQuestions);
    const baselineTallies = tallyQuestions(baselineReviews, hazardQuestions);

    return computeTurnoverRisk(this.flagCalculator, workplaceType, recentTallies, baselineTallies, reviews.length);
  }

  // Duplicated rather than cross-imported from OwnerService — matches this
  // codebase's existing module-per-feature convention (see e.g. the
  // company-reply feature's own ownership check).
  private async requireApprovedOwnership(userId: string, companyId: string) {
    const ownership = await this.prisma.companyOwner.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!ownership || ownership.claimStatus !== "APPROVED") {
      throw new ForbiddenException("You are not an approved owner of this company");
    }
    return ownership;
  }
}

/**
 * The "dynamic risk score explanation" printed under the sector's turnover
 * risk in the Sector Benchmark Report — a reading of the numbers, not new
 * information.
 */
export function explainSectorRisk(
  percentage: number,
  spikeDetected: boolean,
  sampleSizeWarning: boolean,
  reviewsInWindow: number,
): string {
  const level = percentage >= 50 ? "high" : percentage >= 25 ? "moderate" : "low";
  const parts = [
    `${percentage}% of the sector's staff-retention warning signs (job stability and work-life balance) ` +
      `are currently red in the last three months of reviews, which reads as a ${level} risk of people leaving.`,
  ];
  parts.push(
    spikeDetected
      ? "This is noticeably worse than the nine months before, so the risk is rising."
      : "This is in line with the nine months before, with no sudden rise.",
  );
  if (sampleSizeWarning) {
    parts.push(
      `Only ${reviewsInWindow} review${reviewsInWindow === 1 ? "" : "s"} fall in the last 12 months, so treat this figure as a rough indication.`,
    );
  }
  return parts.join(" ");
}

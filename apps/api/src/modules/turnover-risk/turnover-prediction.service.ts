import { ForbiddenException, Injectable } from "@nestjs/common";
import type { WorkplaceType } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { FlagCalculatorService } from "../flags/flag-calculator.service";
import { getQuestionsFor } from "../reviews/survey-questions.data";
import { tallyQuestions } from "../reviews/survey-tally.util";
import { computeTurnoverRisk, type TurnoverRiskAssessment } from "./turnover-risk.util";

const HAZARD_CATEGORIES = new Set(["stability", "workLifeBalance"]);

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

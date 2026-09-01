import { Injectable, NotFoundException } from "@nestjs/common";
import type { CategoryKey, CompanyNarrative, WorkplaceType } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { getQuestionsFor } from "../reviews/survey-questions.data";
import { tallyQuestions } from "../reviews/survey-tally.util";
import { FlagCalculatorService } from "../flags/flag-calculator.service";
import { PatternGeneratorService, type PatternRow } from "./pattern-generator.service";
import { PATTERN_ENGINE_VERSION, PROMPT_VERSION, buildNumbersLine } from "./numbers-line";

export const MIN_REVIEWS_FOR_AI = 3;
export const STALE_AFTER_DAYS = 30;
export const STALE_REVIEW_DELTA = 3;

type ReviewScoreRow = {
  surveyAnswers: unknown;
  corporateCultureScore: number;
  leadershipScore: number;
  infrastructureScore: number;
  workLifeBalanceScore: number;
  stabilityScore: number;
};

@Injectable()
export class CompanyNarrativeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flagCalculator: FlagCalculatorService,
    private readonly patternGenerator: PatternGeneratorService,
  ) {}

  async getNarrative(slug: string): Promise<CompanyNarrative> {
    const company = await this.prisma.company.findUnique({
      where: { slug },
      select: { id: true, slug: true, workplaceTypes: true },
    });
    if (!company) {
      throw new NotFoundException("Company not found");
    }

    const workplaceType = company.workplaceTypes[0] as WorkplaceType;

    const reviewCount = await this.prisma.review.count({
      where: { companyId: company.id, status: "PUBLISHED", workplaceType },
    });
    if (reviewCount < MIN_REVIEWS_FOR_AI) {
      return { workplaceType, reviewCount, description: null };
    }

    const stored = await this.prisma.companyNarrative.findUnique({
      where: { companyId_workplaceType: { companyId: company.id, workplaceType } },
    });

    if (stored && !this.isStale(stored, reviewCount)) {
      return { workplaceType, reviewCount, description: stored.description };
    }

    // Only now — past the fresh-row and N<3 early returns — load every
    // published review row. Each one carries a surveyAnswers JSON blob, so
    // this is the expensive query the two returns above deliberately skip.
    const reviews = (await this.prisma.review.findMany({
      where: { companyId: company.id, status: "PUBLISHED", workplaceType },
      select: {
        surveyAnswers: true,
        corporateCultureScore: true,
        leadershipScore: true,
        infrastructureScore: true,
        workLifeBalanceScore: true,
        stabilityScore: true,
      },
    })) as ReviewScoreRow[];

    const questions = tallyQuestions(reviews.map((r) => ({ surveyAnswers: r.surveyAnswers })), getQuestionsFor(workplaceType));
    const flags = this.flagCalculator.computeVibeFlags({ workplaceType, totalReviews: reviewCount, questions });
    const patterns = await this.loadPatterns(workplaceType);

    const assembled = this.patternGenerator.generate({ workplaceType, questions, flags, patterns });

    if (assembled) {
      await this.prisma.companyNarrative.upsert({
        where: { companyId_workplaceType: { companyId: company.id, workplaceType } },
        create: {
          companyId: company.id,
          workplaceType,
          description: assembled,
          reviewCountAtGen: reviewCount,
          model: PATTERN_ENGINE_VERSION,
          promptVersion: PROMPT_VERSION,
        },
        update: {
          description: assembled,
          reviewCountAtGen: reviewCount,
          model: PATTERN_ENGINE_VERSION,
          promptVersion: PROMPT_VERSION,
          generatedAt: new Date(),
        },
      });
      return { workplaceType, reviewCount, description: assembled };
    }

    // No SummaryPattern content authored yet for this workplaceType — content
    // gap, not an error. Serve whatever's cached, else the plain numbers line.
    if (stored) {
      return { workplaceType, reviewCount, description: stored.description };
    }
    const categories = this.categoryAverages(reviews);
    const overall =
      (categories.corporateCulture + categories.leadership + categories.infrastructure + categories.workLifeBalance + categories.stability) / 5;
    return { workplaceType, reviewCount, description: buildNumbersLine({ workplaceType, overall, categories, reviewCount }) };
  }

  private async loadPatterns(workplaceType: WorkplaceType): Promise<PatternRow[]> {
    const rows = await this.prisma.summaryPattern.findMany({ where: { workplaceType } });
    return rows.map((r) => ({ id: r.id, category: r.category, qnaKey: r.qnaKey, flagKey: r.flagKey, textBlock: r.textBlock }));
  }

  private categoryAverages(reviews: ReviewScoreRow[]): Record<CategoryKey, number> {
    const n = reviews.length;
    const sum = (pick: (r: ReviewScoreRow) => number) => reviews.reduce((acc, r) => acc + pick(r), 0);
    return {
      corporateCulture: sum((r) => r.corporateCultureScore) / n,
      leadership: sum((r) => r.leadershipScore) / n,
      infrastructure: sum((r) => r.infrastructureScore) / n,
      workLifeBalance: sum((r) => r.workLifeBalanceScore) / n,
      stability: sum((r) => r.stabilityScore) / n,
    };
  }

  private isStale(
    row: { reviewCountAtGen: number; model: string; promptVersion: number; generatedAt: Date },
    currentReviewCount: number,
  ): boolean {
    if (row.model !== PATTERN_ENGINE_VERSION) return true;
    if (row.promptVersion !== PROMPT_VERSION) return true;
    if (currentReviewCount - row.reviewCountAtGen >= STALE_REVIEW_DELTA) return true;
    const ageDays = (Date.now() - row.generatedAt.getTime()) / (1000 * 60 * 60 * 24);
    return ageDays > STALE_AFTER_DAYS;
  }
}

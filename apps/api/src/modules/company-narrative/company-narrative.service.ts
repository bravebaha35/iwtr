import { Injectable, NotFoundException } from "@nestjs/common";
import type { CategoryKey, CompanyNarrative, WorkplaceType } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { getQuestionsFor } from "../reviews/survey-questions.data";
import { tallyQuestions } from "../reviews/survey-tally.util";
import { NarrativeGeneratorService } from "./narrative-generator.service";
import {
  NARRATIVE_MODEL,
  PROMPT_VERSION,
  buildNumbersLine,
  buildUserMessage,
  clampToLimit,
} from "./company-narrative.prompt";

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
    private readonly generator: NarrativeGeneratorService,
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

    const categories = this.categoryAverages(reviews);
    const overall =
      (categories.corporateCulture +
        categories.leadership +
        categories.infrastructure +
        categories.workLifeBalance +
        categories.stability) /
      5;

    if (this.generator.available) {
      try {
        const questions = tallyQuestions(
          reviews.map((r) => ({ surveyAnswers: r.surveyAnswers })),
          getQuestionsFor(workplaceType),
        );
        const raw = await this.generator.generate(
          buildUserMessage({ workplaceType, overall, categories, reviewCount, questions }),
        );
        const description = clampToLimit(raw);
        if (description.length > 0) {
          await this.prisma.companyNarrative.upsert({
            where: { companyId_workplaceType: { companyId: company.id, workplaceType } },
            create: {
              companyId: company.id,
              workplaceType,
              description,
              reviewCountAtGen: reviewCount,
              model: NARRATIVE_MODEL,
              promptVersion: PROMPT_VERSION,
            },
            update: {
              description,
              reviewCountAtGen: reviewCount,
              model: NARRATIVE_MODEL,
              promptVersion: PROMPT_VERSION,
              generatedAt: new Date(),
            },
          });
          return { workplaceType, reviewCount, description };
        }
        // eslint-disable-next-line no-console
        console.error(`[company-narrative] empty description after clamp for company=${company.slug}`);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[company-narrative] generation failed for company=${company.slug}`, err);
        // fall through to stored copy / numbers line
      }
    }

    if (stored) {
      return { workplaceType, reviewCount, description: stored.description };
    }
    return {
      workplaceType,
      reviewCount,
      description: buildNumbersLine({ workplaceType, overall, categories, reviewCount }),
    };
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
    if (row.model !== NARRATIVE_MODEL) return true;
    if (row.promptVersion !== PROMPT_VERSION) return true;
    if (currentReviewCount - row.reviewCountAtGen >= STALE_REVIEW_DELTA) return true;
    const ageDays = (Date.now() - row.generatedAt.getTime()) / (1000 * 60 * 60 * 24);
    return ageDays > STALE_AFTER_DAYS;
  }
}

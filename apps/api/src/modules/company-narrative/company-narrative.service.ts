import { Injectable } from "@nestjs/common";
import type { CategoryKey, CompanyNarrative, WorkplaceType } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { assertCompanyVisibleOrThrow } from "../companies/company-visibility";
import { getQuestionsFor } from "../reviews/survey-questions.data";
import { tallyQuestions } from "../reviews/survey-tally.util";
import { SUMMARY_ENGINE_VERSION, composeSummary, scoreBandFor } from "./summary-composer";

export const MIN_REVIEWS_FOR_SUMMARY = 3;
// Kept for the CompanyNarrative.promptVersion column; bump to rewrite every
// stored summary after a wording change in summary-phrases.data.ts.
export const SUMMARY_TEXT_VERSION = 1;

type ReviewScoreRow = {
  surveyAnswers: unknown;
  corporateCultureScore: number;
  leadershipScore: number;
  infrastructureScore: number;
  workLifeBalanceScore: number;
  stabilityScore: number;
};

/**
 * The company page's Summary (2026-10-25). Built by composeSummary from the
 * survey answers of the company's main work type, in English and Turkish,
 * once it has 3 published reviews of that type.
 *
 * It is written for the company's score band (the Rating Breakdown's
 * overall average: under 2, 2.x, 3.x, 4+) and then kept as it is: new
 * reviews do not change it until the average crosses into another band
 * (3.7 -> 4.0), which is when it is written again. The owner's decision, so
 * the summary reads as a settled verdict rather than shifting with every
 * review.
 */
@Injectable()
export class CompanyNarrativeService {
  constructor(private readonly prisma: PrismaService) {}

  async getNarrative(slug: string): Promise<CompanyNarrative> {
    const company = await this.prisma.company.findUnique({
      where: { slug },
      select: { id: true, slug: true, workplaceTypes: true, hiddenAt: true },
    });
    // A hidden company 404s on every public read, this one included.
    assertCompanyVisibleOrThrow(company);

    const workplaceType = company.workplaceTypes[0] as WorkplaceType;
    const empty = { workplaceType, reviewCount: 0, description: null, descriptionTr: null };

    const reviewCount = await this.prisma.review.count({
      where: { companyId: company.id, status: "PUBLISHED", workplaceType },
    });
    if (reviewCount < MIN_REVIEWS_FOR_SUMMARY) return { ...empty, reviewCount };

    const [aggregate, stored] = await Promise.all([
      this.prisma.companyAggregateScore.findUnique({ where: { companyId: company.id }, select: { overallAvg: true } }),
      this.prisma.companyNarrative.findUnique({
        where: { companyId_workplaceType: { companyId: company.id, workplaceType } },
      }),
    ]);

    // Only now load the published reviews (each carries its survey answers):
    // a summary still valid for the current band skips this entirely, unless
    // there is no aggregate row to read the band from.
    let reviews: ReviewScoreRow[] | null = null;
    const loadReviews = async () =>
      (reviews ??= (await this.prisma.review.findMany({
        where: { companyId: company.id, status: "PUBLISHED", workplaceType },
        select: {
          surveyAnswers: true,
          corporateCultureScore: true,
          leadershipScore: true,
          infrastructureScore: true,
          workLifeBalanceScore: true,
          stabilityScore: true,
        },
      })) as ReviewScoreRow[]);

    const overall = aggregate?.overallAvg ?? overallOf(categoryAverages(await loadReviews()));
    const band = scoreBandFor(overall);

    if (
      stored &&
      stored.model === SUMMARY_ENGINE_VERSION &&
      stored.promptVersion === SUMMARY_TEXT_VERSION &&
      stored.scoreBand === band &&
      stored.descriptionTr
    ) {
      return { workplaceType, reviewCount, description: stored.description, descriptionTr: stored.descriptionTr };
    }

    const rows = await loadReviews();
    const questions = tallyQuestions(
      rows.map((r) => ({ surveyAnswers: r.surveyAnswers })),
      getQuestionsFor(workplaceType),
    );
    const summary = composeSummary({ workplaceType, band, questions, categoryAverages: categoryAverages(rows) });

    const data = {
      description: summary.en,
      descriptionTr: summary.tr,
      scoreBand: band,
      reviewCountAtGen: reviewCount,
      model: SUMMARY_ENGINE_VERSION,
      promptVersion: SUMMARY_TEXT_VERSION,
    };
    await this.prisma.companyNarrative.upsert({
      where: { companyId_workplaceType: { companyId: company.id, workplaceType } },
      create: { companyId: company.id, workplaceType, ...data },
      update: { ...data, generatedAt: new Date() },
    });
    return { workplaceType, reviewCount, description: summary.en, descriptionTr: summary.tr };
  }
}

function categoryAverages(reviews: ReviewScoreRow[]): Record<CategoryKey, number> {
  const n = Math.max(1, reviews.length);
  const avg = (pick: (r: ReviewScoreRow) => number) => reviews.reduce((acc, r) => acc + pick(r), 0) / n;
  return {
    corporateCulture: avg((r) => r.corporateCultureScore),
    leadership: avg((r) => r.leadershipScore),
    infrastructure: avg((r) => r.infrastructureScore),
    workLifeBalance: avg((r) => r.workLifeBalanceScore),
    stability: avg((r) => r.stabilityScore),
  };
}

function overallOf(c: Record<CategoryKey, number>): number {
  return (c.corporateCulture + c.leadership + c.infrastructure + c.workLifeBalance + c.stability) / 5;
}

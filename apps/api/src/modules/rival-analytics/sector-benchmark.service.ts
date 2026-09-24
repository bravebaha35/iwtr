import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { BenefitKey, SalaryBand, WorkplaceType } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { getQuestionsFor } from "../reviews/survey-questions.data";
import { tallyQuestions } from "../reviews/survey-tally.util";
import { TurnoverPredictionService, type SectorTurnoverRisk } from "../turnover-risk/turnover-prediction.service";
import {
  assertKAnonymity,
  benefitsDistribution,
  toSalaryBands,
  topAgreedAndDisagreed,
  type BenefitShare,
  type DistinctCounts,
  type QuestionRatio,
  type SalaryPercentileRow,
} from "./sector-benchmark.util";

export interface SectorScope {
  sectorCategory: string;
  // null = the whole of Turkey.
  city: string | null;
}

export interface SectorBenchmarkReportData {
  sectorCategory: string;
  city: string | null;
  requestingCompanyName: string;
  generatedAt: Date;
  reviewCount: number;
  companyCount: number;
  salaryBands: SalaryBand[];
  benefits: BenefitShare[];
  benefitRespondentCount: number;
  mostAgreed: QuestionRatio[];
  mostDisagreed: QuestionRatio[];
  turnover: SectorTurnoverRisk;
}

/**
 * Sector-wide aggregation for the Sector Benchmark Report. Every number it
 * returns is either a count, a percentage, or a rounded percentile band —
 * never an individual answer, never an exact salary, never an average
 * salary. The k-anonymity lock (>= 5 distinct people AND >= 3 distinct
 * companies) is enforced on the whole scope and again on each salary year
 * and on the benefits question separately.
 *
 * Scope = PUBLISHED reviews of non-hidden companies whose category is the
 * sector, optionally narrowed to one city.
 */
@Injectable()
export class SectorBenchmarkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly turnover: TurnoverPredictionService,
  ) {}

  /** Throws 403 "Insufficient Data to Ensure Anonymity" if the scope is too thin. */
  async assertEligibleScope(scope: SectorScope): Promise<DistinctCounts & { reviewCount: number }> {
    const counts = await this.scopeCounts(scope);
    assertKAnonymity(counts);
    return counts;
  }

  async buildReportData(scope: SectorScope, requestingCompanyName: string): Promise<SectorBenchmarkReportData> {
    const counts = await this.assertEligibleScope(scope);

    const reviewWhere: Prisma.ReviewWhereInput = {
      status: "PUBLISHED",
      company: { category: scope.sectorCategory, hiddenAt: null, ...(scope.city ? { city: scope.city } : {}) },
    };

    const [salaryRows, benefitRows, reviews] = await Promise.all([
      this.salaryPercentiles(scope),
      this.prisma.salarySubmission.findMany({
        where: { kvkkCommercialConsent: true, review: reviewWhere },
        select: { userId: true, companyId: true, benefits: true },
      }),
      this.prisma.review.findMany({
        where: reviewWhere,
        select: { workplaceType: true, surveyAnswers: true, publishedAt: true },
      }),
    ]);

    const questionStats = [...new Set(reviews.map((r) => r.workplaceType))].flatMap((workplaceType) =>
      tallyQuestions(
        reviews.filter((r) => r.workplaceType === workplaceType),
        getQuestionsFor(workplaceType as WorkplaceType),
      ),
    );
    const { shares, respondentCount } = benefitsDistribution(
      benefitRows.map((r) => ({ ...r, benefits: r.benefits as BenefitKey[] })),
    );

    return {
      sectorCategory: scope.sectorCategory,
      city: scope.city,
      requestingCompanyName,
      generatedAt: new Date(),
      reviewCount: counts.reviewCount,
      companyCount: counts.distinctCompanies,
      salaryBands: toSalaryBands(salaryRows),
      benefits: shares,
      benefitRespondentCount: respondentCount,
      ...topAgreedAndDisagreed(questionStats),
      turnover: this.turnover.assessSectorRisk(
        reviews.map((r) => ({ ...r, workplaceType: r.workplaceType as WorkplaceType })),
      ),
    };
  }

  private async scopeCounts(scope: SectorScope): Promise<DistinctCounts & { reviewCount: number }> {
    const rows = await this.prisma.$queryRaw<(DistinctCounts & { reviewCount: number })[]>`
      SELECT
        COUNT(DISTINCT r."userId")::int    AS "distinctUsers",
        COUNT(DISTINCT r."companyId")::int AS "distinctCompanies",
        COUNT(*)::int                      AS "reviewCount"
      FROM "public"."Review" r
      JOIN "public"."Company" c ON c.id = r."companyId"
      WHERE r.status = 'PUBLISHED'
        AND c."hiddenAt" IS NULL
        AND c.category = ${scope.sectorCategory}
        AND (${scope.city}::text IS NULL OR c.city = ${scope.city})`;
    const row = rows[0];
    return {
      distinctUsers: Number(row?.distinctUsers ?? 0),
      distinctCompanies: Number(row?.distinctCompanies ?? 0),
      reviewCount: Number(row?.reviewCount ?? 0),
    };
  }

  // Percentiles only — deliberately no AVG() anywhere. Partitioned by
  // salaryYear so different years' pay is never blended into one figure.
  private salaryPercentiles(scope: SectorScope): Promise<SalaryPercentileRow[]> {
    return this.prisma.$queryRaw<SalaryPercentileRow[]>`
      SELECT
        s."salaryYear"                     AS "salaryYear",
        COUNT(DISTINCT s."userId")::int    AS "distinctUsers",
        COUNT(DISTINCT s."companyId")::int AS "distinctCompanies",
        percentile_cont(0.25) WITHIN GROUP (ORDER BY s."monthlyNetSalary") AS "p25",
        percentile_cont(0.5)  WITHIN GROUP (ORDER BY s."monthlyNetSalary") AS "p50",
        percentile_cont(0.75) WITHIN GROUP (ORDER BY s."monthlyNetSalary") AS "p75"
      FROM "public"."SalarySubmission" s
      JOIN "public"."Review" r ON r.id = s."reviewId"
      JOIN "public"."Company" c ON c.id = s."companyId"
      WHERE s."monthlyNetSalary" IS NOT NULL
        AND s."kvkkCommercialConsent" = true
        AND r.status = 'PUBLISHED'
        AND c."hiddenAt" IS NULL
        AND c.category = ${scope.sectorCategory}
        AND (${scope.city}::text IS NULL OR c.city = ${scope.city})
      GROUP BY s."salaryYear"`;
  }
}

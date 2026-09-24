import { ForbiddenException } from "@nestjs/common";
import { BENEFIT_KEYS, BENEFIT_LABELS, type BenefitKey, type SalaryBand, type SurveyQuestionStats } from "@iwtr/shared-types";

// K-anonymity floor for every figure a Sector Benchmark Report shows: at
// least this many different people AND this many different companies must
// stand behind it, or it is not reported at all.
export const MIN_DISTINCT_USERS = 5;
export const MIN_DISTINCT_COMPANIES = 3;

// A single survey question is only listed when at least this many people
// answered it — otherwise a "100% agree" line could be one person's answer.
export const MIN_ANSWERS_PER_QUESTION = 5;

export const SALARY_BAND_ROUNDING = 500;

export const INSUFFICIENT_DATA_MESSAGE = "Insufficient Data to Ensure Anonymity";

export interface DistinctCounts {
  distinctUsers: number;
  distinctCompanies: number;
}

export function passesKAnonymity(counts: DistinctCounts): boolean {
  return counts.distinctUsers >= MIN_DISTINCT_USERS && counts.distinctCompanies >= MIN_DISTINCT_COMPANIES;
}

/** Hard lock: throws a 403 unless the scope clears both floors. */
export function assertKAnonymity(counts: DistinctCounts): void {
  if (!passesKAnonymity(counts)) {
    throw new ForbiddenException(INSUFFICIENT_DATA_MESSAGE);
  }
}

export function roundToBand(value: number): number {
  return Math.round(value / SALARY_BAND_ROUNDING) * SALARY_BAND_ROUNDING;
}

/** One salaryYear partition as it comes back from the percentile query. */
export interface SalaryPercentileRow extends DistinctCounts {
  salaryYear: number;
  p25: number;
  p50: number;
  p75: number;
}

/**
 * Turns percentile rows into the only salary shape a report ever carries:
 * three rounded integer bands per year. Years that don't clear the
 * k-anonymity floor on their own are dropped, not merged or padded.
 * Newest year first.
 */
export function toSalaryBands(rows: SalaryPercentileRow[]): SalaryBand[] {
  return rows
    .filter(passesKAnonymity)
    .map((row) => ({
      salaryYear: Number(row.salaryYear),
      bottom25: roundToBand(Number(row.p25)),
      median: roundToBand(Number(row.p50)),
      top75: roundToBand(Number(row.p75)),
      respondentCount: Number(row.distinctUsers),
    }))
    .sort((a, b) => b.salaryYear - a.salaryYear);
}

export interface BenefitShare {
  benefit: BenefitKey;
  label: string;
  percent: number;
}

/**
 * % of benefit respondents who ticked each benefit, most common first.
 * Returns an empty list unless the respondents themselves clear the
 * k-anonymity floor.
 */
export function benefitsDistribution(
  submissions: { userId: string; companyId: string; benefits: BenefitKey[] }[],
): { shares: BenefitShare[]; respondentCount: number } {
  const counts: DistinctCounts = {
    distinctUsers: new Set(submissions.map((s) => s.userId)).size,
    distinctCompanies: new Set(submissions.map((s) => s.companyId)).size,
  };
  if (!passesKAnonymity(counts)) return { shares: [], respondentCount: 0 };

  const total = submissions.length;
  const shares = BENEFIT_KEYS.map((benefit) => ({
    benefit,
    label: BENEFIT_LABELS[benefit],
    percent: Math.round((submissions.filter((s) => s.benefits.includes(benefit)).length / total) * 100),
  })).sort((a, b) => b.percent - a.percent);
  return { shares, respondentCount: total };
}

export interface QuestionRatio {
  text: string;
  category: string;
  agreePercent: number;
  disagreePercent: number;
  answerCount: number;
}

/**
 * Top `limit` questions by agree % and by disagree %, where "agree" means
 * the answer matched the healthy-workplace answer — the same definition
 * the public company pages and the rival-analytics PDF use (see
 * highlights.util.ts). Ratios are over every answer including "prefer not
 * to answer", again matching those pages.
 */
export function topAgreedAndDisagreed(
  stats: SurveyQuestionStats[],
  limit = 10,
): { mostAgreed: QuestionRatio[]; mostDisagreed: QuestionRatio[] } {
  const ratios: QuestionRatio[] = stats
    .map((q) => {
      const answerCount = q.agreeCount + q.disagreeCount + q.preferNotCount;
      return {
        text: q.text,
        category: q.category,
        answerCount,
        agreePercent: answerCount === 0 ? 0 : Math.round((q.agreeCount / answerCount) * 100),
        disagreePercent: answerCount === 0 ? 0 : Math.round((q.disagreeCount / answerCount) * 100),
      };
    })
    .filter((q) => q.answerCount >= MIN_ANSWERS_PER_QUESTION);

  return {
    mostAgreed: [...ratios].sort((a, b) => b.agreePercent - a.agreePercent).slice(0, limit),
    mostDisagreed: [...ratios].sort((a, b) => b.disagreePercent - a.disagreePercent).slice(0, limit),
  };
}

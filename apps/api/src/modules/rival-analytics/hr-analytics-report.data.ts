import { existsSync } from "node:fs";
import { join } from "node:path";
import { BadRequestException, Injectable } from "@nestjs/common";
import type { JobPostingStatus } from "@prisma/client";
import type { CategoryKey, SurveyQuestionStats, WorkplaceType } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { FlagCalculatorService } from "../flags/flag-calculator.service";
import { YELLOW_FLAG_PAIRS } from "../flags/yellow-flag-pairs.data";
import { getQuestionsFor } from "../reviews/survey-questions.data";
import { tallyContradictionPairs, tallyQuestions } from "../reviews/survey-tally.util";

// A work type needs this many published reviews before it appears in the
// report - below that the percentages say more about a few people than
// about the workplace (same threshold as the company narrative).
export const MIN_REVIEWS_PER_WORK_TYPE = 3;
export const NOT_ENOUGH_REVIEWS =
  `An HR Analytics Report needs at least ${MIN_REVIEWS_PER_WORK_TYPE} published reviews for one of your work types. ` +
  "Please try again once more people have reviewed your company.";

// Newest postings shown in the Risk Score history; older ones are counted.
export const MAX_POSTINGS_SHOWN = 12;

const LOGO_DIR = join(process.cwd(), "uploads", "company-logos");
// Only a logo this API itself stored (OwnerService/AdminCompaniesService
// always write <uuid>.png there) is ever drawn. The PDF never downloads
// anything: a logo URL pointing anywhere else simply gets the monogram.
const OWN_LOGO_PATH = /^\/uploads\/company-logos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png)$/i;

export const WORK_TYPE_LABELS: Record<WorkplaceType, string> = {
  OFFICE: "Office",
  HYBRID_REMOTE: "Hybrid/Remote",
  SERVICE: "Service",
  MANUAL_LABOUR: "Manual-Labour",
};

export const CATEGORY_TITLES: Record<CategoryKey, string> = {
  corporateCulture: "Corporate Culture",
  leadership: "Leadership & Management",
  infrastructure: "Infrastructure & Resources",
  workLifeBalance: "Work-Life Balance",
  stability: "Organizational Stability",
};
const CATEGORY_ORDER = Object.keys(CATEGORY_TITLES) as CategoryKey[];

const MONTH = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

export interface HrReportCompany {
  name: string;
  category: string;
  location: string | null;
  workTypes: string[];
  website: string | null;
  email: string | null;
  phone: string | null;
  logoPath: string | null;
}

export interface HrReportFlag {
  tone: "STRENGTH" | "CONCERN" | "MIXED";
  label: string;
  explanation: string;
}

export interface HrReportQuestionRow {
  text: string;
  healthyPercent: number;
  unhealthyPercent: number;
  skippedPercent: number;
}

export interface HrReportCategory {
  title: string;
  healthyPercent: number;
  questions: HrReportQuestionRow[];
}

export interface HrReportWorkType {
  label: string;
  flags: HrReportFlag[];
  categories: HrReportCategory[];
}

export type HrReportPostingImpact = "RAISED" | "KEPT_CLEAN" | "NONE";

export interface HrReportPosting {
  jobTitle: string;
  workType: string | null;
  postedMonth: string;
  outcome: string;
  impact: HrReportPostingImpact;
}

export interface HrReportRisk {
  // null: the company has never posted a job, so there's no history to score.
  score: number | null;
  postings: HrReportPosting[];
  olderPostingsNotShown: number;
}

/**
 * Everything the HR Analytics PDF prints. Survey data arrives here as
 * percentages only - no review count, id, date or single answer is in this
 * shape, so the PDF builder can't print one even by mistake.
 */
export interface HrAnalyticsReportData {
  company: HrReportCompany;
  generatedAt: Date;
  workTypes: HrReportWorkType[];
  // Work types left out for having too few reviews.
  skippedWorkTypes: string[];
  risk: HrReportRisk;
}

/**
 * Plain, printable text from owner-entered fields: control and
 * text-direction characters and emoji removed, whitespace collapsed, length
 * capped. pdfkit draws text as glyphs and never interprets markup, so this
 * is about a clean page, not script injection - links are never made
 * clickable either.
 */
export function cleanText(value: string | null | undefined, max = 120): string | null {
  if (!value) return null;
  const cleaned = value
    // eslint-disable-next-line no-control-regex -- stripping control characters is the point
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, " ")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return cleaned.length > max ? `${cleaned.slice(0, max - 1).trimEnd()}…` : cleaned;
}

/** Local file path of the company's own uploaded logo, or null. */
export function ownLogoPath(mainPhotoUrl: string | null): string | null {
  if (!mainPhotoUrl) return null;
  let pathname: string;
  try {
    pathname = new URL(mainPhotoUrl).pathname;
  } catch {
    return null;
  }
  const match = OWN_LOGO_PATH.exec(pathname);
  if (!match) return null;
  const file = join(LOGO_DIR, match[1].toLowerCase());
  return existsSync(file) ? file : null;
}

/**
 * Whole-number healthy / unhealthy / skipped shares that always add up to
 * 100 (largest remainder), so a row never reads 33 + 33 + 33.
 */
export function splitPercent(counts: [number, number, number]): [number, number, number] {
  const total = counts[0] + counts[1] + counts[2];
  if (total === 0) return [0, 0, 0];
  const exact = counts.map((c) => (c * 100) / total);
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((v, i) => ({ i, rest: v - floors[i] })).sort((a, b) => b.rest - a.rest);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors as [number, number, number];
}

function questionOrdinal(questionId: string): number {
  return Number(questionId.slice(questionId.lastIndexOf(".") + 1));
}

function healthyShare(q: SurveyQuestionStats): number {
  return splitPercent([q.agreeCount, q.disagreeCount, q.preferNotCount])[0];
}

function unhealthyShare(q: SurveyQuestionStats): number {
  return splitPercent([q.agreeCount, q.disagreeCount, q.preferNotCount])[1];
}

/** The one-sentence "why" printed under a green or red flag. */
export function flagExplanation(color: "GREEN" | "RED", cluster: SurveyQuestionStats[]): string {
  const share = color === "GREEN" ? healthyShare : unhealthyShare;
  const lead = [...cluster].sort((a, b) => share(b) - share(a))[0];
  if (!lead) return color === "GREEN" ? "Most answers in this area were healthy." : "Most answers in this area were unhealthy.";
  const text = lead.text.replace(/\?$/, "");
  return color === "GREEN"
    ? `Earned because most answers in this area were healthy, strongest on "${text}?" (${share(lead)}% healthy).`
    : `Earned because most answers in this area were unhealthy, weakest on "${text}?" (${share(lead)}% unhealthy).`;
}

const OUTCOME: Record<JobPostingStatus, string> = {
  PUBLISHED: "Open",
  FILLED: "Filled",
  PENDING_ADMIN: "Under review",
  REJECTED: "Not published",
};

export interface PostingHistoryRow {
  id: string;
  jobTitle: string;
  workType: WorkplaceType | null;
  status: JobPostingStatus;
  createdAt: Date;
  filledAt: Date | null;
}

/**
 * Each posting's effect on the Risk Score, by the same rule that raises it
 * (JobPostingsService.create): a live posting whose exact title and work
 * type match an earlier one the company had already marked filled raised
 * it; a filled role that was never reopened kept the record clean;
 * anything else had no effect. Worked out from the postings themselves so
 * the table always agrees with what's listed.
 */
export function postingImpacts(postings: PostingHistoryRow[]): Map<string, HrReportPostingImpact> {
  const key = (p: PostingHistoryRow) => `${p.workType ?? ""}|${p.jobTitle.trim().toLocaleLowerCase("tr-TR")}`;
  const reopened = new Set<string>();
  const impacts = new Map<string, HrReportPostingImpact>();
  for (const p of postings) {
    const live = p.status === "PUBLISHED" || p.status === "FILLED";
    const prior = live && p.workType
      ? postings.find((q) => q.id !== p.id && key(q) === key(p) && q.status === "FILLED" && q.filledAt !== null && q.filledAt <= p.createdAt)
      : undefined;
    if (prior) {
      impacts.set(p.id, "RAISED");
      reopened.add(prior.id);
    }
  }
  for (const p of postings) {
    if (!impacts.has(p.id)) impacts.set(p.id, p.status === "FILLED" && !reopened.has(p.id) ? "KEPT_CLEAN" : "NONE");
  }
  return impacts;
}

/**
 * Gathers and anonymises the HR Analytics Report's data. Reviews are read
 * with nothing but their work type and survey answers (no id, author or
 * date), tallied, and turned into percentages before leaving this class.
 */
@Injectable()
export class HrAnalyticsReportDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FlagCalculatorService,
  ) {}

  /** True when at least one of the company's work types has enough reviews. */
  async isEligible(companyId: string): Promise<boolean> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { workplaceTypes: true } });
    if (!company) return false;
    const grouped = await this.prisma.review.groupBy({
      by: ["workplaceType"],
      where: { companyId, status: "PUBLISHED", workplaceType: { in: company.workplaceTypes } },
      _count: { _all: true },
    });
    return grouped.some((g) => g._count._all >= MIN_REVIEWS_PER_WORK_TYPE);
  }

  async assertEligible(companyId: string): Promise<void> {
    if (!(await this.isEligible(companyId))) throw new BadRequestException(NOT_ENOUGH_REVIEWS);
  }

  async build(companyId: string, now = new Date()): Promise<HrAnalyticsReportData> {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: {
        name: true,
        category: true,
        city: true,
        district: true,
        workplaceTypes: true,
        website: true,
        contactEmail: true,
        contactPhone: true,
        mainPhotoUrl: true,
        riskScore: true,
      },
    });

    const reviews = await this.prisma.review.findMany({
      where: { companyId, status: "PUBLISHED" },
      select: { workplaceType: true, surveyAnswers: true },
    });

    const workTypes: HrReportWorkType[] = [];
    const skippedWorkTypes: string[] = [];
    for (const workplaceType of company.workplaceTypes) {
      const answers = reviews.filter((r) => r.workplaceType === workplaceType);
      if (answers.length < MIN_REVIEWS_PER_WORK_TYPE) {
        skippedWorkTypes.push(WORK_TYPE_LABELS[workplaceType]);
        continue;
      }
      workTypes.push(this.workTypeSection(workplaceType, answers));
    }
    if (workTypes.length === 0) throw new BadRequestException(NOT_ENOUGH_REVIEWS);

    return {
      company: {
        name: cleanText(company.name) ?? "Your company",
        category: cleanText(company.category, 60) ?? "",
        location: cleanText([company.district, company.city].filter(Boolean).join(", "), 80),
        workTypes: company.workplaceTypes.map((t) => WORK_TYPE_LABELS[t]),
        website: cleanText(company.website, 80),
        email: cleanText(company.contactEmail, 80),
        phone: cleanText(company.contactPhone, 40),
        logoPath: ownLogoPath(company.mainPhotoUrl),
      },
      generatedAt: now,
      workTypes,
      skippedWorkTypes,
      risk: await this.riskSection(companyId, company.riskScore),
    };
  }

  private workTypeSection(workplaceType: WorkplaceType, reviews: { surveyAnswers: unknown }[]): HrReportWorkType {
    const questions = tallyQuestions(reviews, getQuestionsFor(workplaceType));
    const stats = { workplaceType, totalReviews: reviews.length, questions };

    const flags: HrReportFlag[] = this.flags.computeVibeFlags(stats).map((flag) => {
      const cluster = questions.filter(
        (q) => q.category === flag.category && (flag.cluster === 1 ? questionOrdinal(q.questionId) <= 3 : questionOrdinal(q.questionId) >= 4),
      );
      return {
        tone: flag.color === "GREEN" ? "STRENGTH" : "CONCERN",
        label: flag.label,
        explanation: flagExplanation(flag.color, cluster),
      };
    });
    const yellow = this.flags.computeYellowFlags(
      workplaceType,
      reviews.length,
      tallyContradictionPairs(reviews, YELLOW_FLAG_PAIRS[workplaceType]),
    );
    flags.push(...yellow.map((y) => ({ tone: "MIXED" as const, label: y.label, explanation: y.explanation })));

    const categories = CATEGORY_ORDER.map((key) => {
      const rows = questions.filter((q) => q.category === key);
      const pooled = rows.reduce<[number, number, number]>(
        (sum, q) => [sum[0] + q.agreeCount, sum[1] + q.disagreeCount, sum[2] + q.preferNotCount],
        [0, 0, 0],
      );
      return {
        title: CATEGORY_TITLES[key],
        healthyPercent: splitPercent(pooled)[0],
        questions: rows.map((q) => {
          const [healthyPercent, unhealthyPercent, skippedPercent] = splitPercent([q.agreeCount, q.disagreeCount, q.preferNotCount]);
          return { text: q.text, healthyPercent, unhealthyPercent, skippedPercent };
        }),
      };
    });

    return { label: WORK_TYPE_LABELS[workplaceType], flags, categories };
  }

  private async riskSection(companyId: string, riskScore: number): Promise<HrReportRisk> {
    const postings = await this.prisma.jobPosting.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      select: { id: true, jobTitle: true, workType: true, status: true, createdAt: true, filledAt: true },
    });
    if (postings.length === 0) return { score: null, postings: [], olderPostingsNotShown: 0 };
    const impacts = postingImpacts(postings);

    return {
      score: riskScore,
      postings: postings.slice(0, MAX_POSTINGS_SHOWN).map((p) => ({
        jobTitle: cleanText(p.jobTitle, 70) ?? "Untitled role",
        workType: p.workType ? WORK_TYPE_LABELS[p.workType] : null,
        postedMonth: MONTH.format(p.createdAt),
        outcome: OUTCOME[p.status],
        impact: impacts.get(p.id) ?? "NONE",
      })),
      olderPostingsNotShown: Math.max(0, postings.length - MAX_POSTINGS_SHOWN),
    };
  }
}

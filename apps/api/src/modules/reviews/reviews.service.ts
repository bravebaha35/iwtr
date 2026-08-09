import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  AddEmploymentHistoryInput,
  CastVoteInput,
  CastVoteResult,
  CategoryScores,
  CompanySurveyStats,
  CreateReviewInput,
  MyEmploymentEntry,
  MyReview,
  PublicReview,
  SubmitReviewResult,
  SurveyAnswer,
  SurveyResponse,
  UpdateEmploymentHistoryInput,
  UpdateReviewInput,
  VoteEligibility,
  WorkplaceType,
} from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ModerationService } from "../moderation/moderation.service";
import { PiiVaultService } from "../pii-vault/pii-vault.service";
import { getQuestionsFor } from "./survey-questions.data";

const AUTO_PUBLISH_THRESHOLD = 0.8;
const MID_THRESHOLD = 0.5;

function toDateOnly(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

// Minimum number of distinct companies a member must have a PUBLISHED review
// for before their like/dislike votes count, per the plan's contribution gate.
const REQUIRED_COMPANY_REVIEW_COUNT = 3;
// Same distinct-company-count signal, reused to badge reviews with a
// trust/contribution indicator — never the author's identity, just a tier.
const TOP_CONTRIBUTOR_COMPANY_COUNT = 5;

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
      startDate: toDateOnly(e.startDate),
      endDate: toDateOnly(e.endDate),
      hasReview: e.reviews.length > 0,
      reviewId: e.reviews[0]?.id ?? null,
    }));
  }

  /**
   * Post-onboarding addition from the account-settings page. Unlike
   * onboarding's free-text submitHistory, the caller always picked a real
   * Company row (from a city/district-filtered list), so there's no
   * name-matching to do — just record the link directly.
   */
  async addEmploymentHistory(userId: string, input: AddEmploymentHistoryInput): Promise<MyEmploymentEntry> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.status !== "ACTIVE") {
      throw new ForbiddenException("Complete onboarding before editing your employment history");
    }

    const company = await this.prisma.company.findUnique({ where: { id: input.companyId } });
    if (!company) {
      throw new NotFoundException("Company not found");
    }

    const created = await this.prisma.employmentHistory.create({
      data: {
        userId,
        rawCompanyName: company.name,
        companyId: company.id,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
      },
    });

    return {
      id: created.id,
      rawCompanyName: created.rawCompanyName,
      companyId: created.companyId,
      companySlug: company.slug,
      startDate: toDateOnly(created.startDate),
      endDate: toDateOnly(created.endDate),
      hasReview: false,
      reviewId: null,
    };
  }

  private async loadOwnedEmploymentEntry(userId: string, entryId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.status !== "ACTIVE") {
      throw new ForbiddenException("Complete onboarding before editing your employment history");
    }
    const entry = await this.prisma.employmentHistory.findUnique({
      where: { id: entryId },
      include: { company: true, reviews: { select: { id: true } } },
    });
    if (!entry || entry.userId !== userId) {
      throw new NotFoundException("Employment history entry not found");
    }
    return entry;
  }

  /**
   * Dates only — changing which company an entry points to isn't supported
   * here (that's a delete + re-add, since it's really a different entry).
   * Blocked once a review exists for the same reason delete is: the review's
   * dates were part of what got moderated/trust-scored at submission time.
   */
  async updateEmploymentHistory(
    userId: string,
    entryId: string,
    input: UpdateEmploymentHistoryInput,
  ): Promise<MyEmploymentEntry> {
    const entry = await this.loadOwnedEmploymentEntry(userId, entryId);
    if (entry.reviews.length > 0) {
      throw new ConflictException("Can't edit this — you've already submitted a review for it.");
    }

    const updated = await this.prisma.employmentHistory.update({
      where: { id: entryId },
      data: {
        ...(input.startDate !== undefined ? { startDate: input.startDate ? new Date(input.startDate) : null } : {}),
        ...(input.endDate !== undefined ? { endDate: input.endDate ? new Date(input.endDate) : null } : {}),
      },
    });

    return {
      id: updated.id,
      rawCompanyName: updated.rawCompanyName,
      companyId: updated.companyId,
      companySlug: entry.company?.slug ?? null,
      startDate: toDateOnly(updated.startDate),
      endDate: toDateOnly(updated.endDate),
      hasReview: false,
      reviewId: null,
    };
  }

  async deleteEmploymentHistory(userId: string, entryId: string): Promise<void> {
    const entry = await this.loadOwnedEmploymentEntry(userId, entryId);
    if (entry.reviews.length > 0) {
      throw new ConflictException("Can't remove this — you've already submitted a review for it.");
    }
    await this.prisma.employmentHistory.delete({ where: { id: entryId } });
  }

  /**
   * Scores a submitted survey against the question bank for a workplaceType.
   * A category's score is simply how many of its 5 questions were answered
   * with that question's predefined "correct" answer (0-5) — "prefer not to
   * answer" and the non-correct choice both score 0, same as a miss. Rejects
   * (400) anything that doesn't cover exactly that workplaceType's question
   * set, so a stale/tampered client can't submit a partial or mismatched
   * survey. Never trusts a client-computed score — this is the only place
   * scores are produced.
   */
  private scoreAnswers(
    workplaceType: WorkplaceType,
    answers: SurveyResponse[],
  ): { scores: CategoryScores; surveyAnswers: Record<string, SurveyAnswer> } {
    const questions = getQuestionsFor(workplaceType);
    const answerByQuestionId = new Map(answers.map((a) => [a.questionId, a.answer]));

    const validShape =
      answers.length === questions.length &&
      answerByQuestionId.size === questions.length &&
      questions.every((question) => answerByQuestionId.has(question.id));

    if (!validShape) {
      throw new BadRequestException("Survey answers don't match this workplace type's question set");
    }

    const surveyAnswers: Record<string, SurveyAnswer> = {};
    const scores: CategoryScores = {
      corporateCulture: 0,
      leadership: 0,
      infrastructure: 0,
      workLifeBalance: 0,
      stability: 0,
    };
    for (const question of questions) {
      const answer = answerByQuestionId.get(question.id)!;
      surveyAnswers[question.id] = answer;
      if (answer === question.correctAnswer) {
        scores[question.category] += 1;
      }
    }

    return { scores, surveyAnswers };
  }

  async submitReview(userId: string, input: CreateReviewInput): Promise<SubmitReviewResult> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.status !== "ACTIVE") {
      throw new ForbiddenException("Complete onboarding before submitting a review");
    }

    const employment = await this.prisma.employmentHistory.findUnique({
      where: { id: input.employmentHistoryId },
      include: { company: true },
    });
    if (!employment || employment.userId !== userId || employment.companyId !== input.companyId || !employment.company) {
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

    if (!employment.company.workplaceTypes.includes(input.workplaceType)) {
      throw new ForbiddenException("This company doesn't offer that role category");
    }

    const { scores, surveyAnswers } = this.scoreAnswers(input.workplaceType, input.answers);

    const [priorPublished, priorRejected] = await Promise.all([
      this.prisma.review.count({ where: { userId, status: "PUBLISHED" } }),
      this.prisma.review.count({ where: { userId, status: "REJECTED" } }),
    ]);

    const { status, queueReason, contentCheck, trustScore } = this.runModerationPipeline(
      [input.generalThoughts ?? ""],
      employment,
      user,
      priorPublished,
      priorRejected,
    );

    const review = await this.prisma.review.create({
      data: {
        userId,
        companyId: input.companyId,
        employmentHistoryId: input.employmentHistoryId,
        workplaceType: input.workplaceType,
        corporateCultureScore: scores.corporateCulture,
        leadershipScore: scores.leadership,
        infrastructureScore: scores.infrastructure,
        workLifeBalanceScore: scores.workLifeBalance,
        stabilityScore: scores.stability,
        surveyAnswers,
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
      scores,
    };
  }

  /**
   * Shared by submitReview and updateReview so a re-submitted (edited) review
   * is scored by exactly the same rules as a brand-new one — this logic is
   * the anonymous-routing decision REVIEW.md flags as critical-severity, so
   * it must not drift into two copies. `comments` is just `[generalThoughts]`
   * now that per-category free text is gone — survey answers are fixed
   * choices, so they can never trip the content-rule checks.
   */
  private runModerationPipeline(
    comments: string[],
    employment: { startDate: Date | null; endDate: Date | null },
    user: { createdAt: Date },
    priorPublishedCount: number,
    priorRejectedCount: number,
  ): {
    status: "PUBLISHED" | "PENDING_ADMIN_REVIEW";
    queueReason: "CONTENT_FLAGGED" | "LOW_TRUST_SCORE" | "NEW_USER" | null;
    contentCheck: ReturnType<ModerationService["checkContent"]>;
    trustScore: ReturnType<ModerationService["scoreTrust"]>;
  } {
    const contentCheck = this.moderation.checkContent(comments);

    if (contentCheck.violates && contentCheck.confidence >= 0.9) {
      throw new BadRequestException({
        message: `Your review couldn't be published: ${contentCheck.violationTypes.join(", ")}. Please remove any names, job titles, or inappropriate language and try again.`,
        violationTypes: contentCheck.violationTypes,
      });
    }

    const accountAgeDays = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const employmentDatesPlausible =
      !employment.startDate || !employment.endDate || employment.startDate <= employment.endDate;

    const trustScore = this.moderation.scoreTrust({
      accountAgeDays,
      priorPublishedReviewCount: priorPublishedCount,
      priorRejectedReviewCount: priorRejectedCount,
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
      queueReason = priorPublishedCount === 0 ? "NEW_USER" : "LOW_TRUST_SCORE";
    }

    return { status, queueReason, contentCheck, trustScore };
  }

  /** Owner-only — never exposed to anyone but the review's author. */
  async getMyReview(userId: string, reviewId: string): Promise<MyReview> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review || review.userId !== userId) {
      throw new NotFoundException("Review not found");
    }

    return {
      id: review.id,
      companyId: review.companyId,
      workplaceType: review.workplaceType,
      corporateCultureScore: review.corporateCultureScore,
      leadershipScore: review.leadershipScore,
      infrastructureScore: review.infrastructureScore,
      workLifeBalanceScore: review.workLifeBalanceScore,
      stabilityScore: review.stabilityScore,
      surveyAnswers: review.surveyAnswers as Record<string, SurveyAnswer>,
      generalThoughts: review.generalThoughts,
      status: review.status,
    };
  }

  /**
   * Re-scores edited content through the same pipeline a new submission gets
   * (see runModerationPipeline/scoreAnswers) rather than just patching the
   * row, since a changed survey could change whether the review should still
   * be auto-published. The company's aggregate is recomputed whenever the
   * review is (or was, before this edit) PUBLISHED, so an edit that changes
   * scores — or pulls a review out of/into the published set — is reflected
   * immediately.
   */
  async updateReview(userId: string, reviewId: string, input: UpdateReviewInput): Promise<SubmitReviewResult> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.status !== "ACTIVE") {
      throw new ForbiddenException("Complete onboarding before editing a review");
    }

    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: { employmentHistory: true },
    });
    if (!review || review.userId !== userId) {
      throw new NotFoundException("Review not found");
    }

    const wasPublished = review.status === "PUBLISHED";

    const { scores, surveyAnswers } = this.scoreAnswers(review.workplaceType, input.answers);

    const [priorPublished, priorRejected] = await Promise.all([
      this.prisma.review.count({ where: { userId, status: "PUBLISHED", id: { not: reviewId } } }),
      this.prisma.review.count({ where: { userId, status: "REJECTED", id: { not: reviewId } } }),
    ]);

    const { status, queueReason, contentCheck, trustScore } = this.runModerationPipeline(
      [input.generalThoughts ?? ""],
      review.employmentHistory,
      user,
      priorPublished,
      priorRejected,
    );

    await this.prisma.review.update({
      where: { id: reviewId },
      data: {
        corporateCultureScore: scores.corporateCulture,
        leadershipScore: scores.leadership,
        infrastructureScore: scores.infrastructure,
        workLifeBalanceScore: scores.workLifeBalance,
        stabilityScore: scores.stability,
        surveyAnswers,
        generalThoughts: input.generalThoughts,
        status,
        aiModerationScore: contentCheck.confidence,
        aiTrustScore: trustScore.score,
        moderationDetails: { contentCheck, trustScore } as object,
        publishedAt: status === "PUBLISHED" ? (review.publishedAt ?? new Date()) : review.publishedAt,
      },
    });

    if (queueReason) {
      const aiSummary = `Content check: ${JSON.stringify(contentCheck)}. Trust score: ${trustScore.score.toFixed(2)} (${trustScore.factors.join(", ")}).`;
      // reviewId is @unique on ModerationQueueItem, and a review can only
      // ever get one (approve/reject update it in place, never delete) — so
      // a second edit that re-flags the same review must update that row,
      // not insert a new one.
      await this.prisma.moderationQueueItem.upsert({
        where: { reviewId },
        create: { reviewId, reason: queueReason, aiSummary },
        update: { reason: queueReason, aiSummary, status: "OPEN", resolvedAt: null },
      });
    }

    if (status === "PUBLISHED" || wasPublished) {
      await this.recomputeAggregate(review.companyId);
    }
    if (status === "PUBLISHED") {
      await this.piiVault.purgeTcKimlikNoIfPresent(userId);
    }

    return {
      reviewId: review.id,
      status,
      message:
        status === "PUBLISHED"
          ? "Your review is live."
          : "Your review is being reviewed before publishing. This usually takes a short while.",
      scores,
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

  async listForCompany(companySlug: string, viewerUserId?: string): Promise<PublicReview[]> {
    const company = await this.prisma.company.findUnique({ where: { slug: companySlug } });
    if (!company) {
      throw new NotFoundException("Company not found");
    }

    const reviews = await this.prisma.review.findMany({
      where: { companyId: company.id, status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      include: {
        votes: viewerUserId
          ? { where: { userId: viewerUserId }, select: { value: true } }
          : false,
      },
    });

    // Single grouped query for both like and dislike counts, so the two
    // numbers always come from the same read rather than two independent
    // queries that could observe different points in time.
    const voteCounts = await this.prisma.reviewVote.groupBy({
      by: ["reviewId", "value"],
      where: { reviewId: { in: reviews.map((r) => r.id) } },
      _count: { _all: true },
    });
    const likeByReview = new Map<string, number>();
    const dislikeByReview = new Map<string, number>();
    for (const row of voteCounts) {
      (row.value === 1 ? likeByReview : dislikeByReview).set(row.reviewId, row._count._all);
    }

    // Contributor badge: derived from how many distinct companies each
    // review's author has PUBLISHED elsewhere — a trust signal for readers,
    // computed without ever exposing who the author is. One batched query
    // for every author on this page rather than a query per review.
    const authorIds = [...new Set(reviews.map((r) => r.userId))];
    const authorCompanyRows = await this.prisma.review.groupBy({
      by: ["userId", "companyId"],
      where: { userId: { in: authorIds }, status: "PUBLISHED" },
    });
    const distinctCompanyCountByAuthor = new Map<string, number>();
    for (const row of authorCompanyRows) {
      distinctCompanyCountByAuthor.set(row.userId, (distinctCompanyCountByAuthor.get(row.userId) ?? 0) + 1);
    }
    const contributorBadge = (userId: string): PublicReview["contributorBadge"] => {
      const count = distinctCompanyCountByAuthor.get(userId) ?? 0;
      if (count >= TOP_CONTRIBUTOR_COMPANY_COUNT) return "TOP_CONTRIBUTOR";
      if (count >= REQUIRED_COMPANY_REVIEW_COUNT) return "CONTRIBUTOR";
      return null;
    };

    return reviews.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      workplaceType: r.workplaceType,
      corporateCultureScore: r.corporateCultureScore,
      leadershipScore: r.leadershipScore,
      infrastructureScore: r.infrastructureScore,
      workLifeBalanceScore: r.workLifeBalanceScore,
      stabilityScore: r.stabilityScore,
      generalThoughts: r.generalThoughts,
      status: r.status,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      likeCount: likeByReview.get(r.id) ?? 0,
      dislikeCount: dislikeByReview.get(r.id) ?? 0,
      myVote: viewerUserId ? ((r.votes?.[0]?.value as 1 | -1 | undefined) ?? null) : null,
      contributorBadge: contributorBadge(r.userId),
    }));
  }

  /**
   * Per-question consensus across a company's PUBLISHED reviews — powers the
   * "most agreed / most disputed question" highlight and the full "All
   * Questions" breakdown on the company page. Computed on demand rather than
   * a maintained rollup table (unlike CompanyAggregateScore): this is a much
   * lower-traffic read (one company-detail-page click-through, not every
   * browse-page card), and 25 questions × however many published reviews a
   * company has is cheap to tally per request.
   *
   * One section per Company.workplaceTypes[i] — a 2-tag company (e.g. a
   * hospital tagged SERVICE + OFFICE) gets its Service reviewers' answers
   * tallied completely separately from its Office reviewers', since
   * "SERVICE.corporateCulture.1" and "OFFICE.corporateCulture.1" are
   * different questions entirely; merging them would be meaningless.
   *
   * Only ever returns agree/disagree/prefer-not-to-answer COUNTS, never the
   * raw per-review YES/NO breakdown or which literal choice was correct —
   * that stays server-only in survey-questions.data.ts. A count of how many
   * people agreed with the platform's rubric can't be reversed into the
   * rubric itself.
   */
  async getSurveyStats(companySlug: string): Promise<CompanySurveyStats> {
    const company = await this.prisma.company.findUnique({ where: { slug: companySlug } });
    if (!company) {
      throw new NotFoundException("Company not found");
    }

    const published = await this.prisma.review.findMany({
      where: { companyId: company.id, status: "PUBLISHED" },
      select: { workplaceType: true, surveyAnswers: true },
    });

    const byWorkplaceType = company.workplaceTypes.map((workplaceType) => {
      const reviewsForType = published.filter((r) => r.workplaceType === workplaceType);
      const questions = getQuestionsFor(workplaceType);
      const tallies = new Map(
        questions.map((q) => [q.id, { agreeCount: 0, disagreeCount: 0, preferNotCount: 0 }]),
      );

      for (const review of reviewsForType) {
        const answers = review.surveyAnswers as Record<string, SurveyAnswer>;
        for (const question of questions) {
          const answer = answers[question.id];
          const tally = tallies.get(question.id);
          if (!tally || answer === undefined) continue;
          if (answer === question.correctAnswer) {
            tally.agreeCount += 1;
          } else if (answer === "PREFER_NOT_TO_ANSWER") {
            tally.preferNotCount += 1;
          } else {
            tally.disagreeCount += 1;
          }
        }
      }

      return {
        workplaceType,
        totalReviews: reviewsForType.length,
        questions: questions.map((q) => ({
          questionId: q.id,
          category: q.category,
          text: q.text,
          ...tallies.get(q.id)!,
        })),
      };
    });

    return { byWorkplaceType };
  }

  async getVoteEligibility(userId: string): Promise<VoteEligibility> {
    const distinctCompanies = await this.prisma.review.findMany({
      where: { userId, status: "PUBLISHED" },
      distinct: ["companyId"],
      select: { companyId: true },
    });

    return {
      eligible: distinctCompanies.length >= REQUIRED_COMPANY_REVIEW_COUNT,
      distinctCompanyReviewCount: distinctCompanies.length,
      requiredCompanyReviewCount: REQUIRED_COMPANY_REVIEW_COUNT,
    };
  }

  async castVote(userId: string, input: CastVoteInput): Promise<CastVoteResult> {
    const eligibility = await this.getVoteEligibility(userId);
    if (!eligibility.eligible) {
      throw new ForbiddenException(
        `You need published reviews for ${eligibility.requiredCompanyReviewCount} different companies before you can vote (you have ${eligibility.distinctCompanyReviewCount}).`,
      );
    }

    const review = await this.prisma.review.findUnique({ where: { id: input.reviewId } });
    if (!review || review.status !== "PUBLISHED") {
      throw new NotFoundException("Review not found");
    }
    if (review.userId === userId) {
      throw new ForbiddenException("You can't vote on your own review");
    }

    const existing = await this.prisma.reviewVote.findUnique({
      where: { reviewId_userId: { reviewId: input.reviewId, userId } },
    });

    try {
      if (existing && existing.value === input.value) {
        await this.prisma.reviewVote.delete({ where: { id: existing.id } });
      } else if (existing) {
        await this.prisma.reviewVote.update({ where: { id: existing.id }, data: { value: input.value } });
      } else {
        await this.prisma.reviewVote.create({
          data: { reviewId: input.reviewId, userId, value: input.value },
        });
      }
    } catch (err) {
      // A concurrent request from the same user (double-click / duplicate
      // submit) can lose this exact race — e.g. two "create" calls both read
      // no existing vote, or two "delete" calls both read the same existing
      // vote. Either way the vote state is now whatever the winner left it
      // as, which is what we want, so just fall through to reading it back
      // rather than surfacing a spurious error for a no-op-in-effect request.
      const isBenignRace =
        err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2002" || err.code === "P2025");
      if (!isBenignRace) throw err;
    }

    const [likeCount, dislikeCount, myVote] = await Promise.all([
      this.prisma.reviewVote.count({ where: { reviewId: input.reviewId, value: 1 } }),
      this.prisma.reviewVote.count({ where: { reviewId: input.reviewId, value: -1 } }),
      this.prisma.reviewVote.findUnique({
        where: { reviewId_userId: { reviewId: input.reviewId, userId } },
      }),
    ]);

    return {
      reviewId: input.reviewId,
      likeCount,
      dislikeCount,
      myVote: (myVote?.value as 1 | -1 | undefined) ?? null,
    };
  }
}

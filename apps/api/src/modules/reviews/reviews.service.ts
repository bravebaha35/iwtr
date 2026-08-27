import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  RANDOMIZED_IDENTITY_AVATAR_GRADIENT,
  RANDOMIZED_IDENTITY_AVATAR_KEY,
  type AddEmploymentHistoryInput,
  type CastVoteInput,
  type CastVoteResult,
  type CategoryScores,
  type CompanyReply,
  type CompanySurveyStats,
  type CreateReviewInput,
  type MyEmploymentEntry,
  type MyReview,
  type MyReviewListItem,
  type PublicReview,
  type ReplyToReviewInput,
  type SubmitReviewResult,
  type SurveyAnswer,
  type SurveyResponse,
  type UpdateEmploymentHistoryInput,
  type UpdateReviewInput,
  type WorkplaceType,
} from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ModerationService } from "../moderation/moderation.service";
import { PiiVaultService } from "../pii-vault/pii-vault.service";
import { getQuestionsFor } from "./survey-questions.data";
import { pickRandomDisplayUsername } from "./randomized-identity.util";
import { tallyQuestions } from "./survey-tally.util";

const AUTO_PUBLISH_THRESHOLD = 0.8;
const MID_THRESHOLD = 0.5;

function toDateOnly(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function toPublicReply(r: { id: string; content: string; createdAt: Date } | undefined): CompanyReply | null {
  return r ? { id: r.id, content: r.content, createdAt: r.createdAt.toISOString() } : null;
}

// Distinct-company-count thresholds for the CONTRIBUTOR/TOP_CONTRIBUTOR
// badge shown on reviews — a trust/contribution indicator, never the
// author's identity. No longer used to gate voting (2026-08-09: any
// registered, logged-in member can vote helpful/not-helpful — see
// castVote) — purely a badge-tier signal now.
const CONTRIBUTOR_COMPANY_COUNT = 3;
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
      jobTitle: e.jobTitle,
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
        jobTitle: input.jobTitle ?? null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
      },
    });

    return {
      id: created.id,
      rawCompanyName: created.rawCompanyName,
      companyId: created.companyId,
      companySlug: company.slug,
      jobTitle: created.jobTitle,
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
   * Dates and job title only — changing which company an entry points to
   * isn't supported here (that's a delete + re-add, since it's really a
   * different entry). Blocked once a review exists for the same reason
   * delete is: the review's dates were part of what got moderated/
   * trust-scored at submission time.
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
        ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
        ...(input.startDate !== undefined ? { startDate: input.startDate ? new Date(input.startDate) : null } : {}),
        ...(input.endDate !== undefined ? { endDate: input.endDate ? new Date(input.endDate) : null } : {}),
      },
    });

    return {
      id: updated.id,
      rawCompanyName: updated.rawCompanyName,
      companyId: updated.companyId,
      companySlug: entry.company?.slug ?? null,
      jobTitle: updated.jobTitle,
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

    // The pool of usernames is picked from this review's own, already-
    // validated workplaceType (never a client-supplied category) — the same
    // "server derives it, never trusts the client for it" rule this method
    // already applies to workplaceType itself a few lines up.
    const isRandomizedIdentity = input.isRandomizedIdentity ?? false;
    const displayUsername = isRandomizedIdentity ? pickRandomDisplayUsername(input.workplaceType) : null;

    let review;
    try {
      review = await this.prisma.review.create({
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
          isRandomizedIdentity,
          displayUsername,
        },
      });
    } catch (err) {
      // Two concurrent submissions for the same user+company can both pass
      // the existing-review check above before either write lands —
      // @@unique([userId, companyId]) is the real guard; this just turns the
      // loser's raw constraint violation into the same friendly error the
      // upfront check already gives (same benign-race pattern as castVote).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("You have already reviewed this company");
      }
      throw err;
    }

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
      isRandomizedIdentity: review.isRandomizedIdentity,
      displayUsername: review.displayUsername,
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

    // Turning the toggle on freshly picks a name; leaving it on (already
    // randomized, still randomized) keeps the SAME name stable across edits
    // instead of re-rolling one on every save, which would look like the
    // review kept changing authors. Turning it off clears the override
    // entirely, reverting to the account's real avatarKey/avatarGradient/
    // reviewUsername (see listForCompany).
    const isRandomizedIdentity = input.isRandomizedIdentity ?? review.isRandomizedIdentity;
    const displayUsername = isRandomizedIdentity
      ? (review.isRandomizedIdentity ? review.displayUsername : pickRandomDisplayUsername(review.workplaceType))
      : null;

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
        isRandomizedIdentity,
        displayUsername,
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

    // At most one per review (CompanyReply.reviewId is @unique) — see
    // replyToReview.
    const replies = await this.prisma.companyReply.findMany({
      where: { reviewId: { in: reviews.map((r) => r.id) } },
    });
    const replyByReview = new Map(replies.map((r) => [r.reviewId, r]));

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
      if (count >= CONTRIBUTOR_COMPANY_COUNT) return "CONTRIBUTOR";
      return null;
    };

    // The author's own self-chosen anonymous avatar and permanent
    // reviewUsername (see REVIEW.md rule #8 — an explicit, approved
    // exception for exactly these three columns). Explicit `select`, never
    // `include: { user: true }` — that would also pull back email/city/etc.
    // on a review-shaped query, which is exactly the leak pattern
    // REVIEW.md's red flag #1 warns about.
    const authors = await this.prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, avatarKey: true, avatarGradient: true, reviewUsername: true },
    });
    const avatarByAuthor = new Map(
      authors.map((a) => [a.id, { avatarKey: a.avatarKey, avatarGradient: a.avatarGradient, reviewUsername: a.reviewUsername }]),
    );

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
      reply: toPublicReply(replyByReview.get(r.id)),
      // A review submitted/edited with "randomize my identity" on displays a
      // fixed generic avatar and its own one-off displayUsername instead of
      // the author's real avatarKey/avatarGradient/reviewUsername — this is
      // the one place those get swapped, so a randomized review can never be
      // correlated back to the same author's other reviews via a repeating
      // avatar/name (see REVIEW.md rule #8).
      avatarKey: r.isRandomizedIdentity ? RANDOMIZED_IDENTITY_AVATAR_KEY : (avatarByAuthor.get(r.userId)?.avatarKey ?? null),
      avatarGradient: r.isRandomizedIdentity
        ? RANDOMIZED_IDENTITY_AVATAR_GRADIENT
        : (avatarByAuthor.get(r.userId)?.avatarGradient ?? null),
      displayUsername: r.isRandomizedIdentity ? r.displayUsername : (avatarByAuthor.get(r.userId)?.reviewUsername ?? null),
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

      return {
        workplaceType,
        totalReviews: reviewsForType.length,
        questions: tallyQuestions(reviewsForType, questions),
      };
    });

    return { byWorkplaceType };
  }

  /**
   * Any logged-in, registered member can vote — no contribution gate (see
   * REVIEW.md-adjacent history: this used to require published reviews for 3
   * distinct companies; removed 2026-08-09 per product decision). Still
   * blocks self-voting and requires the target review to be PUBLISHED.
   */
  async castVote(userId: string, input: CastVoteInput): Promise<CastVoteResult> {
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

  /**
   * The "My Ratings" page — every review the caller has ever submitted,
   * newest first, including non-published ones (same reasoning as
   * getMyReview: this is never shown to anyone but the author).
   */
  async listMine(userId: string): Promise<MyReviewListItem[]> {
    const reviews = await this.prisma.review.findMany({
      where: { userId },
      include: { company: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    });
    const reviewIds = reviews.map((r) => r.id);

    const [voteCounts, replies] = await Promise.all([
      this.prisma.reviewVote.groupBy({
        by: ["reviewId", "value"],
        where: { reviewId: { in: reviewIds } },
        _count: { _all: true },
      }),
      this.prisma.companyReply.findMany({ where: { reviewId: { in: reviewIds } } }),
    ]);
    const likeByReview = new Map<string, number>();
    const dislikeByReview = new Map<string, number>();
    for (const row of voteCounts) {
      (row.value === 1 ? likeByReview : dislikeByReview).set(row.reviewId, row._count._all);
    }
    const replyByReview = new Map(replies.map((r) => [r.reviewId, r]));

    return reviews.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      companyName: r.company?.name ?? "",
      companySlug: r.company?.slug ?? null,
      workplaceType: r.workplaceType,
      corporateCultureScore: r.corporateCultureScore,
      leadershipScore: r.leadershipScore,
      infrastructureScore: r.infrastructureScore,
      workLifeBalanceScore: r.workLifeBalanceScore,
      stabilityScore: r.stabilityScore,
      surveyAnswers: r.surveyAnswers as Record<string, SurveyAnswer>,
      generalThoughts: r.generalThoughts,
      status: r.status,
      isRandomizedIdentity: r.isRandomizedIdentity,
      displayUsername: r.displayUsername,
      createdAt: r.createdAt.toISOString(),
      publishedAt: r.publishedAt?.toISOString() ?? null,
      likeCount: likeByReview.get(r.id) ?? 0,
      dislikeCount: dislikeByReview.get(r.id) ?? 0,
      reply: toPublicReply(replyByReview.get(r.id)),
    }));
  }

  /**
   * Same ownership check owner.service.ts's requireApprovedOwnership does —
   * duplicated rather than imported across module boundaries (see this
   * project's module-per-feature layout in CLAUDE.md), since it's a 3-line
   * query and reviews.service.ts otherwise has no reason to depend on the
   * owner module.
   */
  private async requireApprovedCompanyOwnership(userId: string, companyId: string): Promise<void> {
    const ownership = await this.prisma.companyOwner.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!ownership || ownership.claimStatus !== "APPROVED") {
      throw new ForbiddenException("You don't have an approved claim on this company");
    }
  }

  /**
   * A company's one public reply to a review — see CompanyReply in
   * schema.prisma for why this is public rather than a DM to the reviewer,
   * and why it's run through the same content-moderation check reviews get:
   * the one real risk is a reply trying to name or out the anonymous
   * reviewer, which checkContent's name-pattern rule catches same as it does
   * for review text.
   */
  async replyToReview(userId: string, reviewId: string, input: ReplyToReviewInput): Promise<CompanyReply> {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review || review.status !== "PUBLISHED") {
      throw new NotFoundException("Review not found");
    }
    await this.requireApprovedCompanyOwnership(userId, review.companyId);

    const contentCheck = this.moderation.checkContent([input.content]);
    if (contentCheck.violates) {
      throw new BadRequestException({
        message: `Your reply couldn't be published: ${contentCheck.violationTypes.join(", ")}. Please remove any names or identifying details and try again.`,
        violationTypes: contentCheck.violationTypes,
      });
    }

    try {
      const created = await this.prisma.companyReply.create({
        data: { reviewId, companyId: review.companyId, authorUserId: userId, content: input.content },
      });
      return toPublicReply(created)!;
    } catch (err) {
      // Same benign-race pattern as submitReview/castVote — reviewId is
      // @unique on CompanyReply, so a double-submit just means the loser
      // should be told to edit the reply that already landed.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("This review already has a reply — edit it instead of posting a new one");
      }
      throw err;
    }
  }

  async updateReply(userId: string, reviewId: string, input: ReplyToReviewInput): Promise<CompanyReply> {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) {
      throw new NotFoundException("Review not found");
    }
    await this.requireApprovedCompanyOwnership(userId, review.companyId);

    const existing = await this.prisma.companyReply.findUnique({ where: { reviewId } });
    if (!existing) {
      throw new NotFoundException("No reply to edit yet — post one first");
    }

    const contentCheck = this.moderation.checkContent([input.content]);
    if (contentCheck.violates) {
      throw new BadRequestException({
        message: `Your reply couldn't be published: ${contentCheck.violationTypes.join(", ")}. Please remove any names or identifying details and try again.`,
        violationTypes: contentCheck.violationTypes,
      });
    }

    const updated = await this.prisma.companyReply.update({ where: { reviewId }, data: { content: input.content } });
    return toPublicReply(updated)!;
  }
}

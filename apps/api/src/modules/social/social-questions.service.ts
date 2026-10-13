import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  RANDOMIZED_IDENTITY_AVATAR_GRADIENT,
  RANDOMIZED_IDENTITY_AVATAR_KEY,
  SOCIAL_QUESTION_PREVIEW_ANSWERS,
  SOCIAL_QUESTIONS_PER_DAY,
  workplaceTypeSchema,
  type AdminReportedSocialQuestionItem,
  type CommentIdentityMode,
  type CompanyQuestionCounts,
  type CompanyQuestionFilter,
  type CompanyQuestionPage,
  type CompanyQuestionVisibilityChoice,
  type CreateSocialAnswerInput,
  type CreateSocialQuestionInput,
  type PublicSocialAnswer,
  type PublicSocialQuestion,
  type ReportSocialCommentResult,
  type SocialAnswerHelpfulResult,
  type SocialCommentReportReason,
  type SocialQuestionFilter,
  type SocialQuestionIdentity,
  type SocialQuestionPage,
  type SocialQuestionTarget,
  type SocialQuestionVisibility,
  type WorkplaceType,
} from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ModerationService } from "../moderation/moderation.service";
import { assertCompanyVisibleOrThrow } from "../companies/company-visibility";
import { pickRandomDisplayUsername } from "../reviews/randomized-identity.util";
import { toUtcHour } from "../../common/time/day-precision.util";
import { categoryGroupWhere, type CategoryGroup } from "./social.service";
import { ownerDisplayFromProfile } from "./social-owner-display.util";
import { VISIBLE_QUESTION_WHERE } from "./social-questions.rail";

export const SOCIAL_QUESTION_PAGE_SIZE = 10;
// A question's own page shows every answer; this is only a safety ceiling.
const ANSWERS_ON_PAGE = 200;
const REPORTS_BEFORE_RECHECK = 3;
const DAY_MS = 86_400_000;

const TEXT_REJECTED_MESSAGE = "That looks like it names a person or breaks our content rules - please reword it.";

// What a question shape is built from. authorUserId is read to settle `mine`
// and the shown name; it never leaves this file (REVIEW.md).
const QUESTION_ROW_SELECT = {
  id: true,
  body: true,
  createdAt: true,
  companyId: true,
  workType: true,
  authorUserId: true,
  identityMode: true,
  randomUsername: true,
  visibility: true,
  company: { select: { slug: true, name: true, mainPhotoUrl: true, badgeTier: true } },
  _count: { select: { answers: true } },
} as const;
type QuestionRow = Prisma.SocialQuestionGetPayload<{ select: typeof QUESTION_ROW_SELECT }>;

const ANSWER_ROW_SELECT = {
  id: true,
  questionId: true,
  body: true,
  createdAt: true,
  authorUserId: true,
  identityMode: true,
  randomUsername: true,
  workedThere: true,
  _count: { select: { votes: true } },
} as const;
type AnswerRow = Prisma.SocialAnswerGetPayload<{ select: typeof ANSWER_ROW_SELECT }>;

// Most helpful first, oldest first among equals.
const ANSWER_ORDER: Prisma.SocialAnswerOrderByWithRelationInput[] = [{ votes: { _count: "desc" } }, { createdAt: "asc" }, { id: "asc" }];

type Viewer = { id: string; role: string; ownedCompanyIds: Set<string> };

// The dashboard's filter words, as the stored state.
const COMPANY_FILTER_VISIBILITY = { waiting: "PENDING", hidden: "HIDDEN", shown: "PUBLIC" } as const;

// What this viewer may be sent: every question that is shown to everyone,
// their own whatever its state, and - for an approved owner - everything put
// to their own companies. Nobody else ever receives a waiting or hidden one.
function viewableBy(viewer: Viewer | null): Prisma.SocialQuestionWhereInput {
  const or: Prisma.SocialQuestionWhereInput[] = [{ visibility: "PUBLIC" }];
  if (viewer) {
    or.push({ authorUserId: viewer.id });
    if (viewer.ownedCompanyIds.size > 0) or.push({ companyId: { in: [...viewer.ownedCompanyIds] } });
  }
  return { AND: [VISIBLE_QUESTION_WHERE, { OR: or }] };
}

export type ListQuestionsOptions = {
  cursor?: string;
  q?: string;
  workplaceTypes?: WorkplaceType[];
  categoryGroup?: CategoryGroup;
  companySlug?: string;
  filter?: SocialQuestionFilter;
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * IWT Social Questions. A member asks one company, or everyone in a kind of
 * work; members answer, and the asked company's owner answers too.
 *
 * Anonymity is the comment model: a member appears under their reviewUsername
 * or a one-off random name, never anything else, and no response carries an
 * account id. The one real name is an owner's, answering for their own company
 * (EmployerProfile, decrypted at read time - never the PII vault).
 *
 * Text goes through the same content rules as a review or a comment and a
 * violation is refused on the spot. After that a report path exists (three
 * reports plus a content match queues the item for an admin); nothing is
 * removed without a person looking. A company cannot delete a question put
 * to it - only its author or an admin can.
 *
 * A question put to a claimed company starts out seen by its asker and that
 * company's owner only (SocialQuestion.visibility PENDING). The owner answers
 * it - from the dashboard's Questions section - and picks whether it is then
 * shown to everyone or stays hidden; that choice can be changed later, but
 * showing a question always needs the company's own answer on it. The owner's
 * one way to respond is that answer: there is no message to the asker, and
 * the asker is as anonymous to the company as to anyone else. A question that
 * breaks the rules is reported, which puts it in front of an admin.
 */
@Injectable()
export class SocialQuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
  ) {}

  async ask(userId: string, input: CreateSocialQuestionInput): Promise<PublicSocialQuestion> {
    const since = new Date(Date.now() - DAY_MS);
    const askedToday = await this.prisma.socialQuestion.count({ where: { authorUserId: userId, createdAt: { gte: since } } });
    if (askedToday >= SOCIAL_QUESTIONS_PER_DAY) {
      throw new HttpException(
        `You can ask ${SOCIAL_QUESTIONS_PER_DAY} questions a day. Try again tomorrow.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let companyName: string | null = null;
    // A claimed company sees the question first; with nobody to do that, and
    // for a question put to a kind of work, it is shown to everyone at once.
    let visibility: SocialQuestionVisibility = "PUBLIC";
    if (input.companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: input.companyId },
        select: { id: true, name: true, hiddenAt: true },
      });
      assertCompanyVisibleOrThrow(company);
      companyName = company.name;
      const owners = await this.prisma.companyOwner.count({ where: { companyId: company.id, claimStatus: "APPROVED" } });
      if (owners > 0) visibility = "PENDING";
    }
    this.assertTextAllowed(input.body, companyName);

    const mode = input.identityMode ?? "PERSONAL_CHOSEN";
    const row = await this.prisma.socialQuestion.create({
      data: {
        companyId: input.companyId ?? null,
        workType: input.companyId ? null : (input.workType ?? null),
        authorUserId: userId,
        body: input.body,
        identityMode: mode,
        randomUsername: mode === "PERSONAL_RANDOM" ? this.randomName(input.workType) : null,
        visibility,
      },
      select: QUESTION_ROW_SELECT,
    });
    const [question] = await this.serializeQuestions([row], await this.loadViewer(userId), { allAnswers: true });
    return question;
  }

  // Newest first. The sidebar's search, Work-Type and Quick Select filters
  // apply here as they do to posts; `companySlug` is the company Social tab.
  async list(viewerUserId: string | undefined, opts: ListQuestionsOptions): Promise<SocialQuestionPage> {
    const filter = opts.filter ?? "all";
    // "My questions" is the caller's own list: nothing for a logged-out caller.
    if (filter === "mine" && !viewerUserId) return { questions: [], nextCursor: null };

    const viewer = await this.loadViewer(viewerUserId);
    const and: Prisma.SocialQuestionWhereInput[] = [viewableBy(viewer)];
    if (opts.companySlug) and.push({ company: { slug: opts.companySlug } });
    const q = opts.q?.trim();
    if (q) {
      and.push({
        OR: [
          { body: { contains: q, mode: "insensitive" } },
          { company: { name: { contains: q, mode: "insensitive" } } },
        ],
      });
    }
    if (opts.workplaceTypes && opts.workplaceTypes.length > 0) {
      // A question put to that kind of work, or to a company doing it.
      and.push({
        OR: [{ workType: { in: opts.workplaceTypes } }, { company: { workplaceTypes: { hasSome: opts.workplaceTypes } } }],
      });
    }
    const categoryFilter = categoryGroupWhere(opts.categoryGroup);
    if (categoryFilter !== undefined) and.push({ company: { category: categoryFilter } });
    if (filter === "unanswered") and.push({ answers: { none: {} } });
    if (filter === "mine") and.push({ authorUserId: viewerUserId });

    const rows = await this.prisma.socialQuestion.findMany({
      where: { AND: and },
      // id is the tie-breaker: createdAt alone is not unique.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: SOCIAL_QUESTION_PAGE_SIZE + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      select: QUESTION_ROW_SELECT,
    });
    const hasMore = rows.length > SOCIAL_QUESTION_PAGE_SIZE;
    const pageRows = hasMore ? rows.slice(0, SOCIAL_QUESTION_PAGE_SIZE) : rows;
    const questions = await this.serializeQuestions(pageRows, viewer, { allAnswers: false });
    return { questions, nextCursor: hasMore ? pageRows[pageRows.length - 1].id : null };
  }

  // One question with every answer, for its own page. A waiting or hidden
  // one answers "not found" to everybody but its asker and the company.
  async get(viewerUserId: string | undefined, questionId: string): Promise<PublicSocialQuestion> {
    const viewer = await this.loadViewer(viewerUserId);
    const row = await this.prisma.socialQuestion.findFirst({
      where: { AND: [{ id: questionId }, viewableBy(viewer)] },
      select: QUESTION_ROW_SELECT,
    });
    if (!row) throw new NotFoundException("Question not found");
    const [question] = await this.serializeQuestions([row], viewer, { allAnswers: true });
    return question;
  }

  // The owner dashboard's Questions section: everything put to one of the
  // caller's own companies, whatever its state, newest first, with how many
  // are in each state. Anyone but that company's approved owner gets 403.
  async listForCompany(
    userId: string,
    companyId: string,
    opts: { filter?: CompanyQuestionFilter; cursor?: string },
  ): Promise<CompanyQuestionPage> {
    const viewer = await this.loadViewer(userId);
    if (!viewer || !viewer.ownedCompanyIds.has(companyId)) {
      throw new ForbiddenException("Only this company's approved owner can see its questions.");
    }
    const filter = opts.filter ?? "all";
    const where: Prisma.SocialQuestionWhereInput = {
      companyId,
      ...(filter === "all" ? {} : { visibility: COMPANY_FILTER_VISIBILITY[filter] }),
    };
    const [rows, counts] = await Promise.all([
      this.prisma.socialQuestion.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: SOCIAL_QUESTION_PAGE_SIZE + 1,
        ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
        select: QUESTION_ROW_SELECT,
      }),
      this.companyCounts(companyId),
    ]);
    const hasMore = rows.length > SOCIAL_QUESTION_PAGE_SIZE;
    const pageRows = hasMore ? rows.slice(0, SOCIAL_QUESTION_PAGE_SIZE) : rows;
    const questions = await this.serializeQuestions(pageRows, viewer, { allAnswers: false });
    return { questions, nextCursor: hasMore ? pageRows[pageRows.length - 1].id : null, counts };
  }

  // Just the three numbers, for the dashboard's side list ("2 waiting").
  async countsForCompany(userId: string, companyId: string): Promise<CompanyQuestionCounts> {
    const viewer = await this.loadViewer(userId);
    if (!viewer || !viewer.ownedCompanyIds.has(companyId)) {
      throw new ForbiddenException("Only this company's approved owner can see its questions.");
    }
    return this.companyCounts(companyId);
  }

  private async companyCounts(companyId: string): Promise<CompanyQuestionCounts> {
    const grouped = await this.prisma.socialQuestion.groupBy({ by: ["visibility"], where: { companyId }, _count: { _all: true } });
    const counts: CompanyQuestionCounts = { waiting: 0, hidden: 0, shown: 0 };
    for (const g of grouped) {
      if (g.visibility === "PENDING") counts.waiting = g._count._all;
      else if (g.visibility === "HIDDEN") counts.hidden = g._count._all;
      else counts.shown = g._count._all;
    }
    return counts;
  }

  // The asked company's approved owner hides a question or shows it to
  // everyone. Showing needs the company's own answer on it first.
  async setVisibility(userId: string, questionId: string, visibility: CompanyQuestionVisibilityChoice): Promise<PublicSocialQuestion> {
    const viewer = await this.loadViewer(userId);
    const question = await this.prisma.socialQuestion.findUnique({ where: { id: questionId }, select: { companyId: true } });
    if (!question) throw new NotFoundException("Question not found");
    if (!viewer || !question.companyId || !viewer.ownedCompanyIds.has(question.companyId)) {
      throw new ForbiddenException("Only the company that was asked can hide or show this question.");
    }
    if (visibility === "PUBLIC") {
      const answered = await this.prisma.socialAnswer.count({ where: { questionId, identityMode: "OWNER_REAL_NAME" } });
      if (answered === 0) throw new BadRequestException("Answer the question first - then you can show it to everyone.");
    }
    const row = await this.prisma.socialQuestion.update({ where: { id: questionId }, data: { visibility }, select: QUESTION_ROW_SELECT });
    const [serialized] = await this.serializeQuestions([row], viewer, { allAnswers: false });
    return serialized;
  }

  // The name a member would ask or answer under, for the composer.
  async identity(userId: string): Promise<SocialQuestionIdentity> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { reviewUsername: true, avatarKey: true, avatarGradient: true },
    });
    return { displayUsername: user.reviewUsername, avatarKey: user.avatarKey, avatarGradient: user.avatarGradient };
  }

  // A member answers anonymously (never their own question); the approved
  // owner of the asked company answers under their real name. Nobody else
  // can answer: another company's owner has no standing in the thread, and a
  // kind-of-work question has no company to speak for.
  //
  // The owner's answer also settles who sees the question: `visibility` from
  // the answer form, or - left out - a question still waiting becomes hidden
  // and any other keeps its state. A member's `visibility` is ignored.
  async answer(userId: string, questionId: string, input: CreateSocialAnswerInput): Promise<PublicSocialAnswer> {
    const viewer = await this.loadViewer(userId);
    if (!viewer) throw new ForbiddenException();
    const question = await this.prisma.socialQuestion.findFirst({
      where: { AND: [{ id: questionId }, viewableBy(viewer)] },
      select: { id: true, companyId: true, workType: true, authorUserId: true, visibility: true, company: { select: { name: true } } },
    });
    if (!question) throw new NotFoundException("Question not found");

    let identityMode: CommentIdentityMode;
    let nextVisibility: SocialQuestionVisibility | null = null;
    let randomUsername: string | null = null;
    let workedThere = false;
    if (viewer.role === "MEMBER") {
      if (question.authorUserId === userId) {
        throw new ForbiddenException("You can't answer your own question.");
      }
      identityMode = input.identityMode ?? "PERSONAL_CHOSEN";
      if (identityMode === "PERSONAL_RANDOM") randomUsername = this.randomName(question.workType as WorkplaceType | null);
      if (question.companyId) {
        workedThere = (await this.prisma.employmentHistory.count({ where: { userId, companyId: question.companyId } })) > 0;
      }
    } else if (viewer.role === "COMPANY_OWNER" && question.companyId && viewer.ownedCompanyIds.has(question.companyId)) {
      await this.requireOwnerName(userId);
      identityMode = "OWNER_REAL_NAME";
      nextVisibility = input.visibility ?? (question.visibility === "PENDING" ? "HIDDEN" : question.visibility);
    } else {
      throw new ForbiddenException("Only members and the company that was asked can answer this question.");
    }

    this.assertTextAllowed(input.body, question.company?.name ?? null);

    let row: AnswerRow;
    try {
      const create = this.prisma.socialAnswer.create({
        data: { questionId, authorUserId: userId, body: input.body, identityMode, randomUsername, workedThere },
        select: ANSWER_ROW_SELECT,
      });
      if (nextVisibility !== null && nextVisibility !== question.visibility) {
        // The answer and who-sees-it land together or not at all.
        [row] = await this.prisma.$transaction([
          create,
          this.prisma.socialQuestion.update({ where: { id: questionId }, data: { visibility: nextVisibility }, select: { id: true } }),
        ]);
      } else {
        row = await create;
      }
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new BadRequestException("You already answered this question.");
      }
      throw err;
    }
    const [answer] = await this.serializeAnswers([row], viewer);
    return answer;
  }

  // Author-only; the answers go with it. A company cannot remove a question
  // put to it.
  async deleteQuestion(userId: string, questionId: string): Promise<{ success: true }> {
    const question = await this.prisma.socialQuestion.findUnique({ where: { id: questionId }, select: { authorUserId: true } });
    if (!question) throw new NotFoundException("Question not found");
    if (question.authorUserId !== userId) throw new ForbiddenException("You can only delete your own question.");
    await this.prisma.socialQuestion.deleteMany({ where: { id: questionId } });
    return { success: true };
  }

  async deleteAnswer(userId: string, answerId: string): Promise<{ success: true }> {
    const answer = await this.prisma.socialAnswer.findUnique({ where: { id: answerId }, select: { authorUserId: true } });
    if (!answer) throw new NotFoundException("Answer not found");
    if (answer.authorUserId !== userId) throw new ForbiddenException("You can only delete your own answer.");
    await this.prisma.socialAnswer.deleteMany({ where: { id: answerId } });
    return { success: true };
  }

  // "Helpful" on an answer: one per member, a second click takes it off.
  async toggleHelpful(userId: string, answerId: string): Promise<SocialAnswerHelpfulResult> {
    const viewer = await this.loadViewer(userId);
    const answer = await this.prisma.socialAnswer.findFirst({
      where: { id: answerId, question: viewableBy(viewer) },
      select: { authorUserId: true },
    });
    if (!answer) throw new NotFoundException("Answer not found");
    if (answer.authorUserId === userId) throw new ForbiddenException("You can't mark your own answer as helpful.");

    const existing = await this.prisma.socialAnswerVote.findUnique({ where: { answerId_userId: { answerId, userId } } });
    let helpfulByMe: boolean;
    try {
      if (existing) {
        await this.prisma.socialAnswerVote.delete({ where: { id: existing.id } });
        helpfulByMe = false;
      } else {
        await this.prisma.socialAnswerVote.create({ data: { answerId, userId } });
        helpfulByMe = true;
      }
    } catch (err) {
      // A double click can lose the create / delete race; the vote is then
      // whatever the winner left - read it once.
      const benign = err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2002" || err.code === "P2025");
      if (!benign) throw err;
      helpfulByMe = (await this.prisma.socialAnswerVote.findUnique({ where: { answerId_userId: { answerId, userId } } })) !== null;
    }
    const helpfulCount = await this.prisma.socialAnswerVote.count({ where: { answerId } });
    return { answerId, helpfulCount, helpfulByMe };
  }

  // Anyone signed in who can see the item, except its own author; a repeat
  // report from the same person adds nothing. Every reported item is listed
  // for the admins (adminListReported) - this is how the asked company flags
  // a question it shouldn't have been sent. Crossing three reports also runs
  // the content rules again and, on a match, marks the item as pre-flagged.
  // It is never removed automatically.
  async report(
    userId: string,
    kind: "QUESTION" | "ANSWER",
    id: string,
    reason: SocialCommentReportReason,
  ): Promise<ReportSocialCommentResult> {
    const viewable = viewableBy(await this.loadViewer(userId));
    const select = { authorUserId: true, body: true, flaggedForReview: true } as const;
    const item =
      kind === "QUESTION"
        ? await this.prisma.socialQuestion.findFirst({ where: { AND: [{ id }, viewable] }, select })
        : await this.prisma.socialAnswer.findFirst({ where: { id, question: viewable }, select });
    if (!item) throw new NotFoundException(kind === "QUESTION" ? "Question not found" : "Answer not found");
    if (item.authorUserId === userId) throw new ForbiddenException("You can't report your own text.");

    const target = kind === "QUESTION" ? { questionId: id } : { answerId: id };
    try {
      await this.prisma.socialQuestionReport.create({ data: { ...target, reporterId: userId, reason } });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
      // Already reported by this person - no new row.
    }
    const reportCount = await this.prisma.socialQuestionReport.count({ where: target });

    if (reportCount >= REPORTS_BEFORE_RECHECK && !item.flaggedForReview) {
      const check = this.moderation.checkContent([item.body]);
      if (check.violates) {
        const data = { flaggedForReview: true, flaggedReviewReason: check.violationTypes.join(", ") };
        if (kind === "QUESTION") await this.prisma.socialQuestion.update({ where: { id }, data });
        else await this.prisma.socialAnswer.update({ where: { id }, data });
      }
    }
    return { commentId: id, reportCount };
  }

  // --- ADMIN (AdminSocialQuestionsController). The content and its reports,
  // never who wrote it.

  async adminListReported(): Promise<AdminReportedSocialQuestionItem[]> {
    const [questions, answers] = await Promise.all([
      this.prisma.socialQuestion.findMany({
        where: { reports: { some: {} } },
        select: {
          id: true,
          body: true,
          createdAt: true,
          companyId: true,
          flaggedForReview: true,
          flaggedReviewReason: true,
          _count: { select: { reports: true } },
        },
        take: 2000,
      }),
      this.prisma.socialAnswer.findMany({
        where: { reports: { some: {} } },
        select: {
          id: true,
          questionId: true,
          body: true,
          createdAt: true,
          flaggedForReview: true,
          flaggedReviewReason: true,
          question: { select: { body: true, companyId: true } },
          _count: { select: { reports: true } },
        },
        take: 2000,
      }),
    ]);
    const reports =
      questions.length + answers.length > 0
        ? await this.prisma.socialQuestionReport.findMany({
            where: { OR: [{ questionId: { in: questions.map((q) => q.id) } }, { answerId: { in: answers.map((a) => a.id) } }] },
            select: { questionId: true, answerId: true, reason: true, reporterId: true },
          })
        : [];
    // Which reports came from the asked company itself: its approved owners,
    // looked up once. Only the yes/no leaves this method, never who.
    const companyIdByItem = new Map<string, string | null>([
      ...questions.map((q) => [q.id, q.companyId] as const),
      ...answers.map((a) => [a.id, a.question.companyId] as const),
    ]);
    const askedCompanyIds = [...new Set([...companyIdByItem.values()].filter((id): id is string => id !== null))];
    const owners =
      askedCompanyIds.length > 0
        ? await this.prisma.companyOwner.findMany({
            where: { companyId: { in: askedCompanyIds }, claimStatus: "APPROVED" },
            select: { companyId: true, userId: true },
          })
        : [];
    const ownerPairs = new Set(owners.map((o) => `${o.companyId} ${o.userId}`));
    const reasonsByItem = new Map<string, Record<string, number>>();
    const reportedByCompany = new Set<string>();
    for (const r of reports) {
      const key = r.questionId ?? r.answerId;
      if (!key) continue;
      const bucket = reasonsByItem.get(key) ?? {};
      bucket[r.reason] = (bucket[r.reason] ?? 0) + 1;
      reasonsByItem.set(key, bucket);
      const companyId = companyIdByItem.get(key);
      if (companyId && r.reporterId && ownerPairs.has(`${companyId} ${r.reporterId}`)) reportedByCompany.add(key);
    }

    const items: AdminReportedSocialQuestionItem[] = [
      ...questions.map((q) => ({
        kind: "QUESTION" as const,
        id: q.id,
        questionId: q.id,
        body: q.body,
        questionBody: q.body,
        createdAt: q.createdAt.toISOString(),
        reportCount: q._count.reports,
        reportReasonCounts: reasonsByItem.get(q.id) ?? {},
        flaggedForReview: q.flaggedForReview,
        flaggedReviewReason: q.flaggedReviewReason,
        reportedByCompany: reportedByCompany.has(q.id),
      })),
      ...answers.map((a) => ({
        kind: "ANSWER" as const,
        id: a.id,
        questionId: a.questionId,
        body: a.body,
        questionBody: a.question.body,
        createdAt: a.createdAt.toISOString(),
        reportCount: a._count.reports,
        reportReasonCounts: reasonsByItem.get(a.id) ?? {},
        flaggedForReview: a.flaggedForReview,
        flaggedReviewReason: a.flaggedReviewReason,
        reportedByCompany: reportedByCompany.has(a.id),
      })),
    ];
    // The pre-flagged ones first, then newest.
    return items.sort((a, b) => Number(b.flaggedForReview) - Number(a.flaggedForReview) || (a.createdAt < b.createdAt ? 1 : -1));
  }

  // "Looked at it, nothing wrong": the reports are cleared so the item
  // leaves the queue. It can be reported again later.
  async adminDismiss(kind: "QUESTION" | "ANSWER", id: string): Promise<{ success: true }> {
    const data = { flaggedForReview: false, flaggedReviewReason: null };
    if (kind === "QUESTION") {
      const found = await this.prisma.socialQuestion.updateMany({ where: { id }, data });
      if (found.count === 0) throw new NotFoundException("Question not found");
      await this.prisma.socialQuestionReport.deleteMany({ where: { questionId: id } });
    } else {
      const found = await this.prisma.socialAnswer.updateMany({ where: { id }, data });
      if (found.count === 0) throw new NotFoundException("Answer not found");
      await this.prisma.socialQuestionReport.deleteMany({ where: { answerId: id } });
    }
    return { success: true };
  }

  async adminRemove(adminUserId: string, kind: "QUESTION" | "ANSWER", id: string): Promise<{ success: true }> {
    const removed =
      kind === "QUESTION"
        ? await this.prisma.socialQuestion.deleteMany({ where: { id } })
        : await this.prisma.socialAnswer.deleteMany({ where: { id } });
    if (removed.count === 0) throw new NotFoundException(kind === "QUESTION" ? "Question not found" : "Answer not found");
    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminUserId,
        action: kind === "QUESTION" ? "SOCIAL_QUESTION_REMOVED" : "SOCIAL_ANSWER_REMOVED",
        targetType: kind === "QUESTION" ? "SocialQuestion" : "SocialAnswer",
        targetId: id,
      },
    });
    return { success: true };
  }

  // --- internals

  // The asked company's own name is taken out before the check: "Does Demo
  // Finans pay on time?" would otherwise read as a person's name (two
  // capitalised words in a row).
  private assertTextAllowed(text: string, companyName: string | null): void {
    const checked = companyName ? text.replace(new RegExp(escapeRegExp(companyName), "giu"), " ") : text;
    if (this.moderation.checkContent([checked]).violates) {
      throw new BadRequestException(TEXT_REJECTED_MESSAGE);
    }
  }

  private randomName(workType: WorkplaceType | null | undefined): string {
    const all = workplaceTypeSchema.options;
    return pickRandomDisplayUsername(workType ?? (all[Math.floor(Math.random() * all.length)] as WorkplaceType));
  }

  // An owner answers under their real name, so there has to be one.
  private async requireOwnerName(userId: string): Promise<void> {
    const profile = await this.prisma.employerProfile.findUnique({
      where: { userId },
      select: { encFirstName: true, encLastName: true },
    });
    if (!profile?.encFirstName || !profile.encLastName) {
      throw new ForbiddenException("Complete your employer profile name before answering - a company answers under its owner's real name.");
    }
  }

  private async loadViewer(viewerUserId: string | undefined): Promise<Viewer | null> {
    if (!viewerUserId) return null;
    const user = await this.prisma.user.findUnique({ where: { id: viewerUserId }, select: { role: true } });
    if (!user) return null;
    const owned =
      user.role === "COMPANY_OWNER"
        ? await this.prisma.companyOwner.findMany({
            where: { userId: viewerUserId, claimStatus: "APPROVED" },
            select: { companyId: true },
          })
        : [];
    return { id: viewerUserId, role: user.role, ownedCompanyIds: new Set(owned.map((o) => o.companyId)) };
  }

  private async serializeQuestions(
    rows: QuestionRow[],
    viewer: Viewer | null,
    options: { allAnswers: boolean },
  ): Promise<PublicSocialQuestion[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const authorIds = [...new Set(rows.map((r) => r.authorUserId).filter((id): id is string => id !== null))];

    const [authors, answerRows, myAnswers] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, avatarKey: true, avatarGradient: true, reviewUsername: true },
      }),
      options.allAnswers ? this.allAnswerRows(ids) : this.previewAnswerRows(ids),
      viewer
        ? this.prisma.socialAnswer.findMany({
            where: { questionId: { in: ids }, authorUserId: viewer.id },
            select: { questionId: true },
          })
        : Promise.resolve([]),
    ]);
    const authorById = new Map(authors.map((a) => [a.id, a]));
    const answeredByMe = new Set(myAnswers.map((a) => a.questionId));
    const answers = await this.serializeAnswers(answerRows, viewer);
    const answersByQuestion = new Map<string, PublicSocialAnswer[]>();
    for (const a of answers) {
      const list = answersByQuestion.get(a.questionId) ?? [];
      list.push(a);
      answersByQuestion.set(a.questionId, list);
    }

    return rows.map((r) => {
      const mine = viewer !== null && r.authorUserId === viewer.id;
      const author = r.authorUserId !== null ? authorById.get(r.authorUserId) : undefined;
      const random = r.identityMode === "PERSONAL_RANDOM";
      const target: SocialQuestionTarget =
        r.companyId && r.company
          ? {
              kind: "company",
              companyId: r.companyId,
              companySlug: r.company.slug,
              companyName: r.company.name,
              companyLogoUrl: r.company.mainPhotoUrl,
              companyBadgeTier: r.company.badgeTier as Extract<SocialQuestionTarget, { kind: "company" }>["companyBadgeTier"],
            }
          : { kind: "workType", workType: (r.workType ?? "OFFICE") as WorkplaceType };

      const ownsAskedCompany = viewer?.role === "COMPANY_OWNER" && r.companyId !== null && viewer.ownedCompanyIds.has(r.companyId);
      const canAnswer = viewer !== null && !answeredByMe.has(r.id) && (viewer.role === "MEMBER" ? !mine : ownsAskedCompany);
      // The company's own answer leads, then the order the rows came in.
      const sorted = [...(answersByQuestion.get(r.id) ?? [])].sort((a, b) => Number(b.fromCompany) - Number(a.fromCompany));
      const visibility = r.visibility as SocialQuestionVisibility;

      return {
        id: r.id,
        body: r.body,
        // Hour precision, like every other time on IWT Social.
        createdAt: toUtcHour(r.createdAt).toISOString(),
        target,
        displayUsername: random ? r.randomUsername : (author?.reviewUsername ?? null),
        avatarKey: random ? RANDOMIZED_IDENTITY_AVATAR_KEY : (author?.avatarKey ?? null),
        avatarGradient: random ? RANDOMIZED_IDENTITY_AVATAR_GRADIENT : (author?.avatarGradient ?? null),
        mine,
        answerCount: r._count.answers,
        answers: options.allAnswers ? sorted : sorted.slice(0, SOCIAL_QUESTION_PREVIEW_ANSWERS),
        canAnswer,
        answersAsCompany: canAnswer && ownsAskedCompany,
        visibility,
        canSetVisibility: ownsAskedCompany,
        // Both answer reads carry every company answer, so this is exact.
        companyAnswered: sorted.some((a) => a.fromCompany),
      };
    });
  }

  private allAnswerRows(questionIds: string[]): Promise<AnswerRow[]> {
    return this.prisma.socialAnswer.findMany({
      where: { questionId: { in: questionIds } },
      orderBy: ANSWER_ORDER,
      take: ANSWERS_ON_PAGE,
      select: ANSWER_ROW_SELECT,
    });
  }

  // For a list: each question's company answer plus its most helpful ones,
  // read per question so one busy thread can't crowd out the others.
  private async previewAnswerRows(questionIds: string[]): Promise<AnswerRow[]> {
    const [companyAnswers, ...perQuestion] = await Promise.all([
      this.prisma.socialAnswer.findMany({
        where: { questionId: { in: questionIds }, identityMode: "OWNER_REAL_NAME" },
        select: ANSWER_ROW_SELECT,
      }),
      ...questionIds.map((questionId) =>
        this.prisma.socialAnswer.findMany({
          where: { questionId, identityMode: { not: "OWNER_REAL_NAME" } },
          orderBy: ANSWER_ORDER,
          take: SOCIAL_QUESTION_PREVIEW_ANSWERS,
          select: ANSWER_ROW_SELECT,
        }),
      ),
    ]);
    return [...companyAnswers, ...perQuestion.flat()];
  }

  // Three name sources, as for a comment: the owner's decrypted name, the
  // row's own random name, or the member's reviewUsername. Explicit selects
  // throughout - never a whole user row on an answer-shaped payload.
  private async serializeAnswers(rows: AnswerRow[], viewer: Viewer | null): Promise<PublicSocialAnswer[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const authorIds = [...new Set(rows.map((r) => r.authorUserId).filter((id): id is string => id !== null))];
    const ownerIds = [
      ...new Set(rows.filter((r) => r.identityMode === "OWNER_REAL_NAME" && r.authorUserId !== null).map((r) => r.authorUserId as string)),
    ];
    const [authors, profiles, myVotes] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, avatarKey: true, avatarGradient: true, reviewUsername: true },
      }),
      ownerIds.length > 0
        ? this.prisma.employerProfile.findMany({
            where: { userId: { in: ownerIds } },
            select: { userId: true, encFirstName: true, encLastName: true, profilePictureUrl: true, dekWrapped: true },
          })
        : Promise.resolve([]),
      viewer
        ? this.prisma.socialAnswerVote.findMany({ where: { answerId: { in: ids }, userId: viewer.id }, select: { answerId: true } })
        : Promise.resolve([]),
    ]);
    const authorById = new Map(authors.map((a) => [a.id, a]));
    const profileByUserId = new Map(profiles.map((p) => [p.userId, p]));
    const votedByMe = new Set(myVotes.map((v) => v.answerId));

    return rows.map((r) => {
      const fromCompany = r.identityMode === "OWNER_REAL_NAME";
      let identity: Pick<PublicSocialAnswer, "displayUsername" | "avatarKey" | "avatarGradient" | "avatarPhotoUrl">;
      if (fromCompany) {
        const profile = r.authorUserId !== null ? (profileByUserId.get(r.authorUserId) ?? null) : null;
        identity = { ...ownerDisplayFromProfile(profile), avatarKey: null, avatarGradient: null };
      } else if (r.identityMode === "PERSONAL_RANDOM") {
        identity = {
          displayUsername: r.randomUsername,
          avatarKey: RANDOMIZED_IDENTITY_AVATAR_KEY,
          avatarGradient: RANDOMIZED_IDENTITY_AVATAR_GRADIENT,
          avatarPhotoUrl: null,
        };
      } else {
        const a = r.authorUserId !== null ? authorById.get(r.authorUserId) : undefined;
        identity = {
          displayUsername: a?.reviewUsername ?? null,
          avatarKey: a?.avatarKey ?? null,
          avatarGradient: a?.avatarGradient ?? null,
          avatarPhotoUrl: null,
        };
      }
      return {
        id: r.id,
        questionId: r.questionId,
        body: r.body,
        createdAt: toUtcHour(r.createdAt).toISOString(),
        fromCompany,
        workedThere: r.workedThere,
        ...identity,
        mine: viewer !== null && r.authorUserId === viewer.id,
        helpfulCount: r._count.votes,
        helpfulByMe: viewer ? votedByMe.has(r.id) : null,
      };
    });
  }
}

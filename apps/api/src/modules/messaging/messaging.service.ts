import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  CannotSendReason,
  ContentViolationType,
  ConversationSummary,
  ConversationThread,
  SendMessageInput,
} from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ModerationService } from "../moderation/moderation.service";
import { publicReviewerName } from "../reviews/display-name.util";
import { toUtcDay } from "../../common/time/day-precision.util";

type Side = "REVIEWER" | "COMPANY";

const REVIEW_EXCERPT_LENGTH = 280;
const PREVIEW_LENGTH = 120;
// Shown to the company if a reviewer somehow has no handle yet (every ACTIVE
// member gets one at onboarding, so this is a safety net, never an id).
const FALLBACK_REVIEWER_NAME = "Anonymous reviewer";

const THREAD_INCLUDE = {
  review: {
    select: {
      userId: true,
      isRandomizedIdentity: true,
      displayUsername: true,
      generalThoughts: true,
      user: { select: { reviewUsername: true } },
    },
  },
  company: { select: { name: true, slug: true } },
  messages: { orderBy: { seq: "asc" } },
} satisfies Prisma.ReviewConversationInclude;

const SUMMARY_INCLUDE = {
  ...THREAD_INCLUDE,
  messages: { orderBy: { seq: "desc" }, take: 1 },
} satisfies Prisma.ReviewConversationInclude;

type ThreadRow = Prisma.ReviewConversationGetPayload<{ include: typeof THREAD_INCLUDE }>;
type ConversationRow = Omit<ThreadRow, "messages"> & { messages: ThreadRow["messages"] };

const toDay = (d: Date) => d.toISOString().slice(0, 10);

// Plain-language reasons for a blocked message (the raw codes stay in
// violationTypes for any client that wants them).
const VIOLATION_WORDING: Record<ContentViolationType, string> = {
  NAME_OR_SURNAME: "a person's name",
  JOB_TITLE: "a specific job title that could identify someone",
  PROFANITY: "offensive words",
  ABUSE_OR_INSULT: "insults or shouting",
  PII_PHONE_NUMBER: "a phone number",
};

/**
 * Private reviewer <-> company conversations (see
 * docs/superpowers/specs/2026-09-25-reviewer-company-messaging-design.md).
 *
 * Every conversation-level call resolves which side the caller is on from
 * the database, never from the client: the review's author is REVIEWER, an
 * APPROVED owner of the company is COMPANY, anyone else gets a 404 (not a
 * 403, so outsiders can't probe which conversations exist). Nothing returned
 * to either side carries a user id, and the company only ever sees the
 * review's public display name.
 */
@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
  ) {}

  async startConversation(userId: string, reviewId: string, input: SendMessageInput): Promise<ConversationThread> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, userId: true, companyId: true, status: true, companyReply: { select: { id: true } } },
    });
    if (!review || review.userId !== userId || review.status !== "PUBLISHED" || !review.companyReply) {
      throw new NotFoundException("Review not found");
    }
    this.assertClean(input.content);

    let conversationId: string;
    try {
      conversationId = await this.prisma.$transaction(async (tx) => {
        const created = await tx.reviewConversation.create({
          data: {
            reviewId,
            companyId: review.companyId,
            reviewerUserId: userId,
            messages: { create: { side: "REVIEWER", authorUserId: userId, content: input.content } },
          },
          include: { messages: true },
        });
        await tx.reviewConversation.update({
          where: { id: created.id },
          data: { reviewerLastReadSeq: created.messages[0].seq },
        });
        return created.id;
      });
    } catch (err) {
      // reviewId is @unique: one conversation per review, ever — including
      // an ended one, which is what makes "End conversation" permanent.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("You already have a conversation about this review");
      }
      throw err;
    }
    return this.getThread(userId, conversationId);
  }

  async getThread(userId: string, conversationId: string): Promise<ConversationThread> {
    const conversation = await this.loadThread(conversationId);
    const side = await this.resolveSide(userId, conversation);
    return this.toThread(conversation, side);
  }

  async listMine(userId: string): Promise<ConversationSummary[]> {
    const rows = await this.prisma.reviewConversation.findMany({
      where: { reviewerUserId: userId },
      include: SUMMARY_INCLUDE,
    });
    return this.toSortedSummaries(rows, "REVIEWER");
  }

  async listForCompany(userId: string, companyId: string): Promise<ConversationSummary[]> {
    if (!(await this.isApprovedOwner(userId, companyId))) {
      throw new ForbiddenException("You don't have an approved claim on this company");
    }
    const rows = await this.prisma.reviewConversation.findMany({
      where: { companyId },
      include: SUMMARY_INCLUDE,
    });
    return this.toSortedSummaries(rows, "COMPANY");
  }

  /**
   * Rules, in order: ended -> 409; reviewer writing again before any company
   * message -> 409 (the company can never write first, since a conversation
   * only exists once the reviewer has); content check -> 400, nothing saved.
   */
  async sendMessage(userId: string, conversationId: string, input: SendMessageInput): Promise<ConversationThread> {
    const conversation = await this.loadThread(conversationId);
    const side = await this.resolveSide(userId, conversation);
    const reason = this.cannotSendReason(conversation, side);
    if (reason === "ENDED") throw new ConflictException("This conversation has ended.");
    if (reason === "AWAITING_COMPANY") {
      throw new ConflictException("Wait for the company to answer before sending another message.");
    }
    this.assertClean(input.content);

    await this.prisma.$transaction(async (tx) => {
      const message = await tx.reviewConversationMessage.create({
        data: { conversationId, side, authorUserId: userId, content: input.content },
      });
      // Your own message never counts as unread for you.
      await tx.reviewConversation.update({
        where: { id: conversationId },
        data: side === "REVIEWER" ? { reviewerLastReadSeq: message.seq } : { companyLastReadSeq: message.seq },
      });
    });
    return this.getThread(userId, conversationId);
  }

  /** Permanent for both sides. Ending an already-ended conversation keeps the original ender. */
  async endConversation(userId: string, conversationId: string): Promise<ConversationThread> {
    const conversation = await this.loadThread(conversationId);
    const side = await this.resolveSide(userId, conversation);
    if (!conversation.endedAt) {
      await this.prisma.reviewConversation.update({
        where: { id: conversationId },
        data: { endedAt: toUtcDay(), endedBy: side },
      });
    }
    return this.getThread(userId, conversationId);
  }

  async markRead(userId: string, conversationId: string): Promise<void> {
    const conversation = await this.loadThread(conversationId);
    const side = await this.resolveSide(userId, conversation);
    const latest = conversation.messages[conversation.messages.length - 1];
    if (!latest) return;
    await this.prisma.reviewConversation.update({
      where: { id: conversationId },
      data: side === "REVIEWER" ? { reviewerLastReadSeq: latest.seq } : { companyLastReadSeq: latest.seq },
    });
  }

  // --- internals ---------------------------------------------------------

  private async loadThread(conversationId: string): Promise<ThreadRow> {
    const conversation = await this.prisma.reviewConversation.findUnique({
      where: { id: conversationId },
      include: THREAD_INCLUDE,
    });
    if (!conversation) throw new NotFoundException("Conversation not found");
    return conversation;
  }

  /** Reviewer wins if the caller is somehow both (owners can't rate their own company today). */
  private async resolveSide(userId: string, conversation: { reviewerUserId: string; companyId: string }): Promise<Side> {
    if (conversation.reviewerUserId === userId) return "REVIEWER";
    if (await this.isApprovedOwner(userId, conversation.companyId)) return "COMPANY";
    throw new NotFoundException("Conversation not found");
  }

  /** Same 3-line check as ReviewsService.requireApprovedCompanyOwnership, kept local per module. */
  private async isApprovedOwner(userId: string, companyId: string): Promise<boolean> {
    const ownership = await this.prisma.companyOwner.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    return ownership?.claimStatus === "APPROVED";
  }

  private assertClean(content: string): void {
    const check = this.moderation.checkContent([content]);
    if (check.violates) {
      const reasons = [...new Set(check.violationTypes.map((t) => VIOLATION_WORDING[t]))].join(", ");
      throw new BadRequestException({
        message: `Your message couldn't be sent because it seems to contain ${reasons}. Please rephrase it and try again.`,
        violationTypes: check.violationTypes,
      });
    }
  }

  private cannotSendReason(conversation: ThreadRow, side: Side): CannotSendReason | null {
    if (conversation.endedAt) return "ENDED";
    if (side === "REVIEWER" && !conversation.messages.some((m) => m.side === "COMPANY")) return "AWAITING_COMPANY";
    return null;
  }

  private toSummary(conversation: ConversationRow, side: Side): ConversationSummary {
    // A thread row holds every message oldest-first; a summary row holds only
    // the newest one (SUMMARY_INCLUDE) — the last element is the newest either way.
    const last = conversation.messages[conversation.messages.length - 1];
    const myLastRead = side === "REVIEWER" ? conversation.reviewerLastReadSeq : conversation.companyLastReadSeq;
    return {
      id: conversation.id,
      reviewId: conversation.reviewId,
      counterpartName:
        side === "REVIEWER"
          ? conversation.company.name
          : (publicReviewerName(conversation.review, conversation.review.user) ?? FALLBACK_REVIEWER_NAME),
      companySlug: side === "REVIEWER" ? conversation.company.slug : null,
      lastMessagePreview: last ? last.content.slice(0, PREVIEW_LENGTH) : "",
      lastMessageDay: toDay(last ? last.createdAt : conversation.createdAt),
      unread: last ? last.seq > myLastRead : false,
      ended: conversation.endedAt !== null,
      endedBy: conversation.endedBy ? (conversation.endedBy === side ? "YOU" : "THEM") : null,
    };
  }

  private toSortedSummaries(rows: ConversationRow[], side: Side): ConversationSummary[] {
    const lastSeq = (row: ConversationRow) => row.messages[0]?.seq ?? 0;
    return [...rows].sort((a, b) => lastSeq(b) - lastSeq(a)).map((row) => this.toSummary(row, side));
  }

  private toThread(conversation: ThreadRow, side: Side): ConversationThread {
    const reason = this.cannotSendReason(conversation, side);
    return {
      ...this.toSummary(conversation, side),
      companyName: conversation.company.name,
      reviewExcerpt: conversation.review.generalThoughts?.slice(0, REVIEW_EXCERPT_LENGTH) ?? null,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        fromMe: m.side === side,
        day: toDay(m.createdAt),
        content: m.content,
      })),
      canSend: reason === null,
      cannotSendReason: reason,
    };
  }
}

import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { z } from "zod";
import {
  SOCIAL_SCHEDULED_POST_LIMITS,
  SOCIAL_SCHEDULE_MAX_DAYS_AHEAD,
  SOCIAL_SCHEDULE_MIN_MINUTES_AHEAD,
  socialPostKindSchema,
  type OwnerTier,
  type ScheduleSocialPostInput,
  type ScheduledSocialPost,
  type ScheduledSocialPostList,
} from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { SocialService, type PreparedSocialPost } from "./social.service";

// What a waiting post keeps of the composer's form (ScheduledSocialPost.payload).
const payloadSchema = z.object({
  kind: socialPostKindSchema,
  caption: z.string().nullable(),
  title: z.string().nullable(),
  eventStartsAt: z.string().nullable(),
  eventLocation: z.string().nullable(),
  pollOptions: z.array(z.string()),
  pollDays: z.number().nullable(),
  jobPostingId: z.string().nullable(),
});
type Payload = z.infer<typeof payloadSchema>;

const ROW_SELECT = {
  id: true,
  companyId: true,
  authorUserId: true,
  publishAt: true,
  status: true,
  payload: true,
  imageUrls: true,
  imageAspectRatios: true,
  failureReason: true,
} as const;
interface Row {
  id: string;
  companyId: string;
  authorUserId: string | null;
  publishAt: Date;
  status: "SCHEDULED" | "FAILED";
  payload: unknown;
  imageUrls: string[];
  imageAspectRatios: number[];
  failureReason: string | null;
}

// How many due posts one pass of the worker takes.
const PUBLISH_BATCH = 20;
const NOT_ON_PLAN = "Posting later is part of the Starter plan and above.";

/**
 * Phase 4 of IWT Social: an owner writes a post now and names the moment it
 * goes out. Until then it is a ScheduledSocialPost, not a SocialPost, so no
 * feed, count or notification can show it early. Publishing creates the real
 * post and removes the waiting row in one transaction.
 *
 * How many posts a company may keep waiting comes from its plan
 * (SOCIAL_SCHEDULED_POST_LIMITS; Free has none). Everything is for an
 * approved owner of the company - never the shared company login.
 */
@Injectable()
export class SocialScheduleService {
  private readonly logger = new Logger(SocialScheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly social: SocialService,
  ) {}

  async schedule(userId: string, input: ScheduleSocialPostInput, files: Express.Multer.File[] | undefined): Promise<ScheduledSocialPost> {
    const { limit } = await this.planFor(userId, input.companyId);
    if (limit === 0) throw new ForbiddenException(NOT_ON_PLAN);
    const publishAt = this.checkedTime(input.publishAt);
    await this.assertRoom(input.companyId, limit);

    // The same checks as a post that goes out now (ownership, content rules,
    // photos); done here so a problem is named while the owner is still
    // looking at the form, not at 3 a.m. when its time comes.
    const prepared = await this.social.prepareNewPost(userId, input, files, publishAt);
    const payload: Payload = {
      kind: prepared.kind,
      caption: prepared.caption,
      title: prepared.title,
      eventStartsAt: prepared.eventStartsAt ? prepared.eventStartsAt.toISOString() : null,
      eventLocation: prepared.eventLocation,
      pollOptions: prepared.pollOptions,
      pollDays: prepared.pollDays,
      jobPostingId: prepared.jobPostingId,
    };
    const row = await this.prisma.scheduledSocialPost.create({
      data: {
        companyId: prepared.companyId,
        authorUserId: userId,
        publishAt,
        payload,
        imageUrls: prepared.imageUrls,
        imageAspectRatios: prepared.imageAspectRatios,
      },
      select: ROW_SELECT,
    });
    return this.serialize(row);
  }

  // A company's waiting posts, soonest first, and what its plan allows.
  async list(userId: string, companyId: string): Promise<ScheduledSocialPostList> {
    const { tier, limit } = await this.planFor(userId, companyId);
    const rows = await this.prisma.scheduledSocialPost.findMany({
      where: { companyId },
      orderBy: [{ publishAt: "asc" }, { id: "asc" }],
      select: ROW_SELECT,
    });
    return {
      posts: rows.map((r) => this.serialize(r)),
      tier,
      limit,
      waiting: rows.filter((r) => r.status === "SCHEDULED").length,
    };
  }

  // A new time. Also how a post that could not go out is put back in line.
  async reschedule(userId: string, id: string, publishAtIso: string): Promise<ScheduledSocialPost> {
    const row = await this.ownedRow(userId, id);
    const { limit } = await this.planFor(userId, row.companyId);
    if (limit === 0) throw new ForbiddenException(NOT_ON_PLAN);
    const publishAt = this.checkedTime(publishAtIso);
    const payload = payloadSchema.parse(row.payload);
    if (payload.eventStartsAt && new Date(payload.eventStartsAt) <= publishAt) {
      throw new BadRequestException("The event has to start after the post goes out.");
    }
    if (row.status === "FAILED") await this.assertRoom(row.companyId, limit);
    const updated = await this.prisma.scheduledSocialPost.update({
      where: { id },
      data: { publishAt, status: "SCHEDULED", failureReason: null },
      select: ROW_SELECT,
    });
    return this.serialize(updated);
  }

  // "Post now" on a waiting post. Says why when it cannot go out.
  async publishNow(userId: string, id: string): Promise<{ id: string }> {
    const row = await this.ownedRow(userId, id);
    const result = await this.publish(row);
    if (!result) throw new NotFoundException("That post has already gone out.");
    if ("failed" in result) throw new BadRequestException(result.failed);
    return result;
  }

  async remove(userId: string, id: string): Promise<{ success: true }> {
    const row = await this.ownedRow(userId, id);
    const gone = await this.prisma.scheduledSocialPost.deleteMany({ where: { id } });
    // Published in the same instant: the photos are the live post's now.
    if (gone.count > 0) await this.social.unlinkImages(row.imageUrls);
    return { success: true };
  }

  /** The worker's pass: every waiting post whose time has come. Returns how many it handled. */
  async publishDue(now: Date = new Date()): Promise<number> {
    const due = await this.prisma.scheduledSocialPost.findMany({
      where: { status: "SCHEDULED", publishAt: { lte: now } },
      orderBy: [{ publishAt: "asc" }, { id: "asc" }],
      take: PUBLISH_BATCH,
      select: ROW_SELECT,
    });
    for (const row of due) {
      try {
        await this.publish(row);
      } catch (err) {
        // One bad row must not hold the rest back; it is tried again next pass.
        this.logger.error(`Scheduled post ${row.id} could not be published`, err as Error);
      }
    }
    return due.length;
  }

  // Creates the real post and removes the waiting row together. null when
  // another request published or deleted it first; { failed } when it can no
  // longer go out, with the reason kept on the row for the owner.
  private async publish(row: Row): Promise<{ id: string } | { failed: string } | null> {
    const payload = payloadSchema.parse(row.payload);
    const problem = await this.problemWith(row, payload);
    if (problem) {
      await this.prisma.scheduledSocialPost.updateMany({ where: { id: row.id }, data: { status: "FAILED", failureReason: problem } });
      return { failed: problem };
    }
    const prepared: PreparedSocialPost = {
      companyId: row.companyId,
      kind: payload.kind,
      caption: payload.caption,
      title: payload.title,
      eventStartsAt: payload.eventStartsAt ? new Date(payload.eventStartsAt) : null,
      eventLocation: payload.eventLocation,
      pollOptions: payload.pollOptions,
      pollDays: payload.pollDays,
      jobPostingId: payload.jobPostingId,
      imageUrls: row.imageUrls,
      imageAspectRatios: row.imageAspectRatios,
    };
    return this.prisma.$transaction(async (tx) => {
      // Whoever removes the row is the one that publishes it.
      const claimed = await tx.scheduledSocialPost.deleteMany({ where: { id: row.id } });
      if (claimed.count === 0) return null;
      return this.social.publishPrepared(prepared, row.authorUserId, tx);
    });
  }

  // What changed since the post was written that stops it going out.
  private async problemWith(row: Row, payload: Payload): Promise<string | null> {
    const owners = await this.prisma.companyOwner.count({ where: { companyId: row.companyId, claimStatus: "APPROVED" } });
    if (owners === 0) return "This company no longer has an approved owner.";
    if (payload.kind === "EVENT" && payload.eventStartsAt && new Date(payload.eventStartsAt) <= new Date()) {
      return "The event's date has already passed.";
    }
    if (payload.kind === "HIRING" && !(payload.jobPostingId && (await this.social.isLiveJobOf(row.companyId, payload.jobPostingId)))) {
      return "The job posting is no longer open.";
    }
    return null;
  }

  private checkedTime(iso: string): Date {
    const publishAt = new Date(iso);
    const now = Date.now();
    if (publishAt.getTime() < now + SOCIAL_SCHEDULE_MIN_MINUTES_AHEAD * 60_000) {
      throw new BadRequestException(`Pick a time at least ${SOCIAL_SCHEDULE_MIN_MINUTES_AHEAD} minutes from now.`);
    }
    if (publishAt.getTime() > now + SOCIAL_SCHEDULE_MAX_DAYS_AHEAD * 24 * 60 * 60_000) {
      throw new BadRequestException(`A post can be scheduled up to ${SOCIAL_SCHEDULE_MAX_DAYS_AHEAD} days ahead.`);
    }
    return publishAt;
  }

  private async assertRoom(companyId: string, limit: number): Promise<void> {
    const waiting = await this.prisma.scheduledSocialPost.count({ where: { companyId, status: "SCHEDULED" } });
    if (waiting >= limit) {
      throw new BadRequestException(
        `Your plan keeps up to ${limit} post${limit === 1 ? "" : "s"} waiting. Delete one, or wait for one to go out.`,
      );
    }
  }

  // Approved owner of the company, and the plan in force (a lapsed paid plan
  // counts as Free).
  private async planFor(userId: string, companyId: string): Promise<{ tier: OwnerTier; limit: number }> {
    const ownership = await this.prisma.companyOwner.findUnique({
      where: { userId_companyId: { userId, companyId } },
      select: { claimStatus: true, tier: true, planStatus: true },
    });
    if (!ownership || ownership.claimStatus !== "APPROVED") {
      throw new ForbiddenException("You are not an approved owner of this company.");
    }
    const tier: OwnerTier = ownership.planStatus === "ACTIVE" ? ownership.tier : "FREE";
    return { tier, limit: SOCIAL_SCHEDULED_POST_LIMITS[tier] };
  }

  private async ownedRow(userId: string, id: string): Promise<Row> {
    const row = await this.prisma.scheduledSocialPost.findUnique({ where: { id }, select: ROW_SELECT });
    if (!row) throw new NotFoundException("Scheduled post not found");
    await this.planFor(userId, row.companyId);
    return row;
  }

  // No author id: a waiting post belongs to the company, like a posted one.
  private serialize(row: Row): ScheduledSocialPost {
    const payload = payloadSchema.parse(row.payload);
    return {
      id: row.id,
      companyId: row.companyId,
      kind: payload.kind,
      publishAt: row.publishAt.toISOString(),
      status: row.status,
      failureReason: row.failureReason,
      caption: payload.caption,
      title: payload.title,
      imageUrls: row.imageUrls,
      pollOptions: payload.pollOptions,
    };
  }
}

import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  validateSocialImageUpload,
  type CreateSocialCommentInput,
  type CreateSocialPostInput,
  type PublicSocialComment,
  type PublicSocialPost,
  type SavedPostToggleResult,
  type SocialCommentVoteResult,
  type SocialFeedPage,
  type SocialPostLikeResult,
  type VoteValue,
  type WorkplaceType,
} from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ModerationService } from "../moderation/moderation.service";
import { PUBLIC_COMPANY_WHERE, assertCompanyVisibleOrThrow } from "../companies/company-visibility";
import { processSocialImage } from "./social-image.util";

// Local disk, dev-safe - same pattern as OwnerService.uploadLogo. Served at
// /uploads/social/ by main.ts's existing useStaticAssets(cwd/uploads, prefix
// "/uploads/") mount, outside the "v1" API prefix.
const SOCIAL_UPLOADS_DIR = join(process.cwd(), "uploads", "social");

// One feed page. Fetched as PAGE_SIZE + 1 rows so a next page can be detected
// without a second COUNT query.
export const SOCIAL_FEED_PAGE_SIZE = 10;

// The Quick Select / "Industry Tags" bucket, identical set to apps/web's
// lib/categoryGroups.tsx CategoryGroup - kept here as a manually-synced
// value (same "deliberate near-duplicate" pattern JobsBrowser.tsx documents
// for itself vs WorkplaceBrowser.tsx) because one is pure frontend
// presentation (icons/labels/tooltips) and this is the DB-query-shaped
// mirror of the exact same 7 buckets, needed server-side so the feed filter
// doesn't have to round-trip a whole company-list through the client.
export type CategoryGroup =
  | "FIRMS"
  | "SUPERMARKET"
  | "FRANCHISE"
  | "LOGISTICS"
  | "CLOTHING"
  | "SERVICE_PROVIDERS"
  | "OIL_ENERGY";

// Exact Company.category strings each narrow bucket matches - copied from
// categoryGroups.tsx's NARROW_CATEGORY_GROUP_VALUES. FIRMS is everything
// NOT in this list (the one bucket that can't be expressed as a plain "in"
// filter, hence the notIn branch below).
const NARROW_CATEGORY_GROUP_VALUES = ["Supermarket", "Franchise", "Logistics", "Clothing Retail", "Telecom", "Fuel & Energy"];

function categoryGroupWhere(group: CategoryGroup | undefined): Prisma.StringFilter | string | undefined {
  switch (group) {
    case "SUPERMARKET":
      return "Supermarket";
    case "FRANCHISE":
      return "Franchise";
    case "LOGISTICS":
      return "Logistics";
    case "CLOTHING":
      return "Clothing Retail";
    case "SERVICE_PROVIDERS":
      return "Telecom";
    case "OIL_ENERGY":
      return "Fuel & Energy";
    case "FIRMS":
      return { notIn: NARROW_CATEGORY_GROUP_VALUES };
    default:
      return undefined;
  }
}

@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
  ) {}

  async createPost(
    userId: string,
    input: CreateSocialPostInput,
    files: Express.Multer.File[] | undefined,
  ): Promise<{ id: string }> {
    await this.requireApprovedOwnership(userId, input.companyId);

    if (!files || files.length === 0) {
      throw new BadRequestException("Attach at least one photo to post.");
    }
    for (const file of files) {
      const check = validateSocialImageUpload({ mimeType: file.mimetype, sizeBytes: file.buffer.length });
      if (!check.valid) {
        throw new BadRequestException(check.error);
      }
    }

    if (input.caption) {
      // An employer captioning its own post may name its own staff and job
      // roles and write an all-caps announcement - those rules exist to stop an
      // anonymous employee venting about their boss in a review, not this.
      // Profanity, sexual content and phone numbers still hard-reject.
      // addComment below keeps the full ruleset for comment bodies.
      const result = this.moderation.checkContent([input.caption], {
        skipViolationTypes: ["NAME_OR_SURNAME", "JOB_TITLE", "ABUSE_OR_INSULT"],
      });
      if (result.violates) {
        throw new BadRequestException(
          "That caption breaks our content rules (profanity or contact details) - please reword it.",
        );
      }
    }

    await mkdir(SOCIAL_UPLOADS_DIR, { recursive: true });
    const origin = process.env.API_PUBLIC_ORIGIN ?? `http://localhost:${process.env.PORT ?? 3001}`;
    // Sequential, not Promise.all - sharp/heic-convert are CPU-bound; running
    // every image in a multi-photo post concurrently would just contend for
    // the same cores instead of finishing any of them sooner.
    const imageUrls: string[] = [];
    for (const file of files) {
      const webp = await processSocialImage(file.buffer, file.mimetype);
      const filename = `${randomUUID()}.webp`;
      await writeFile(join(SOCIAL_UPLOADS_DIR, filename), webp);
      imageUrls.push(`${origin}/uploads/social/${filename}`);
    }

    const post = await this.prisma.socialPost.create({
      data: { companyId: input.companyId, authorUserId: userId, imageUrls, caption: input.caption || null },
      select: { id: true },
    });
    return { id: post.id };
  }

  // Global feed - newest post first across every company. `q` (optional) is a
  // case-insensitive substring match on the company name. `workplaceTypes`
  // ("Job Category") and `categoryGroup` ("Quick Select" / "Industry Tags")
  // filter on the post's own company - both optional, both AND'd together
  // with `q` when present. Anonymous viewers (viewerUserId undefined) get
  // likedByMe/savedByMe: null on every post.
  async feed(
    viewerUserId: string | undefined,
    opts: { cursor?: string; q?: string; workplaceTypes?: WorkplaceType[]; categoryGroup?: CategoryGroup },
  ): Promise<SocialFeedPage> {
    const categoryFilter = categoryGroupWhere(opts.categoryGroup);
    // The global feed is always gated on the post's company being publicly
    // visible — a company an ADMIN has hidden (Company.hiddenAt) drops out
    // of the feed entirely, same as it does from search / its detail page.
    const companyWhere = {
      ...PUBLIC_COMPANY_WHERE,
      ...(opts.q?.trim() ? { name: { contains: opts.q.trim(), mode: "insensitive" as const } } : {}),
      // hasSome: the post's company matches if it carries ANY of the
      // requested job categories - mirrors CompaniesService.search's own
      // workplaceTypes filter (a company can span up to 2 tags).
      ...(opts.workplaceTypes && opts.workplaceTypes.length > 0
        ? { workplaceTypes: { hasSome: opts.workplaceTypes } }
        : {}),
      ...(categoryFilter !== undefined ? { category: categoryFilter } : {}),
    };
    const where: Prisma.SocialPostWhereInput = { company: companyWhere };
    return this.pageFromWhere(viewerUserId, where, opts.cursor);
  }

  // One company's feed, addressed by slug. 404s on an unknown — or hidden — slug.
  async companyFeed(
    viewerUserId: string | undefined,
    slug: string,
    opts: { cursor?: string },
  ): Promise<SocialFeedPage> {
    const company = await this.prisma.company.findUnique({
      where: { slug },
      select: { id: true, hiddenAt: true },
    });
    assertCompanyVisibleOrThrow(company);
    return this.pageFromWhere(viewerUserId, { companyId: company.id }, opts.cursor);
  }

  // ADMIN-only: one company's feed by id, bypassing the hidden-company gate.
  // Without this, hiding a company (the expected first moderation step) would
  // 404 the public companyFeed for the admin too, leaving no way to see post
  // ids to remove or to confirm a feed wipe worked while the company stays
  // hidden. Existence-checked (404 unknown id) but never visibility-checked.
  async adminCompanyFeed(companyId: string, opts: { cursor?: string }): Promise<SocialFeedPage> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) {
      throw new NotFoundException("Company not found");
    }
    return this.pageFromWhere(undefined, { companyId: company.id }, opts.cursor);
  }

  // --- ADMIN content moderation (AdminSocialController, ADMIN-only). A hard
  // delete: SocialComment / SocialPostLike / SavedPost are onDelete: Cascade
  // on the post (see schema.prisma), so removing a post takes its whole
  // thread + likes + every user's saved-post row with it. Each removed
  // post's WebP files are unlinked from uploads/social/ best-effort. Operates
  // on SocialPost by id / companyId only — never reads or logs a post/
  // comment author (REVIEW.md anonymity scope).

  async adminRemovePost(adminUserId: string, postId: string): Promise<{ success: true }> {
    const post = await this.prisma.socialPost.findUnique({
      where: { id: postId },
      select: { id: true, companyId: true, imageUrls: true },
    });
    if (!post) throw new NotFoundException("Post not found");

    await this.prisma.socialPost.delete({ where: { id: postId } }); // cascades comments + likes + saves
    await Promise.all(post.imageUrls.map((url) => this.unlinkSocialImage(url)));
    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminUserId,
        action: "SOCIAL_POST_REMOVED",
        targetType: "SocialPost",
        targetId: postId,
        metadata: { companyId: post.companyId },
      },
    });
    return { success: true };
  }

  async adminWipeCompanyFeed(adminUserId: string, companyId: string): Promise<{ deletedCount: number }> {
    const posts = await this.prisma.socialPost.findMany({
      where: { companyId },
      select: { id: true, imageUrls: true },
    });

    await this.prisma.socialPost.deleteMany({ where: { companyId } }); // cascades each post's comments + likes + saves
    await Promise.all(posts.flatMap((p) => p.imageUrls.map((url) => this.unlinkSocialImage(url))));
    await this.prisma.auditLog.create({
      data: {
        actorUserId: adminUserId,
        action: "SOCIAL_FEED_WIPED",
        targetType: "Company",
        targetId: companyId,
        metadata: { deletedCount: posts.length },
      },
    });
    return { deletedCount: posts.length };
  }

  // Maps a stored imageUrl (`${origin}/uploads/social/<uuid>.webp`) back to
  // its path on disk and removes it. Best-effort: a file that's already gone
  // (or a URL that somehow lacks the prefix) is not an error.
  private async unlinkSocialImage(imageUrl: string): Promise<void> {
    const name = imageUrl.split("/uploads/social/")[1];
    if (!name) return;
    try {
      await unlink(join(SOCIAL_UPLOADS_DIR, name));
    } catch {
      // Already gone — nothing to clean up.
    }
  }

  // Cursor = the previous page's last post id. Fetch PAGE_SIZE + 1 to learn
  // whether a next page exists without a second query.
  private async pageFromWhere(
    viewerUserId: string | undefined,
    where: Prisma.SocialPostWhereInput,
    cursor: string | undefined,
  ): Promise<SocialFeedPage> {
    const rows = await this.prisma.socialPost.findMany({
      where,
      // id is the tie-breaker: createdAt alone is not unique (same-millisecond
      // posts from a seed script or a burst) and an unstable sort drops or
      // duplicates rows across a cursor page seam.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: SOCIAL_FEED_PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { company: { select: { slug: true, name: true, mainPhotoUrl: true, badgeTier: true, workplaceTypes: true } } },
    });
    const hasMore = rows.length > SOCIAL_FEED_PAGE_SIZE;
    const pageRows = hasMore ? rows.slice(0, SOCIAL_FEED_PAGE_SIZE) : rows;
    const posts = await this.serializePosts(pageRows, viewerUserId);
    return { posts, nextCursor: hasMore ? pageRows[pageRows.length - 1].id : null };
  }

  // Shared serializer for both feed shapes. Fans out into four grouped
  // aggregate reads (like count, comment count, and - only for an
  // authenticated viewer - that viewer's own likes and saves) rather than
  // N+1 per post. NOTE (REVIEW.md-adjacent): never selects authorUserId; the
  // viewer's-own-likes/saves queries stay select: { postId: true }.
  private async serializePosts(
    rows: Array<{
      id: string; companyId: string; imageUrls: string[]; caption: string | null; createdAt: Date;
      company: { slug: string; name: string; mainPhotoUrl: string | null; badgeTier: string; workplaceTypes: PublicSocialPost["companyWorkplaceTypes"] };
    }>,
    viewerUserId: string | undefined,
  ): Promise<PublicSocialPost[]> {
    const ids = rows.map((r) => r.id);
    const [likeCounts, commentCounts, myLikes, mySaves] = await Promise.all([
      this.prisma.socialPostLike.groupBy({ by: ["postId"], where: { postId: { in: ids } }, _count: { _all: true } }),
      this.prisma.socialComment.groupBy({ by: ["postId"], where: { postId: { in: ids } }, _count: { _all: true } }),
      viewerUserId
        ? this.prisma.socialPostLike.findMany({
            where: { postId: { in: ids }, userId: viewerUserId },
            select: { postId: true },
          })
        : Promise.resolve([]),
      viewerUserId
        ? this.prisma.savedPost.findMany({
            where: { postId: { in: ids }, userId: viewerUserId },
            select: { postId: true },
          })
        : Promise.resolve([]),
    ]);
    const likeByPost = new Map(likeCounts.map((r) => [r.postId, r._count._all]));
    const commentByPost = new Map(commentCounts.map((r) => [r.postId, r._count._all]));
    const likedByMe = new Set(myLikes.map((r) => r.postId));
    const savedByMe = new Set(mySaves.map((r) => r.postId));

    return rows.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      companySlug: r.company.slug,
      companyName: r.company.name,
      companyLogoUrl: r.company.mainPhotoUrl,
      companyBadgeTier: r.company.badgeTier as PublicSocialPost["companyBadgeTier"],
      companyWorkplaceTypes: r.company.workplaceTypes,
      imageUrls: r.imageUrls,
      caption: r.caption,
      createdAt: r.createdAt.toISOString(),
      likeCount: likeByPost.get(r.id) ?? 0,
      commentCount: commentByPost.get(r.id) ?? 0,
      likedByMe: viewerUserId ? likedByMe.has(r.id) : null,
      savedByMe: viewerUserId ? savedByMe.has(r.id) : null,
    }));
  }

  // Copy of OwnerService's check (not imported - a 6-line guard is not worth
  // a cross-module dependency, and the spec calls this out explicitly).
  private async requireApprovedOwnership(userId: string, companyId: string) {
    const ownership = await this.prisma.companyOwner.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!ownership || ownership.claimStatus !== "APPROVED") {
      throw new ForbiddenException("You are not an approved owner of this company.");
    }
    return ownership;
  }

  // --- Comments. Any member may comment on any post; the body is run through
  // the same ModerationService.checkContent gate as a review/caption and a
  // violation is a hard 400 (never an admin queue - see the backend spec).
  async addComment(
    userId: string,
    postId: string,
    input: CreateSocialCommentInput,
  ): Promise<PublicSocialComment> {
    await this.requirePost(postId);
    const result = this.moderation.checkContent([input.body]);
    if (result.violates) {
      throw new BadRequestException(
        "That comment looks like it names a person or breaks our content rules - please reword it.",
      );
    }
    const row = await this.prisma.socialComment.create({
      data: { postId, authorUserId: userId, body: input.body },
    });
    const [serialized] = await this.serializeComments([row], userId);
    return serialized;
  }

  // Oldest-first (a comment thread reads top-to-bottom). Optional auth: an
  // anonymous viewer just gets mine: false and myVote: null on every row.
  async listComments(
    viewerUserId: string | undefined,
    postId: string,
  ): Promise<PublicSocialComment[]> {
    await this.requirePost(postId);
    const rows = await this.prisma.socialComment.findMany({
      where: { postId },
      orderBy: { createdAt: "asc" },
    });
    return this.serializeComments(rows, viewerUserId);
  }

  // Author-only. A non-author (or an anonymous caller, caught by the guard
  // before here) gets 403; an unknown id gets 404.
  async deleteComment(userId: string, commentId: string): Promise<{ success: true }> {
    const comment = await this.prisma.socialComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException("Comment not found");
    if (comment.authorUserId !== userId) {
      throw new ForbiddenException("You can only delete your own comment.");
    }
    try {
      await this.prisma.socialComment.delete({ where: { id: commentId } });
    } catch (err) {
      // A parallel delete already removed it between the read above and here
      // -> P2025. The caller's intent (comment gone) is already satisfied.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")) {
        throw err;
      }
    }
    return { success: true };
  }

  // --- Likes. Post-level only (there is deliberately no CommentLike). One
  // call toggles: like if not liked, unlike if already liked. Returns the
  // fresh count so the caller never has to re-fetch the post.
  async toggleLike(userId: string, postId: string): Promise<SocialPostLikeResult> {
    await this.requirePost(postId);
    const existing = await this.prisma.socialPostLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });
    if (existing) {
      try {
        await this.prisma.socialPostLike.delete({ where: { id: existing.id } });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")) {
          throw err;
        }
      }
    } else {
      try {
        await this.prisma.socialPostLike.create({ data: { postId, userId } });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
          throw err;
        }
      }
    }
    const likeCount = await this.prisma.socialPostLike.count({ where: { postId } });
    return { postId, likeCount, likedByMe: !existing };
  }

  // --- Saves. Post-level, private bookmark - no public save count or "who
  // saved this" surface exists anywhere (unlike likes). Same race-safe
  // toggle shape as toggleLike above.
  async toggleSave(userId: string, postId: string): Promise<SavedPostToggleResult> {
    await this.requirePost(postId);
    const existing = await this.prisma.savedPost.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    if (existing) {
      try {
        await this.prisma.savedPost.delete({ where: { id: existing.id } });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")) {
          throw err;
        }
      }
    } else {
      try {
        await this.prisma.savedPost.create({ data: { userId, postId } });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
          throw err;
        }
      }
    }
    return { postId, saved: !existing };
  }

  // The caller's own saved posts, most-recently-saved first (not most-
  // recently-posted — SavedPost.createdAt, not SocialPost.createdAt).
  // Excludes posts whose company has since been hidden, same as every other
  // public-shaped feed. Cursor = the previous page's last SavedPost id.
  async listSavedPosts(userId: string, cursor: string | undefined): Promise<SocialFeedPage> {
    const rows = await this.prisma.savedPost.findMany({
      where: { userId, post: { company: PUBLIC_COMPANY_WHERE } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: SOCIAL_FEED_PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      // Explicit select (not include) all the way down - same structural
      // defense as pageFromWhere/serializeComments (REVIEW.md): the post's
      // authorUserId must never be pulled into memory here, not just never
      // be forwarded in the response.
      select: {
        id: true,
        post: {
          select: {
            id: true,
            companyId: true,
            imageUrls: true,
            caption: true,
            createdAt: true,
            company: { select: { slug: true, name: true, mainPhotoUrl: true, badgeTier: true, workplaceTypes: true } },
          },
        },
      },
    });
    const hasMore = rows.length > SOCIAL_FEED_PAGE_SIZE;
    const pageRows = hasMore ? rows.slice(0, SOCIAL_FEED_PAGE_SIZE) : rows;
    const posts = await this.serializePosts(
      pageRows.map((r) => r.post),
      userId,
    );
    return { posts, nextCursor: hasMore ? pageRows[pageRows.length - 1].id : null };
  }
  // --- Comment votes. Helpful (1) / Not Helpful (-1), one per (comment,
  // user) - same cast-again-to-remove / cast-different-value-to-change
  // semantics as ReviewsService.castVote. Unlike castVote, this never blocks
  // voting on your own comment (comments have no such rule).
  async voteComment(userId: string, commentId: string, value: VoteValue): Promise<SocialCommentVoteResult> {
    await this.requireComment(commentId);
    const existing = await this.prisma.socialCommentVote.findUnique({
      where: { commentId_userId: { commentId, userId } },
    });

    // Known outcome from the branch taken below, not a redundant re-read -
    // only the race-recovery catch below needs an actual re-read, since it
    // genuinely doesn't know which side of the race it lost.
    let myVote: VoteValue | null;
    try {
      if (existing && existing.value === value) {
        await this.prisma.socialCommentVote.delete({ where: { id: existing.id } });
        myVote = null;
      } else if (existing) {
        await this.prisma.socialCommentVote.update({ where: { id: existing.id }, data: { value } });
        myVote = value;
      } else {
        await this.prisma.socialCommentVote.create({ data: { commentId, userId, value } });
        myVote = value;
      }
    } catch (err) {
      // Same benign-race tolerance as ReviewsService.castVote: a concurrent
      // duplicate click can lose the exact create/delete race, but the vote
      // state is already whatever the winner left it as - re-read it once.
      const isBenignRace =
        err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2002" || err.code === "P2025");
      if (!isBenignRace) throw err;
      const after = await this.prisma.socialCommentVote.findUnique({ where: { commentId_userId: { commentId, userId } } });
      myVote = (after?.value as VoteValue | undefined) ?? null;
    }

    const [helpfulCount, notHelpfulCount] = await Promise.all([
      this.prisma.socialCommentVote.count({ where: { commentId, value: 1 } }),
      this.prisma.socialCommentVote.count({ where: { commentId, value: -1 } }),
    ]);
    return { commentId, helpfulCount, notHelpfulCount, myVote };
  }

  private async requireComment(commentId: string) {
    const comment = await this.prisma.socialComment.findUnique({ where: { id: commentId }, select: { id: true } });
    if (!comment) throw new NotFoundException("Comment not found");
    return comment;
  }

  private async requirePost(postId: string) {
    const post = await this.prisma.socialPost.findUnique({
      where: { id: postId },
      select: { id: true },
    });
    if (!post) throw new NotFoundException("Post not found");
    return post;
  }

  // REVIEW.md-adjacent: identical shape to ReviewsService.listForCompany's
  // author lookup. Explicit `select`, never `include: { user: true }` - that
  // would pull email/city/etc. onto a comment-shaped payload, exactly the
  // leak REVIEW.md's red flag #1 warns about. The returned shape carries no
  // authorUserId / userId; the only per-viewer fields are `mine`/`myVote`.
  private async serializeComments(
    rows: Array<{ id: string; postId: string; body: string; createdAt: Date; authorUserId: string | null }>,
    viewerUserId: string | undefined,
  ): Promise<PublicSocialComment[]> {
    // authorUserId is null when the comment's author has since deleted their
    // account (SocialComment.authorUserId is onDelete: SetNull). The comment
    // keeps its body but serializes with a null handle/avatar, and is never
    // "mine" - so filter the nulls out before the author lookup.
    const authorIds = [...new Set(rows.map((r) => r.authorUserId).filter((id): id is string => id !== null))];
    const ids = rows.map((r) => r.id);
    const [authors, helpfulCounts, notHelpfulCounts, myVotes] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, avatarKey: true, avatarGradient: true, reviewUsername: true },
      }),
      this.prisma.socialCommentVote.groupBy({ by: ["commentId"], where: { commentId: { in: ids }, value: 1 }, _count: { _all: true } }),
      this.prisma.socialCommentVote.groupBy({ by: ["commentId"], where: { commentId: { in: ids }, value: -1 }, _count: { _all: true } }),
      viewerUserId
        ? this.prisma.socialCommentVote.findMany({
            where: { commentId: { in: ids }, userId: viewerUserId },
            select: { commentId: true, value: true },
          })
        : Promise.resolve([]),
    ]);
    const byId = new Map(authors.map((a) => [a.id, a]));
    const helpfulByComment = new Map(helpfulCounts.map((r) => [r.commentId, r._count._all]));
    const notHelpfulByComment = new Map(notHelpfulCounts.map((r) => [r.commentId, r._count._all]));
    const myVoteByComment = new Map(myVotes.map((r) => [r.commentId, r.value as VoteValue]));
    return rows.map((r) => {
      const a = r.authorUserId !== null ? byId.get(r.authorUserId) : undefined;
      return {
        id: r.id,
        postId: r.postId,
        body: r.body,
        createdAt: r.createdAt.toISOString(),
        displayUsername: a?.reviewUsername ?? null,
        avatarKey: a?.avatarKey ?? null,
        avatarGradient: a?.avatarGradient ?? null,
        mine: viewerUserId !== undefined && r.authorUserId === viewerUserId,
        helpfulCount: helpfulByComment.get(r.id) ?? 0,
        notHelpfulCount: notHelpfulByComment.get(r.id) ?? 0,
        myVote: myVoteByComment.get(r.id) ?? null,
      };
    });
  }
}

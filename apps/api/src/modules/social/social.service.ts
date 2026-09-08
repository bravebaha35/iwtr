import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  validateSocialImageUpload,
  type CreateSocialPostInput,
  type PublicSocialPost,
  type SocialFeedPage,
} from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ModerationService } from "../moderation/moderation.service";
import { processSocialImage } from "./social-image.util";

// Local disk, dev-safe - same pattern as OwnerService.uploadLogo. Served at
// /uploads/social/ by main.ts's existing useStaticAssets(cwd/uploads, prefix
// "/uploads/") mount, outside the "v1" API prefix.
const SOCIAL_UPLOADS_DIR = join(process.cwd(), "uploads", "social");

// One feed page. Fetched as PAGE_SIZE + 1 rows so a next page can be detected
// without a second COUNT query.
export const SOCIAL_FEED_PAGE_SIZE = 10;

@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
  ) {}

  async createPost(
    userId: string,
    input: CreateSocialPostInput,
    file: Express.Multer.File | undefined,
  ): Promise<{ id: string }> {
    await this.requireApprovedOwnership(userId, input.companyId);

    if (!file) {
      throw new BadRequestException("Attach a photo to post.");
    }
    const check = validateSocialImageUpload({ mimeType: file.mimetype, sizeBytes: file.buffer.length });
    if (!check.valid) {
      throw new BadRequestException(check.error);
    }

    if (input.caption) {
      const result = this.moderation.checkContent([input.caption]);
      if (result.violates) {
        throw new BadRequestException(
          "That caption looks like it names a person or breaks our content rules - please reword it.",
        );
      }
    }

    const webp = await processSocialImage(file.buffer, file.mimetype);
    await mkdir(SOCIAL_UPLOADS_DIR, { recursive: true });
    const filename = `${randomUUID()}.webp`;
    await writeFile(join(SOCIAL_UPLOADS_DIR, filename), webp);
    const origin = process.env.API_PUBLIC_ORIGIN ?? `http://localhost:${process.env.PORT ?? 3001}`;
    const imageUrl = `${origin}/uploads/social/${filename}`;

    const post = await this.prisma.socialPost.create({
      data: { companyId: input.companyId, authorUserId: userId, imageUrl, caption: input.caption || null },
      select: { id: true },
    });
    return { id: post.id };
  }

  // Global feed - newest post first across every company. `q` (optional) is a
  // case-insensitive substring match on the company name. Anonymous viewers
  // (viewerUserId undefined) get likedByMe: null on every post.
  async feed(
    viewerUserId: string | undefined,
    opts: { cursor?: string; q?: string },
  ): Promise<SocialFeedPage> {
    const where: Prisma.SocialPostWhereInput = opts.q?.trim()
      ? { company: { name: { contains: opts.q.trim(), mode: "insensitive" as const } } }
      : {};
    return this.pageFromWhere(viewerUserId, where, opts.cursor);
  }

  // One company's feed, addressed by slug. 404s on an unknown slug.
  async companyFeed(
    viewerUserId: string | undefined,
    slug: string,
    opts: { cursor?: string },
  ): Promise<SocialFeedPage> {
    const company = await this.prisma.company.findUnique({ where: { slug }, select: { id: true } });
    if (!company) throw new NotFoundException("Company not found");
    return this.pageFromWhere(viewerUserId, { companyId: company.id }, opts.cursor);
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
      orderBy: { createdAt: "desc" },
      take: SOCIAL_FEED_PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { company: { select: { slug: true, name: true, mainPhotoUrl: true, badgeTier: true } } },
    });
    const hasMore = rows.length > SOCIAL_FEED_PAGE_SIZE;
    const pageRows = hasMore ? rows.slice(0, SOCIAL_FEED_PAGE_SIZE) : rows;
    const posts = await this.serializePosts(pageRows, viewerUserId);
    return { posts, nextCursor: hasMore ? pageRows[pageRows.length - 1].id : null };
  }

  // Shared serializer for both feed shapes. Fans out into three grouped
  // aggregate reads (like count, comment count, and - only for an
  // authenticated viewer - that viewer's own likes) rather than N+1 per post.
  // NOTE (REVIEW.md-adjacent): never selects authorUserId; the viewer's-own-
  // likes query stays select: { postId: true }.
  private async serializePosts(
    rows: Array<{
      id: string; companyId: string; imageUrl: string; caption: string | null; createdAt: Date;
      company: { slug: string; name: string; mainPhotoUrl: string | null; badgeTier: string };
    }>,
    viewerUserId: string | undefined,
  ): Promise<PublicSocialPost[]> {
    const ids = rows.map((r) => r.id);
    const [likeCounts, commentCounts, myLikes] = await Promise.all([
      this.prisma.socialPostLike.groupBy({ by: ["postId"], where: { postId: { in: ids } }, _count: { _all: true } }),
      this.prisma.socialComment.groupBy({ by: ["postId"], where: { postId: { in: ids } }, _count: { _all: true } }),
      viewerUserId
        ? this.prisma.socialPostLike.findMany({
            where: { postId: { in: ids }, userId: viewerUserId },
            select: { postId: true },
          })
        : Promise.resolve([]),
    ]);
    const likeByPost = new Map(likeCounts.map((r) => [r.postId, r._count._all]));
    const commentByPost = new Map(commentCounts.map((r) => [r.postId, r._count._all]));
    const likedByMe = new Set(myLikes.map((r) => r.postId));

    return rows.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      companySlug: r.company.slug,
      companyName: r.company.name,
      companyLogoUrl: r.company.mainPhotoUrl,
      companyBadgeTier: r.company.badgeTier as PublicSocialPost["companyBadgeTier"],
      imageUrl: r.imageUrl,
      caption: r.caption,
      createdAt: r.createdAt.toISOString(),
      likeCount: likeByPost.get(r.id) ?? 0,
      commentCount: commentByPost.get(r.id) ?? 0,
      likedByMe: viewerUserId ? likedByMe.has(r.id) : null,
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
}

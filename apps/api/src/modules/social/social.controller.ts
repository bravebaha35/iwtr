import { Body, Controller, Delete, Get, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import {
  createSocialCommentInputSchema,
  createSocialPostInputSchema,
  workplaceTypeSchema,
  SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES,
  type CreateSocialCommentInput,
  type CreateSocialPostInput,
  type WorkplaceType,
} from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../common/guards/optional-jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { OptionalCurrentUser } from "../../common/decorators/optional-current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/auth.types";
import { SocialService } from "./social.service";

// Unrecognized tokens are dropped rather than rejected — same rule as
// CompaniesService.search's own workplaceTypes parsing — so a stale client
// sending a since-removed job category doesn't 400 the whole feed request.
function parseWorkplaceTypes(raw: string | undefined): WorkplaceType[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t): t is WorkplaceType => (workplaceTypeSchema.options as string[]).includes(t));
}

// Company.category is free-text (admin-curated, no fixed enum), so this just
// splits/trims/dedupes — validity is "does a company have this category",
// checked by the query itself, not by a hardcoded allowlist here. Capped
// (unlike workplaceTypes, which is implicitly bounded by its fixed enum)
// since an unconstrained free-text array has no other size limit before it
// reaches a Postgres IN clause - defense in depth, not a fix for a live
// exploit (the global ThrottlerGuard + HTTP header-size limits already
// bound this in practice).
const MAX_CATEGORY_FILTERS = 20;
const MAX_CATEGORY_LENGTH = 100;
function parseCategories(raw: string | undefined): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .slice(0, MAX_CATEGORY_FILTERS)
        .map((c) => c.trim().slice(0, MAX_CATEGORY_LENGTH))
        .filter(Boolean),
    ),
  ];
}

@Controller("social")
export class SocialController {
  constructor(private readonly social: SocialService) {}

  // Multipart: `file` + `companyId` + optional `caption`. Tighter throttle
  // than the global 100/min - creating a post is expensive (decode + encode).
  @Post("posts")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES } }))
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  createPost(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createSocialPostInputSchema)) body: CreateSocialPostInput,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.social.createPost(user.id, body, file);
  }

  // Public global feed, newest-first, cursor-paginated. Optional auth: a
  // signed-in caller gets real likedByMe/savedByMe booleans, an anonymous
  // one gets null for both. `q` filters by company name (case-insensitive
  // substring); `workplaceTypes` ("Job Category") and `categories`
  // ("Industry Tags") are comma-separated, same convention as
  // CompaniesService.search's own filter params.
  @Get("feed")
  @UseGuards(OptionalJwtAuthGuard)
  feed(
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
    @Query("cursor") cursor?: string,
    @Query("q") q?: string,
    @Query("workplaceTypes") workplaceTypes?: string,
    @Query("categories") categories?: string,
  ) {
    return this.social.feed(user?.id, {
      cursor,
      q,
      workplaceTypes: parseWorkplaceTypes(workplaceTypes),
      categories: parseCategories(categories),
    });
  }

  // Public per-company feed, addressed by slug. Same optional-auth rule.
  @Get("companies/:slug/posts")
  @UseGuards(OptionalJwtAuthGuard)
  companyPosts(
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
    @Param("slug") slug: string,
    @Query("cursor") cursor?: string,
  ) {
    return this.social.companyFeed(user?.id, slug, { cursor });
  }

  // Add an anonymous comment to a post. Body is moderated - a violation is a
  // hard 400, never an admin queue. Tighter throttle than the global 100/min.
  @Post("posts/:id/comments")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  addComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") postId: string,
    @Body(new ZodValidationPipe(createSocialCommentInputSchema)) body: CreateSocialCommentInput,
  ) {
    return this.social.addComment(user.id, postId, body);
  }

  // A post's comment thread, oldest-first. Optional auth: a signed-in caller
  // gets mine: true on their own comments, an anonymous one gets mine: false.
  @Get("posts/:id/comments")
  @UseGuards(OptionalJwtAuthGuard)
  listComments(
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") postId: string,
  ) {
    return this.social.listComments(user?.id, postId);
  }

  // Author-only delete. A non-author gets 403.
  @Delete("comments/:id")
  @UseGuards(JwtAuthGuard)
  deleteComment(@CurrentUser() user: AuthenticatedUser, @Param("id") commentId: string) {
    return this.social.deleteComment(user.id, commentId);
  }

  // Toggle the current user's like on a post. Returns the fresh like count.
  @Post("posts/:id/like")
  @UseGuards(JwtAuthGuard)
  toggleLike(@CurrentUser() user: AuthenticatedUser, @Param("id") postId: string) {
    return this.social.toggleLike(user.id, postId);
  }

  // Toggle the current user's private bookmark on a post. Employee-only
  // (MEMBER) - an owner/admin saving a post isn't part of this feature.
  @Post("posts/:id/save")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("MEMBER")
  toggleSave(@CurrentUser() user: AuthenticatedUser, @Param("id") postId: string) {
    return this.social.toggleSave(user.id, postId);
  }
}

import { Body, Controller, Delete, Get, Param, Post, Query, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import {
  createSocialCommentInputSchema,
  createSocialPostInputSchema,
  reportSocialCommentInputSchema,
  voteSocialCommentInputSchema,
  workplaceTypeSchema,
  SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES,
  MAX_SOCIAL_POST_IMAGES,
  type CreateSocialCommentInput,
  type CreateSocialPostInput,
  type ReportSocialCommentInput,
  type VoteSocialCommentInput,
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
import { SocialService, type CategoryGroup } from "./social.service";

// Unrecognized tokens are dropped rather than rejected - same rule as
// CompaniesService.search's own workplaceTypes parsing - so a stale client
// sending a since-removed job category doesn't 400 the whole feed request.
function parseWorkplaceTypes(raw: string | undefined): WorkplaceType[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t): t is WorkplaceType => (workplaceTypeSchema.options as string[]).includes(t));
}

// The Quick Select sidebar/homepage/jobs-page icon row (Firms/Supermarket/
// Franchise/Logistics/Clothing/Service Providers/Oil & Energy) - same 7
// buckets as apps/web's lib/categoryGroups.tsx CategoryGroup, kept as a
// manually-synced list on this side (see SocialService's own comment on
// CATEGORY_GROUP_VALUES for why this can't just import the frontend file).
// An unrecognized value is dropped, same tolerant-parsing rule as above,
// rather than 400ing the whole feed request.
const CATEGORY_GROUP_VALUES = new Set<CategoryGroup>([
  "FIRMS",
  "SUPERMARKET",
  "FRANCHISE",
  "LOGISTICS",
  "CLOTHING",
  "SERVICE_PROVIDERS",
  "OIL_ENERGY",
]);
function parseCategoryGroup(raw: string | undefined): CategoryGroup | undefined {
  return raw !== undefined && (CATEGORY_GROUP_VALUES as Set<string>).has(raw) ? (raw as CategoryGroup) : undefined;
}

@Controller("social")
export class SocialController {
  constructor(private readonly social: SocialService) {}

  // Multipart: 1..MAX_SOCIAL_POST_IMAGES `files` + `companyId` + optional
  // `caption` - an Instagram-style multi-photo carousel, not a single image
  // (see SocialPost.imageUrls). Tighter throttle than the global 100/min -
  // creating a post is expensive (decode + encode, now per image).
  @Post("posts")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor("files", MAX_SOCIAL_POST_IMAGES, { limits: { fileSize: SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES } }))
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  createPost(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createSocialPostInputSchema)) body: CreateSocialPostInput,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.social.createPost(user.id, body, files);
  }

  // Public global feed, newest-first, cursor-paginated. Optional auth: a
  // signed-in caller gets real likedByMe/savedByMe booleans, an anonymous
  // one gets null for both. `q` filters by company name (case-insensitive
  // substring); `workplaceTypes` ("Job Category") is comma-separated, same
  // convention as CompaniesService.search's own filter params;
  // `categoryGroup` ("Quick Select" / "Industry Tags") is the single
  // Firms/Supermarket/.../Oil & Energy bucket, same as the rating/jobs pages.
  @Get("feed")
  @UseGuards(OptionalJwtAuthGuard)
  feed(
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
    @Query("cursor") cursor?: string,
    @Query("q") q?: string,
    @Query("workplaceTypes") workplaceTypes?: string,
    @Query("categoryGroup") categoryGroup?: string,
  ) {
    return this.social.feed(user?.id, {
      cursor,
      q,
      workplaceTypes: parseWorkplaceTypes(workplaceTypes),
      categoryGroup: parseCategoryGroup(categoryGroup),
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
  // gets mine: true on their own comments and their own helpful/not-helpful
  // vote, an anonymous one gets mine: false and myVote: null throughout.
  @Get("posts/:id/comments")
  @UseGuards(OptionalJwtAuthGuard)
  listComments(
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") postId: string,
  ) {
    return this.social.listComments(user?.id, postId);
  }

  // What the comment composer should show/offer this user on this post -
  // fetched once when it opens (see SocialCommentIdentityContext).
  @Get("posts/:id/comment-identity")
  @UseGuards(JwtAuthGuard)
  getCommentIdentityContext(@CurrentUser() user: AuthenticatedUser, @Param("id") postId: string) {
    return this.social.getCommentIdentityContext(user.id, postId);
  }

  // Any member except the comment's own author. 3+ reports triggers an
  // automated content re-check that fast-tracks into the admin queue if it
  // finds anything - never an unreviewed auto-delete (see SocialService.
  // registerReport).
  @Post("comments/:id/report")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  reportComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") commentId: string,
    @Body(new ZodValidationPipe(reportSocialCommentInputSchema)) body: ReportSocialCommentInput,
  ) {
    return this.social.registerReport(user.id, commentId, body);
  }

  // Author-only delete. A non-author gets 403.
  @Delete("comments/:id")
  @UseGuards(JwtAuthGuard)
  deleteComment(@CurrentUser() user: AuthenticatedUser, @Param("id") commentId: string) {
    return this.social.deleteComment(user.id, commentId);
  }

  // Toggle/change the caller's Helpful (1) / Not Helpful (-1) vote on a
  // comment - same cast-a-vote-again-to-remove-it semantics as
  // ReviewsService.castVote. Any signed-in member may vote, including on
  // their own comment (comments have no author-facing notion of self-voting
  // being meaningless to block, unlike reviews).
  @Post("comments/:id/vote")
  @UseGuards(JwtAuthGuard)
  voteComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") commentId: string,
    @Body(new ZodValidationPipe(voteSocialCommentInputSchema)) body: VoteSocialCommentInput,
  ) {
    return this.social.voteComment(user.id, commentId, body.value);
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

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import {
  createSocialCommentInputSchema,
  createSocialPostInputSchema,
  reactToSocialPostInputSchema,
  reportSocialCommentInputSchema,
  socialCompanySortSchema,
  updateSocialPostInputSchema,
  voteSocialCommentInputSchema,
  voteSocialPollInputSchema,
  workplaceTypeSchema,
  SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES,
  MAX_SOCIAL_POST_IMAGES,
  type CreateSocialCommentInput,
  type CreateSocialPostInput,
  type ReactToSocialPostInput,
  type ReportSocialCommentInput,
  type SocialCompanySort,
  type UpdateSocialPostInput,
  type VoteSocialCommentInput,
  type VoteSocialPollInput,
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
export function parseWorkplaceTypes(raw: string | undefined): WorkplaceType[] {
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
export function parseCategoryGroup(raw: string | undefined): CategoryGroup | undefined {
  return raw !== undefined && (CATEGORY_GROUP_VALUES as Set<string>).has(raw) ? (raw as CategoryGroup) : undefined;
}

// Same tolerant-parsing rule as parseWorkplaceTypes/parseCategoryGroup - an
// unrecognized or missing value falls back to "newest" rather than 400ing.
function parseSocialCompanySort(raw: string | undefined): SocialCompanySort {
  const result = socialCompanySortSchema.safeParse(raw);
  return result.success ? result.data : "newest";
}

@Controller("social")
export class SocialController {
  constructor(private readonly social: SocialService) {}

  // Multipart: 0..MAX_SOCIAL_POST_IMAGES `files` + `companyId` + the fields
  // of the post's kind (see createSocialPostInputSchema): a photo or text
  // update, a poll, an event, a milestone or a "we're hiring" post. Tighter
  // throttle than the global 100/min - creating a post is expensive (decode
  // + encode, per image).
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
    @Query("following") following?: string,
  ) {
    return this.social.feed(user?.id, {
      cursor,
      q,
      workplaceTypes: parseWorkplaceTypes(workplaceTypes),
      categoryGroup: parseCategoryGroup(categoryGroup),
      // The "Following" tab: only companies the caller follows.
      following: following === "1",
    });
  }

  // The two lists beside the feed: companies to follow and fresh job ads.
  @Get("rail")
  @UseGuards(OptionalJwtAuthGuard)
  rail(@OptionalCurrentUser() user: AuthenticatedUser | undefined) {
    return this.social.rail(user?.id);
  }

  // One post, for its own page (share links). Same optional-auth rule.
  @Get("posts/:id")
  @UseGuards(OptionalJwtAuthGuard)
  getPost(@OptionalCurrentUser() user: AuthenticatedUser | undefined, @Param("id", new ParseUUIDPipe()) postId: string) {
    return this.social.getPost(user?.id, postId);
  }

  // The owner's Edit: caption only. An approved owner of the post's company.
  @Patch("posts/:id")
  @UseGuards(JwtAuthGuard)
  updatePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) postId: string,
    @Body(new ZodValidationPipe(updateSocialPostInputSchema)) body: UpdateSocialPostInput,
  ) {
    return this.social.updatePost(user.id, postId, body);
  }

  // The owner's Delete: the post, its thread and its photos.
  @Delete("posts/:id")
  @UseGuards(JwtAuthGuard)
  deletePost(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe()) postId: string) {
    return this.social.deletePost(user.id, postId);
  }

  // Pin / unpin on the company's own feed (one pinned post per company).
  @Post("posts/:id/pin")
  @UseGuards(JwtAuthGuard)
  togglePin(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe()) postId: string) {
    return this.social.togglePin(user.id, postId);
  }

  // Follower and post counts for the company Social tab - counts only.
  @Get("companies/:slug/summary")
  companySummary(@Param("slug") slug: string) {
    return this.social.companySummary(slug);
  }

  // Public per-company feed, addressed by slug. Same optional-auth rule.
  // `sort` defaults to "newest" (today's only behavior) when omitted or
  // unrecognized.
  @Get("companies/:slug/posts")
  @UseGuards(OptionalJwtAuthGuard)
  companyPosts(
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
    @Param("slug") slug: string,
    @Query("cursor") cursor?: string,
    @Query("sort") sort?: string,
  ) {
    return this.social.companyFeed(user?.id, slug, { cursor, sort: parseSocialCompanySort(sort) });
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

  // A reply to a top-level comment - same moderation/identity rules as a
  // top-level comment, target must not itself be a reply (see
  // SocialService.addReply).
  @Post("comments/:id/replies")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  addReply(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") commentId: string,
    @Body(new ZodValidationPipe(createSocialCommentInputSchema)) body: CreateSocialCommentInput,
  ) {
    return this.social.addReply(user.id, commentId, body);
  }

  // A specific comment's replies, oldest-first - same optional-auth shape
  // as listComments.
  @Get("comments/:id/replies")
  @UseGuards(OptionalJwtAuthGuard)
  listReplies(
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
    @Param("id") commentId: string,
  ) {
    return this.social.listReplies(user?.id, commentId);
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

  // Leave, change or take back the current user's reaction on a post (no
  // body = a plain like). Returns the fresh counts.
  @Post("posts/:id/like")
  @UseGuards(JwtAuthGuard)
  toggleLike(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") postId: string,
    @Body(new ZodValidationPipe(reactToSocialPostInputSchema)) body: ReactToSocialPostInput,
  ) {
    return this.social.toggleLike(user.id, postId, body.reaction);
  }

  // Vote on a poll, or move the vote to another answer. Employee-only
  // (MEMBER): a poll asks the people who work there, not other employers.
  @Post("posts/:id/poll-vote")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("MEMBER")
  votePoll(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) postId: string,
    @Body(new ZodValidationPipe(voteSocialPollInputSchema)) body: VoteSocialPollInput,
  ) {
    return this.social.votePoll(user.id, postId, body.optionId);
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

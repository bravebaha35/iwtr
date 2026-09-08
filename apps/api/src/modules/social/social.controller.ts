import { Body, Controller, Delete, Get, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import {
  createSocialCommentInputSchema,
  createSocialPostInputSchema,
  SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES,
  type CreateSocialCommentInput,
  type CreateSocialPostInput,
} from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../common/guards/optional-jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { OptionalCurrentUser } from "../../common/decorators/optional-current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/auth.types";
import { SocialService } from "./social.service";

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
  // signed-in caller gets a real likedByMe boolean, an anonymous one gets
  // null. `q` filters by company name (case-insensitive substring).
  @Get("feed")
  @UseGuards(OptionalJwtAuthGuard)
  feed(
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
    @Query("cursor") cursor?: string,
    @Query("q") q?: string,
  ) {
    return this.social.feed(user?.id, { cursor, q });
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
}

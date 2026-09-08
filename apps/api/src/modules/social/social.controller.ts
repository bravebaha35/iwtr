import { Body, Controller, Get, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { createSocialPostInputSchema, SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES, type CreateSocialPostInput } from "@iwtr/shared-types";
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
}

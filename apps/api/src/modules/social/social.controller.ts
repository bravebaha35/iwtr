import { Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { createSocialPostInputSchema, SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES, type CreateSocialPostInput } from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
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
}

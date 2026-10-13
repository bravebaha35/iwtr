import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
  MAX_SOCIAL_POST_IMAGES,
  SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES,
  recordSocialViewsInputSchema,
  rescheduleSocialPostInputSchema,
  scheduleSocialPostInputSchema,
  type RecordSocialViewsInput,
  type RescheduleSocialPostInput,
  type ScheduleSocialPostInput,
} from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/auth.types";
import { SocialInsightsService } from "./social-insights.service";
import { SocialScheduleService } from "./social-schedule.service";

/**
 * Phase 4 of IWT Social: post views, the owner's Insights and posting later.
 * The owner routes are for an approved owner of the company (checked in the
 * services); none of them is opened to the shared company login.
 */
@Controller("social")
export class SocialOwnerToolsController {
  constructor(
    private readonly insights: SocialInsightsService,
    private readonly schedule: SocialScheduleService,
  ) {}

  // The page reports the posts a member has had on screen. Nothing comes
  // back: the count is the company's to read, not the member's.
  @Post("views")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  async recordViews(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(recordSocialViewsInputSchema)) body: RecordSocialViewsInput,
  ): Promise<void> {
    await this.insights.recordViews(user, body.postIds);
  }

  // A company's own numbers: followers, views, reactions, comments, its
  // most seen posts. `days` is one of 7 / 30 / 90 / 365, cut to the plan.
  @Get("company-insights/:companyId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("COMPANY_OWNER")
  companyInsights(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Query("days") days?: string,
  ) {
    return this.insights.insights(user.id, companyId, days ? Number(days) : undefined);
  }

  // The composer's form plus `publishAt`: the post goes out at that moment.
  @Post("scheduled-posts")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("COMPANY_OWNER")
  @UseInterceptors(FilesInterceptor("files", MAX_SOCIAL_POST_IMAGES, { limits: { fileSize: SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES } }))
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  schedulePost(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(scheduleSocialPostInputSchema)) body: ScheduleSocialPostInput,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.schedule.schedule(user.id, body, files);
  }

  // The company's waiting posts and how many its plan lets it keep.
  @Get("company-scheduled/:companyId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("COMPANY_OWNER")
  listScheduled(@CurrentUser() user: AuthenticatedUser, @Param("companyId", new ParseUUIDPipe()) companyId: string) {
    return this.schedule.list(user.id, companyId);
  }

  @Patch("scheduled-posts/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("COMPANY_OWNER")
  reschedule(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(rescheduleSocialPostInputSchema)) body: RescheduleSocialPostInput,
  ) {
    return this.schedule.reschedule(user.id, id, body.publishAt);
  }

  @Post("scheduled-posts/:id/publish-now")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("COMPANY_OWNER")
  publishNow(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.schedule.publishNow(user.id, id);
  }

  @Delete("scheduled-posts/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("COMPANY_OWNER")
  removeScheduled(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.schedule.remove(user.id, id);
  }
}

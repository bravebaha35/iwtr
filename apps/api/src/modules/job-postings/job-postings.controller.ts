import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import {
  createJobPostingInputSchema,
  jobPostingStatusSchema,
  type CreateJobPostingInput,
} from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JobPostingsService } from "./job-postings.service";

@Controller()
export class JobPostingsController {
  constructor(private readonly jobPostings: JobPostingsService) {}

  @Get("my-companies/:companyId/job-postings/boost-status")
  @UseGuards(JwtAuthGuard)
  boostStatus(@CurrentUser() user: AuthenticatedUser, @Param("companyId", new ParseUUIDPipe()) companyId: string) {
    return this.jobPostings.getBoostStatus(user.id, companyId);
  }

  @Post("my-companies/:companyId/job-postings")
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Body(new ZodValidationPipe(createJobPostingInputSchema)) body: CreateJobPostingInput,
  ) {
    return this.jobPostings.create(user.id, companyId, body);
  }

  // Public: this is where the user's *browser* lands after paying on
  // iyzico's hosted page, not an authenticated API call — same shape as
  // PaymentsController.callback and RivalAnalyticsController's own callback.
  // Trustworthiness comes from JobPostingsService immediately calling back
  // into iyzico with our own API secret, never from trusting this body.
  @Post("job-postings/boost-checkout-callback")
  async boostCheckoutCallback(@Body() body: { token?: string }, @Res() res: Response) {
    if (body?.token) {
      await this.jobPostings.completeCheckout(body.token).catch(() => {
        // Best-effort: still send the user back into the app either way.
      });
    }
    const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
    res.redirect(`${webOrigin}/jobs?boostCheckout=done`);
  }

  @Get("admin/job-postings")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  adminList(@Query("status") status?: string) {
    const parsed = jobPostingStatusSchema.safeParse(status);
    return this.jobPostings.adminList(parsed.success ? parsed.data : "PENDING_ADMIN");
  }

  @Post("admin/job-postings/:id/approve")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  adminApprove(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.jobPostings.adminApprove(id);
  }

  @Post("admin/job-postings/:id/reject")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  adminReject(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.jobPostings.adminReject(id);
  }
}

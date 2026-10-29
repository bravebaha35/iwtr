import { Body, Controller, Get, Logger, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import { logAndReport } from "../../common/monitoring/log-and-report";
import type { Response } from "express";
import {
  createJobPostingInputSchema,
  jobPostingStatusSchema,
  updateJobPostingInputSchema,
  type CreateJobPostingInput,
  type UpdateJobPostingInput,
} from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CompanyAccountAllowed } from "../../common/decorators/company-account-allowed.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JobPostingsService } from "./job-postings.service";

@Controller()
export class JobPostingsController {
  private readonly logger = new Logger(JobPostingsController.name);

  constructor(private readonly jobPostings: JobPostingsService) {}

  @Get("my-companies/:companyId/job-postings/boost-status")
  @CompanyAccountAllowed()
  @UseGuards(JwtAuthGuard)
  boostStatus(@CurrentUser() user: AuthenticatedUser, @Param("companyId", new ParseUUIDPipe()) companyId: string) {
    return this.jobPostings.getBoostStatus(user.id, companyId);
  }

  // Salary Information: the sector's average monthly ₺ salary from other job ads.
  @Get("my-companies/:companyId/job-postings/salary-average")
  @CompanyAccountAllowed()
  @UseGuards(JwtAuthGuard)
  salaryAverage(@CurrentUser() user: AuthenticatedUser, @Param("companyId", new ParseUUIDPipe()) companyId: string) {
    return this.jobPostings.sectorSalaryAverage(user.id, companyId);
  }

  @Post("my-companies/:companyId/job-postings")
  @CompanyAccountAllowed()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Body(new ZodValidationPipe(createJobPostingInputSchema)) body: CreateJobPostingInput,
  ) {
    return this.jobPostings.create(user.id, companyId, body);
  }

  // The dashboard's Edit: new description and/or a boost on an active posting.
  @Patch("my-companies/:companyId/job-postings/:jobPostingId")
  @CompanyAccountAllowed()
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("jobPostingId", new ParseUUIDPipe()) jobPostingId: string,
    @Body(new ZodValidationPipe(updateJobPostingInputSchema)) body: UpdateJobPostingInput,
  ) {
    return this.jobPostings.update(user.id, companyId, jobPostingId, body);
  }

  @Post("my-companies/:companyId/job-postings/:jobPostingId/mark-filled")
  @CompanyAccountAllowed()
  @UseGuards(JwtAuthGuard)
  markFilled(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("jobPostingId", new ParseUUIDPipe()) jobPostingId: string,
  ) {
    return this.jobPostings.markFilled(user.id, companyId, jobPostingId);
  }

  @Get("my-companies/:companyId/job-postings")
  @CompanyAccountAllowed()
  @UseGuards(JwtAuthGuard)
  listOwnerPostings(@CurrentUser() user: AuthenticatedUser, @Param("companyId", new ParseUUIDPipe()) companyId: string) {
    return this.jobPostings.listOwnerPostings(user.id, companyId);
  }

  // Public: this is where the user's *browser* lands after paying on
  // iyzico's hosted page, not an authenticated API call — same shape as
  // PaymentsController.callback and RivalAnalyticsController's own callback.
  // Trustworthiness comes from JobPostingsService immediately calling back
  // into iyzico with our own API secret, never from trusting this body.
  @Post("job-postings/boost-checkout-callback")
  async boostCheckoutCallback(@Body() body: { token?: unknown }, @Res() res: Response) {
    // Only a plain string token is ever passed on to iyzico - this route is
    // public, so anything else in the body is ignored.
    if (typeof body?.token === "string" && body.token.length > 0 && body.token.length <= 256) {
      await this.jobPostings.completeCheckout(body.token).catch((err) => {
        // Best-effort: still send the user back into the app either way.
        // Still logged so a genuine DB/API error here isn't invisible.
        logAndReport(this.logger, `Boost callback completeCheckout failed for token=${body.token as string}`, err);
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


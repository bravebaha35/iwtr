import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Res, StreamableFile, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { hrReportRequestSchema, type HrReportRequest } from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/auth.types";
import { HrAnalyticsReportService } from "./hr-analytics-report.service";

@Controller()
export class HrAnalyticsReportController {
  constructor(private readonly reports: HrAnalyticsReportService) {}

  @Get("my-companies/:companyId/hr-analytics-report")
  @UseGuards(JwtAuthGuard)
  overview(@CurrentUser() user: AuthenticatedUser, @Param("companyId", new ParseUUIDPipe()) companyId: string) {
    return this.reports.overview(user.id, companyId);
  }

  // 202: the report is only queued (or its checkout opened) here;
  // HrAnalyticsReportWorker builds it. A tight per-account throttle on top
  // of the service's daily cap, since every accepted call ends in a PDF build.
  @Post("my-companies/:companyId/hr-analytics-report")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(202)
  request(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Body(new ZodValidationPipe(hrReportRequestSchema)) body: HrReportRequest,
  ) {
    return this.reports.request(user.id, companyId, body);
  }

  @Get("my-companies/:companyId/hr-analytics-report/:jobId/download")
  @UseGuards(JwtAuthGuard)
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("jobId", new ParseUUIDPipe()) jobId: string,
  ): Promise<StreamableFile> {
    const { filename, pdf } = await this.reports.download(user.id, companyId, jobId);
    return new StreamableFile(pdf, { type: "application/pdf", disposition: `inline; filename="${filename}"` });
  }

  // Public: where the browser lands after paying on iyzico's page. Only a
  // plain string token is passed on, and the service confirms it with iyzico.
  @Post("hr-analytics-report/checkout-callback")
  async checkoutCallback(@Body() body: { token?: unknown }, @Res() res: Response) {
    let companyId: string | null = null;
    if (typeof body?.token === "string" && body.token.length > 0 && body.token.length <= 256) {
      companyId = await this.reports.completeCheckout(body.token).catch(() => null);
    }
    const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
    res.redirect(
      companyId
        ? `${webOrigin}/my/companies?company=${encodeURIComponent(companyId)}&category=benchmark-reports`
        : `${webOrigin}/my/companies`,
    );
  }
}

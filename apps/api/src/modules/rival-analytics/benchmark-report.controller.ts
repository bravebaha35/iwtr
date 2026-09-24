import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, StreamableFile, UseGuards } from "@nestjs/common";
import { sectorBenchmarkRequestSchema, type SectorBenchmarkRequest } from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/auth.types";
import { BenchmarkReportService } from "./benchmark-report.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class BenchmarkReportController {
  constructor(private readonly reports: BenchmarkReportService) {}

  // 202: the report is only queued here; BenchmarkReportWorker builds it.
  @Post("my-companies/:companyId/sector-benchmark")
  @HttpCode(202)
  request(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Body(new ZodValidationPipe(sectorBenchmarkRequestSchema)) body: SectorBenchmarkRequest,
  ) {
    return this.reports.request(user.id, companyId, body);
  }

  @Get("my-companies/:companyId/sector-benchmark")
  list(@CurrentUser() user: AuthenticatedUser, @Param("companyId", new ParseUUIDPipe()) companyId: string) {
    return this.reports.list(user.id, companyId);
  }

  @Get("my-companies/:companyId/sector-benchmark/:jobId/download")
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("jobId", new ParseUUIDPipe()) jobId: string,
  ): Promise<StreamableFile> {
    const { filename, pdf } = await this.reports.download(user.id, companyId, jobId);
    return new StreamableFile(pdf, { type: "application/pdf", disposition: `attachment; filename="${filename}"` });
  }
}

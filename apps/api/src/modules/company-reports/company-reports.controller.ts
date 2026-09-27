import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { reportCompanyInputSchema, type ReportCompanyInput } from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CompanyReportsService } from "./company-reports.service";

@Controller()
export class CompanyReportsController {
  constructor(private readonly reports: CompanyReportsService) {}

  // POST companies/:id/report - any signed-in member except the company's own owner.
  @Post("companies/:id/report")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @HttpCode(200)
  report(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) companyId: string,
    @Body(new ZodValidationPipe(reportCompanyInputSchema, { strict: true })) body: ReportCompanyInput,
  ) {
    return this.reports.report(user.id, companyId, body);
  }
}

// ADMIN-only queue, same class-level guard shape as AdminSocialController.
@Controller("admin/company-reports")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminCompanyReportsController {
  constructor(private readonly reports: CompanyReportsService) {}

  @Get()
  listOpen() {
    return this.reports.listOpen();
  }

  @Post(":companyId/dismiss")
  @HttpCode(200)
  dismiss(@Param("companyId", new ParseUUIDPipe()) companyId: string) {
    return this.reports.dismiss(companyId);
  }
}

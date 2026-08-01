import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { adminCreateCompanyInputSchema, type AdminCreateCompanyInput } from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CompaniesService } from "./companies.service";

@Controller()
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Post("admin/companies")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  createCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(adminCreateCompanyInputSchema)) body: AdminCreateCompanyInput,
  ) {
    return this.companies.createByAdmin(user.id, body);
  }

  @Get("companies")
  search(@Query("q") q?: string) {
    return this.companies.search(q);
  }

  @Get("companies/:slug")
  getBySlug(@Param("slug") slug: string) {
    return this.companies.getBySlug(slug);
  }
}

import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { adminCreateCompanyInputSchema, type AdminCreateCompanyInput } from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { OptionalJwtAuthGuard } from "../../common/guards/optional-jwt-auth.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { OptionalCurrentUser } from "../../common/decorators/optional-current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CompaniesService } from "./companies.service";
import { ReviewsService } from "../reviews/reviews.service";

@Controller()
export class CompaniesController {
  constructor(
    private readonly companies: CompaniesService,
    private readonly reviews: ReviewsService,
  ) {}

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
  search(@Query("q") q?: string, @Query("category") category?: string, @Query("city") city?: string) {
    return this.companies.search(q, category, city);
  }

  // Must be registered before "companies/:slug" — otherwise Nest's route
  // matching would treat "filters" as a slug value for that route instead.
  @Get("companies/filters")
  filters() {
    return this.companies.listFilters();
  }

  @Get("companies/:slug")
  getBySlug(@Param("slug") slug: string) {
    return this.companies.getBySlug(slug);
  }

  @Get("companies/:slug/reviews")
  @UseGuards(OptionalJwtAuthGuard)
  listReviews(@Param("slug") slug: string, @OptionalCurrentUser() user?: AuthenticatedUser) {
    return this.reviews.listForCompany(slug, user?.id);
  }
}

import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import {
  adminCreateCompanyInputSchema,
  companySearchQuerySchema,
  type AdminCreateCompanyInput,
  type CompanySearchQuery,
} from "@iwtr/shared-types";
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
import { FlagCalculatorService } from "../flags/flag-calculator.service";
import { CompanyNarrativeService } from "../company-narrative/company-narrative.service";

@Controller()
export class CompaniesController {
  constructor(
    private readonly companies: CompaniesService,
    private readonly reviews: ReviewsService,
    private readonly flagCalculator: FlagCalculatorService,
    private readonly companyNarrative: CompanyNarrativeService,
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
  search(@Query(new ZodValidationPipe(companySearchQuerySchema)) query: CompanySearchQuery) {
    return this.companies.search(query);
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

  @Get("companies/:slug/survey-stats")
  surveyStats(@Param("slug") slug: string) {
    return this.reviews.getSurveyStats(slug);
  }

  // Dual-Opposite Flag Aggregation Engine (CEO-mandated, replaces the old
  // points-based WorkplaceVibeFlags system). Only ever returns the final
  // GREEN/RED flag + its chart label per category cluster — never the
  // agree/disagree counts (see survey-stats above) or any individual
  // employee's answers, which FlagCalculatorService never even receives.
  @Get("companies/:slug/vibe-flags")
  async vibeFlags(@Param("slug") slug: string) {
    const stats = await this.reviews.getSurveyStats(slug);
    return {
      byWorkplaceType: stats.byWorkplaceType.map((entry) => ({
        workplaceType: entry.workplaceType,
        totalReviews: entry.totalReviews,
        flags: this.flagCalculator.computeVibeFlags(entry),
      })),
    };
  }

  // Lazily-generated 450-600 char rating-narrative summary for the company's
  // primary work-type, assembled entirely from SummaryPattern rows (see
  // PatternGeneratorService) — no external call, no network. Regenerated
  // only on a stale/absent row with 3+ published reviews for that type;
  // otherwise this is a single indexed SELECT. Never returns individual
  // answers or reviewer data.
  @Get("companies/:slug/narrative")
  narrative(@Param("slug") slug: string) {
    return this.companyNarrative.getNarrative(slug);
  }
}

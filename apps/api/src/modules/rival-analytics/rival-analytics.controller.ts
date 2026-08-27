import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { rivalAnalyticsRequestInputSchema, type RivalAnalyticsRequestInput } from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/auth.types";
import { RivalAnalyticsService } from "./rival-analytics.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class RivalAnalyticsController {
  constructor(private readonly rivalAnalytics: RivalAnalyticsService) {}

  @Post("companies/:targetSlug/rival-analytics/request")
  requestReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param("targetSlug") targetSlug: string,
    @Body(new ZodValidationPipe(rivalAnalyticsRequestInputSchema)) body: RivalAnalyticsRequestInput,
  ) {
    return this.rivalAnalytics.requestReport(user.id, body.requestingCompanyId, targetSlug);
  }
}

import { Body, Controller, Param, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { rivalAnalyticsRequestInputSchema, type RivalAnalyticsRequestInput } from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/auth.types";
import { RivalAnalyticsService } from "./rival-analytics.service";

@Controller()
export class RivalAnalyticsController {
  constructor(private readonly rivalAnalytics: RivalAnalyticsService) {}

  @Post("companies/:targetSlug/rival-analytics/request")
  @UseGuards(JwtAuthGuard)
  requestReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param("targetSlug") targetSlug: string,
    @Body(new ZodValidationPipe(rivalAnalyticsRequestInputSchema)) body: RivalAnalyticsRequestInput,
  ) {
    return this.rivalAnalytics.requestReport(user.id, targetSlug, body);
  }

  // Public: this is where the user's *browser* lands after paying on
  // iyzico's hosted page, not an authenticated API call — same pattern and
  // trust model as PaymentsController's own iyzico callback (trustworthy
  // because completeCheckout immediately calls back into iyzico with our
  // own API secret to confirm status, never because this request body is
  // trusted on its own).
  @Post("rival-analytics/callback")
  async callback(@Body() body: { token?: string }, @Res() res: Response) {
    if (body?.token) {
      await this.rivalAnalytics.completeCheckout(body.token).catch(() => {
        // Best-effort: still send the user back into the app either way —
        // a failed status lookup shouldn't strand them on a blank response.
      });
    }
    const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
    res.redirect(`${webOrigin}/my/companies?rivalAnalyticsCheckout=done`);
  }
}

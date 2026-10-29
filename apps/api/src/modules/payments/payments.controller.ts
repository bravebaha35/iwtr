import { Body, Controller, Logger, Param, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { plusCheckoutInputSchema, type PlusCheckoutInput } from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PaymentsService } from "./payments.service";
import { logAndReport } from "../../common/monitoring/log-and-report";

@Controller()
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly payments: PaymentsService) {}

  // A membership (plan) is bought from the owner's own account only: this
  // route is deliberately NOT opened to the shared company login, which can
  // still buy boosts, ad space and reports for its company.
  @Post("my-companies/:companyId/plus/checkout")
  @UseGuards(JwtAuthGuard)
  checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Body(new ZodValidationPipe(plusCheckoutInputSchema)) body: PlusCheckoutInput,
  ) {
    return this.payments.initiatePlusCheckout(user.id, companyId, body);
  }

  // Public: this is where the user's *browser* lands after paying on
  // iyzico's hosted page, not an authenticated API call. Its trustworthiness
  // comes from PaymentsService immediately calling back into iyzico with our
  // own API secret to confirm status — never from trusting this request body.
  @Post("payments/iyzico/callback")
  async callback(@Body() body: { token?: unknown }, @Res() res: Response) {
    // Only a plain string token is ever passed on to iyzico - this route is
    // public, so anything else in the body is ignored.
    if (typeof body?.token === "string" && body.token.length > 0 && body.token.length <= 256) {
      await this.payments.handleCheckoutCallback(body.token).catch((err) => {
        // Best-effort: still send the user back into the app either way —
        // a failed status lookup shouldn't strand them on a blank response.
        // Still logged so a genuine DB/API error here isn't invisible.
        logAndReport(this.logger, `Callback handleCheckoutCallback failed for token=${body.token as string}`, err);
      });
    }
    const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
    res.redirect(`${webOrigin}/my/companies?plusCheckout=done`);
  }
}

import { Body, Controller, Param, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { plusCheckoutInputSchema, type PlusCheckoutInput } from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PaymentsService } from "./payments.service";

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

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
  async callback(@Body() body: { token?: string }, @Res() res: Response) {
    if (body?.token) {
      await this.payments.handleCheckoutCallback(body.token).catch(() => {
        // Best-effort: still send the user back into the app either way —
        // a failed status lookup shouldn't strand them on a blank response.
      });
    }
    const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
    res.redirect(`${webOrigin}/my/companies?plusCheckout=done`);
  }
}

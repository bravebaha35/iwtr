import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { companyLoginSetupInputSchema, type CompanyLoginSetupInput } from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "./auth.types";
import { CompanyLoginService } from "./company-login.service";

// The owner manages the company's shared login here. Deliberately NOT
// @CompanyAccountAllowed(): a company-login session can't see or change it.
@Controller("my-companies/:companyId/company-login")
@UseGuards(JwtAuthGuard)
export class CompanyLoginController {
  constructor(private readonly companyLogins: CompanyLoginService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser, @Param("companyId", new ParseUUIDPipe()) companyId: string) {
    return this.companyLogins.get(user.id, companyId);
  }

  @Post()
  set(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Body(new ZodValidationPipe(companyLoginSetupInputSchema)) body: CompanyLoginSetupInput,
  ) {
    return this.companyLogins.set(user.id, companyId, body);
  }

  @Delete()
  remove(@CurrentUser() user: AuthenticatedUser, @Param("companyId", new ParseUUIDPipe()) companyId: string) {
    return this.companyLogins.remove(user.id, companyId);
  }
}

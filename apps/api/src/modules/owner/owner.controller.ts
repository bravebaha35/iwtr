import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  claimCompanyInputSchema,
  contactAdminInputSchema,
  ownerClaimStatusSchema,
  updateCompanyInputSchema,
  type ClaimCompanyInput,
  type ContactAdminInput,
  type OwnerClaimStatus,
  type UpdateCompanyInput,
} from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/auth.types";
import { OwnerService } from "./owner.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class OwnerController {
  constructor(private readonly owner: OwnerService) {}

  @Post("companies/:slug/claim")
  claimCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Param("slug") slug: string,
    @Body(new ZodValidationPipe(claimCompanyInputSchema)) body: ClaimCompanyInput,
  ) {
    return this.owner.claimCompany(user.id, slug, body);
  }

  @Get("me/company-claims")
  myClaims(@CurrentUser() user: AuthenticatedUser) {
    return this.owner.myClaims(user.id);
  }

  @Get("me/owned-companies")
  myOwnedCompanies(@CurrentUser() user: AuthenticatedUser) {
    return this.owner.myOwnedCompanies(user.id);
  }

  @Patch("my-companies/:companyId")
  updateMyCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Body(new ZodValidationPipe(updateCompanyInputSchema)) body: UpdateCompanyInput,
  ) {
    return this.owner.updateMyCompany(user.id, companyId, body);
  }

  @Post("my-companies/:companyId/contact-admin")
  contactAdmin(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId") companyId: string,
    @Body(new ZodValidationPipe(contactAdminInputSchema)) body: ContactAdminInput,
  ) {
    return this.owner.contactAdmin(user.id, companyId, body);
  }

  @Get("admin/owner-claims")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  listClaims(@Query("status", new ZodValidationPipe(ownerClaimStatusSchema.optional())) status?: OwnerClaimStatus) {
    return this.owner.listClaims(status);
  }

  @Post("admin/owner-claims/:id/approve")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  approveClaim(@Param("id") id: string) {
    return this.owner.approveClaim(id);
  }

  @Post("admin/owner-claims/:id/reject")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  rejectClaim(@Param("id") id: string) {
    return this.owner.rejectClaim(id);
  }

  @Get("admin/owner-messages")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  listContactMessages(@Query("all") all?: string) {
    return this.owner.listContactMessages(all !== "true");
  }

  @Post("admin/owner-messages/:id/resolve")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  resolveContactMessage(@Param("id") id: string) {
    return this.owner.resolveContactMessage(id);
  }
}

import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  adminUpdateCompanyInputSchema,
  dismissCompanySuggestionInputSchema,
  mergeCompaniesInputSchema,
  type AdminUpdateCompanyInput,
  type DismissCompanySuggestionInput,
  type MergeCompaniesInput,
} from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/auth.types";
import { AdminCompaniesService } from "./admin-companies.service";

// Every route here requires the ADMIN role — this whole controller IS the
// "any other user attempting to access admin/* routes must be instantly
// blocked" shield for company management. RolesGuard throws a
// ForbiddenException (403) before AdminCompaniesService ever runs for
// anyone else (see RolesGuard.canActivate) — the frontend's own
// middleware.ts redirect is a UX nicety on top of this, not the actual
// security boundary.
@Controller("admin/companies")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminCompaniesController {
  constructor(private readonly adminCompanies: AdminCompaniesService) {}

  @Get()
  search(@Query("q") q?: string) {
    return this.adminCompanies.search(q);
  }

  @Get("suggestions")
  suggestions() {
    return this.adminCompanies.listSuggestions();
  }

  @Post("suggestions/dismiss")
  dismissSuggestion(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(dismissCompanySuggestionInputSchema)) body: DismissCompanySuggestionInput,
  ) {
    return this.adminCompanies.dismissSuggestion(user.id, body.rawCompanyName);
  }

  @Post("merge")
  merge(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(mergeCompaniesInputSchema)) body: MergeCompaniesInput,
  ) {
    return this.adminCompanies.merge(user.id, body.masterId, body.duplicateId);
  }

  @Post("logo")
  @UseInterceptors(FileInterceptor("file"))
  uploadLogo(@UploadedFile() file: Express.Multer.File) {
    return this.adminCompanies.uploadLogo(file);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(adminUpdateCompanyInputSchema)) body: AdminUpdateCompanyInput,
  ) {
    return this.adminCompanies.update(user.id, id, body);
  }
}

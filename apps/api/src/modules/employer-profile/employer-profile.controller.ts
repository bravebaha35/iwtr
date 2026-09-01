import { Body, Controller, Get, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { employerProfileInputSchema, type EmployerProfileInput } from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/auth.types";
import { EmployerProfileService } from "./employer-profile.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class EmployerProfileController {
  constructor(private readonly employerProfile: EmployerProfileService) {}

  @Get("me/employer-profile")
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.employerProfile.getMyProfile(user.id);
  }

  @Patch("me/employer-profile")
  updateMine(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(employerProfileInputSchema)) body: EmployerProfileInput,
  ) {
    return this.employerProfile.updateMyProfile(user.id, body);
  }

  // Returns only {url} — saving it onto the profile is a separate PATCH
  // above (already accepted profilePictureUrl before this endpoint existed),
  // same two-step pattern OwnerController.uploadLogo/CompanyLogoUploader.tsx
  // already use for company logos.
  @Post("me/employer-profile/photo")
  @UseInterceptors(FileInterceptor("file"))
  uploadPhoto(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: Express.Multer.File) {
    return this.employerProfile.uploadPhoto(user.id, file);
  }

  @Get("admin/employer-profiles")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  adminList() {
    return this.employerProfile.adminListProfiles();
  }

  @Get("admin/employer-profiles/:userId")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  adminGet(@Param("userId") userId: string) {
    return this.employerProfile.adminGetProfile(userId);
  }
}

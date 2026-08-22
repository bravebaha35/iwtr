import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
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

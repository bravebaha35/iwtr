import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  educationHistoryInputSchema,
  updateEducationHistoryInputSchema,
  updateProfileInputSchema,
  type EducationHistoryInput,
  type UpdateEducationHistoryInput,
  type UpdateProfileInput,
} from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ProfileService } from "./profile.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get("me/profile")
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.profile.getMyProfile(user.id);
  }

  @Patch("me/profile")
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProfileInputSchema)) body: UpdateProfileInput,
  ) {
    await this.profile.updateProfile(user.id, body);
    return { success: true };
  }

  @Post("me/education-history")
  addEducationHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(educationHistoryInputSchema)) body: EducationHistoryInput,
  ) {
    return this.profile.addEducationHistory(user.id, body);
  }

  @Patch("me/education-history/:id")
  updateEducationHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateEducationHistoryInputSchema)) body: UpdateEducationHistoryInput,
  ) {
    return this.profile.updateEducationHistory(user.id, id, body);
  }

  @Delete("me/education-history/:id")
  async deleteEducationHistory(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    await this.profile.deleteEducationHistory(user.id, id);
    return { success: true };
  }
}

import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import {
  changePasswordInputSchema,
  educationHistoryInputSchema,
  requestPhoneOtpSchema,
  updateEducationHistoryInputSchema,
  updateIdentityInputSchema,
  updateProfileInputSchema,
  verifyPhoneOtpSchema,
  type ChangePasswordInput,
  type EducationHistoryInput,
  type RequestPhoneOtpInput,
  type UpdateEducationHistoryInput,
  type UpdateIdentityInput,
  type UpdateProfileInput,
  type VerifyPhoneOtpInput,
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

  @Patch("me/identity")
  async updateIdentity(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateIdentityInputSchema)) body: UpdateIdentityInput,
  ) {
    await this.profile.updateBirthDate(user.id, body.birthDate);
    return { success: true };
  }

  @Post("me/phone/request-otp")
  requestPhoneChangeOtp(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(requestPhoneOtpSchema)) body: RequestPhoneOtpInput,
  ) {
    return this.profile.requestPhoneChangeOtp(user.id, body.phoneNumber);
  }

  @Post("me/phone/verify-otp")
  async verifyPhoneChangeOtp(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(verifyPhoneOtpSchema)) body: VerifyPhoneOtpInput,
  ) {
    await this.profile.verifyPhoneChangeOtp(user.id, body.code);
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
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateEducationHistoryInputSchema)) body: UpdateEducationHistoryInput,
  ) {
    return this.profile.updateEducationHistory(user.id, id, body);
  }

  @Delete("me/education-history/:id")
  async deleteEducationHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    await this.profile.deleteEducationHistory(user.id, id);
    return { success: true };
  }

  @Patch("me/password")
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(changePasswordInputSchema)) body: ChangePasswordInput,
  ) {
    await this.profile.changePassword(user.id, body);
    return { success: true };
  }

  @Post("me/freeze")
  async freezeAccount(@CurrentUser() user: AuthenticatedUser) {
    await this.profile.freezeAccount(user.id);
    return { success: true };
  }

  @Delete("me")
  async deleteAccount(@CurrentUser() user: AuthenticatedUser) {
    await this.profile.deleteAccount(user.id);
    return { success: true };
  }
}

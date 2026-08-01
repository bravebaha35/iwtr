import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import {
  avatarSelectionSchema,
  historySubmissionSchema,
  piiOnboardingInputSchema,
  type AvatarSelection,
  type HistorySubmission,
  type PiiOnboardingInput,
} from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/auth.types";
import { OnboardingService } from "./onboarding.service";

@Controller("onboarding")
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get("status")
  getStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.onboarding.getStatus(user.id);
  }

  @Post("pii")
  async submitPii(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(piiOnboardingInputSchema)) body: PiiOnboardingInput,
  ) {
    await this.onboarding.submitPii(user.id, body);
    return { success: true };
  }

  @Post("history")
  async submitHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(historySubmissionSchema)) body: HistorySubmission,
  ) {
    await this.onboarding.submitHistory(user.id, body);
    return { success: true };
  }

  @Post("avatar")
  async submitAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(avatarSelectionSchema)) body: AvatarSelection,
  ) {
    await this.onboarding.submitAvatar(user.id, body);
    return { success: true };
  }
}

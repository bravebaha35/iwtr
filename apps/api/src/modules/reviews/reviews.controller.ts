import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  addEmploymentHistoryInputSchema,
  castVoteInputSchema,
  createReviewInputSchema,
  updateEmploymentHistoryInputSchema,
  type AddEmploymentHistoryInput,
  type CastVoteInput,
  type CreateReviewInput,
  type UpdateEmploymentHistoryInput,
} from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ReviewsService } from "./reviews.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get("me/employment-history")
  myEmploymentHistory(@CurrentUser() user: AuthenticatedUser) {
    return this.reviews.myEmploymentHistory(user.id);
  }

  @Post("me/employment-history")
  addEmploymentHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(addEmploymentHistoryInputSchema)) body: AddEmploymentHistoryInput,
  ) {
    return this.reviews.addEmploymentHistory(user.id, body);
  }

  @Patch("me/employment-history/:id")
  updateEmploymentHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateEmploymentHistoryInputSchema)) body: UpdateEmploymentHistoryInput,
  ) {
    return this.reviews.updateEmploymentHistory(user.id, id, body);
  }

  @Delete("me/employment-history/:id")
  async deleteEmploymentHistory(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    await this.reviews.deleteEmploymentHistory(user.id, id);
    return { success: true };
  }

  @Post("reviews")
  submitReview(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createReviewInputSchema)) body: CreateReviewInput,
  ) {
    return this.reviews.submitReview(user.id, body);
  }

  @Get("reviews/vote-eligibility")
  voteEligibility(@CurrentUser() user: AuthenticatedUser) {
    return this.reviews.getVoteEligibility(user.id);
  }

  @Post("reviews/:id/vote")
  castVote(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(castVoteInputSchema.omit({ reviewId: true }))) body: Omit<CastVoteInput, "reviewId">,
  ) {
    return this.reviews.castVote(user.id, { reviewId: id, value: body.value });
  }
}

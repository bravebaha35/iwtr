import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { createReviewInputSchema, type CreateReviewInput } from "@iwtr/shared-types";
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

  @Post("reviews")
  submitReview(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createReviewInputSchema)) body: CreateReviewInput,
  ) {
    return this.reviews.submitReview(user.id, body);
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  addEmploymentHistoryInputSchema,
  castVoteInputSchema,
  createReviewInputSchema,
  updateEmploymentHistoryInputSchema,
  updateReviewInputSchema,
  workplaceTypeSchema,
  type AddEmploymentHistoryInput,
  type CastVoteInput,
  type CreateReviewInput,
  type UpdateEmploymentHistoryInput,
  type UpdateReviewInput,
} from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ReviewsService } from "./reviews.service";
import { getPublicQuestionsFor } from "./survey-questions.data";

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
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateEmploymentHistoryInputSchema)) body: UpdateEmploymentHistoryInput,
  ) {
    return this.reviews.updateEmploymentHistory(user.id, id, body);
  }

  @Delete("me/employment-history/:id")
  async deleteEmploymentHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    await this.reviews.deleteEmploymentHistory(user.id, id);
    return { success: true };
  }

  // Behind the same JwtAuthGuard as the rest of this controller — question
  // text isn't sensitive on its own, but there's no existing bypass-auth
  // decorator in this codebase and RateButton only ever calls this while
  // already logged in, so reusing the guard is simpler than adding one.
  @Get("reviews/survey/:workplaceType")
  getSurveyQuestions(@Param("workplaceType") workplaceType: string) {
    const parsed = workplaceTypeSchema.safeParse(workplaceType);
    if (!parsed.success) {
      throw new BadRequestException("Unknown workplace type");
    }
    return getPublicQuestionsFor(parsed.data);
  }

  // Well under the global default — a real reviewer submits at most a
  // handful of reviews in any given minute; anything higher is either a
  // client bug looping or an attempt to flood a company's review count.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("reviews")
  submitReview(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createReviewInputSchema)) body: CreateReviewInput,
  ) {
    return this.reviews.submitReview(user.id, body);
  }

  @Get("reviews/:id")
  getMyReview(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.reviews.getMyReview(user.id, id);
  }

  @Patch("reviews/:id")
  updateReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateReviewInputSchema)) body: UpdateReviewInput,
  ) {
    return this.reviews.updateReview(user.id, id, body);
  }

  // Voting is a one-click action, so its natural rate is higher than
  // reviewing — but still capped well below the global default to blunt a
  // script clicking through every review on a page.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post("reviews/:id/vote")
  castVote(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(castVoteInputSchema.omit({ reviewId: true }))) body: Omit<CastVoteInput, "reviewId">,
  ) {
    return this.reviews.castVote(user.id, { reviewId: id, value: body.value });
  }
}

import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  createSocialAnswerInputSchema,
  createSocialQuestionInputSchema,
  reportSocialCommentInputSchema,
  socialQuestionFilterSchema,
  type CreateSocialAnswerInput,
  type CreateSocialQuestionInput,
  type ReportSocialCommentInput,
  type SocialQuestionFilter,
} from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../common/guards/optional-jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { OptionalCurrentUser } from "../../common/decorators/optional-current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/auth.types";
import { parseCategoryGroup, parseWorkplaceTypes } from "./social.controller";
import { SocialQuestionsEnabledGuard } from "./social-questions.flag";
import { SocialQuestionsService } from "./social-questions.service";

// An unrecognized value falls back to "all" rather than 400ing the list.
function parseFilter(raw: string | undefined): SocialQuestionFilter {
  const result = socialQuestionFilterSchema.safeParse(raw);
  return result.success ? result.data : "all";
}

// IWT Social Questions. Every route answers 404 while the feature is
// switched off (SocialQuestionsEnabledGuard). None of them is opened to the
// shared company login: an answer from a company is its owner speaking under
// their own name.
@Controller("social")
@UseGuards(SocialQuestionsEnabledGuard)
export class SocialQuestionsController {
  constructor(private readonly questions: SocialQuestionsService) {}

  // Newest first, cursor-paginated. Same optional-auth rule and the same
  // sidebar filters as the post feed; `company` is one company's questions.
  @Get("questions")
  @UseGuards(OptionalJwtAuthGuard)
  list(
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
    @Query("cursor") cursor?: string,
    @Query("q") q?: string,
    @Query("workplaceTypes") workplaceTypes?: string,
    @Query("categoryGroup") categoryGroup?: string,
    @Query("company") company?: string,
    @Query("filter") filter?: string,
  ) {
    return this.questions.list(user?.id, {
      cursor,
      q,
      workplaceTypes: parseWorkplaceTypes(workplaceTypes),
      categoryGroup: parseCategoryGroup(categoryGroup),
      companySlug: company,
      filter: parseFilter(filter),
    });
  }

  // The name the caller would ask or answer under. Declared before
  // questions/:id so "identity" is never read as an id.
  @Get("questions/identity")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("MEMBER")
  identity(@CurrentUser() user: AuthenticatedUser) {
    return this.questions.identity(user.id);
  }

  @Get("questions/:id")
  @UseGuards(OptionalJwtAuthGuard)
  get(@OptionalCurrentUser() user: AuthenticatedUser | undefined, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.questions.get(user?.id, id);
  }

  // Members only: an employer or admin does not ask. The text is checked
  // against the content rules and refused on a violation.
  @Post("questions")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("MEMBER")
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  ask(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createSocialQuestionInputSchema)) body: CreateSocialQuestionInput,
  ) {
    return this.questions.ask(user.id, body);
  }

  @Delete("questions/:id")
  @UseGuards(JwtAuthGuard)
  deleteQuestion(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.questions.deleteQuestion(user.id, id);
  }

  // A member, or the asked company's approved owner (the service settles
  // which, and refuses everyone else).
  @Post("questions/:id/answers")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  answer(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(createSocialAnswerInputSchema)) body: CreateSocialAnswerInput,
  ) {
    return this.questions.answer(user.id, id, body);
  }

  @Post("questions/:id/report")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  reportQuestion(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(reportSocialCommentInputSchema)) body: ReportSocialCommentInput,
  ) {
    return this.questions.report(user.id, "QUESTION", id, body.reason);
  }

  @Delete("answers/:id")
  @UseGuards(JwtAuthGuard)
  deleteAnswer(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.questions.deleteAnswer(user.id, id);
  }

  // Members only, like a poll vote: "helpful" is the readers' verdict, not
  // an employer's.
  @Post("answers/:id/helpful")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("MEMBER")
  toggleHelpful(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.questions.toggleHelpful(user.id, id);
  }

  @Post("answers/:id/report")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  reportAnswer(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(reportSocialCommentInputSchema)) body: ReportSocialCommentInput,
  ) {
    return this.questions.report(user.id, "ANSWER", id, body.reason);
  }
}

// ADMIN-only: the reported questions and answers queue on /admin/content.
// Deliberately not behind the on/off switch, so the queue can still be
// emptied after the feature has been turned off.
@Controller("admin/social")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminSocialQuestionsController {
  constructor(private readonly questions: SocialQuestionsService) {}

  @Get("reported-questions")
  listReported() {
    return this.questions.adminListReported();
  }

  @Post("questions/:id/dismiss-report")
  dismissQuestion(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.questions.adminDismiss("QUESTION", id);
  }

  @Post("answers/:id/dismiss-report")
  dismissAnswer(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.questions.adminDismiss("ANSWER", id);
  }

  @Delete("questions/:id")
  removeQuestion(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.questions.adminRemove(user.id, "QUESTION", id);
  }

  @Delete("answers/:id")
  removeAnswer(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.questions.adminRemove(user.id, "ANSWER", id);
  }
}

import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { sendMessageInputSchema, type SendMessageInput } from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/auth.types";
import { MessagingService } from "./messaging.service";

/**
 * Private reviewer <-> company conversations. Which side the caller is on is
 * always resolved server-side in MessagingService, never taken from the body.
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("reviews/:id/conversation")
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) reviewId: string,
    @Body(new ZodValidationPipe(sendMessageInputSchema, { strict: true })) body: SendMessageInput,
  ) {
    return this.messaging.startConversation(user.id, reviewId, body);
  }

  @Get("me/conversations")
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.messaging.listMine(user.id);
  }

  @Get("owner/companies/:companyId/conversations")
  listForCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
  ) {
    return this.messaging.listForCompany(user.id, companyId);
  }

  @Get("conversations/:id")
  getThread(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.messaging.getThread(user.id, id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("conversations/:id/messages")
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(sendMessageInputSchema, { strict: true })) body: SendMessageInput,
  ) {
    return this.messaging.sendMessage(user.id, id, body);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("conversations/:id/end")
  @HttpCode(200)
  end(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.messaging.endConversation(user.id, id);
  }

  @Post("conversations/:id/read")
  @HttpCode(204)
  markRead(@CurrentUser() user: AuthenticatedUser, @Param("id", new ParseUUIDPipe()) id: string) {
    return this.messaging.markRead(user.id, id);
  }
}

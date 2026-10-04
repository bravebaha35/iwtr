import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import { markNotificationsReadSchema, type MarkNotificationsReadInput } from "@iwtr/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { NotificationsService } from "./notifications.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get("me/notifications")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.list(user.id);
  }

  @Post("me/notifications/read")
  @HttpCode(200)
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(markNotificationsReadSchema, { strict: true })) body: MarkNotificationsReadInput,
  ) {
    return this.notifications.markRead(user.id, body.ids);
  }
}

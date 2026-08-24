import { Controller, Get, UseGuards } from "@nestjs/common";
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
}

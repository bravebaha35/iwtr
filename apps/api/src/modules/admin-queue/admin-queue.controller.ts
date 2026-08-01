import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import type { QueueStatus } from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { AdminQueueService } from "./admin-queue.service";

@Controller("admin/moderation-queue")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminQueueController {
  constructor(private readonly queue: AdminQueueService) {}

  @Get()
  list(@Query("status") status?: QueueStatus) {
    return this.queue.list(status);
  }

  @Post(":id/approve")
  approve(@Param("id") id: string) {
    return this.queue.approve(id);
  }

  @Post(":id/reject")
  reject(@Param("id") id: string) {
    return this.queue.reject(id);
  }

  @Post(":id/request-sgk-doc")
  requestSgkDoc(@Param("id") id: string) {
    return this.queue.requestSgkDoc(id);
  }
}

import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { EmployerProfileModule } from "../employer-profile/employer-profile.module";
import { ModerationModule } from "../moderation/moderation.module";
import { MessagingController } from "./messaging.controller";
import { MessagingService } from "./messaging.service";

@Module({
  imports: [AuthModule, ModerationModule, EmployerProfileModule],
  controllers: [MessagingController],
  providers: [MessagingService],
})
export class MessagingModule {}

import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { ModerationModule } from "../moderation/moderation.module";
import { AuthModule } from "../auth/auth.module";
import { SocialController } from "./social.controller";
import { SocialService } from "./social.service";

@Module({
  // AuthModule provides TokenService, which JwtAuthGuard (and Task 5's
  // OptionalJwtAuthGuard) inject - every peer feature module that uses these
  // guards imports it too (owner.module.ts, companies.module.ts).
  imports: [PrismaModule, ModerationModule, AuthModule],
  controllers: [SocialController],
  providers: [SocialService],
})
export class SocialModule {}

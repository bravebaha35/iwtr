import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { FollowsController } from "./follows.controller";
import { FollowsService } from "./follows.service";

@Module({
  // AuthModule provides TokenService, which JwtAuthGuard injects — every
  // peer feature module that uses it imports it too (owner.module.ts,
  // companies.module.ts, social.module.ts).
  imports: [PrismaModule, AuthModule],
  controllers: [FollowsController],
  providers: [FollowsService],
})
export class FollowsModule {}

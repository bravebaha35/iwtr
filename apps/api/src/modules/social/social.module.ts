import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { ModerationModule } from "../moderation/moderation.module";
import { AuthModule } from "../auth/auth.module";
import { SocialController } from "./social.controller";
import { AdminSocialController } from "./admin-social.controller";
import { SavedPostsController } from "./saved-posts.controller";
import { SocialService } from "./social.service";
import { AdminSocialQuestionsController, SocialQuestionsController } from "./social-questions.controller";
import { SocialQuestionsService } from "./social-questions.service";
import { SocialQuestionsEnabledGuard } from "./social-questions.flag";
import { SocialOwnerToolsController } from "./social-owner-tools.controller";
import { SocialInsightsService } from "./social-insights.service";
import { SocialScheduleService } from "./social-schedule.service";
import { SocialScheduleWorker } from "./social-schedule.worker";

@Module({
  // AuthModule provides TokenService, which JwtAuthGuard (and Task 5's
  // OptionalJwtAuthGuard) inject - every peer feature module that uses these
  // guards imports it too (owner.module.ts, companies.module.ts).
  imports: [PrismaModule, ModerationModule, AuthModule],
  controllers: [
    SocialController,
    AdminSocialController,
    SavedPostsController,
    SocialQuestionsController,
    AdminSocialQuestionsController,
    SocialOwnerToolsController,
  ],
  providers: [
    SocialService,
    SocialQuestionsService,
    SocialQuestionsEnabledGuard,
    SocialInsightsService,
    SocialScheduleService,
    SocialScheduleWorker,
  ],
})
export class SocialModule {}

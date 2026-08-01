import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ModerationModule } from "../moderation/moderation.module";
import { PiiVaultModule } from "../pii-vault/pii-vault.module";
import { ReviewsController } from "./reviews.controller";
import { ReviewsService } from "./reviews.service";

@Module({
  imports: [AuthModule, ModerationModule, PiiVaultModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}

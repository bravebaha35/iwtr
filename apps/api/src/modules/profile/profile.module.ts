import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ModerationModule } from "../moderation/moderation.module";
import { PiiVaultModule } from "../pii-vault/pii-vault.module";
import { PhoneVerificationModule } from "../phone-verification/phone-verification.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";

@Module({
  imports: [AuthModule, ModerationModule, PiiVaultModule, PhoneVerificationModule, ReviewsModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}

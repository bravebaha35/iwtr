import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PiiVaultModule } from "../pii-vault/pii-vault.module";
import { PhoneVerificationModule } from "../phone-verification/phone-verification.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { MemberCvController } from "./member-cv.controller";
import { MemberCvService } from "./member-cv.service";
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";

@Module({
  imports: [AuthModule, PiiVaultModule, PhoneVerificationModule, ReviewsModule],
  controllers: [ProfileController, MemberCvController],
  providers: [ProfileService, MemberCvService],
})
export class ProfileModule {}

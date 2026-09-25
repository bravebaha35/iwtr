import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PiiVaultModule } from "../pii-vault/pii-vault.module";
import { PhoneVerificationModule } from "../phone-verification/phone-verification.module";
import { EmployerProfileModule } from "../employer-profile/employer-profile.module";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";

@Module({
  imports: [AuthModule, PiiVaultModule, PhoneVerificationModule, EmployerProfileModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}

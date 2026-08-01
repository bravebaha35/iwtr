import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PiiVaultModule } from "../pii-vault/pii-vault.module";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";

@Module({
  imports: [AuthModule, PiiVaultModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}

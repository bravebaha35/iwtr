import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { OnboardingModule } from "./modules/onboarding/onboarding.module";
import { CompaniesModule } from "./modules/companies/companies.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { AdminQueueModule } from "./modules/admin-queue/admin-queue.module";

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    OnboardingModule,
    CompaniesModule,
    ReviewsModule,
    AdminQueueModule,
  ],
})
export class AppModule {}

import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { OnboardingModule } from "./modules/onboarding/onboarding.module";
import { CompaniesModule } from "./modules/companies/companies.module";
import { ReviewsModule } from "./modules/reviews/reviews.module";
import { AdminQueueModule } from "./modules/admin-queue/admin-queue.module";
import { OwnerModule } from "./modules/owner/owner.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { ProfileModule } from "./modules/profile/profile.module";
import { TrafficLogModule } from "./modules/traffic-log/traffic-log.module";
import { EmployerProfileModule } from "./modules/employer-profile/employer-profile.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";

@Module({
  imports: [
    // Global default: 100 requests per minute per IP. Individual endpoints
    // that need tighter limits (auth, review submission, voting) override
    // this with their own @Throttle() decorator rather than a second global
    // tier — see auth.controller.ts / reviews.controller.ts.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    HealthModule,
    AuthModule,
    OnboardingModule,
    CompaniesModule,
    ReviewsModule,
    AdminQueueModule,
    OwnerModule,
    PaymentsModule,
    ProfileModule,
    TrafficLogModule,
    EmployerProfileModule,
    NotificationsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

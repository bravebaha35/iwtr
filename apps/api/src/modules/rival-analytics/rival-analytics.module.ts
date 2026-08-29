import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { FlagsModule } from "../flags/flags.module";
import { PaymentsModule } from "../payments/payments.module";
import { RivalAnalyticsController } from "./rival-analytics.controller";
import { RivalAnalyticsService } from "./rival-analytics.service";
import { EMAIL_PROVIDER } from "./email/email-provider.interface";
import { ConsoleEmailProvider } from "./email/console-email.provider";
import { SmtpEmailProvider } from "./email/smtp-email.provider";

function isSmtpConfigured(): boolean {
  return Boolean(process.env.RIVAL_ANALYTICS_SMTP_USER && process.env.RIVAL_ANALYTICS_SMTP_PASSWORD);
}

@Module({
  imports: [AuthModule, FlagsModule, PaymentsModule],
  controllers: [RivalAnalyticsController],
  providers: [
    {
      provide: EMAIL_PROVIDER,
      useFactory: () => (isSmtpConfigured() ? new SmtpEmailProvider() : new ConsoleEmailProvider()),
    },
    RivalAnalyticsService,
  ],
  exports: [RivalAnalyticsService],
})
export class RivalAnalyticsModule {}

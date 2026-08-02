import { Module } from "@nestjs/common";
import { PhoneVerificationService } from "./phone-verification.service";
import { ConsoleSmsProvider } from "./console-sms.provider";
import { TwilioSmsProvider } from "./twilio-sms.provider";
import { SMS_PROVIDER } from "./sms-provider.interface";

function isTwilioConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

@Module({
  providers: [
    {
      provide: SMS_PROVIDER,
      useFactory: () => (isTwilioConfigured() ? new TwilioSmsProvider() : new ConsoleSmsProvider()),
    },
    PhoneVerificationService,
  ],
  exports: [PhoneVerificationService],
})
export class PhoneVerificationModule {}

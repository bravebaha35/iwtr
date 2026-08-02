import { Injectable } from "@nestjs/common";
import type { ISmsProvider } from "./sms-provider.interface";

// Dev-only fallback used whenever no real SMS gateway is configured (see
// TwilioSmsProvider) — logs the code instead of sending a real text, so local
// development can exercise the whole phone-verification flow without an SMS
// vendor account. Refuses to run once NODE_ENV=production: silently
// "succeeding" without ever delivering a real SMS would leave users stuck
// with no way to get their code, not just be insecure.
@Injectable()
export class ConsoleSmsProvider implements ISmsProvider {
  async sendOtp(phoneNumber: string, code: string): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "No real SMS provider is configured (set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER) — refusing to fake-send in production.",
      );
    }
    // eslint-disable-next-line no-console
    console.log(`[iwtr] DEV SMS to ${phoneNumber}: your iwtr.com verification code is ${code}`);
  }
}

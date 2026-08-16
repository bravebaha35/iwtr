import { Injectable, NotImplementedException } from "@nestjs/common";
import twilio from "twilio";
import type { ISmsProvider } from "./sms-provider.interface";

// Wired up once TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER
// are provided (see apps/api/.env.example) — same "throw until configured"
// pattern as Google/Apple sign-in and iyzico. Twilio was picked because its
// Node SDK + TypeScript types are well-documented and verifiable (field names
// below are taken from the SDK's own types via context7, not guessed), not
// for any Turkey-specific reason — swap in a local gateway later by adding
// another ISmsProvider implementation, without touching PhoneVerificationService.
@Injectable()
export class TwilioSmsProvider implements ISmsProvider {
  async sendOtp(phoneNumber: string, code: string): Promise<void> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    if (!accountSid || !authToken || !from) {
      throw new NotImplementedException(
        "SMS delivery is not configured yet. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER once you have a Twilio account.",
      );
    }

    const client = twilio(accountSid, authToken);
    await client.messages.create({
      to: phoneNumber,
      from,
      body: `Your iworkedthere.com verification code is ${code}. It expires in 5 minutes.`,
    });
  }
}

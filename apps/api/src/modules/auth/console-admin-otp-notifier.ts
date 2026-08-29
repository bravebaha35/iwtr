import { Injectable } from "@nestjs/common";
import type { IAdminOtpNotifier } from "./admin-otp-notifier.interface";

// Dev-only fallback, same refusal rule as ConsoleSmsProvider/
// ConsoleEmailProvider: logs instead of actually delivering the code, and
// refuses to run once NODE_ENV=production so a real deployment can't
// silently "succeed" at sending a code nobody ever receives, locking the
// admin account out with no way to complete login.
@Injectable()
export class ConsoleAdminOtpNotifier implements IAdminOtpNotifier {
  async sendOtp(email: string, code: string): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "No real admin-OTP delivery is configured — refusing to fake-send the admin login code in production. " +
          "Wire up a real IAdminOtpNotifier (e.g. SMTP) before deploying.",
      );
    }
    // eslint-disable-next-line no-console
    console.log(`[iworkedthere] DEV ADMIN LOGIN OTP for ${email}: ${code}`);
  }
}

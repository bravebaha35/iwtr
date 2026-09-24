import nodemailer, { type Transporter } from "nodemailer";
import type { IAdminOtpNotifier } from "./admin-otp-notifier.interface";
import { ConsoleAdminOtpNotifier } from "./console-admin-otp-notifier";

// Each setting reads ADMIN_OTP_* first and falls back to the Rival Analytics
// mailbox (RIVAL_ANALYTICS_*), so a site with one outgoing SMTP account only
// has to configure it once. Kept as its own small provider rather than
// reusing SmtpEmailProvider — see admin-otp-notifier.interface.ts for why.
function smtpSetting(name: "SMTP_HOST" | "SMTP_PORT" | "SMTP_USER" | "SMTP_PASSWORD"): string | undefined {
  return process.env[`ADMIN_OTP_${name}`] || process.env[`RIVAL_ANALYTICS_${name}`] || undefined;
}

export function isAdminOtpSmtpConfigured(): boolean {
  return Boolean(smtpSetting("SMTP_USER") && smtpSetting("SMTP_PASSWORD"));
}

export class SmtpAdminOtpNotifier implements IAdminOtpNotifier {
  private readonly transporter: Transporter;
  private readonly fromAddress: string;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: smtpSetting("SMTP_HOST") ?? "smtp.gmail.com",
      port: Number(smtpSetting("SMTP_PORT") ?? 587),
      secure: false,
      auth: { user: smtpSetting("SMTP_USER"), pass: smtpSetting("SMTP_PASSWORD") },
    });
    this.fromAddress =
      process.env.ADMIN_OTP_SENDER_EMAIL ||
      process.env.RIVAL_ANALYTICS_SENDER_EMAIL ||
      smtpSetting("SMTP_USER") ||
      "";
  }

  async sendOtp(email: string, code: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.fromAddress,
      to: email,
      subject: "Your I Worked There admin login code",
      text:
        `Your admin login code is: ${code}\n\n` +
        "It expires in 5 minutes. If you didn't try to sign in, someone may know your password — change it now.",
    });
  }
}

// Real email once an SMTP account is configured; otherwise the console
// stub, which still refuses to run in production (so a deployment without
// SMTP fails loudly instead of "sending" a code nobody receives).
export function createAdminOtpNotifier(): IAdminOtpNotifier {
  return isAdminOtpSmtpConfigured() ? new SmtpAdminOtpNotifier() : new ConsoleAdminOtpNotifier();
}

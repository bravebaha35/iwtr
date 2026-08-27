import { Injectable } from "@nestjs/common";
import type { EmailAttachment, IEmailProvider } from "./email-provider.interface";

// Dev-only fallback used whenever no real mail provider is configured (see
// SmtpEmailProvider) — logs instead of sending a real email, so local
// development can exercise the whole Rival Analytics flow without a mail
// account. Refuses to run once NODE_ENV=production — same reasoning as
// ConsoleSmsProvider: silently "succeeding" without ever delivering the
// report would leave a paying customer with nothing, not just be insecure.
@Injectable()
export class ConsoleEmailProvider implements IEmailProvider {
  async sendEmail(to: string, subject: string, body: string, attachments: EmailAttachment[] = []): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "No real email provider is configured (set RIVAL_ANALYTICS_SMTP_HOST / _USER / _PASSWORD) — refusing to fake-send in production.",
      );
    }
    // eslint-disable-next-line no-console
    console.log(
      `[iworkedthere] DEV EMAIL to ${to}\nSubject: ${subject}\n${body}\nAttachments: ${attachments.map((a) => `${a.filename} (${a.content.length} bytes)`).join(", ") || "none"}`,
    );
  }
}

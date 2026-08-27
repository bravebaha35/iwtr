import { Injectable } from "@nestjs/common";
import nodemailer, { type Transporter } from "nodemailer";
import type { EmailAttachment, IEmailProvider } from "./email-provider.interface";

// Real provider — works with any SMTP account, including a Google
// Workspace mailbox (smtp.gmail.com, an app password or OAuth2 XOAUTH2
// token as RIVAL_ANALYTICS_SMTP_PASSWORD). The sender address is
// deliberately env-configurable rather than hardcoded: the spec that
// requested this feature named "info@iworkedthere.com", but the project's
// actual settled contact address is iworkedthere@hotmail.com (see project
// memory) — rather than silently picking one, this defaults to whatever
// mailbox RIVAL_ANALYTICS_SMTP_USER authenticates as, and
// RIVAL_ANALYTICS_SENDER_EMAIL can override it once a real address is
// decided.
@Injectable()
export class SmtpEmailProvider implements IEmailProvider {
  private readonly transporter: Transporter;
  private readonly fromAddress: string;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.RIVAL_ANALYTICS_SMTP_HOST ?? "smtp.gmail.com",
      port: Number(process.env.RIVAL_ANALYTICS_SMTP_PORT ?? 587),
      secure: false,
      auth: {
        user: process.env.RIVAL_ANALYTICS_SMTP_USER,
        pass: process.env.RIVAL_ANALYTICS_SMTP_PASSWORD,
      },
    });
    this.fromAddress = process.env.RIVAL_ANALYTICS_SENDER_EMAIL ?? process.env.RIVAL_ANALYTICS_SMTP_USER ?? "";
  }

  async sendEmail(to: string, subject: string, body: string, attachments: EmailAttachment[] = []): Promise<void> {
    await this.transporter.sendMail({
      from: this.fromAddress,
      to,
      subject,
      text: body,
      attachments: attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
    });
  }
}

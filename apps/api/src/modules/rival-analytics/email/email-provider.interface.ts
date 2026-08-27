// Swappable email-gateway boundary — same pattern as ISmsProvider in the
// phone-verification module and IPaymentProvider in payments. Nothing
// above this interface (RivalAnalyticsService) depends on which real
// provider is behind it.
export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface IEmailProvider {
  sendEmail(to: string, subject: string, body: string, attachments?: EmailAttachment[]): Promise<void>;
}

export const EMAIL_PROVIDER = Symbol("EMAIL_PROVIDER");

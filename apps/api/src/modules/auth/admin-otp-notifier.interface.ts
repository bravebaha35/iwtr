// Swappable delivery boundary for the admin-login OTP code — same pattern as
// ISmsProvider (phone-verification) and IEmailProvider (rival-analytics).
// Kept deliberately tiny and separate from rival-analytics' email provider
// rather than reusing it: that one is scoped to a shipped, paid customer
// flow (report delivery) and this repo's convention is small, self-contained
// per-module providers (see CLAUDE.md's module-layout note). The real
// implementation is SmtpAdminOtpNotifier; createAdminOtpNotifier picks it
// when an SMTP account is configured and ConsoleAdminOtpNotifier otherwise.
export interface IAdminOtpNotifier {
  sendOtp(email: string, code: string): Promise<void>;
}

export const ADMIN_OTP_NOTIFIER = Symbol("ADMIN_OTP_NOTIFIER");

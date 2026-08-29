// Swappable delivery boundary for the admin-login OTP code — same pattern as
// ISmsProvider (phone-verification) and IEmailProvider (rival-analytics).
// Kept deliberately tiny and separate from rival-analytics' email provider
// rather than reusing it: that one is scoped to a shipped, paid customer
// flow (report delivery) and this repo's convention is small, self-contained
// per-module providers (see CLAUDE.md's module-layout note) — swap
// ConsoleAdminOtpNotifier below for a real one (e.g. wiring up SMTP) once
// this account needs to log in from somewhere the server console isn't
// visible.
export interface IAdminOtpNotifier {
  sendOtp(email: string, code: string): Promise<void>;
}

export const ADMIN_OTP_NOTIFIER = Symbol("ADMIN_OTP_NOTIFIER");

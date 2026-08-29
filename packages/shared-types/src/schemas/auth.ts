import { z } from "zod";

export const authProviderSchema = z.enum(["EMAIL", "GOOGLE", "APPLE"]);
export type AuthProvider = z.infer<typeof authProviderSchema>;

// Postgres text equality is case-sensitive by default and there's no citext
// column here, so normalizing at the validation boundary is what actually
// makes "Foo@Example.com" and "foo@example.com" resolve to the same account.
const normalizedEmail = z
  .string()
  .email()
  .transform((s) => s.trim().toLowerCase());

// Temporary anti-abuse measure (2026-08-02) — restricts registration to a
// short allowlist of well-known consumer email providers, since there's no
// real email-verification flow yet to catch fake/throwaway addresses.
// Existing accounts on other domains can still log in (loginEmailInputSchema
// below has no such restriction) — this only gates new signups.
export const ALLOWED_REGISTRATION_EMAIL_DOMAINS = ["gmail.com", "hotmail.com", "outlook.com", "windowslive.com"];

export const registerEmailInputSchema = z.object({
  email: normalizedEmail.refine(
    (email) => ALLOWED_REGISTRATION_EMAIL_DOMAINS.some((domain) => email.endsWith(`@${domain}`)),
    { message: `Please use an email address from: ${ALLOWED_REGISTRATION_EMAIL_DOMAINS.join(", ")}` },
  ),
  password: z.string().min(8),
});
export type RegisterEmailInput = z.infer<typeof registerEmailInputSchema>;

export const loginEmailInputSchema = z.object({
  email: normalizedEmail,
  password: z.string().min(1),
});
export type LoginEmailInput = z.infer<typeof loginEmailInputSchema>;

// Same strength rule the frontend already enforces client-side at
// registration (apps/web/src/lib/passwordValidation.ts) — mirrored here as a
// real server-side rule (unlike that file, which is deliberately UI-only)
// since this backs an actual mutation (change-password) rather than just
// gating a submit button.
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
function countPasswordCategories(password: string): number {
  const categoryPatterns = [/[A-Z]/, /[a-z]/, /[0-9]/, /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/];
  return categoryPatterns.filter((re) => re.test(password)).length;
}
export const strongPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Must be at most ${PASSWORD_MAX_LENGTH} characters`)
  .refine((password) => countPasswordCategories(password) >= 3, {
    message: "Must include at least 3 of: uppercase letter, lowercase letter, number, special symbol",
  });

export const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: strongPasswordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;

export const oauthLoginInputSchema = z.object({
  provider: z.enum(["GOOGLE", "APPLE"]),
  idToken: z.string().min(1),
});
export type OAuthLoginInput = z.infer<typeof oauthLoginInputSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

export const authTokensResponseSchema = z.object({
  accessToken: z.string(),
  // The API always returns this in the JSON body — it's the Next.js route
  // handlers under apps/web/src/app/api/auth/* and api/proxy/[...path] that
  // turn it into an httpOnly cookie before anything reaches the browser (see
  // apps/web/src/lib/server-auth.ts). A raw mobile client would read this
  // field directly instead.
  refreshToken: z.string().optional(),
  expiresInSeconds: z.number(),
});
export type AuthTokensResponse = z.infer<typeof authTokensResponseSchema>;

// POST /auth/login's actual response shape — a plain AuthTokensResponse for
// every account except the hardcoded ADMIN email, which instead gets sent
// an OTP and must follow up with POST /auth/login/verify-otp (see
// AuthService.loginWithEmail / verifyAdminLoginOtp). Tagged with `status`
// rather than just being AuthTokensResponse-or-null so a client can't
// mistake "no tokens yet, OTP pending" for a malformed success response.
export const loginResultSchema = z.discriminatedUnion("status", [
  authTokensResponseSchema.extend({ status: z.literal("OK") }),
  z.object({ status: z.literal("OTP_REQUIRED"), email: z.string() }),
]);
export type LoginResult = z.infer<typeof loginResultSchema>;

export const verifyAdminOtpInputSchema = loginEmailInputSchema.pick({ email: true }).extend({
  code: z.string().regex(/^\d{6}$/, "Must be a 6-digit code"),
});
export type VerifyAdminOtpInput = z.infer<typeof verifyAdminOtpInputSchema>;

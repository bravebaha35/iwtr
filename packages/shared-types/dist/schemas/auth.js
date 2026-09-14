"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.devOwnerLoginInputSchema = exports.devAdminLoginInputSchema = exports.verifyAdminOtpInputSchema = exports.loginResultSchema = exports.authTokensResponseSchema = exports.refreshRequestSchema = exports.oauthLoginInputSchema = exports.changePasswordInputSchema = exports.strongPasswordSchema = exports.loginEmailInputSchema = exports.registerEmailInputSchema = exports.ALLOWED_REGISTRATION_EMAIL_DOMAINS = exports.authProviderSchema = void 0;
const zod_1 = require("zod");
exports.authProviderSchema = zod_1.z.enum(["EMAIL", "GOOGLE", "APPLE"]);
// Postgres text equality is case-sensitive by default and there's no citext
// column here, so normalizing at the validation boundary is what actually
// makes "Foo@Example.com" and "foo@example.com" resolve to the same account.
const normalizedEmail = zod_1.z
    .string()
    .email()
    .transform((s) => s.trim().toLowerCase());
// Temporary anti-abuse measure (2026-08-02) — restricts registration to a
// short allowlist of well-known consumer email providers, since there's no
// real email-verification flow yet to catch fake/throwaway addresses.
// Existing accounts on other domains can still log in (loginEmailInputSchema
// below has no such restriction) — this only gates new signups.
exports.ALLOWED_REGISTRATION_EMAIL_DOMAINS = ["gmail.com", "hotmail.com", "outlook.com", "windowslive.com"];
exports.registerEmailInputSchema = zod_1.z.object({
    email: normalizedEmail.refine((email) => exports.ALLOWED_REGISTRATION_EMAIL_DOMAINS.some((domain) => email.endsWith(`@${domain}`)), { message: `Please use an email address from: ${exports.ALLOWED_REGISTRATION_EMAIL_DOMAINS.join(", ")}` }),
    password: zod_1.z.string().min(8),
});
exports.loginEmailInputSchema = zod_1.z.object({
    email: normalizedEmail,
    password: zod_1.z.string().min(1),
});
// Same strength rule the frontend already enforces client-side at
// registration (apps/web/src/lib/passwordValidation.ts) — mirrored here as a
// real server-side rule (unlike that file, which is deliberately UI-only)
// since this backs an actual mutation (change-password) rather than just
// gating a submit button.
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
function countPasswordCategories(password) {
    const categoryPatterns = [/[A-Z]/, /[a-z]/, /[0-9]/, /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/];
    return categoryPatterns.filter((re) => re.test(password)).length;
}
exports.strongPasswordSchema = zod_1.z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(PASSWORD_MAX_LENGTH, `Must be at most ${PASSWORD_MAX_LENGTH} characters`)
    .refine((password) => countPasswordCategories(password) >= 3, {
    message: "Must include at least 3 of: uppercase letter, lowercase letter, number, special symbol",
});
exports.changePasswordInputSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1),
    newPassword: exports.strongPasswordSchema,
});
exports.oauthLoginInputSchema = zod_1.z.object({
    provider: zod_1.z.enum(["GOOGLE", "APPLE"]),
    idToken: zod_1.z.string().min(1),
});
exports.refreshRequestSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1).optional(),
});
exports.authTokensResponseSchema = zod_1.z.object({
    accessToken: zod_1.z.string(),
    // The API always returns this in the JSON body — it's the Next.js route
    // handlers under apps/web/src/app/api/auth/* and api/proxy/[...path] that
    // turn it into an httpOnly cookie before anything reaches the browser (see
    // apps/web/src/lib/server-auth.ts). A raw mobile client would read this
    // field directly instead.
    refreshToken: zod_1.z.string().optional(),
    expiresInSeconds: zod_1.z.number(),
});
// POST /auth/login's actual response shape — a plain AuthTokensResponse for
// every account except the hardcoded ADMIN email, which instead gets sent
// an OTP and must follow up with POST /auth/login/verify-otp (see
// AuthService.loginWithEmail / verifyAdminLoginOtp). Tagged with `status`
// rather than just being AuthTokensResponse-or-null so a client can't
// mistake "no tokens yet, OTP pending" for a malformed success response.
exports.loginResultSchema = zod_1.z.discriminatedUnion("status", [
    exports.authTokensResponseSchema.extend({ status: zod_1.z.literal("OK") }),
    zod_1.z.object({ status: zod_1.z.literal("OTP_REQUIRED"), email: zod_1.z.string() }),
]);
exports.verifyAdminOtpInputSchema = exports.loginEmailInputSchema.pick({ email: true }).extend({
    code: zod_1.z.string().regex(/^\d{6}$/, "Must be a 6-digit code"),
});
// POST /auth/dev-admin-login — local-dev-only shortcut that skips password
// and OTP entirely for a pre-existing ADMIN account (AuthService.devAdminLogin
// refuses to run once NODE_ENV=production, same guard as ConsoleAdminOtpNotifier).
exports.devAdminLoginInputSchema = exports.loginEmailInputSchema.pick({ email: true });
// POST /auth/dev-owner-login — same local-dev-only shortcut, for a
// pre-existing COMPANY_OWNER account instead of ADMIN (AuthService.devOwnerLogin,
// same production refusal). Identical shape to devAdminLoginInputSchema; kept
// as its own named export since the two log into different account kinds.
exports.devOwnerLoginInputSchema = exports.loginEmailInputSchema.pick({ email: true });

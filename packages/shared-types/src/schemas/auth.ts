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

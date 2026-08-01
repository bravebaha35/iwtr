import { z } from "zod";

export const authProviderSchema = z.enum(["EMAIL", "GOOGLE", "APPLE"]);
export type AuthProvider = z.infer<typeof authProviderSchema>;

export const registerEmailInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type RegisterEmailInput = z.infer<typeof registerEmailInputSchema>;

export const loginEmailInputSchema = z.object({
  email: z.string().email(),
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
  // Present in the JSON body for mobile clients; web clients instead receive
  // this as an httpOnly cookie set by the Next.js proxy route (see apps/web/lib/auth).
  refreshToken: z.string().optional(),
  expiresInSeconds: z.number(),
});
export type AuthTokensResponse = z.infer<typeof authTokensResponseSchema>;

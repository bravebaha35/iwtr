import { z } from "zod";
export declare const authProviderSchema: z.ZodEnum<["EMAIL", "GOOGLE", "APPLE"]>;
export type AuthProvider = z.infer<typeof authProviderSchema>;
export declare const ALLOWED_REGISTRATION_EMAIL_DOMAINS: string[];
export declare const registerEmailInputSchema: z.ZodObject<{
    email: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export type RegisterEmailInput = z.infer<typeof registerEmailInputSchema>;
export declare const loginEmailInputSchema: z.ZodObject<{
    email: z.ZodEffects<z.ZodString, string, string>;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export type LoginEmailInput = z.infer<typeof loginEmailInputSchema>;
export declare const strongPasswordSchema: z.ZodEffects<z.ZodString, string, string>;
export declare const changePasswordInputSchema: z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    currentPassword: string;
    newPassword: string;
}, {
    currentPassword: string;
    newPassword: string;
}>;
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;
export declare const oauthLoginInputSchema: z.ZodObject<{
    provider: z.ZodEnum<["GOOGLE", "APPLE"]>;
    idToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    provider: "GOOGLE" | "APPLE";
    idToken: string;
}, {
    provider: "GOOGLE" | "APPLE";
    idToken: string;
}>;
export type OAuthLoginInput = z.infer<typeof oauthLoginInputSchema>;
export declare const refreshRequestSchema: z.ZodObject<{
    refreshToken: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    refreshToken?: string | undefined;
}, {
    refreshToken?: string | undefined;
}>;
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;
export declare const authTokensResponseSchema: z.ZodObject<{
    accessToken: z.ZodString;
    refreshToken: z.ZodOptional<z.ZodString>;
    expiresInSeconds: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    accessToken: string;
    expiresInSeconds: number;
    refreshToken?: string | undefined;
}, {
    accessToken: string;
    expiresInSeconds: number;
    refreshToken?: string | undefined;
}>;
export type AuthTokensResponse = z.infer<typeof authTokensResponseSchema>;
export declare const loginResultSchema: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
    accessToken: z.ZodString;
    refreshToken: z.ZodOptional<z.ZodString>;
    expiresInSeconds: z.ZodNumber;
} & {
    status: z.ZodLiteral<"OK">;
}, "strip", z.ZodTypeAny, {
    status: "OK";
    accessToken: string;
    expiresInSeconds: number;
    refreshToken?: string | undefined;
}, {
    status: "OK";
    accessToken: string;
    expiresInSeconds: number;
    refreshToken?: string | undefined;
}>, z.ZodObject<{
    status: z.ZodLiteral<"OTP_REQUIRED">;
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "OTP_REQUIRED";
    email: string;
}, {
    status: "OTP_REQUIRED";
    email: string;
}>]>;
export type LoginResult = z.infer<typeof loginResultSchema>;
export declare const verifyAdminOtpInputSchema: z.ZodObject<Pick<{
    email: z.ZodEffects<z.ZodString, string, string>;
    password: z.ZodString;
}, "email"> & {
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    email: string;
}, {
    code: string;
    email: string;
}>;
export type VerifyAdminOtpInput = z.infer<typeof verifyAdminOtpInputSchema>;
export declare const devAdminLoginInputSchema: z.ZodObject<Pick<{
    email: z.ZodEffects<z.ZodString, string, string>;
    password: z.ZodString;
}, "email">, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export type DevAdminLoginInput = z.infer<typeof devAdminLoginInputSchema>;
export declare const devOwnerLoginInputSchema: z.ZodObject<Pick<{
    email: z.ZodEffects<z.ZodString, string, string>;
    password: z.ZodString;
}, "email">, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export type DevOwnerLoginInput = z.infer<typeof devOwnerLoginInputSchema>;

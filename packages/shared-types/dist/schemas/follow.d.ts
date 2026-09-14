import { z } from "zod";
export declare const companyFollowToggleResultSchema: z.ZodObject<{
    companyId: z.ZodString;
    following: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    companyId: string;
    following: boolean;
}, {
    companyId: string;
    following: boolean;
}>;
export type CompanyFollowToggleResult = z.infer<typeof companyFollowToggleResultSchema>;
export declare const followedCompanySummarySchema: z.ZodObject<{
    companyId: z.ZodString;
    companyName: z.ZodString;
    companySlug: z.ZodString;
    mainPhotoUrl: z.ZodNullable<z.ZodString>;
    badgeTier: z.ZodEnum<["FREE", "BLUE", "BLUE_PLUS", "ENTERPRISE"]>;
}, "strip", z.ZodTypeAny, {
    companyId: string;
    companyName: string;
    mainPhotoUrl: string | null;
    badgeTier: "BLUE" | "BLUE_PLUS" | "ENTERPRISE" | "FREE";
    companySlug: string;
}, {
    companyId: string;
    companyName: string;
    mainPhotoUrl: string | null;
    badgeTier: "BLUE" | "BLUE_PLUS" | "ENTERPRISE" | "FREE";
    companySlug: string;
}>;
export type FollowedCompanySummary = z.infer<typeof followedCompanySummarySchema>;
export declare const companyFollowerCountSchema: z.ZodObject<{
    count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    count: number;
}, {
    count: number;
}>;
export type CompanyFollowerCount = z.infer<typeof companyFollowerCountSchema>;
export declare const userFollowToggleResultSchema: z.ZodObject<{
    userId: z.ZodString;
    following: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    userId: string;
    following: boolean;
}, {
    userId: string;
    following: boolean;
}>;
export type UserFollowToggleResult = z.infer<typeof userFollowToggleResultSchema>;
export declare const savedPostToggleResultSchema: z.ZodObject<{
    postId: z.ZodString;
    saved: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    saved: boolean;
    postId: string;
}, {
    saved: boolean;
    postId: string;
}>;
export type SavedPostToggleResult = z.infer<typeof savedPostToggleResultSchema>;

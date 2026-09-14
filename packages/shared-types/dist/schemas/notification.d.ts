import { z } from "zod";
export declare const notificationTypeSchema: z.ZodEnum<["VOTE_HELPFUL", "VOTE_NOT_HELPFUL", "COMPANY_REPLY", "JOB_POSTING_PUBLISHED", "COMPANY_STATUS_UPDATE", "COMPANY_NEW_SOCIAL_POST", "COMPANY_HIRING"]>;
export type NotificationType = z.infer<typeof notificationTypeSchema>;
export declare const notificationSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<["VOTE_HELPFUL", "VOTE_NOT_HELPFUL", "COMPANY_REPLY", "JOB_POSTING_PUBLISHED", "COMPANY_STATUS_UPDATE", "COMPANY_NEW_SOCIAL_POST", "COMPANY_HIRING"]>;
    companyName: z.ZodString;
    companySlug: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "VOTE_HELPFUL" | "VOTE_NOT_HELPFUL" | "COMPANY_REPLY" | "JOB_POSTING_PUBLISHED" | "COMPANY_STATUS_UPDATE" | "COMPANY_NEW_SOCIAL_POST" | "COMPANY_HIRING";
    id: string;
    createdAt: string;
    companyName: string;
    companySlug: string | null;
}, {
    type: "VOTE_HELPFUL" | "VOTE_NOT_HELPFUL" | "COMPANY_REPLY" | "JOB_POSTING_PUBLISHED" | "COMPANY_STATUS_UPDATE" | "COMPANY_NEW_SOCIAL_POST" | "COMPANY_HIRING";
    id: string;
    createdAt: string;
    companyName: string;
    companySlug: string | null;
}>;
export type Notification = z.infer<typeof notificationSchema>;

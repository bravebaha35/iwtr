import { z } from "zod";
export declare const contentViolationTypeSchema: z.ZodEnum<["NAME_OR_SURNAME", "JOB_TITLE", "PROFANITY", "ABUSE_OR_INSULT", "PII_PHONE_NUMBER"]>;
export type ContentViolationType = z.infer<typeof contentViolationTypeSchema>;
export declare const skippableViolationTypeSchema: z.ZodEnum<["NAME_OR_SURNAME", "JOB_TITLE", "ABUSE_OR_INSULT"]>;
export type SkippableViolationType = z.infer<typeof skippableViolationTypeSchema>;
export declare const contentCheckResultSchema: z.ZodObject<{
    violates: z.ZodBoolean;
    violationTypes: z.ZodArray<z.ZodEnum<["NAME_OR_SURNAME", "JOB_TITLE", "PROFANITY", "ABUSE_OR_INSULT", "PII_PHONE_NUMBER"]>, "many">;
    confidence: z.ZodNumber;
    sanitizedSuggestion: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    violates: boolean;
    violationTypes: ("NAME_OR_SURNAME" | "JOB_TITLE" | "PROFANITY" | "ABUSE_OR_INSULT" | "PII_PHONE_NUMBER")[];
    confidence: number;
    sanitizedSuggestion?: string | undefined;
}, {
    violates: boolean;
    violationTypes: ("NAME_OR_SURNAME" | "JOB_TITLE" | "PROFANITY" | "ABUSE_OR_INSULT" | "PII_PHONE_NUMBER")[];
    confidence: number;
    sanitizedSuggestion?: string | undefined;
}>;
export type ContentCheckResult = z.infer<typeof contentCheckResultSchema>;
export declare const trustScoreResultSchema: z.ZodObject<{
    score: z.ZodNumber;
    factors: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    score: number;
    factors: string[];
}, {
    score: number;
    factors: string[];
}>;
export type TrustScoreResult = z.infer<typeof trustScoreResultSchema>;
export declare const moderationQueueReasonSchema: z.ZodEnum<["CONTENT_FLAGGED", "LOW_TRUST_SCORE", "NEW_USER"]>;
export type ModerationQueueReason = z.infer<typeof moderationQueueReasonSchema>;
export declare const queueStatusSchema: z.ZodEnum<["OPEN", "ASKED_FOR_SGK_DOC", "APPROVED", "REJECTED"]>;
export type QueueStatus = z.infer<typeof queueStatusSchema>;
export declare const moderationQueueItemSchema: z.ZodObject<{
    id: z.ZodString;
    reviewId: z.ZodString;
    reason: z.ZodEnum<["CONTENT_FLAGGED", "LOW_TRUST_SCORE", "NEW_USER"]>;
    aiSummary: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["OPEN", "ASKED_FOR_SGK_DOC", "APPROVED", "REJECTED"]>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "REJECTED" | "OPEN" | "ASKED_FOR_SGK_DOC" | "APPROVED";
    id: string;
    createdAt: string;
    reviewId: string;
    reason: "CONTENT_FLAGGED" | "LOW_TRUST_SCORE" | "NEW_USER";
    aiSummary: string | null;
}, {
    status: "REJECTED" | "OPEN" | "ASKED_FOR_SGK_DOC" | "APPROVED";
    id: string;
    createdAt: string;
    reviewId: string;
    reason: "CONTENT_FLAGGED" | "LOW_TRUST_SCORE" | "NEW_USER";
    aiSummary: string | null;
}>;
export type ModerationQueueItem = z.infer<typeof moderationQueueItemSchema>;
export declare const adminQueueItemSchema: z.ZodObject<{
    id: z.ZodString;
    reviewId: z.ZodString;
    reason: z.ZodEnum<["CONTENT_FLAGGED", "LOW_TRUST_SCORE", "NEW_USER"]>;
    aiSummary: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["OPEN", "ASKED_FOR_SGK_DOC", "APPROVED", "REJECTED"]>;
    createdAt: z.ZodString;
    companyName: z.ZodString;
    review: z.ZodObject<{
        corporateCultureScore: z.ZodNumber;
        leadershipScore: z.ZodNumber;
        infrastructureScore: z.ZodNumber;
        workLifeBalanceScore: z.ZodNumber;
        stabilityScore: z.ZodNumber;
        generalThoughts: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        generalThoughts: string | null;
        corporateCultureScore: number;
        leadershipScore: number;
        infrastructureScore: number;
        workLifeBalanceScore: number;
        stabilityScore: number;
    }, {
        generalThoughts: string | null;
        corporateCultureScore: number;
        leadershipScore: number;
        infrastructureScore: number;
        workLifeBalanceScore: number;
        stabilityScore: number;
    }>;
}, "strip", z.ZodTypeAny, {
    status: "REJECTED" | "OPEN" | "ASKED_FOR_SGK_DOC" | "APPROVED";
    id: string;
    createdAt: string;
    companyName: string;
    reviewId: string;
    reason: "CONTENT_FLAGGED" | "LOW_TRUST_SCORE" | "NEW_USER";
    aiSummary: string | null;
    review: {
        generalThoughts: string | null;
        corporateCultureScore: number;
        leadershipScore: number;
        infrastructureScore: number;
        workLifeBalanceScore: number;
        stabilityScore: number;
    };
}, {
    status: "REJECTED" | "OPEN" | "ASKED_FOR_SGK_DOC" | "APPROVED";
    id: string;
    createdAt: string;
    companyName: string;
    reviewId: string;
    reason: "CONTENT_FLAGGED" | "LOW_TRUST_SCORE" | "NEW_USER";
    aiSummary: string | null;
    review: {
        generalThoughts: string | null;
        corporateCultureScore: number;
        leadershipScore: number;
        infrastructureScore: number;
        workLifeBalanceScore: number;
        stabilityScore: number;
    };
}>;
export type AdminQueueItem = z.infer<typeof adminQueueItemSchema>;

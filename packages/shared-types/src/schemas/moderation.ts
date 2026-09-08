import { z } from "zod";

// The content-rule categories checkContent can flag.
export const contentViolationTypeSchema = z.enum([
  "NAME_OR_SURNAME",
  "JOB_TITLE",
  "PROFANITY",
  "ABUSE_OR_INSULT",
  "PII_PHONE_NUMBER",
]);
export type ContentViolationType = z.infer<typeof contentViolationTypeSchema>;

// The subset a caller may opt out of via ModerationService.checkContent's
// options.skipViolationTypes. An employer's own IWT Social post caption
// passes all three (SocialService.createPost): it may name its own staff,
// name a job role, and write an all-caps announcement in its own post.
// PROFANITY and PII_PHONE_NUMBER are deliberately NOT skippable.
export const skippableViolationTypeSchema = z.enum([
  "NAME_OR_SURNAME",
  "JOB_TITLE",
  "ABUSE_OR_INSULT",
]);
export type SkippableViolationType = z.infer<typeof skippableViolationTypeSchema>;

// Output of the content-rule check stage (names, titles, curse words, insults).
export const contentCheckResultSchema = z.object({
  violates: z.boolean(),
  violationTypes: z.array(contentViolationTypeSchema),
  confidence: z.number().min(0).max(1),
  sanitizedSuggestion: z.string().optional(),
});
export type ContentCheckResult = z.infer<typeof contentCheckResultSchema>;

// Output of the employment-claim plausibility stage. This is a plausibility
// signal only — there is no live SGK integration to actually verify employment.
export const trustScoreResultSchema = z.object({
  score: z.number().min(0).max(1),
  factors: z.array(z.string()),
});
export type TrustScoreResult = z.infer<typeof trustScoreResultSchema>;

export const moderationQueueReasonSchema = z.enum([
  "CONTENT_FLAGGED",
  "LOW_TRUST_SCORE",
  "NEW_USER",
]);
export type ModerationQueueReason = z.infer<typeof moderationQueueReasonSchema>;

export const queueStatusSchema = z.enum([
  "OPEN",
  "ASKED_FOR_SGK_DOC",
  "APPROVED",
  "REJECTED",
]);
export type QueueStatus = z.infer<typeof queueStatusSchema>;

export const moderationQueueItemSchema = z.object({
  id: z.string().uuid(),
  reviewId: z.string().uuid(),
  reason: moderationQueueReasonSchema,
  aiSummary: z.string().nullable(),
  status: queueStatusSchema,
  createdAt: z.string().datetime(),
});
export type ModerationQueueItem = z.infer<typeof moderationQueueItemSchema>;

export const adminQueueItemSchema = z.object({
  id: z.string().uuid(),
  reviewId: z.string().uuid(),
  reason: moderationQueueReasonSchema,
  aiSummary: z.string().nullable(),
  status: queueStatusSchema,
  createdAt: z.string().datetime(),
  companyName: z.string(),
  review: z.object({
    corporateCultureScore: z.number(),
    leadershipScore: z.number(),
    infrastructureScore: z.number(),
    workLifeBalanceScore: z.number(),
    stabilityScore: z.number(),
    generalThoughts: z.string().nullable(),
  }),
});
export type AdminQueueItem = z.infer<typeof adminQueueItemSchema>;

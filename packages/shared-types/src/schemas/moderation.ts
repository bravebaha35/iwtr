import { z } from "zod";

// Output of the content-rule check stage (names, titles, curse words, insults).
export const contentCheckResultSchema = z.object({
  violates: z.boolean(),
  violationTypes: z.array(
    z.enum(["NAME_OR_SURNAME", "JOB_TITLE", "PROFANITY", "ABUSE_OR_INSULT"]),
  ),
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
    corporateCultureComment: z.string().nullable(),
    leadershipScore: z.number(),
    leadershipComment: z.string().nullable(),
    infrastructureScore: z.number(),
    infrastructureComment: z.string().nullable(),
    workLifeBalanceScore: z.number(),
    workLifeBalanceComment: z.string().nullable(),
    stabilityScore: z.number(),
    stabilityComment: z.string().nullable(),
    generalThoughts: z.string().nullable(),
  }),
});
export type AdminQueueItem = z.infer<typeof adminQueueItemSchema>;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminQueueItemSchema = exports.moderationQueueItemSchema = exports.queueStatusSchema = exports.moderationQueueReasonSchema = exports.trustScoreResultSchema = exports.contentCheckResultSchema = exports.skippableViolationTypeSchema = exports.contentViolationTypeSchema = void 0;
const zod_1 = require("zod");
// The content-rule categories checkContent can flag.
exports.contentViolationTypeSchema = zod_1.z.enum([
    "NAME_OR_SURNAME",
    "JOB_TITLE",
    "PROFANITY",
    "ABUSE_OR_INSULT",
    "PII_PHONE_NUMBER",
]);
// The subset a caller may opt out of via ModerationService.checkContent's
// options.skipViolationTypes. An employer's own IWT Social post caption
// passes all three (SocialService.createPost): it may name its own staff,
// name a job role, and write an all-caps announcement in its own post.
// PROFANITY and PII_PHONE_NUMBER are deliberately NOT skippable.
exports.skippableViolationTypeSchema = zod_1.z.enum([
    "NAME_OR_SURNAME",
    "JOB_TITLE",
    "ABUSE_OR_INSULT",
]);
// Output of the content-rule check stage (names, titles, curse words, insults).
exports.contentCheckResultSchema = zod_1.z.object({
    violates: zod_1.z.boolean(),
    violationTypes: zod_1.z.array(exports.contentViolationTypeSchema),
    confidence: zod_1.z.number().min(0).max(1),
    sanitizedSuggestion: zod_1.z.string().optional(),
});
// Output of the employment-claim plausibility stage. This is a plausibility
// signal only — there is no live SGK integration to actually verify employment.
exports.trustScoreResultSchema = zod_1.z.object({
    score: zod_1.z.number().min(0).max(1),
    factors: zod_1.z.array(zod_1.z.string()),
});
exports.moderationQueueReasonSchema = zod_1.z.enum([
    "CONTENT_FLAGGED",
    "LOW_TRUST_SCORE",
    "NEW_USER",
]);
exports.queueStatusSchema = zod_1.z.enum([
    "OPEN",
    "ASKED_FOR_SGK_DOC",
    "APPROVED",
    "REJECTED",
]);
exports.moderationQueueItemSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    reviewId: zod_1.z.string().uuid(),
    reason: exports.moderationQueueReasonSchema,
    aiSummary: zod_1.z.string().nullable(),
    status: exports.queueStatusSchema,
    createdAt: zod_1.z.string().datetime(),
});
exports.adminQueueItemSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    reviewId: zod_1.z.string().uuid(),
    reason: exports.moderationQueueReasonSchema,
    aiSummary: zod_1.z.string().nullable(),
    status: exports.queueStatusSchema,
    createdAt: zod_1.z.string().datetime(),
    companyName: zod_1.z.string(),
    review: zod_1.z.object({
        corporateCultureScore: zod_1.z.number(),
        leadershipScore: zod_1.z.number(),
        infrastructureScore: zod_1.z.number(),
        workLifeBalanceScore: zod_1.z.number(),
        stabilityScore: zod_1.z.number(),
        generalThoughts: zod_1.z.string().nullable(),
    }),
});

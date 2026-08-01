import { z } from "zod";

export const reviewStatusSchema = z.enum([
  "PENDING_MODERATION",
  "PENDING_ADMIN_REVIEW",
  "PUBLISHED",
  "REJECTED",
]);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

const starScore = z.number().int().min(1).max(5);

export const createReviewInputSchema = z.object({
  companyId: z.string().uuid(),
  // Must be an EmploymentHistory row owned by the caller and matching companyId;
  // the server re-validates this regardless of what the client sends.
  employmentHistoryId: z.string().uuid(),
  corporateCultureScore: starScore,
  corporateCultureComment: z.string().max(2000).optional(),
  leadershipScore: starScore,
  leadershipComment: z.string().max(2000).optional(),
  infrastructureScore: starScore,
  infrastructureComment: z.string().max(2000).optional(),
  workLifeBalanceScore: starScore,
  workLifeBalanceComment: z.string().max(2000).optional(),
  stabilityScore: starScore,
  stabilityComment: z.string().max(2000).optional(),
  generalThoughts: z.string().max(4000).optional(),
});
export type CreateReviewInput = z.infer<typeof createReviewInputSchema>;

// What's ever returned publicly for a review — no userId, no employment history
// details beyond what's needed, nothing that could re-identify the reviewer.
export const publicReviewSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  corporateCultureScore: starScore,
  corporateCultureComment: z.string().nullable(),
  leadershipScore: starScore,
  leadershipComment: z.string().nullable(),
  infrastructureScore: starScore,
  infrastructureComment: z.string().nullable(),
  workLifeBalanceScore: starScore,
  workLifeBalanceComment: z.string().nullable(),
  stabilityScore: starScore,
  stabilityComment: z.string().nullable(),
  generalThoughts: z.string().nullable(),
  status: reviewStatusSchema,
  publishedAt: z.string().datetime().nullable(),
  likeCount: z.number().int().min(0),
  dislikeCount: z.number().int().min(0),
});
export type PublicReview = z.infer<typeof publicReviewSchema>;

export const voteValueSchema = z.union([z.literal(1), z.literal(-1)]);
export type VoteValue = z.infer<typeof voteValueSchema>;

export const castVoteInputSchema = z.object({
  reviewId: z.string().uuid(),
  value: voteValueSchema,
});
export type CastVoteInput = z.infer<typeof castVoteInputSchema>;

export const submitReviewResultSchema = z.object({
  reviewId: z.string().uuid(),
  status: reviewStatusSchema,
  message: z.string(),
});
export type SubmitReviewResult = z.infer<typeof submitReviewResultSchema>;

// An employment history entry the current user can potentially rate,
// annotated with whether they already have a review for that company.
export const myEmploymentEntrySchema = z.object({
  id: z.string().uuid(),
  rawCompanyName: z.string(),
  companyId: z.string().uuid().nullable(),
  companySlug: z.string().nullable(),
  hasReview: z.boolean(),
});
export type MyEmploymentEntry = z.infer<typeof myEmploymentEntrySchema>;

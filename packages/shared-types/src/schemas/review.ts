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

// Editing an existing review: same content shape as create, minus the fields
// that identify which employment history it's tied to (that link can't
// change — see ReviewsService.updateReview). Re-runs the same moderation
// pipeline as initial submission, since the content is changing.
export const updateReviewInputSchema = createReviewInputSchema.omit({
  companyId: true,
  employmentHistoryId: true,
});
export type UpdateReviewInput = z.infer<typeof updateReviewInputSchema>;

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
  // Only ever populated for the requesting user; null when logged out or not yet voted.
  myVote: z.union([z.literal(1), z.literal(-1)]).nullable(),
  // A trust signal derived from how many distinct companies this review's
  // (anonymous) author has published reviews for elsewhere — never reveals
  // who the author is, just a contribution tier.
  contributorBadge: z.enum(["CONTRIBUTOR", "TOP_CONTRIBUTOR"]).nullable(),
});
export type PublicReview = z.infer<typeof publicReviewSchema>;

export const voteValueSchema = z.union([z.literal(1), z.literal(-1)]);
export type VoteValue = z.infer<typeof voteValueSchema>;

export const castVoteInputSchema = z.object({
  reviewId: z.string().uuid(),
  value: voteValueSchema,
});
export type CastVoteInput = z.infer<typeof castVoteInputSchema>;

export const castVoteResultSchema = z.object({
  reviewId: z.string().uuid(),
  likeCount: z.number().int().min(0),
  dislikeCount: z.number().int().min(0),
  myVote: z.union([z.literal(1), z.literal(-1)]).nullable(),
});
export type CastVoteResult = z.infer<typeof castVoteResultSchema>;

// Voting is contribution-gated: only members with published reviews across
// several distinct companies can vote, to keep the like/dislike signal from
// being gamed by brand-new or single-employer accounts.
export const voteEligibilitySchema = z.object({
  eligible: z.boolean(),
  distinctCompanyReviewCount: z.number().int().min(0),
  requiredCompanyReviewCount: z.number().int().min(0),
});
export type VoteEligibility = z.infer<typeof voteEligibilitySchema>;

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
  startDate: z.string().date().nullable(),
  endDate: z.string().date().nullable(),
  hasReview: z.boolean(),
  // Present whenever hasReview is true — lets the client fetch/edit the
  // reviewer's own review via GET/PATCH /reviews/:id.
  reviewId: z.string().uuid().nullable(),
});
export type MyEmploymentEntry = z.infer<typeof myEmploymentEntrySchema>;

// The reviewer's own view of their review — unlike PublicReview, this is
// never shown to anyone else, so it's fine to include non-published statuses
// (PENDING_MODERATION/PENDING_ADMIN_REVIEW/REJECTED) so the edit form can
// explain why a review isn't live.
export const myReviewSchema = z.object({
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
});
export type MyReview = z.infer<typeof myReviewSchema>;

// Adding a post-onboarding employment entry from the account-settings page —
// unlike onboarding's free-text rawCompanyName, this always references a real
// Company row the user picked from a list (no free-text matching needed).
export const addEmploymentHistoryInputSchema = z.object({
  companyId: z.string().uuid(),
  startDate: z.string().date().nullable().optional(),
  endDate: z.string().date().nullable().optional(),
});
export type AddEmploymentHistoryInput = z.infer<typeof addEmploymentHistoryInputSchema>;

// Editing dates on an existing entry — blocked server-side once a review
// exists for it (see ReviewsService.updateEmploymentHistory), same as delete.
export const updateEmploymentHistoryInputSchema = z
  .object({
    startDate: z.string().date().nullable().optional(),
    endDate: z.string().date().nullable().optional(),
  })
  .refine((v) => v.startDate !== undefined || v.endDate !== undefined, {
    message: "Provide at least one field to update",
  });
export type UpdateEmploymentHistoryInput = z.infer<typeof updateEmploymentHistoryInputSchema>;

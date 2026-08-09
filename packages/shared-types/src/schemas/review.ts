import { z } from "zod";
import { workplaceTypeSchema } from "./company";

export const reviewStatusSchema = z.enum([
  "PENDING_MODERATION",
  "PENDING_ADMIN_REVIEW",
  "PUBLISHED",
  "REJECTED",
]);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

// A computed 0-5 category score — no longer picked directly by the reviewer,
// derived server-side from how many of that category's 5 survey questions
// were answered "correctly" (see apps/api's ReviewsService.scoreAnswers).
// 0 is a valid score now (all 5 missed), unlike the old free-pick 1-5 range.
const categoryScore = z.number().int().min(0).max(5);

export const categoryKeySchema = z.enum([
  "corporateCulture",
  "leadership",
  "infrastructure",
  "workLifeBalance",
  "stability",
]);
export type CategoryKey = z.infer<typeof categoryKeySchema>;

export const surveyAnswerSchema = z.enum(["YES", "NO", "PREFER_NOT_TO_ANSWER"]);
export type SurveyAnswer = z.infer<typeof surveyAnswerSchema>;

// The public (no answer key) shape of a survey question — what the client
// renders. The full question bank including each question's correct answer
// lives only in apps/api (survey-questions.data.ts) and is never sent to the
// client; scoring always happens server-side.
export const surveyQuestionSchema = z.object({
  id: z.string(),
  category: categoryKeySchema,
  text: z.string(),
});
export type SurveyQuestion = z.infer<typeof surveyQuestionSchema>;

export const surveyQuestionSetSchema = z.array(surveyQuestionSchema).length(25);
export type SurveyQuestionSet = z.infer<typeof surveyQuestionSetSchema>;

export const surveyResponseSchema = z.object({
  questionId: z.string(),
  answer: surveyAnswerSchema,
});
export type SurveyResponse = z.infer<typeof surveyResponseSchema>;

export const createReviewInputSchema = z.object({
  companyId: z.string().uuid(),
  // Must be an EmploymentHistory row owned by the caller and matching companyId;
  // the server re-validates this regardless of what the client sends.
  employmentHistoryId: z.string().uuid(),
  // Must cover exactly the 25 question ids for the company's workplaceType —
  // the server re-validates this too (see ReviewsService.scoreAnswers).
  answers: z.array(surveyResponseSchema).length(25),
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
  corporateCultureScore: categoryScore,
  leadershipScore: categoryScore,
  infrastructureScore: categoryScore,
  workLifeBalanceScore: categoryScore,
  stabilityScore: categoryScore,
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

export const categoryScoresSchema = z.object({
  corporateCulture: categoryScore,
  leadership: categoryScore,
  infrastructure: categoryScore,
  workLifeBalance: categoryScore,
  stability: categoryScore,
});
export type CategoryScores = z.infer<typeof categoryScoresSchema>;

export const submitReviewResultSchema = z.object({
  reviewId: z.string().uuid(),
  status: reviewStatusSchema,
  message: z.string(),
  // The just-computed category scores, so the post-submit screen can show a
  // quick recap without a second round trip.
  scores: categoryScoresSchema,
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
// explain why a review isn't live. surveyAnswers lets the edit form reload
// exactly what was answered before.
export const myReviewSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  workplaceType: workplaceTypeSchema,
  corporateCultureScore: categoryScore,
  leadershipScore: categoryScore,
  infrastructureScore: categoryScore,
  workLifeBalanceScore: categoryScore,
  stabilityScore: categoryScore,
  surveyAnswers: z.record(z.string(), surveyAnswerSchema),
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

// Per-question consensus for a company's PUBLISHED reviews — how many
// reviewers answered matching the question's correct answer ("agreed" the
// workplace does the healthy thing), how many explicitly chose the opposite
// ("disagreed"), and how many preferred not to answer. Deliberately never
// includes the raw YES/NO breakdown or which literal choice was correct —
// that stays server-only (see apps/api's survey-questions.data.ts) — this is
// purely an outcome tally, which can't be reversed into the answer key.
export const surveyQuestionStatsSchema = z.object({
  questionId: z.string(),
  category: categoryKeySchema,
  text: z.string(),
  agreeCount: z.number().int().min(0),
  disagreeCount: z.number().int().min(0),
  preferNotCount: z.number().int().min(0),
});
export type SurveyQuestionStats = z.infer<typeof surveyQuestionStatsSchema>;

export const companySurveyStatsSchema = z.object({
  totalReviews: z.number().int().min(0),
  // All 25 questions for the company's workplaceType, in question-bank
  // order. Empty when totalReviews is 0.
  questions: z.array(surveyQuestionStatsSchema),
});
export type CompanySurveyStats = z.infer<typeof companySurveyStatsSchema>;

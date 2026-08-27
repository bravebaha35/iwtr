import { z } from "zod";
import { workplaceTypeSchema } from "./company";

// The reserved avatarKey/avatarGradient pair a review displays instead of
// its author's real ones when "randomize my identity" (isRandomizedIdentity)
// is on — see ReviewsService.submitReview/updateReview and
// apps/web/src/lib/avatars.ts's avatarEmoji. Single source of truth so the
// two apps can't drift on the exact string. RANDOMIZED_IDENTITY_AVATAR_KEY
// is deliberately outside the normal WORK_TYPE_AVATARS picker set — it can
// never be chosen as a real account's own avatar, only assigned by the
// server for this one purpose.
export const RANDOMIZED_IDENTITY_AVATAR_KEY = "randomized_identity";
export const RANDOMIZED_IDENTITY_AVATAR_GRADIENT = "dusk";

// The full pool of anonymous, humorous handles a user can pick as their
// permanent User.reviewUsername (apps/web/src/app/me's "Customize" page —
// filtered to whichever category matches their currently selected avatar's
// work type), and the same pool ReviewsService.pickRandomDisplayUsername
// draws a one-off name from when isRandomizedIdentity is on for a single
// review. Single source of truth in shared-types so the picker UI (frontend)
// and the membership validation + auto-assignment (backend) can never drift
// on the exact wording. This fully replaces the old numeric User.memberNumber
// system — every review now shows a name from here, never a number.
export const ANONYMOUS_USERNAMES_BY_WORKPLACE_TYPE: Record<z.infer<typeof workplaceTypeSchema>, readonly string[]> = {
  OFFICE: [
    "Chief Happiness Officer",
    "Spreadsheet Maestro",
    "Coffee Machine Whisperer",
    "Reply-All Enthusiast",
    "Meeting Survivor",
    "PowerPoint Picasso",
    "Desk Plant Parent",
    "Watercooler Diplomat",
    "BCC Ninja",
    "Inbox Zero Hero",
  ],
  HYBRID_REMOTE: [
    "Pajama Executive",
    "Zoom Mute Master",
    "Wi-Fi Nomad",
    "Sofa Surfer",
    "Virtual Background Artist",
    "Keyboard Cat",
    "Timezone Traveler",
    "Screen Share Strategist",
    "Webcam Avoider",
    "Router Rebooter",
  ],
  SERVICE: [
    "Customer Whisperer",
    "Smile Ambassador",
    "Patience Practitioner",
    "Receipt Magician",
    "The Floor General",
    "Karen's Nemesis",
    "Shift Survivor",
    "Name Tag Ninja",
    "The Apology Artist",
    "Small Talk Specialist",
  ],
  MANUAL_LABOUR: [
    "Heavy Lifter Extraordinaire",
    "The Toolbox Tamer",
    "Forklift Philosopher",
    "Callus Collector",
    "Hard Hat Hero",
    "Duct Tape Magician",
    "The Blueprint Boss",
    "Steel Toe Sprinter",
    "WD-40 Wizard",
    "Early Morning Engine",
  ],
};

export const ALL_ANONYMOUS_USERNAMES: readonly string[] = Object.values(ANONYMOUS_USERNAMES_BY_WORKPLACE_TYPE).flat();

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
  // Which of the company's (up to 2) workplaceTypes this review is about —
  // the reviewer's own role. Must be one of Company.workplaceTypes; the
  // server re-validates this (see ReviewsService.submitReview) and it's what
  // decides which 25-question set `answers` below must match.
  workplaceType: workplaceTypeSchema,
  // Must cover exactly the 25 question ids for the chosen workplaceType —
  // the server re-validates this too (see ReviewsService.scoreAnswers).
  answers: z.array(surveyResponseSchema).length(25),
  generalThoughts: z.string().max(4000).optional(),
  // "Randomize my avatar and username for this review" — when true, the
  // server replaces this review's displayed avatar/handle with a generic
  // one and a random humorous name (picked from a list keyed by this
  // review's own workplaceType, never a client-supplied category — see
  // ReviewsService.pickRandomDisplayUsername) instead of the author's real
  // avatarKey/avatarGradient/reviewUsername. Also settable on
  // updateReviewInputSchema below, so a reviewer can turn it on/off later.
  isRandomizedIdentity: z.boolean().optional().default(false),
});
export type CreateReviewInput = z.infer<typeof createReviewInputSchema>;

// Editing an existing review: same content shape as create, minus the fields
// that identify which employment history it's tied to (that link can't
// change — see ReviewsService.updateReview) and workplaceType, which is
// equally immutable once set: changing it would mean answering an entirely
// different 25-question set, which isn't really an "edit" of the same
// review. Re-runs the same moderation pipeline as initial submission, since
// the content is changing.
export const updateReviewInputSchema = createReviewInputSchema.omit({
  companyId: true,
  employmentHistoryId: true,
  workplaceType: true,
});
export type UpdateReviewInput = z.infer<typeof updateReviewInputSchema>;

// A company's single public response to one of its reviews — see
// CompanyReply in apps/api/prisma/schema.prisma for why this is public
// (not a DM to the reviewer) and capped at one per review. Deliberately no
// author field: a reply is attributed to the company, not to whichever
// individual owner account wrote it.
export const companyReplySchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  createdAt: z.string().datetime(),
});
export type CompanyReply = z.infer<typeof companyReplySchema>;

export const replyToReviewInputSchema = z.object({
  content: z.string().min(1).max(2000),
});
export type ReplyToReviewInput = z.infer<typeof replyToReviewInputSchema>;

// What's ever returned publicly for a review — no userId, no employment history
// details beyond what's needed, nothing that could re-identify the reviewer.
export const publicReviewSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  // Which of the company's (up to 2) workplaceTypes this review is about —
  // matters now that a company can span more than one, so a reader can tell
  // which "side" of e.g. a hospital a given review is describing.
  workplaceType: workplaceTypeSchema,
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
  // Null until the company posts its one public response — see
  // companyReplySchema above.
  reply: companyReplySchema.nullable(),
  // The author's own self-chosen anonymous avatar (see REVIEW.md rule #8 —
  // an explicit, deliberate exception, not an oversight: the product owner
  // accepted that the same avatar repeating across a reviewer's other
  // reviews narrows the anonymity set somewhat). Deliberately NOT paired
  // with email or any other identifying User field — see
  // ReviewsService.listForCompany, which selects only avatarKey/
  // avatarGradient/reviewUsername.
  avatarKey: z.string().nullable(),
  avatarGradient: z.string().nullable(),
  // The name shown for this review — either the author's own permanent,
  // self-chosen User.reviewUsername (picked from ANONYMOUS_USERNAMES_BY_
  // WORKPLACE_TYPE above on the account-settings "Customize" page), or, when
  // this specific review was submitted/edited with "randomize my identity"
  // on, a one-off random handle from that same pool that replaces it for
  // this review alone — so that one review can't be correlated with the same
  // author's other reviews via a repeating name (REVIEW.md rule #8's
  // trade-off, opted out of per-review). Never a number: this fully replaces
  // the old numeric User.memberNumber system.
  displayUsername: z.string().nullable(),
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
  jobTitle: z.string().nullable(),
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
  isRandomizedIdentity: z.boolean(),
  displayUsername: z.string().nullable(),
});
export type MyReview = z.infer<typeof myReviewSchema>;

// One row of the "My Ratings" page (GET /me/reviews) — same as MyReview plus
// the company context and vote/reply counts that page's list view needs,
// none of which the single-review edit-form fetch (myReviewSchema) cares
// about.
export const myReviewListItemSchema = myReviewSchema.extend({
  companyName: z.string(),
  companySlug: z.string().nullable(),
  createdAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable(),
  likeCount: z.number().int().min(0),
  dislikeCount: z.number().int().min(0),
  reply: companyReplySchema.nullable(),
});
export type MyReviewListItem = z.infer<typeof myReviewListItemSchema>;

// Adding a post-onboarding employment entry from the account-settings page —
// unlike onboarding's free-text rawCompanyName, this always references a real
// Company row the user picked from a list (no free-text matching needed).
export const addEmploymentHistoryInputSchema = z.object({
  companyId: z.string().uuid(),
  jobTitle: z.string().min(1).max(200).nullable().optional(),
  startDate: z.string().date().nullable().optional(),
  endDate: z.string().date().nullable().optional(),
});
export type AddEmploymentHistoryInput = z.infer<typeof addEmploymentHistoryInputSchema>;

// Editing dates (or job title) on an existing entry — blocked server-side
// once a review exists for it (see ReviewsService.updateEmploymentHistory),
// same as delete.
export const updateEmploymentHistoryInputSchema = z
  .object({
    jobTitle: z.string().min(1).max(200).nullable().optional(),
    startDate: z.string().date().nullable().optional(),
    endDate: z.string().date().nullable().optional(),
  })
  .refine((v) => v.jobTitle !== undefined || v.startDate !== undefined || v.endDate !== undefined, {
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

// One entry per Company.workplaceTypes[i] — a company with 2 tags gets 2
// entries here, since each workplaceType has its own, entirely different
// 25-question set (e.g. "SERVICE.corporateCulture.1" and
// "OFFICE.corporateCulture.1" are different questions). Mixing a Service
// reviewer's answers into an Office reviewer's tally would be meaningless,
// so stats are always scoped to one workplaceType at a time, never merged.
export const companyWorkplaceSurveyStatsSchema = z.object({
  workplaceType: workplaceTypeSchema,
  totalReviews: z.number().int().min(0),
  // All 25 questions for this workplaceType, in question-bank order. Empty
  // when totalReviews is 0.
  questions: z.array(surveyQuestionStatsSchema),
});
export type CompanyWorkplaceSurveyStats = z.infer<typeof companyWorkplaceSurveyStatsSchema>;

export const companySurveyStatsSchema = z.object({
  byWorkplaceType: z.array(companyWorkplaceSurveyStatsSchema),
});
export type CompanySurveyStats = z.infer<typeof companySurveyStatsSchema>;

// GET /companies/:slug/vibe-flags — the Dual-Opposite Flag Aggregation
// Engine's response (see apps/api/src/modules/flags/flag-calculator.service.ts).
// Each category always contributes exactly 2 flags (one per question
// cluster), never both a green and its opposite red for the same cluster —
// only the color/label the engine actually resolved to. Deliberately never
// carries agreeCount/disagreeCount or any other per-question detail; that
// stays on companySurveyStatsSchema above.
export const flagColorSchema = z.enum(["GREEN", "RED"]);
export type FlagColor = z.infer<typeof flagColorSchema>;

export const vibeFlagSchema = z.object({
  category: categoryKeySchema,
  cluster: z.union([z.literal(1), z.literal(2)]),
  color: flagColorSchema,
  label: z.string(),
});
export type VibeFlag = z.infer<typeof vibeFlagSchema>;

export const companyWorkplaceVibeFlagsSchema = z.object({
  workplaceType: workplaceTypeSchema,
  totalReviews: z.number().int().min(0),
  // Empty when totalReviews is 0 — a workplace type nobody has reviewed yet
  // gets no flags rather than 10 default-red ones.
  flags: z.array(vibeFlagSchema),
});
export type CompanyWorkplaceVibeFlags = z.infer<typeof companyWorkplaceVibeFlagsSchema>;

export const companyVibeFlagsSchema = z.object({
  byWorkplaceType: z.array(companyWorkplaceVibeFlagsSchema),
});
export type CompanyVibeFlags = z.infer<typeof companyVibeFlagsSchema>;

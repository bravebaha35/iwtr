"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.companyVibeFlagsSchema = exports.companyWorkplaceVibeFlagsSchema = exports.yellowVibeFlagSchema = exports.vibeFlagSchema = exports.flagColorSchema = exports.companySurveyStatsSchema = exports.companyWorkplaceSurveyStatsSchema = exports.surveyQuestionStatsSchema = exports.updateEmploymentHistoryInputSchema = exports.addEmploymentHistoryInputSchema = exports.myReviewListItemSchema = exports.myReviewSchema = exports.myEmploymentEntrySchema = exports.submitReviewResultSchema = exports.categoryScoresSchema = exports.castVoteResultSchema = exports.castVoteInputSchema = exports.voteValueSchema = exports.publicReviewSchema = exports.replyToReviewInputSchema = exports.companyReplySchema = exports.updateReviewInputSchema = exports.createReviewInputSchema = exports.surveyResponseSchema = exports.surveyQuestionSetSchema = exports.surveyQuestionSchema = exports.surveyAnswerSchema = exports.categoryKeySchema = exports.reviewStatusSchema = exports.ALL_ANONYMOUS_USERNAMES = exports.ANONYMOUS_USERNAMES_BY_WORKPLACE_TYPE = exports.RANDOMIZED_IDENTITY_AVATAR_GRADIENT = exports.RANDOMIZED_IDENTITY_AVATAR_KEY = void 0;
const zod_1 = require("zod");
const company_1 = require("./company");
// The reserved avatarKey/avatarGradient pair a review displays instead of
// its author's real ones when "randomize my identity" (isRandomizedIdentity)
// is on — see ReviewsService.submitReview/updateReview and
// apps/web/src/lib/avatars.ts's avatarEmoji. Single source of truth so the
// two apps can't drift on the exact string. RANDOMIZED_IDENTITY_AVATAR_KEY
// is deliberately outside the normal WORK_TYPE_AVATARS picker set — it can
// never be chosen as a real account's own avatar, only assigned by the
// server for this one purpose.
exports.RANDOMIZED_IDENTITY_AVATAR_KEY = "randomized_identity";
exports.RANDOMIZED_IDENTITY_AVATAR_GRADIENT = "dusk";
// The full pool of anonymous, humorous handles a user can pick as their
// permanent User.reviewUsername (apps/web/src/app/me's "Customize" page —
// filtered to whichever category matches their currently selected avatar's
// work type), and the same pool ReviewsService.pickRandomDisplayUsername
// draws a one-off name from when isRandomizedIdentity is on for a single
// review. Single source of truth in shared-types so the picker UI (frontend)
// and the membership validation + auto-assignment (backend) can never drift
// on the exact wording. This fully replaces the old numeric User.memberNumber
// system — every review now shows a name from here, never a number.
exports.ANONYMOUS_USERNAMES_BY_WORKPLACE_TYPE = {
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
exports.ALL_ANONYMOUS_USERNAMES = Object.values(exports.ANONYMOUS_USERNAMES_BY_WORKPLACE_TYPE).flat();
exports.reviewStatusSchema = zod_1.z.enum([
    "PENDING_MODERATION",
    "PENDING_ADMIN_REVIEW",
    "PUBLISHED",
    "REJECTED",
]);
// A computed 0-5 category score — no longer picked directly by the reviewer,
// derived server-side from how many of that category's 5 survey questions
// were answered "correctly" (see apps/api's ReviewsService.scoreAnswers).
// 0 is a valid score now (all 5 missed), unlike the old free-pick 1-5 range.
const categoryScore = zod_1.z.number().int().min(0).max(5);
exports.categoryKeySchema = zod_1.z.enum([
    "corporateCulture",
    "leadership",
    "infrastructure",
    "workLifeBalance",
    "stability",
]);
exports.surveyAnswerSchema = zod_1.z.enum(["YES", "NO", "PREFER_NOT_TO_ANSWER"]);
// The public (no answer key) shape of a survey question — what the client
// renders. The full question bank including each question's correct answer
// lives only in apps/api (survey-questions.data.ts) and is never sent to the
// client; scoring always happens server-side.
exports.surveyQuestionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    category: exports.categoryKeySchema,
    text: zod_1.z.string(),
});
exports.surveyQuestionSetSchema = zod_1.z.array(exports.surveyQuestionSchema).length(25);
exports.surveyResponseSchema = zod_1.z.object({
    questionId: zod_1.z.string(),
    answer: exports.surveyAnswerSchema,
});
exports.createReviewInputSchema = zod_1.z.object({
    companyId: zod_1.z.string().uuid(),
    // Must be an EmploymentHistory row owned by the caller and matching companyId;
    // the server re-validates this regardless of what the client sends.
    employmentHistoryId: zod_1.z.string().uuid(),
    // Which of the company's (up to 2) workplaceTypes this review is about —
    // the reviewer's own role. Must be one of Company.workplaceTypes; the
    // server re-validates this (see ReviewsService.submitReview) and it's what
    // decides which 25-question set `answers` below must match.
    workplaceType: company_1.workplaceTypeSchema,
    // Must cover exactly the 25 question ids for the chosen workplaceType —
    // the server re-validates this too (see ReviewsService.scoreAnswers).
    answers: zod_1.z.array(exports.surveyResponseSchema).length(25),
    generalThoughts: zod_1.z.string().max(4000).optional(),
    // "Randomize my avatar and username for this review" — when true, the
    // server replaces this review's displayed avatar/handle with a generic
    // one and a random humorous name (picked from a list keyed by this
    // review's own workplaceType, never a client-supplied category — see
    // ReviewsService.pickRandomDisplayUsername) instead of the author's real
    // avatarKey/avatarGradient/reviewUsername. Also settable on
    // updateReviewInputSchema below, so a reviewer can turn it on/off later.
    isRandomizedIdentity: zod_1.z.boolean().optional().default(false),
    // Required only when the target company is CITY_BASED (a district of that
    // company's own city) or REGION_BASED (a city within that company's own
    // region) — never used for a SETTLED company. Server-revalidated against
    // the company's actual structureType/city/region regardless of what's
    // sent (see ReviewsService.resolveReviewLocation) — plain optional strings
    // here since the real canonical-name/membership check needs a DB lookup
    // the zod layer doesn't have.
    city: zod_1.z.string().min(1).max(100).optional(),
    district: zod_1.z.string().min(1).max(100).optional(),
});
// Editing an existing review: same content shape as create, minus the fields
// that identify which employment history it's tied to (that link can't
// change — see ReviewsService.updateReview) and workplaceType, which is
// equally immutable once set: changing it would mean answering an entirely
// different 25-question set, which isn't really an "edit" of the same
// review. Re-runs the same moderation pipeline as initial submission, since
// the content is changing.
exports.updateReviewInputSchema = exports.createReviewInputSchema.omit({
    companyId: true,
    employmentHistoryId: true,
    workplaceType: true,
});
// A company's single public response to one of its reviews — see
// CompanyReply in apps/api/prisma/schema.prisma for why this is public
// (not a DM to the reviewer) and capped at one per review. Deliberately no
// author field: a reply is attributed to the company, not to whichever
// individual owner account wrote it.
exports.companyReplySchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    content: zod_1.z.string(),
    createdAt: zod_1.z.string().datetime(),
});
exports.replyToReviewInputSchema = zod_1.z.object({
    content: zod_1.z.string().min(1).max(2000),
});
// What's ever returned publicly for a review — no userId, no employment history
// details beyond what's needed, nothing that could re-identify the reviewer.
exports.publicReviewSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    companyId: zod_1.z.string().uuid(),
    // Which of the company's (up to 2) workplaceTypes this review is about —
    // matters now that a company can span more than one, so a reader can tell
    // which "side" of e.g. a hospital a given review is describing.
    workplaceType: company_1.workplaceTypeSchema,
    corporateCultureScore: categoryScore,
    leadershipScore: categoryScore,
    infrastructureScore: categoryScore,
    workLifeBalanceScore: categoryScore,
    stabilityScore: categoryScore,
    generalThoughts: zod_1.z.string().nullable(),
    status: exports.reviewStatusSchema,
    publishedAt: zod_1.z.string().datetime().nullable(),
    likeCount: zod_1.z.number().int().min(0),
    dislikeCount: zod_1.z.number().int().min(0),
    // Only ever populated for the requesting user; null when logged out or not yet voted.
    myVote: zod_1.z.union([zod_1.z.literal(1), zod_1.z.literal(-1)]).nullable(),
    // A trust signal derived from how many distinct companies this review's
    // (anonymous) author has published reviews for elsewhere — never reveals
    // who the author is, just a contribution tier.
    contributorBadge: zod_1.z.enum(["CONTRIBUTOR", "TOP_CONTRIBUTOR"]).nullable(),
    // Null until the company posts its one public response — see
    // companyReplySchema above.
    reply: exports.companyReplySchema.nullable(),
    // The author's own self-chosen anonymous avatar (see REVIEW.md rule #8 —
    // an explicit, deliberate exception, not an oversight: the product owner
    // accepted that the same avatar repeating across a reviewer's other
    // reviews narrows the anonymity set somewhat). Deliberately NOT paired
    // with email or any other identifying User field — see
    // ReviewsService.listForCompany, which selects only avatarKey/
    // avatarGradient/reviewUsername.
    avatarKey: zod_1.z.string().nullable(),
    avatarGradient: zod_1.z.string().nullable(),
    // The name shown for this review — either the author's own permanent,
    // self-chosen User.reviewUsername (picked from ANONYMOUS_USERNAMES_BY_
    // WORKPLACE_TYPE above on the account-settings "Customize" page), or, when
    // this specific review was submitted/edited with "randomize my identity"
    // on, a one-off random handle from that same pool that replaces it for
    // this review alone — so that one review can't be correlated with the same
    // author's other reviews via a repeating name (REVIEW.md rule #8's
    // trade-off, opted out of per-review). Never a number: this fully replaces
    // the old numeric User.memberNumber system.
    displayUsername: zod_1.z.string().nullable(),
    // The district/city this review named (see createReviewInputSchema) —
    // only ever non-null here when at least MIN_REVIEWS_FOR_LOCATION_DISPLAY
    // published reviews on this exact company share the exact same value
    // (ReviewsService.listForCompany's k-anonymity gate). Always null for a
    // SETTLED company's reviews, and can be null even when the reviewer did
    // supply one, if too few others share it — the raw value is still stored,
    // just not surfaced yet. Never a vector for "highly specific filtering on
    // small branches": there is no query param anywhere that lets a caller ask
    // for reviews matching one particular district/city.
    city: zod_1.z.string().nullable(),
    district: zod_1.z.string().nullable(),
});
exports.voteValueSchema = zod_1.z.union([zod_1.z.literal(1), zod_1.z.literal(-1)]);
exports.castVoteInputSchema = zod_1.z.object({
    reviewId: zod_1.z.string().uuid(),
    value: exports.voteValueSchema,
});
exports.castVoteResultSchema = zod_1.z.object({
    reviewId: zod_1.z.string().uuid(),
    likeCount: zod_1.z.number().int().min(0),
    dislikeCount: zod_1.z.number().int().min(0),
    myVote: zod_1.z.union([zod_1.z.literal(1), zod_1.z.literal(-1)]).nullable(),
});
exports.categoryScoresSchema = zod_1.z.object({
    corporateCulture: categoryScore,
    leadership: categoryScore,
    infrastructure: categoryScore,
    workLifeBalance: categoryScore,
    stability: categoryScore,
});
exports.submitReviewResultSchema = zod_1.z.object({
    reviewId: zod_1.z.string().uuid(),
    status: exports.reviewStatusSchema,
    message: zod_1.z.string(),
    // The just-computed category scores, so the post-submit screen can show a
    // quick recap without a second round trip.
    scores: exports.categoryScoresSchema,
});
// An employment history entry the current user can potentially rate,
// annotated with whether they already have a review for that company.
exports.myEmploymentEntrySchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    rawCompanyName: zod_1.z.string(),
    companyId: zod_1.z.string().uuid().nullable(),
    companySlug: zod_1.z.string().nullable(),
    jobTitle: zod_1.z.string().nullable(),
    startDate: zod_1.z.string().date().nullable(),
    endDate: zod_1.z.string().date().nullable(),
    hasReview: zod_1.z.boolean(),
    // Present whenever hasReview is true — lets the client fetch/edit the
    // reviewer's own review via GET/PATCH /reviews/:id.
    reviewId: zod_1.z.string().uuid().nullable(),
});
// The reviewer's own view of their review — unlike PublicReview, this is
// never shown to anyone else, so it's fine to include non-published statuses
// (PENDING_MODERATION/PENDING_ADMIN_REVIEW/REJECTED) so the edit form can
// explain why a review isn't live. surveyAnswers lets the edit form reload
// exactly what was answered before.
exports.myReviewSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    companyId: zod_1.z.string().uuid(),
    workplaceType: company_1.workplaceTypeSchema,
    corporateCultureScore: categoryScore,
    leadershipScore: categoryScore,
    infrastructureScore: categoryScore,
    workLifeBalanceScore: categoryScore,
    stabilityScore: categoryScore,
    surveyAnswers: zod_1.z.record(zod_1.z.string(), exports.surveyAnswerSchema),
    generalThoughts: zod_1.z.string().nullable(),
    status: exports.reviewStatusSchema,
    isRandomizedIdentity: zod_1.z.boolean(),
    displayUsername: zod_1.z.string().nullable(),
    // Ungated here (unlike PublicReview's city/district) — this is the
    // reviewer's own private view of their own review, so there's no
    // anonymity-set concern in showing them exactly what they submitted, the
    // same way an edit form needs to reload it.
    city: zod_1.z.string().nullable(),
    district: zod_1.z.string().nullable(),
});
// One row of the "My Ratings" page (GET /me/reviews) — same as MyReview plus
// the company context and vote/reply counts that page's list view needs,
// none of which the single-review edit-form fetch (myReviewSchema) cares
// about.
exports.myReviewListItemSchema = exports.myReviewSchema.extend({
    companyName: zod_1.z.string(),
    companySlug: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string().datetime(),
    publishedAt: zod_1.z.string().datetime().nullable(),
    likeCount: zod_1.z.number().int().min(0),
    dislikeCount: zod_1.z.number().int().min(0),
    reply: exports.companyReplySchema.nullable(),
});
// Adding a post-onboarding employment entry from the account-settings page —
// unlike onboarding's free-text rawCompanyName, this always references a real
// Company row the user picked from a list (no free-text matching needed).
exports.addEmploymentHistoryInputSchema = zod_1.z.object({
    companyId: zod_1.z.string().uuid(),
    jobTitle: zod_1.z.string().min(1).max(200).nullable().optional(),
    startDate: zod_1.z.string().date().nullable().optional(),
    endDate: zod_1.z.string().date().nullable().optional(),
});
// Editing dates (or job title) on an existing entry — blocked server-side
// once a review exists for it (see ReviewsService.updateEmploymentHistory),
// same as delete.
exports.updateEmploymentHistoryInputSchema = zod_1.z
    .object({
    jobTitle: zod_1.z.string().min(1).max(200).nullable().optional(),
    startDate: zod_1.z.string().date().nullable().optional(),
    endDate: zod_1.z.string().date().nullable().optional(),
})
    .refine((v) => v.jobTitle !== undefined || v.startDate !== undefined || v.endDate !== undefined, {
    message: "Provide at least one field to update",
});
// Per-question consensus for a company's PUBLISHED reviews — how many
// reviewers answered matching the question's correct answer ("agreed" the
// workplace does the healthy thing), how many explicitly chose the opposite
// ("disagreed"), and how many preferred not to answer. Deliberately never
// includes the raw YES/NO breakdown or which literal choice was correct —
// that stays server-only (see apps/api's survey-questions.data.ts) — this is
// purely an outcome tally, which can't be reversed into the answer key.
exports.surveyQuestionStatsSchema = zod_1.z.object({
    questionId: zod_1.z.string(),
    category: exports.categoryKeySchema,
    text: zod_1.z.string(),
    agreeCount: zod_1.z.number().int().min(0),
    disagreeCount: zod_1.z.number().int().min(0),
    preferNotCount: zod_1.z.number().int().min(0),
});
// One entry per Company.workplaceTypes[i] — a company with 2 tags gets 2
// entries here, since each workplaceType has its own, entirely different
// 25-question set (e.g. "SERVICE.corporateCulture.1" and
// "OFFICE.corporateCulture.1" are different questions). Mixing a Service
// reviewer's answers into an Office reviewer's tally would be meaningless,
// so stats are always scoped to one workplaceType at a time, never merged.
exports.companyWorkplaceSurveyStatsSchema = zod_1.z.object({
    workplaceType: company_1.workplaceTypeSchema,
    totalReviews: zod_1.z.number().int().min(0),
    // All 25 questions for this workplaceType, in question-bank order. Empty
    // when totalReviews is 0.
    questions: zod_1.z.array(exports.surveyQuestionStatsSchema),
});
exports.companySurveyStatsSchema = zod_1.z.object({
    byWorkplaceType: zod_1.z.array(exports.companyWorkplaceSurveyStatsSchema),
});
// GET /companies/:slug/vibe-flags — the Dual-Opposite Flag Aggregation
// Engine's response (see apps/api/src/modules/flags/flag-calculator.service.ts).
// Each category always contributes exactly 2 flags (one per question
// cluster), never both a green and its opposite red for the same cluster —
// only the color/label the engine actually resolved to. Deliberately never
// carries agreeCount/disagreeCount or any other per-question detail; that
// stays on companySurveyStatsSchema above.
exports.flagColorSchema = zod_1.z.enum(["GREEN", "RED"]);
exports.vibeFlagSchema = zod_1.z.object({
    category: exports.categoryKeySchema,
    cluster: zod_1.z.union([zod_1.z.literal(1), zod_1.z.literal(2)]),
    color: exports.flagColorSchema,
    label: zod_1.z.string(),
});
// A "mixed signals" contradiction flag — two specific survey questions
// (often spanning different categories) whose answers, taken together,
// contradict each other for a strict majority of a workplaceType's
// reviewers. Unlike vibeFlagSchema, these don't map onto a single
// CategoryKey/cluster: the whole point is that they cut across categories
// (see apps/api's flags/yellow-flag-pairs.data.ts), so there's no color
// field either — every entry in this array is implicitly yellow.
exports.yellowVibeFlagSchema = zod_1.z.object({
    id: zod_1.z.string(),
    workplaceType: company_1.workplaceTypeSchema,
    label: zod_1.z.string(),
    // Plain-English "why" shown on hover/focus of the flag's ❓ in the UI.
    explanation: zod_1.z.string(),
});
exports.companyWorkplaceVibeFlagsSchema = zod_1.z.object({
    workplaceType: company_1.workplaceTypeSchema,
    totalReviews: zod_1.z.number().int().min(0),
    // Empty when totalReviews is 0 — a workplace type nobody has reviewed yet
    // gets no flags rather than 10 default-red ones.
    flags: zod_1.z.array(exports.vibeFlagSchema),
    yellowFlags: zod_1.z.array(exports.yellowVibeFlagSchema),
});
exports.companyVibeFlagsSchema = zod_1.z.object({
    byWorkplaceType: zod_1.z.array(exports.companyWorkplaceVibeFlagsSchema),
});

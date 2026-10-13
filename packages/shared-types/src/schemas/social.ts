import { z } from "zod";
import { ownerTierSchema, companyWorkplaceTypesSchema, workplaceTypeSchema } from "./company";
import { voteValueSchema } from "./review";
import { jobPositionSchema } from "./jobPosting";

// Instagram-style multi-photo carousel cap - enforced both by the file
// picker (client-side UX) and FilesInterceptor's maxCount (server-side,
// authoritative).
export const MAX_SOCIAL_POST_IMAGES = 10;

// --- Upload validation (mime + size only; dimensions are not constrained -
// sharp downscales anything oversized). Pure/environment-agnostic so the
// same rule runs client-side for instant feedback and server-side as the
// authoritative check, matching companyLogo.ts's validateLogoFile pattern.
export const SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024;
export const SOCIAL_IMAGE_ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
] as const;

export interface SocialImageFileMeta {
  mimeType: string;
  sizeBytes: number;
}

export function validateSocialImageUpload(
  meta: SocialImageFileMeta,
): { valid: true } | { valid: false; error: string } {
  if (!(SOCIAL_IMAGE_ACCEPTED_MIME_TYPES as readonly string[]).includes(meta.mimeType)) {
    return { valid: false, error: "Photo must be a JPEG, PNG, or HEIC image." };
  }
  if (meta.sizeBytes > SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Photo is too large - keep it under ${SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
    };
  }
  return { valid: true };
}

// The company-scoped Social-tab sidebar's sort control (client state only,
// no ?sort= URL param - this type is shared purely so the frontend's
// sessionStorage value and the backend's query-param parsing agree on the
// same four strings). "newest" is the default/pre-existing behavior.
export const socialCompanySortSchema = z.enum(["newest", "oldest", "mostLiked", "mostCommented"]);
export type SocialCompanySort = z.infer<typeof socialCompanySortSchema>;

// What a post is. PHOTO and UPDATE are the plain ones (with and without
// photos - the API settles which from the files sent); the rest carry extra
// fields.
export const socialPostKindSchema = z.enum(["PHOTO", "UPDATE", "POLL", "EVENT", "MILESTONE", "HIRING"]);
export type SocialPostKind = z.infer<typeof socialPostKindSchema>;

export const SOCIAL_POST_TITLE_MAX = 120;
export const SOCIAL_EVENT_LOCATION_MAX = 120;
export const SOCIAL_POLL_OPTION_MAX = 80;
export const SOCIAL_POLL_MIN_OPTIONS = 2;
export const SOCIAL_POLL_MAX_OPTIONS = 4;
// How long a poll can stay open, in days.
export const SOCIAL_POLL_DAYS = [1, 3, 7, 14] as const;

// The reactions a post can get. LIKE is the old single "like".
export const socialReactionSchema = z.enum(["LIKE", "WELL_DONE", "CURIOUS"]);
export type SocialReaction = z.infer<typeof socialReactionSchema>;
export const SOCIAL_REACTIONS: SocialReaction[] = socialReactionSchema.options;

// --- Create inputs. Sent as multipart form fields, so every value arrives
// as text: the poll's options come as one JSON array string, its length in
// days as a number in text.
export const createSocialPostInputSchema = z
  .object({
    companyId: z.string().uuid(),
    caption: z.string().trim().max(1000).optional(),
    kind: socialPostKindSchema.default("PHOTO"),
    title: z.string().trim().max(SOCIAL_POST_TITLE_MAX).optional(),
    eventStartsAt: z.string().datetime().optional(),
    eventLocation: z.string().trim().max(SOCIAL_EVENT_LOCATION_MAX).optional(),
    pollOptions: z
      .preprocess(
        (v) => {
          if (typeof v !== "string") return v;
          try {
            return JSON.parse(v);
          } catch {
            return v;
          }
        },
        z.array(z.string().trim().min(1).max(SOCIAL_POLL_OPTION_MAX)).min(SOCIAL_POLL_MIN_OPTIONS).max(SOCIAL_POLL_MAX_OPTIONS),
      )
      .optional(),
    pollDays: z.coerce
      .number()
      .refine((n) => (SOCIAL_POLL_DAYS as readonly number[]).includes(n), "Pick how long the poll runs")
      .optional(),
    jobPostingId: z.string().uuid().optional(),
  })
  .superRefine((v, ctx) => {
    const need = (ok: boolean, path: string, message: string) => {
      if (!ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    };
    if (v.kind === "POLL") {
      need(Boolean(v.caption), "caption", "Write the question");
      need(v.pollOptions !== undefined, "pollOptions", "Give at least 2 answers");
      need(v.pollDays !== undefined, "pollDays", "Pick how long the poll runs");
      if (v.pollOptions) {
        const unique = new Set(v.pollOptions.map((o) => o.toLocaleLowerCase("tr")));
        need(unique.size === v.pollOptions.length, "pollOptions", "Each answer can appear once");
      }
    }
    if (v.kind === "EVENT") {
      need(Boolean(v.title), "title", "Give the event a name");
      need(v.eventStartsAt !== undefined, "eventStartsAt", "Pick the date and time");
    }
    if (v.kind === "MILESTONE") need(Boolean(v.title), "title", "Say what you are celebrating");
    if (v.kind === "HIRING") need(v.jobPostingId !== undefined, "jobPostingId", "Pick the job posting");
  });
// `kind` may be left out by a caller: the schema fills in PHOTO.
export type CreateSocialPostInput = Omit<z.infer<typeof createSocialPostInputSchema>, "kind"> & { kind?: SocialPostKind };

// The owner's Edit on a post (PATCH social/posts/:id): the caption only -
// photos are fixed once posted. An empty caption removes it.
export const updateSocialPostInputSchema = z.object({
  caption: z.string().trim().max(1000),
});
export type UpdateSocialPostInput = z.infer<typeof updateSocialPostInputSchema>;

// Which identity a comment is posted under. PERSONAL_CHOSEN/PERSONAL_RANDOM
// are both anonymous - the only two an employee ever picks between.
// OWNER_REAL_NAME is the only mode a company owner ever gets: no toggle, no
// anonymous option, per explicit product decision (2026-09-11) - the API
// rejects anything else from a COMPANY_OWNER regardless of what's sent here.
export const commentIdentityModeSchema = z.enum(["PERSONAL_CHOSEN", "PERSONAL_RANDOM", "OWNER_REAL_NAME"]);
export type CommentIdentityMode = z.infer<typeof commentIdentityModeSchema>;

export const createSocialCommentInputSchema = z.object({
  body: z.string().trim().min(1).max(1250),
  // Omitted = PERSONAL_CHOSEN (today's only behavior) - existing callers
  // that don't know about identity modes yet keep working unchanged.
  identityMode: commentIdentityModeSchema.optional(),
});
export type CreateSocialCommentInput = z.infer<typeof createSocialCommentInputSchema>;

// Fixed set of reasons a reporter must pick from (2026-09-15 product
// decision) - free text gave admins nothing to group or triage by. Keys are
// the stable values stored on SocialCommentReport.reason; labels are the
// exact reporter-facing sentences, shared by the report pop-up and the admin
// queue's per-reason breakdown.
export const socialCommentReportReasonSchema = z.enum([
  "CURSE_WORDS",
  "DISREGARD_ANONYMITY",
  "THREAT_ABUSE",
]);
export type SocialCommentReportReason = z.infer<typeof socialCommentReportReasonSchema>;

export const SOCIAL_COMMENT_REPORT_REASONS: SocialCommentReportReason[] = [
  "CURSE_WORDS",
  "DISREGARD_ANONYMITY",
  "THREAT_ABUSE",
];

export const SOCIAL_COMMENT_REPORT_REASON_LABELS: Record<SocialCommentReportReason, string> = {
  CURSE_WORDS: "Curse words and bad language.",
  DISREGARD_ANONYMITY: "Disregard for anonymity.",
  THREAT_ABUSE: "Threat and abuse.",
};

export const reportSocialCommentInputSchema = z.object({
  reason: socialCommentReportReasonSchema,
});
export type ReportSocialCommentInput = z.infer<typeof reportSocialCommentInputSchema>;

export const reportSocialCommentResultSchema = z.object({
  commentId: z.string(),
  reportCount: z.number().int(),
});
export type ReportSocialCommentResult = z.infer<typeof reportSocialCommentResultSchema>;

// Same value/semantics as a review vote - reused directly rather than a
// duplicate literal-union type.
export const voteSocialCommentInputSchema = z.object({
  value: voteValueSchema,
});
export type VoteSocialCommentInput = z.infer<typeof voteSocialCommentInputSchema>;

export const reactToSocialPostInputSchema = z.object({
  // Left out = LIKE, so a plain "like" click needs no body.
  reaction: socialReactionSchema.optional(),
});
export type ReactToSocialPostInput = z.infer<typeof reactToSocialPostInputSchema>;

export const voteSocialPollInputSchema = z.object({
  optionId: z.string().uuid(),
});
export type VoteSocialPollInput = z.infer<typeof voteSocialPollInputSchema>;

// A POLL post's state for one viewer. `votes` on each option is null until
// the viewer may see the result: after voting, once the poll has closed, or
// as an owner of the company. Counts only - who voted is never exposed.
export const publicSocialPollSchema = z.object({
  endsAt: z.string().datetime(),
  closed: z.boolean(),
  totalVotes: z.number().int(),
  myOptionId: z.string().nullable(),
  options: z.array(z.object({ id: z.string(), text: z.string(), votes: z.number().int().nullable() })),
});
export type PublicSocialPoll = z.infer<typeof publicSocialPollSchema>;

// The job ad a HIRING post is about. `live` is false once the ad is no
// longer on the Jobs page (filled, expired, in review, or deleted).
export const publicSocialPostJobSchema = z.object({
  jobPostingId: z.string().nullable(),
  jobTitle: z.string(),
  workType: workplaceTypeSchema.nullable(),
  positions: z.array(jobPositionSchema),
  live: z.boolean(),
});
export type PublicSocialPostJob = z.infer<typeof publicSocialPostJobSchema>;

export const socialReactionCountsSchema = z.object({
  LIKE: z.number().int(),
  WELL_DONE: z.number().int(),
  CURIOUS: z.number().int(),
});
export type SocialReactionCounts = z.infer<typeof socialReactionCountsSchema>;

// --- Public read shapes. NOTE (REVIEW.md-adjacent): no authorUserId / userId
// on either shape. The comment's identity fields are the same anonymous
// triple a review exposes (avatarKey/avatarGradient/displayUsername).
export const publicSocialPostSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  companySlug: z.string(),
  companyName: z.string(),
  companyLogoUrl: z.string().nullable(),
  companyBadgeTier: ownerTierSchema,
  // The post's company work-type tags, primary-first (see
  // companyWorkplaceTypesSchema) - the feed card renders the primary in
  // bold and the secondary, if any, in a normal weight, same as the rating
  // and job surfaces.
  companyWorkplaceTypes: companyWorkplaceTypesSchema,
  kind: socialPostKindSchema,
  // Instagram-style carousel (see MAX_SOCIAL_POST_IMAGES). Empty for a post
  // without photos (a text update, a poll...).
  imageUrls: z.array(z.string()),
  // Width / height of each image, same order - lets the page hold the right
  // space before a photo arrives. Empty on posts from before this existed.
  imageAspectRatios: z.array(z.number()),
  caption: z.string().nullable(),
  // EVENT and MILESTONE: the headline.
  title: z.string().nullable(),
  // EVENT only: the event's own date (exact - it is content, not a record of
  // when someone did something) and place.
  eventStartsAt: z.string().datetime().nullable(),
  eventLocation: z.string().nullable(),
  // POLL only.
  poll: publicSocialPollSchema.nullable(),
  // HIRING only.
  job: publicSocialPostJobSchema.nullable(),
  createdAt: z.string().datetime(),
  // Every reaction counted together; reactionCounts splits it by kind.
  likeCount: z.number().int(),
  reactionCounts: socialReactionCountsSchema,
  commentCount: z.number().int(),
  // null when the viewer is anonymous; boolean when authenticated.
  likedByMe: z.boolean().nullable(),
  // Which reaction the viewer left, if any.
  myReaction: socialReactionSchema.nullable(),
  // Same null-when-anonymous convention as likedByMe (see SocialService.
  // serializePosts) - a private bookmark flag, never a public save count.
  savedByMe: z.boolean().nullable(),
  // The company's pinned post (at most one): it leads the company's own feed.
  pinned: z.boolean(),
  // The caption was changed after posting.
  edited: z.boolean(),
  // The viewer is an approved owner of this post's company, so the card
  // offers Edit / Pin / Delete. Says nothing about who wrote the post.
  canManage: z.boolean(),
});
export type PublicSocialPost = z.infer<typeof publicSocialPostSchema>;

export const socialPostPinResultSchema = z.object({
  postId: z.string(),
  pinned: z.boolean(),
});
export type SocialPostPinResult = z.infer<typeof socialPostPinResultSchema>;

export const publicSocialCommentSchema = z.object({
  id: z.string(),
  postId: z.string(),
  body: z.string(),
  createdAt: z.string().datetime(),
  identityMode: commentIdentityModeSchema,
  // For PERSONAL_CHOSEN/PERSONAL_RANDOM: the anonymous handle (reviewUsername
  // or the locked one-off pick). For OWNER_REAL_NAME: the owner's real,
  // decrypted name - the one deliberate exception to 'never a real name'.
  displayUsername: z.string().nullable(),
  avatarKey: z.string().nullable(),
  avatarGradient: z.string().nullable(),
  // Only ever set for OWNER_REAL_NAME (EmployerProfile.profilePictureUrl) -
  // takes rendering priority over avatarKey/avatarGradient when present.
  avatarPhotoUrl: z.string().nullable(),
  // True only for the currently-authenticated viewer's own comments, so the
  // frontend can show a delete affordance. Never reveals other authors.
  mine: z.boolean(),
  // Same value/semantics as a review vote (1 = Helpful, -1 = Not Helpful).
  // null when the viewer is anonymous or authenticated-but-hasn't-voted.
  helpfulCount: z.number().int(),
  notHelpfulCount: z.number().int(),
  myVote: voteValueSchema.nullable(),
  // 0 for a reply itself (replies are capped at one level - see
  // SocialService.addReply - so a reply never has replies of its own).
  // For a top-level comment, how many replies it has - drives whether the
  // frontend's down-arrow expand affordance renders at all.
  replyCount: z.number().int(),
});
export type PublicSocialComment = z.infer<typeof publicSocialCommentSchema>;

// What identity a comment composer should show/offer for the CURRENT user
// on a SPECIFIC post - fetched once when the composer opens. A
// COMPANY_OWNER always gets locked: true with mode OWNER_REAL_NAME (no
// choice, ever). A MEMBER gets locked: true (with whichever mode they
// already used on this post) once they've commented here before, otherwise
// locked: false plus both choices' preview so the toggle has something to
// show before the first pick.
export const socialCommentIdentityContextSchema = z.discriminatedUnion("locked", [
  z.object({
    locked: z.literal(true),
    identityMode: commentIdentityModeSchema,
    displayUsername: z.string().nullable(),
    avatarKey: z.string().nullable(),
    avatarGradient: z.string().nullable(),
    avatarPhotoUrl: z.string().nullable(),
  }),
  z.object({
    locked: z.literal(false),
    chosen: z.object({
      displayUsername: z.string().nullable(),
      avatarKey: z.string().nullable(),
      avatarGradient: z.string().nullable(),
    }),
  }),
]);
export type SocialCommentIdentityContext = z.infer<typeof socialCommentIdentityContextSchema>;

export const socialCommentVoteResultSchema = z.object({
  commentId: z.string(),
  helpfulCount: z.number().int(),
  notHelpfulCount: z.number().int(),
  myVote: voteValueSchema.nullable(),
});
export type SocialCommentVoteResult = z.infer<typeof socialCommentVoteResultSchema>;

export const socialFeedPageSchema = z.object({
  posts: z.array(publicSocialPostSchema),
  nextCursor: z.string().nullable(),
});
export type SocialFeedPage = z.infer<typeof socialFeedPageSchema>;

// ADMIN-only view of a reported comment. Deliberately excludes any author
// identity - same anonymity rule every other admin/social endpoint already
// follows (see REVIEW.md's social scope) - an admin judges the CONTENT,
// never who wrote it.
export const adminReportedSocialCommentSchema = z.object({
  id: z.string(),
  postId: z.string(),
  body: z.string(),
  createdAt: z.string().datetime(),
  reportCount: z.number().int(),
  // Per-reason tally (see socialCommentReportReasonSchema) so an admin can
  // see AT A GLANCE what a comment is being reported for, e.g.
  // { THREAT_ABUSE: 2, CURSE_WORDS: 1 }. Reports filed before reasons were
  // required (or otherwise missing one) bucket under "UNSPECIFIED".
  reportReasonCounts: z.record(z.string(), z.number().int()),
  // True once reports crossed 3 AND the automated content check found
  // something - these sort first, since they're the ones most likely to
  // need a decision rather than just 'a couple of people didn't like it'.
  flaggedForReview: z.boolean(),
  flaggedReviewReason: z.string().nullable(),
});
export type AdminReportedSocialComment = z.infer<typeof adminReportedSocialCommentSchema>;

// Admin-only view of one post's comments (GET admin/social/posts/:id/comments):
// the EXACT time each comment was written - members and companies only ever
// see it to the hour. No author account, only the name shown publicly.
export const adminSocialCommentSchema = z.object({
  id: z.string(),
  body: z.string(),
  createdAt: z.string().datetime(),
  identityMode: commentIdentityModeSchema,
  displayUsername: z.string().nullable(),
  isReply: z.boolean(),
});
export type AdminSocialComment = z.infer<typeof adminSocialCommentSchema>;

export const socialPostLikeResultSchema = z.object({
  postId: z.string(),
  likeCount: z.number().int(),
  likedByMe: z.boolean(),
  myReaction: socialReactionSchema.nullable(),
  reactionCounts: socialReactionCountsSchema,
});
export type SocialPostLikeResult = z.infer<typeof socialPostLikeResultSchema>;

// GET /social/rail - the lists beside the IWT Social feed, in one answer.
// Any of them can be empty; the page shows no panel for an empty one.
export const socialRailCompanySchema = z.object({
  companyId: z.string(),
  companySlug: z.string(),
  companyName: z.string(),
  companyLogoUrl: z.string().nullable(),
  companyBadgeTier: ownerTierSchema,
  companyWorkplaceTypes: companyWorkplaceTypesSchema,
});
export type SocialRailCompany = z.infer<typeof socialRailCompanySchema>;

export const socialRailJobSchema = z.object({
  jobPostingId: z.string(),
  jobTitle: z.string(),
  companySlug: z.string(),
  companyName: z.string(),
  companyLogoUrl: z.string().nullable(),
});
export type SocialRailJob = z.infer<typeof socialRailJobSchema>;

// One row of the rail's "Trending this week": just what the row shows.
export const socialRailTrendingPostSchema = z.object({
  postId: z.string(),
  companyName: z.string(),
  companyLogoUrl: z.string().nullable(),
  // The post's first photo, when it has one.
  thumbUrl: z.string().nullable(),
  caption: z.string().nullable(),
  likeCount: z.number().int(),
  commentCount: z.number().int(),
});
export type SocialRailTrendingPost = z.infer<typeof socialRailTrendingPostSchema>;

// One row of the rail's "Waiting for an answer": a question nobody has
// answered yet. companyName is null for a question put to a kind of work.
export const socialRailQuestionSchema = z.object({
  questionId: z.string(),
  body: z.string(),
  companyName: z.string().nullable(),
  workType: workplaceTypeSchema.nullable(),
});
export type SocialRailQuestion = z.infer<typeof socialRailQuestionSchema>;

export const socialRailSchema = z.object({
  // The last 7 days' busiest posts (likes + comments), busiest first.
  trending: z.array(socialRailTrendingPostSchema),
  // The newest questions without an answer (empty while Questions is off).
  openQuestions: z.array(socialRailQuestionSchema),
  // Public companies that have posted and that the viewer doesn't follow yet.
  suggestedCompanies: z.array(socialRailCompanySchema),
  // Job ads posted in the last 7 days, one per company.
  hiringNow: z.array(socialRailJobSchema),
});
export type SocialRail = z.infer<typeof socialRailSchema>;

// GET /social/companies/:slug/summary - bare counts for the company Social
// tab. A count only: the follower list is never exposed (REVIEW.md).
export const companySocialSummarySchema = z.object({
  followerCount: z.number().int(),
  postCount: z.number().int(),
});
export type CompanySocialSummary = z.infer<typeof companySocialSummarySchema>;

// --- Questions (IWT Social phase 3). A member asks one company, or everyone
// in a kind of work, anonymously; members answer anonymously and the asked
// company's owner answers under their real name.
export const SOCIAL_QUESTION_MIN = 10;
export const SOCIAL_QUESTION_MAX = 300;
export const SOCIAL_ANSWER_MAX = 1250;
// How many questions one member may ask in 24 hours.
export const SOCIAL_QUESTIONS_PER_DAY = 5;
// How many answers a question carries in a list (its own page has them all).
export const SOCIAL_QUESTION_PREVIEW_ANSWERS = 2;

// The two anonymous identities a member picks between (never OWNER_REAL_NAME:
// that one is settled by the server for an owner, whatever is sent).
export const memberIdentityModeSchema = z.enum(["PERSONAL_CHOSEN", "PERSONAL_RANDOM"]);
export type MemberIdentityMode = z.infer<typeof memberIdentityModeSchema>;

export const createSocialQuestionInputSchema = z
  .object({
    // Exactly one of the two: the company asked, or the kind of work.
    companyId: z.string().uuid().optional(),
    workType: workplaceTypeSchema.optional(),
    body: z.string().trim().min(SOCIAL_QUESTION_MIN, "Write a little more so people can answer").max(SOCIAL_QUESTION_MAX),
    identityMode: memberIdentityModeSchema.optional(),
  })
  .refine((v) => (v.companyId === undefined) !== (v.workType === undefined), {
    path: ["companyId"],
    message: "Pick a company or a kind of work to ask",
  });
export type CreateSocialQuestionInput = z.infer<typeof createSocialQuestionInputSchema>;

export const createSocialAnswerInputSchema = z.object({
  body: z.string().trim().min(1).max(SOCIAL_ANSWER_MAX),
  identityMode: memberIdentityModeSchema.optional(),
});
export type CreateSocialAnswerInput = z.infer<typeof createSocialAnswerInputSchema>;

// Which questions a list shows.
export const socialQuestionFilterSchema = z.enum(["all", "unanswered", "mine"]);
export type SocialQuestionFilter = z.infer<typeof socialQuestionFilterSchema>;

// No author id on either shape, same rule as a comment (REVIEW.md).
export const publicSocialAnswerSchema = z.object({
  id: z.string(),
  questionId: z.string(),
  body: z.string(),
  createdAt: z.string().datetime(),
  // The asked company's owner, under their real name.
  fromCompany: z.boolean(),
  // A member who had this company in their employment history when they
  // answered. Always false on a kind-of-work question.
  workedThere: z.boolean(),
  displayUsername: z.string().nullable(),
  avatarKey: z.string().nullable(),
  avatarGradient: z.string().nullable(),
  avatarPhotoUrl: z.string().nullable(),
  mine: z.boolean(),
  helpfulCount: z.number().int(),
  // null when the viewer is anonymous.
  helpfulByMe: z.boolean().nullable(),
});
export type PublicSocialAnswer = z.infer<typeof publicSocialAnswerSchema>;

export const socialQuestionTargetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("company"),
    companyId: z.string(),
    companySlug: z.string(),
    companyName: z.string(),
    companyLogoUrl: z.string().nullable(),
    companyBadgeTier: ownerTierSchema,
  }),
  z.object({ kind: z.literal("workType"), workType: workplaceTypeSchema }),
]);
export type SocialQuestionTarget = z.infer<typeof socialQuestionTargetSchema>;

export const publicSocialQuestionSchema = z.object({
  id: z.string(),
  body: z.string(),
  createdAt: z.string().datetime(),
  target: socialQuestionTargetSchema,
  displayUsername: z.string().nullable(),
  avatarKey: z.string().nullable(),
  avatarGradient: z.string().nullable(),
  mine: z.boolean(),
  answerCount: z.number().int(),
  // The company's own answer comes first, then the most helpful ones. A list
  // carries the first SOCIAL_QUESTION_PREVIEW_ANSWERS; the question's own
  // page carries every answer.
  answers: z.array(publicSocialAnswerSchema),
  // The viewer may answer: a member who didn't ask it and hasn't answered
  // yet, or the asked company's owner who hasn't answered yet.
  canAnswer: z.boolean(),
  // ...and would do so under their real name, as the company.
  answersAsCompany: z.boolean(),
});
export type PublicSocialQuestion = z.infer<typeof publicSocialQuestionSchema>;

export const socialQuestionPageSchema = z.object({
  questions: z.array(publicSocialQuestionSchema),
  nextCursor: z.string().nullable(),
});
export type SocialQuestionPage = z.infer<typeof socialQuestionPageSchema>;

export const socialAnswerHelpfulResultSchema = z.object({
  answerId: z.string(),
  helpfulCount: z.number().int(),
  helpfulByMe: z.boolean(),
});
export type SocialAnswerHelpfulResult = z.infer<typeof socialAnswerHelpfulResultSchema>;

// The name a member would ask or answer under, for the composer's preview.
export const socialQuestionIdentitySchema = z.object({
  displayUsername: z.string().nullable(),
  avatarKey: z.string().nullable(),
  avatarGradient: z.string().nullable(),
});
export type SocialQuestionIdentity = z.infer<typeof socialQuestionIdentitySchema>;

// ADMIN-only: a reported question or answer. The content and its reports,
// never who wrote it. An answer carries the question it answers for context.
export const adminReportedSocialQuestionItemSchema = z.object({
  kind: z.enum(["QUESTION", "ANSWER"]),
  id: z.string(),
  questionId: z.string(),
  body: z.string(),
  questionBody: z.string(),
  createdAt: z.string().datetime(),
  reportCount: z.number().int(),
  reportReasonCounts: z.record(z.string(), z.number().int()),
  flaggedForReview: z.boolean(),
  flaggedReviewReason: z.string().nullable(),
});
export type AdminReportedSocialQuestionItem = z.infer<typeof adminReportedSocialQuestionItemSchema>;

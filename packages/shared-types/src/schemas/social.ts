import { z } from "zod";
import { ownerTierSchema, companyWorkplaceTypesSchema } from "./company";
import { voteValueSchema } from "./review";

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

// --- Create inputs
export const createSocialPostInputSchema = z.object({
  companyId: z.string().uuid(),
  caption: z.string().trim().max(1000).optional(),
});
export type CreateSocialPostInput = z.infer<typeof createSocialPostInputSchema>;

// The owner's Edit on a post (PATCH social/posts/:id): the caption only -
// photos are fixed once posted. An empty caption removes it.
export const updateSocialPostInputSchema = z.object({
  caption: createSocialPostInputSchema.shape.caption.unwrap(),
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
  // Instagram-style carousel - always at least 1 (see MAX_SOCIAL_POST_IMAGES).
  imageUrls: z.array(z.string()).min(1),
  caption: z.string().nullable(),
  createdAt: z.string().datetime(),
  likeCount: z.number().int(),
  commentCount: z.number().int(),
  // null when the viewer is anonymous; boolean when authenticated.
  likedByMe: z.boolean().nullable(),
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
});
export type SocialPostLikeResult = z.infer<typeof socialPostLikeResultSchema>;

// GET /social/trending - the last 7 days' top posts across all companies,
// split by like count and comment count. Either array can be empty; the
// page shows no "Trending" panel when both are.
export const socialTrendingSchema = z.object({
  mostLiked: z.array(publicSocialPostSchema),
  mostCommented: z.array(publicSocialPostSchema),
});
export type SocialTrending = z.infer<typeof socialTrendingSchema>;

// GET /social/rail - the two lists beside the IWT Social feed. Either can be
// empty; the page shows no panel for an empty one.
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

export const socialRailSchema = z.object({
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

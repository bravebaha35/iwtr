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

// --- Create inputs
export const createSocialPostInputSchema = z.object({
  companyId: z.string().uuid(),
  caption: z.string().trim().max(1000).optional(),
});
export type CreateSocialPostInput = z.infer<typeof createSocialPostInputSchema>;

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

export const reportSocialCommentInputSchema = z.object({
  reason: z.string().trim().max(500).optional(),
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
});
export type PublicSocialPost = z.infer<typeof publicSocialPostSchema>;

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
  // True once reports crossed 3 AND the automated content check found
  // something - these sort first, since they're the ones most likely to
  // need a decision rather than just 'a couple of people didn't like it'.
  flaggedForReview: z.boolean(),
  flaggedReviewReason: z.string().nullable(),
});
export type AdminReportedSocialComment = z.infer<typeof adminReportedSocialCommentSchema>;

export const socialPostLikeResultSchema = z.object({
  postId: z.string(),
  likeCount: z.number().int(),
  likedByMe: z.boolean(),
});
export type SocialPostLikeResult = z.infer<typeof socialPostLikeResultSchema>;

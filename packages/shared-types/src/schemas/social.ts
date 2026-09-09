import { z } from "zod";
import { ownerTierSchema } from "./company";

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

export const createSocialCommentInputSchema = z.object({
  body: z.string().trim().min(1).max(1000),
});
export type CreateSocialCommentInput = z.infer<typeof createSocialCommentInputSchema>;

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
  imageUrl: z.string(),
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
  displayUsername: z.string().nullable(),
  avatarKey: z.string().nullable(),
  avatarGradient: z.string().nullable(),
  // True only for the currently-authenticated viewer's own comments, so the
  // frontend can show a delete affordance. Never reveals other authors.
  mine: z.boolean(),
});
export type PublicSocialComment = z.infer<typeof publicSocialCommentSchema>;

export const socialFeedPageSchema = z.object({
  posts: z.array(publicSocialPostSchema),
  nextCursor: z.string().nullable(),
});
export type SocialFeedPage = z.infer<typeof socialFeedPageSchema>;

export const socialPostLikeResultSchema = z.object({
  postId: z.string(),
  likeCount: z.number().int(),
  likedByMe: z.boolean(),
});
export type SocialPostLikeResult = z.infer<typeof socialPostLikeResultSchema>;

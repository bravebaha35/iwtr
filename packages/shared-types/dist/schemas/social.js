"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.socialPostLikeResultSchema = exports.adminReportedSocialCommentSchema = exports.socialFeedPageSchema = exports.socialCommentVoteResultSchema = exports.socialCommentIdentityContextSchema = exports.publicSocialCommentSchema = exports.publicSocialPostSchema = exports.voteSocialCommentInputSchema = exports.reportSocialCommentResultSchema = exports.reportSocialCommentInputSchema = exports.SOCIAL_COMMENT_REPORT_REASON_LABELS = exports.SOCIAL_COMMENT_REPORT_REASONS = exports.socialCommentReportReasonSchema = exports.createSocialCommentInputSchema = exports.commentIdentityModeSchema = exports.createSocialPostInputSchema = exports.SOCIAL_IMAGE_ACCEPTED_MIME_TYPES = exports.SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES = exports.MAX_SOCIAL_POST_IMAGES = void 0;
exports.validateSocialImageUpload = validateSocialImageUpload;
const zod_1 = require("zod");
const company_1 = require("./company");
const review_1 = require("./review");
// Instagram-style multi-photo carousel cap - enforced both by the file
// picker (client-side UX) and FilesInterceptor's maxCount (server-side,
// authoritative).
exports.MAX_SOCIAL_POST_IMAGES = 10;
// --- Upload validation (mime + size only; dimensions are not constrained -
// sharp downscales anything oversized). Pure/environment-agnostic so the
// same rule runs client-side for instant feedback and server-side as the
// authoritative check, matching companyLogo.ts's validateLogoFile pattern.
exports.SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024;
exports.SOCIAL_IMAGE_ACCEPTED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/heic",
    "image/heif",
];
function validateSocialImageUpload(meta) {
    if (!exports.SOCIAL_IMAGE_ACCEPTED_MIME_TYPES.includes(meta.mimeType)) {
        return { valid: false, error: "Photo must be a JPEG, PNG, or HEIC image." };
    }
    if (meta.sizeBytes > exports.SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES) {
        return {
            valid: false,
            error: `Photo is too large - keep it under ${exports.SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
        };
    }
    return { valid: true };
}
// --- Create inputs
exports.createSocialPostInputSchema = zod_1.z.object({
    companyId: zod_1.z.string().uuid(),
    caption: zod_1.z.string().trim().max(1000).optional(),
});
// Which identity a comment is posted under. PERSONAL_CHOSEN/PERSONAL_RANDOM
// are both anonymous - the only two an employee ever picks between.
// OWNER_REAL_NAME is the only mode a company owner ever gets: no toggle, no
// anonymous option, per explicit product decision (2026-09-11) - the API
// rejects anything else from a COMPANY_OWNER regardless of what's sent here.
exports.commentIdentityModeSchema = zod_1.z.enum(["PERSONAL_CHOSEN", "PERSONAL_RANDOM", "OWNER_REAL_NAME"]);
exports.createSocialCommentInputSchema = zod_1.z.object({
    body: zod_1.z.string().trim().min(1).max(1250),
    // Omitted = PERSONAL_CHOSEN (today's only behavior) - existing callers
    // that don't know about identity modes yet keep working unchanged.
    identityMode: exports.commentIdentityModeSchema.optional(),
});
// Fixed set of reasons a reporter must pick from (2026-09-15 product
// decision) - free text gave admins nothing to group or triage by. Keys are
// the stable values stored on SocialCommentReport.reason; labels are the
// exact reporter-facing sentences, shared by the report pop-up and the admin
// queue's per-reason breakdown.
exports.socialCommentReportReasonSchema = zod_1.z.enum([
    "CURSE_WORDS",
    "DISREGARD_ANONYMITY",
    "THREAT_ABUSE",
]);
exports.SOCIAL_COMMENT_REPORT_REASONS = [
    "CURSE_WORDS",
    "DISREGARD_ANONYMITY",
    "THREAT_ABUSE",
];
exports.SOCIAL_COMMENT_REPORT_REASON_LABELS = {
    CURSE_WORDS: "Curse words and bad language.",
    DISREGARD_ANONYMITY: "Disregard for anonymity.",
    THREAT_ABUSE: "Threat and abuse.",
};
exports.reportSocialCommentInputSchema = zod_1.z.object({
    reason: exports.socialCommentReportReasonSchema,
});
exports.reportSocialCommentResultSchema = zod_1.z.object({
    commentId: zod_1.z.string(),
    reportCount: zod_1.z.number().int(),
});
// Same value/semantics as a review vote - reused directly rather than a
// duplicate literal-union type.
exports.voteSocialCommentInputSchema = zod_1.z.object({
    value: review_1.voteValueSchema,
});
// --- Public read shapes. NOTE (REVIEW.md-adjacent): no authorUserId / userId
// on either shape. The comment's identity fields are the same anonymous
// triple a review exposes (avatarKey/avatarGradient/displayUsername).
exports.publicSocialPostSchema = zod_1.z.object({
    id: zod_1.z.string(),
    companyId: zod_1.z.string(),
    companySlug: zod_1.z.string(),
    companyName: zod_1.z.string(),
    companyLogoUrl: zod_1.z.string().nullable(),
    companyBadgeTier: company_1.ownerTierSchema,
    // The post's company work-type tags, primary-first (see
    // companyWorkplaceTypesSchema) - the feed card renders the primary in
    // bold and the secondary, if any, in a normal weight, same as the rating
    // and job surfaces.
    companyWorkplaceTypes: company_1.companyWorkplaceTypesSchema,
    // Instagram-style carousel - always at least 1 (see MAX_SOCIAL_POST_IMAGES).
    imageUrls: zod_1.z.array(zod_1.z.string()).min(1),
    caption: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string().datetime(),
    likeCount: zod_1.z.number().int(),
    commentCount: zod_1.z.number().int(),
    // null when the viewer is anonymous; boolean when authenticated.
    likedByMe: zod_1.z.boolean().nullable(),
    // Same null-when-anonymous convention as likedByMe (see SocialService.
    // serializePosts) - a private bookmark flag, never a public save count.
    savedByMe: zod_1.z.boolean().nullable(),
});
exports.publicSocialCommentSchema = zod_1.z.object({
    id: zod_1.z.string(),
    postId: zod_1.z.string(),
    body: zod_1.z.string(),
    createdAt: zod_1.z.string().datetime(),
    identityMode: exports.commentIdentityModeSchema,
    // For PERSONAL_CHOSEN/PERSONAL_RANDOM: the anonymous handle (reviewUsername
    // or the locked one-off pick). For OWNER_REAL_NAME: the owner's real,
    // decrypted name - the one deliberate exception to 'never a real name'.
    displayUsername: zod_1.z.string().nullable(),
    avatarKey: zod_1.z.string().nullable(),
    avatarGradient: zod_1.z.string().nullable(),
    // Only ever set for OWNER_REAL_NAME (EmployerProfile.profilePictureUrl) -
    // takes rendering priority over avatarKey/avatarGradient when present.
    avatarPhotoUrl: zod_1.z.string().nullable(),
    // True only for the currently-authenticated viewer's own comments, so the
    // frontend can show a delete affordance. Never reveals other authors.
    mine: zod_1.z.boolean(),
    // Same value/semantics as a review vote (1 = Helpful, -1 = Not Helpful).
    // null when the viewer is anonymous or authenticated-but-hasn't-voted.
    helpfulCount: zod_1.z.number().int(),
    notHelpfulCount: zod_1.z.number().int(),
    myVote: review_1.voteValueSchema.nullable(),
    // 0 for a reply itself (replies are capped at one level - see
    // SocialService.addReply - so a reply never has replies of its own).
    // For a top-level comment, how many replies it has - drives whether the
    // frontend's down-arrow expand affordance renders at all.
    replyCount: zod_1.z.number().int(),
});
// What identity a comment composer should show/offer for the CURRENT user
// on a SPECIFIC post - fetched once when the composer opens. A
// COMPANY_OWNER always gets locked: true with mode OWNER_REAL_NAME (no
// choice, ever). A MEMBER gets locked: true (with whichever mode they
// already used on this post) once they've commented here before, otherwise
// locked: false plus both choices' preview so the toggle has something to
// show before the first pick.
exports.socialCommentIdentityContextSchema = zod_1.z.discriminatedUnion("locked", [
    zod_1.z.object({
        locked: zod_1.z.literal(true),
        identityMode: exports.commentIdentityModeSchema,
        displayUsername: zod_1.z.string().nullable(),
        avatarKey: zod_1.z.string().nullable(),
        avatarGradient: zod_1.z.string().nullable(),
        avatarPhotoUrl: zod_1.z.string().nullable(),
    }),
    zod_1.z.object({
        locked: zod_1.z.literal(false),
        chosen: zod_1.z.object({
            displayUsername: zod_1.z.string().nullable(),
            avatarKey: zod_1.z.string().nullable(),
            avatarGradient: zod_1.z.string().nullable(),
        }),
    }),
]);
exports.socialCommentVoteResultSchema = zod_1.z.object({
    commentId: zod_1.z.string(),
    helpfulCount: zod_1.z.number().int(),
    notHelpfulCount: zod_1.z.number().int(),
    myVote: review_1.voteValueSchema.nullable(),
});
exports.socialFeedPageSchema = zod_1.z.object({
    posts: zod_1.z.array(exports.publicSocialPostSchema),
    nextCursor: zod_1.z.string().nullable(),
});
// ADMIN-only view of a reported comment. Deliberately excludes any author
// identity - same anonymity rule every other admin/social endpoint already
// follows (see REVIEW.md's social scope) - an admin judges the CONTENT,
// never who wrote it.
exports.adminReportedSocialCommentSchema = zod_1.z.object({
    id: zod_1.z.string(),
    postId: zod_1.z.string(),
    body: zod_1.z.string(),
    createdAt: zod_1.z.string().datetime(),
    reportCount: zod_1.z.number().int(),
    // Per-reason tally (see socialCommentReportReasonSchema) so an admin can
    // see AT A GLANCE what a comment is being reported for, e.g.
    // { THREAT_ABUSE: 2, CURSE_WORDS: 1 }. Reports filed before reasons were
    // required (or otherwise missing one) bucket under "UNSPECIFIED".
    reportReasonCounts: zod_1.z.record(zod_1.z.string(), zod_1.z.number().int()),
    // True once reports crossed 3 AND the automated content check found
    // something - these sort first, since they're the ones most likely to
    // need a decision rather than just 'a couple of people didn't like it'.
    flaggedForReview: zod_1.z.boolean(),
    flaggedReviewReason: zod_1.z.string().nullable(),
});
exports.socialPostLikeResultSchema = zod_1.z.object({
    postId: zod_1.z.string(),
    likeCount: zod_1.z.number().int(),
    likedByMe: zod_1.z.boolean(),
});

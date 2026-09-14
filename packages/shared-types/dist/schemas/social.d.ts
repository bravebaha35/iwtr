import { z } from "zod";
export declare const MAX_SOCIAL_POST_IMAGES = 10;
export declare const SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES: number;
export declare const SOCIAL_IMAGE_ACCEPTED_MIME_TYPES: readonly ["image/jpeg", "image/png", "image/heic", "image/heif"];
export interface SocialImageFileMeta {
    mimeType: string;
    sizeBytes: number;
}
export declare function validateSocialImageUpload(meta: SocialImageFileMeta): {
    valid: true;
} | {
    valid: false;
    error: string;
};
export declare const createSocialPostInputSchema: z.ZodObject<{
    companyId: z.ZodString;
    caption: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    companyId: string;
    caption?: string | undefined;
}, {
    companyId: string;
    caption?: string | undefined;
}>;
export type CreateSocialPostInput = z.infer<typeof createSocialPostInputSchema>;
export declare const commentIdentityModeSchema: z.ZodEnum<["PERSONAL_CHOSEN", "PERSONAL_RANDOM", "OWNER_REAL_NAME"]>;
export type CommentIdentityMode = z.infer<typeof commentIdentityModeSchema>;
export declare const createSocialCommentInputSchema: z.ZodObject<{
    body: z.ZodString;
    identityMode: z.ZodOptional<z.ZodEnum<["PERSONAL_CHOSEN", "PERSONAL_RANDOM", "OWNER_REAL_NAME"]>>;
}, "strip", z.ZodTypeAny, {
    body: string;
    identityMode?: "PERSONAL_CHOSEN" | "PERSONAL_RANDOM" | "OWNER_REAL_NAME" | undefined;
}, {
    body: string;
    identityMode?: "PERSONAL_CHOSEN" | "PERSONAL_RANDOM" | "OWNER_REAL_NAME" | undefined;
}>;
export type CreateSocialCommentInput = z.infer<typeof createSocialCommentInputSchema>;
export declare const socialCommentReportReasonSchema: z.ZodEnum<["CURSE_WORDS", "DISREGARD_ANONYMITY", "THREAT_ABUSE"]>;
export type SocialCommentReportReason = z.infer<typeof socialCommentReportReasonSchema>;
export declare const SOCIAL_COMMENT_REPORT_REASONS: SocialCommentReportReason[];
export declare const SOCIAL_COMMENT_REPORT_REASON_LABELS: Record<SocialCommentReportReason, string>;
export declare const reportSocialCommentInputSchema: z.ZodObject<{
    reason: z.ZodEnum<["CURSE_WORDS", "DISREGARD_ANONYMITY", "THREAT_ABUSE"]>;
}, "strip", z.ZodTypeAny, {
    reason: "CURSE_WORDS" | "DISREGARD_ANONYMITY" | "THREAT_ABUSE";
}, {
    reason: "CURSE_WORDS" | "DISREGARD_ANONYMITY" | "THREAT_ABUSE";
}>;
export type ReportSocialCommentInput = z.infer<typeof reportSocialCommentInputSchema>;
export declare const reportSocialCommentResultSchema: z.ZodObject<{
    commentId: z.ZodString;
    reportCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    commentId: string;
    reportCount: number;
}, {
    commentId: string;
    reportCount: number;
}>;
export type ReportSocialCommentResult = z.infer<typeof reportSocialCommentResultSchema>;
export declare const voteSocialCommentInputSchema: z.ZodObject<{
    value: z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<-1>]>;
}, "strip", z.ZodTypeAny, {
    value: 1 | -1;
}, {
    value: 1 | -1;
}>;
export type VoteSocialCommentInput = z.infer<typeof voteSocialCommentInputSchema>;
export declare const publicSocialPostSchema: z.ZodObject<{
    id: z.ZodString;
    companyId: z.ZodString;
    companySlug: z.ZodString;
    companyName: z.ZodString;
    companyLogoUrl: z.ZodNullable<z.ZodString>;
    companyBadgeTier: z.ZodEnum<["FREE", "BLUE", "BLUE_PLUS", "ENTERPRISE"]>;
    companyWorkplaceTypes: z.ZodArray<z.ZodEnum<["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]>, "many">;
    imageUrls: z.ZodArray<z.ZodString, "many">;
    caption: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    likeCount: z.ZodNumber;
    commentCount: z.ZodNumber;
    likedByMe: z.ZodNullable<z.ZodBoolean>;
    savedByMe: z.ZodNullable<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    companyId: string;
    companyName: string;
    likeCount: number;
    companySlug: string;
    caption: string | null;
    companyLogoUrl: string | null;
    companyBadgeTier: "BLUE" | "BLUE_PLUS" | "ENTERPRISE" | "FREE";
    companyWorkplaceTypes: ("OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR")[];
    imageUrls: string[];
    commentCount: number;
    likedByMe: boolean | null;
    savedByMe: boolean | null;
}, {
    id: string;
    createdAt: string;
    companyId: string;
    companyName: string;
    likeCount: number;
    companySlug: string;
    caption: string | null;
    companyLogoUrl: string | null;
    companyBadgeTier: "BLUE" | "BLUE_PLUS" | "ENTERPRISE" | "FREE";
    companyWorkplaceTypes: ("OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR")[];
    imageUrls: string[];
    commentCount: number;
    likedByMe: boolean | null;
    savedByMe: boolean | null;
}>;
export type PublicSocialPost = z.infer<typeof publicSocialPostSchema>;
export declare const publicSocialCommentSchema: z.ZodObject<{
    id: z.ZodString;
    postId: z.ZodString;
    body: z.ZodString;
    createdAt: z.ZodString;
    identityMode: z.ZodEnum<["PERSONAL_CHOSEN", "PERSONAL_RANDOM", "OWNER_REAL_NAME"]>;
    displayUsername: z.ZodNullable<z.ZodString>;
    avatarKey: z.ZodNullable<z.ZodString>;
    avatarGradient: z.ZodNullable<z.ZodString>;
    avatarPhotoUrl: z.ZodNullable<z.ZodString>;
    mine: z.ZodBoolean;
    helpfulCount: z.ZodNumber;
    notHelpfulCount: z.ZodNumber;
    myVote: z.ZodNullable<z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<-1>]>>;
    replyCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    avatarKey: string | null;
    createdAt: string;
    avatarGradient: string | null;
    myVote: 1 | -1 | null;
    displayUsername: string | null;
    body: string;
    identityMode: "PERSONAL_CHOSEN" | "PERSONAL_RANDOM" | "OWNER_REAL_NAME";
    postId: string;
    avatarPhotoUrl: string | null;
    mine: boolean;
    helpfulCount: number;
    notHelpfulCount: number;
    replyCount: number;
}, {
    id: string;
    avatarKey: string | null;
    createdAt: string;
    avatarGradient: string | null;
    myVote: 1 | -1 | null;
    displayUsername: string | null;
    body: string;
    identityMode: "PERSONAL_CHOSEN" | "PERSONAL_RANDOM" | "OWNER_REAL_NAME";
    postId: string;
    avatarPhotoUrl: string | null;
    mine: boolean;
    helpfulCount: number;
    notHelpfulCount: number;
    replyCount: number;
}>;
export type PublicSocialComment = z.infer<typeof publicSocialCommentSchema>;
export declare const socialCommentIdentityContextSchema: z.ZodDiscriminatedUnion<"locked", [z.ZodObject<{
    locked: z.ZodLiteral<true>;
    identityMode: z.ZodEnum<["PERSONAL_CHOSEN", "PERSONAL_RANDOM", "OWNER_REAL_NAME"]>;
    displayUsername: z.ZodNullable<z.ZodString>;
    avatarKey: z.ZodNullable<z.ZodString>;
    avatarGradient: z.ZodNullable<z.ZodString>;
    avatarPhotoUrl: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    avatarKey: string | null;
    avatarGradient: string | null;
    displayUsername: string | null;
    identityMode: "PERSONAL_CHOSEN" | "PERSONAL_RANDOM" | "OWNER_REAL_NAME";
    avatarPhotoUrl: string | null;
    locked: true;
}, {
    avatarKey: string | null;
    avatarGradient: string | null;
    displayUsername: string | null;
    identityMode: "PERSONAL_CHOSEN" | "PERSONAL_RANDOM" | "OWNER_REAL_NAME";
    avatarPhotoUrl: string | null;
    locked: true;
}>, z.ZodObject<{
    locked: z.ZodLiteral<false>;
    chosen: z.ZodObject<{
        displayUsername: z.ZodNullable<z.ZodString>;
        avatarKey: z.ZodNullable<z.ZodString>;
        avatarGradient: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        avatarKey: string | null;
        avatarGradient: string | null;
        displayUsername: string | null;
    }, {
        avatarKey: string | null;
        avatarGradient: string | null;
        displayUsername: string | null;
    }>;
}, "strip", z.ZodTypeAny, {
    locked: false;
    chosen: {
        avatarKey: string | null;
        avatarGradient: string | null;
        displayUsername: string | null;
    };
}, {
    locked: false;
    chosen: {
        avatarKey: string | null;
        avatarGradient: string | null;
        displayUsername: string | null;
    };
}>]>;
export type SocialCommentIdentityContext = z.infer<typeof socialCommentIdentityContextSchema>;
export declare const socialCommentVoteResultSchema: z.ZodObject<{
    commentId: z.ZodString;
    helpfulCount: z.ZodNumber;
    notHelpfulCount: z.ZodNumber;
    myVote: z.ZodNullable<z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<-1>]>>;
}, "strip", z.ZodTypeAny, {
    myVote: 1 | -1 | null;
    commentId: string;
    helpfulCount: number;
    notHelpfulCount: number;
}, {
    myVote: 1 | -1 | null;
    commentId: string;
    helpfulCount: number;
    notHelpfulCount: number;
}>;
export type SocialCommentVoteResult = z.infer<typeof socialCommentVoteResultSchema>;
export declare const socialFeedPageSchema: z.ZodObject<{
    posts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        companyId: z.ZodString;
        companySlug: z.ZodString;
        companyName: z.ZodString;
        companyLogoUrl: z.ZodNullable<z.ZodString>;
        companyBadgeTier: z.ZodEnum<["FREE", "BLUE", "BLUE_PLUS", "ENTERPRISE"]>;
        companyWorkplaceTypes: z.ZodArray<z.ZodEnum<["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]>, "many">;
        imageUrls: z.ZodArray<z.ZodString, "many">;
        caption: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        likeCount: z.ZodNumber;
        commentCount: z.ZodNumber;
        likedByMe: z.ZodNullable<z.ZodBoolean>;
        savedByMe: z.ZodNullable<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        companyId: string;
        companyName: string;
        likeCount: number;
        companySlug: string;
        caption: string | null;
        companyLogoUrl: string | null;
        companyBadgeTier: "BLUE" | "BLUE_PLUS" | "ENTERPRISE" | "FREE";
        companyWorkplaceTypes: ("OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR")[];
        imageUrls: string[];
        commentCount: number;
        likedByMe: boolean | null;
        savedByMe: boolean | null;
    }, {
        id: string;
        createdAt: string;
        companyId: string;
        companyName: string;
        likeCount: number;
        companySlug: string;
        caption: string | null;
        companyLogoUrl: string | null;
        companyBadgeTier: "BLUE" | "BLUE_PLUS" | "ENTERPRISE" | "FREE";
        companyWorkplaceTypes: ("OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR")[];
        imageUrls: string[];
        commentCount: number;
        likedByMe: boolean | null;
        savedByMe: boolean | null;
    }>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    posts: {
        id: string;
        createdAt: string;
        companyId: string;
        companyName: string;
        likeCount: number;
        companySlug: string;
        caption: string | null;
        companyLogoUrl: string | null;
        companyBadgeTier: "BLUE" | "BLUE_PLUS" | "ENTERPRISE" | "FREE";
        companyWorkplaceTypes: ("OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR")[];
        imageUrls: string[];
        commentCount: number;
        likedByMe: boolean | null;
        savedByMe: boolean | null;
    }[];
    nextCursor: string | null;
}, {
    posts: {
        id: string;
        createdAt: string;
        companyId: string;
        companyName: string;
        likeCount: number;
        companySlug: string;
        caption: string | null;
        companyLogoUrl: string | null;
        companyBadgeTier: "BLUE" | "BLUE_PLUS" | "ENTERPRISE" | "FREE";
        companyWorkplaceTypes: ("OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR")[];
        imageUrls: string[];
        commentCount: number;
        likedByMe: boolean | null;
        savedByMe: boolean | null;
    }[];
    nextCursor: string | null;
}>;
export type SocialFeedPage = z.infer<typeof socialFeedPageSchema>;
export declare const adminReportedSocialCommentSchema: z.ZodObject<{
    id: z.ZodString;
    postId: z.ZodString;
    body: z.ZodString;
    createdAt: z.ZodString;
    reportCount: z.ZodNumber;
    reportReasonCounts: z.ZodRecord<z.ZodString, z.ZodNumber>;
    flaggedForReview: z.ZodBoolean;
    flaggedReviewReason: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    body: string;
    reportCount: number;
    postId: string;
    reportReasonCounts: Record<string, number>;
    flaggedForReview: boolean;
    flaggedReviewReason: string | null;
}, {
    id: string;
    createdAt: string;
    body: string;
    reportCount: number;
    postId: string;
    reportReasonCounts: Record<string, number>;
    flaggedForReview: boolean;
    flaggedReviewReason: string | null;
}>;
export type AdminReportedSocialComment = z.infer<typeof adminReportedSocialCommentSchema>;
export declare const socialPostLikeResultSchema: z.ZodObject<{
    postId: z.ZodString;
    likeCount: z.ZodNumber;
    likedByMe: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    likeCount: number;
    likedByMe: boolean;
    postId: string;
}, {
    likeCount: number;
    likedByMe: boolean;
    postId: string;
}>;
export type SocialPostLikeResult = z.infer<typeof socialPostLikeResultSchema>;

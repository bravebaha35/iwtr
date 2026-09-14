import { z } from "zod";
import { workplaceTypeSchema } from "./company";
export declare const RANDOMIZED_IDENTITY_AVATAR_KEY = "randomized_identity";
export declare const RANDOMIZED_IDENTITY_AVATAR_GRADIENT = "dusk";
export declare const ANONYMOUS_USERNAMES_BY_WORKPLACE_TYPE: Record<z.infer<typeof workplaceTypeSchema>, readonly string[]>;
export declare const ALL_ANONYMOUS_USERNAMES: readonly string[];
export declare const reviewStatusSchema: z.ZodEnum<["PENDING_MODERATION", "PENDING_ADMIN_REVIEW", "PUBLISHED", "REJECTED"]>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export declare const categoryKeySchema: z.ZodEnum<["corporateCulture", "leadership", "infrastructure", "workLifeBalance", "stability"]>;
export type CategoryKey = z.infer<typeof categoryKeySchema>;
export declare const surveyAnswerSchema: z.ZodEnum<["YES", "NO", "PREFER_NOT_TO_ANSWER"]>;
export type SurveyAnswer = z.infer<typeof surveyAnswerSchema>;
export declare const surveyQuestionSchema: z.ZodObject<{
    id: z.ZodString;
    category: z.ZodEnum<["corporateCulture", "leadership", "infrastructure", "workLifeBalance", "stability"]>;
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
    text: string;
}, {
    id: string;
    category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
    text: string;
}>;
export type SurveyQuestion = z.infer<typeof surveyQuestionSchema>;
export declare const surveyQuestionSetSchema: z.ZodArray<z.ZodObject<{
    id: z.ZodString;
    category: z.ZodEnum<["corporateCulture", "leadership", "infrastructure", "workLifeBalance", "stability"]>;
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
    text: string;
}, {
    id: string;
    category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
    text: string;
}>, "many">;
export type SurveyQuestionSet = z.infer<typeof surveyQuestionSetSchema>;
export declare const surveyResponseSchema: z.ZodObject<{
    questionId: z.ZodString;
    answer: z.ZodEnum<["YES", "NO", "PREFER_NOT_TO_ANSWER"]>;
}, "strip", z.ZodTypeAny, {
    questionId: string;
    answer: "YES" | "NO" | "PREFER_NOT_TO_ANSWER";
}, {
    questionId: string;
    answer: "YES" | "NO" | "PREFER_NOT_TO_ANSWER";
}>;
export type SurveyResponse = z.infer<typeof surveyResponseSchema>;
export declare const createReviewInputSchema: z.ZodObject<{
    companyId: z.ZodString;
    employmentHistoryId: z.ZodString;
    workplaceType: z.ZodEnum<["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]>;
    answers: z.ZodArray<z.ZodObject<{
        questionId: z.ZodString;
        answer: z.ZodEnum<["YES", "NO", "PREFER_NOT_TO_ANSWER"]>;
    }, "strip", z.ZodTypeAny, {
        questionId: string;
        answer: "YES" | "NO" | "PREFER_NOT_TO_ANSWER";
    }, {
        questionId: string;
        answer: "YES" | "NO" | "PREFER_NOT_TO_ANSWER";
    }>, "many">;
    generalThoughts: z.ZodOptional<z.ZodString>;
    isRandomizedIdentity: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    city: z.ZodOptional<z.ZodString>;
    district: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    companyId: string;
    workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
    employmentHistoryId: string;
    answers: {
        questionId: string;
        answer: "YES" | "NO" | "PREFER_NOT_TO_ANSWER";
    }[];
    isRandomizedIdentity: boolean;
    city?: string | undefined;
    district?: string | undefined;
    generalThoughts?: string | undefined;
}, {
    companyId: string;
    workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
    employmentHistoryId: string;
    answers: {
        questionId: string;
        answer: "YES" | "NO" | "PREFER_NOT_TO_ANSWER";
    }[];
    city?: string | undefined;
    district?: string | undefined;
    generalThoughts?: string | undefined;
    isRandomizedIdentity?: boolean | undefined;
}>;
export type CreateReviewInput = z.infer<typeof createReviewInputSchema>;
export declare const updateReviewInputSchema: z.ZodObject<Omit<{
    companyId: z.ZodString;
    employmentHistoryId: z.ZodString;
    workplaceType: z.ZodEnum<["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]>;
    answers: z.ZodArray<z.ZodObject<{
        questionId: z.ZodString;
        answer: z.ZodEnum<["YES", "NO", "PREFER_NOT_TO_ANSWER"]>;
    }, "strip", z.ZodTypeAny, {
        questionId: string;
        answer: "YES" | "NO" | "PREFER_NOT_TO_ANSWER";
    }, {
        questionId: string;
        answer: "YES" | "NO" | "PREFER_NOT_TO_ANSWER";
    }>, "many">;
    generalThoughts: z.ZodOptional<z.ZodString>;
    isRandomizedIdentity: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    city: z.ZodOptional<z.ZodString>;
    district: z.ZodOptional<z.ZodString>;
}, "companyId" | "workplaceType" | "employmentHistoryId">, "strip", z.ZodTypeAny, {
    answers: {
        questionId: string;
        answer: "YES" | "NO" | "PREFER_NOT_TO_ANSWER";
    }[];
    isRandomizedIdentity: boolean;
    city?: string | undefined;
    district?: string | undefined;
    generalThoughts?: string | undefined;
}, {
    answers: {
        questionId: string;
        answer: "YES" | "NO" | "PREFER_NOT_TO_ANSWER";
    }[];
    city?: string | undefined;
    district?: string | undefined;
    generalThoughts?: string | undefined;
    isRandomizedIdentity?: boolean | undefined;
}>;
export type UpdateReviewInput = z.infer<typeof updateReviewInputSchema>;
export declare const companyReplySchema: z.ZodObject<{
    id: z.ZodString;
    content: z.ZodString;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    content: string;
}, {
    id: string;
    createdAt: string;
    content: string;
}>;
export type CompanyReply = z.infer<typeof companyReplySchema>;
export declare const replyToReviewInputSchema: z.ZodObject<{
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    content: string;
}, {
    content: string;
}>;
export type ReplyToReviewInput = z.infer<typeof replyToReviewInputSchema>;
export declare const publicReviewSchema: z.ZodObject<{
    id: z.ZodString;
    companyId: z.ZodString;
    workplaceType: z.ZodEnum<["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]>;
    corporateCultureScore: z.ZodNumber;
    leadershipScore: z.ZodNumber;
    infrastructureScore: z.ZodNumber;
    workLifeBalanceScore: z.ZodNumber;
    stabilityScore: z.ZodNumber;
    generalThoughts: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["PENDING_MODERATION", "PENDING_ADMIN_REVIEW", "PUBLISHED", "REJECTED"]>;
    publishedAt: z.ZodNullable<z.ZodString>;
    likeCount: z.ZodNumber;
    dislikeCount: z.ZodNumber;
    myVote: z.ZodNullable<z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<-1>]>>;
    contributorBadge: z.ZodNullable<z.ZodEnum<["CONTRIBUTOR", "TOP_CONTRIBUTOR"]>>;
    reply: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        content: z.ZodString;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        content: string;
    }, {
        id: string;
        createdAt: string;
        content: string;
    }>>;
    avatarKey: z.ZodNullable<z.ZodString>;
    avatarGradient: z.ZodNullable<z.ZodString>;
    displayUsername: z.ZodNullable<z.ZodString>;
    city: z.ZodNullable<z.ZodString>;
    district: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "PUBLISHED" | "REJECTED" | "PENDING_MODERATION" | "PENDING_ADMIN_REVIEW";
    id: string;
    avatarKey: string | null;
    city: string | null;
    district: string | null;
    companyId: string;
    avatarGradient: string | null;
    workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
    generalThoughts: string | null;
    corporateCultureScore: number;
    leadershipScore: number;
    infrastructureScore: number;
    workLifeBalanceScore: number;
    stabilityScore: number;
    publishedAt: string | null;
    likeCount: number;
    dislikeCount: number;
    myVote: 1 | -1 | null;
    contributorBadge: "CONTRIBUTOR" | "TOP_CONTRIBUTOR" | null;
    reply: {
        id: string;
        createdAt: string;
        content: string;
    } | null;
    displayUsername: string | null;
}, {
    status: "PUBLISHED" | "REJECTED" | "PENDING_MODERATION" | "PENDING_ADMIN_REVIEW";
    id: string;
    avatarKey: string | null;
    city: string | null;
    district: string | null;
    companyId: string;
    avatarGradient: string | null;
    workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
    generalThoughts: string | null;
    corporateCultureScore: number;
    leadershipScore: number;
    infrastructureScore: number;
    workLifeBalanceScore: number;
    stabilityScore: number;
    publishedAt: string | null;
    likeCount: number;
    dislikeCount: number;
    myVote: 1 | -1 | null;
    contributorBadge: "CONTRIBUTOR" | "TOP_CONTRIBUTOR" | null;
    reply: {
        id: string;
        createdAt: string;
        content: string;
    } | null;
    displayUsername: string | null;
}>;
export type PublicReview = z.infer<typeof publicReviewSchema>;
export declare const voteValueSchema: z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<-1>]>;
export type VoteValue = z.infer<typeof voteValueSchema>;
export declare const castVoteInputSchema: z.ZodObject<{
    reviewId: z.ZodString;
    value: z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<-1>]>;
}, "strip", z.ZodTypeAny, {
    value: 1 | -1;
    reviewId: string;
}, {
    value: 1 | -1;
    reviewId: string;
}>;
export type CastVoteInput = z.infer<typeof castVoteInputSchema>;
export declare const castVoteResultSchema: z.ZodObject<{
    reviewId: z.ZodString;
    likeCount: z.ZodNumber;
    dislikeCount: z.ZodNumber;
    myVote: z.ZodNullable<z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<-1>]>>;
}, "strip", z.ZodTypeAny, {
    likeCount: number;
    dislikeCount: number;
    myVote: 1 | -1 | null;
    reviewId: string;
}, {
    likeCount: number;
    dislikeCount: number;
    myVote: 1 | -1 | null;
    reviewId: string;
}>;
export type CastVoteResult = z.infer<typeof castVoteResultSchema>;
export declare const categoryScoresSchema: z.ZodObject<{
    corporateCulture: z.ZodNumber;
    leadership: z.ZodNumber;
    infrastructure: z.ZodNumber;
    workLifeBalance: z.ZodNumber;
    stability: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    corporateCulture: number;
    leadership: number;
    infrastructure: number;
    workLifeBalance: number;
    stability: number;
}, {
    corporateCulture: number;
    leadership: number;
    infrastructure: number;
    workLifeBalance: number;
    stability: number;
}>;
export type CategoryScores = z.infer<typeof categoryScoresSchema>;
export declare const submitReviewResultSchema: z.ZodObject<{
    reviewId: z.ZodString;
    status: z.ZodEnum<["PENDING_MODERATION", "PENDING_ADMIN_REVIEW", "PUBLISHED", "REJECTED"]>;
    message: z.ZodString;
    scores: z.ZodObject<{
        corporateCulture: z.ZodNumber;
        leadership: z.ZodNumber;
        infrastructure: z.ZodNumber;
        workLifeBalance: z.ZodNumber;
        stability: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        corporateCulture: number;
        leadership: number;
        infrastructure: number;
        workLifeBalance: number;
        stability: number;
    }, {
        corporateCulture: number;
        leadership: number;
        infrastructure: number;
        workLifeBalance: number;
        stability: number;
    }>;
}, "strip", z.ZodTypeAny, {
    message: string;
    status: "PUBLISHED" | "REJECTED" | "PENDING_MODERATION" | "PENDING_ADMIN_REVIEW";
    reviewId: string;
    scores: {
        corporateCulture: number;
        leadership: number;
        infrastructure: number;
        workLifeBalance: number;
        stability: number;
    };
}, {
    message: string;
    status: "PUBLISHED" | "REJECTED" | "PENDING_MODERATION" | "PENDING_ADMIN_REVIEW";
    reviewId: string;
    scores: {
        corporateCulture: number;
        leadership: number;
        infrastructure: number;
        workLifeBalance: number;
        stability: number;
    };
}>;
export type SubmitReviewResult = z.infer<typeof submitReviewResultSchema>;
export declare const myEmploymentEntrySchema: z.ZodObject<{
    id: z.ZodString;
    rawCompanyName: z.ZodString;
    companyId: z.ZodNullable<z.ZodString>;
    companySlug: z.ZodNullable<z.ZodString>;
    jobTitle: z.ZodNullable<z.ZodString>;
    startDate: z.ZodNullable<z.ZodString>;
    endDate: z.ZodNullable<z.ZodString>;
    hasReview: z.ZodBoolean;
    reviewId: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    rawCompanyName: string;
    companyId: string | null;
    jobTitle: string | null;
    startDate: string | null;
    endDate: string | null;
    reviewId: string | null;
    companySlug: string | null;
    hasReview: boolean;
}, {
    id: string;
    rawCompanyName: string;
    companyId: string | null;
    jobTitle: string | null;
    startDate: string | null;
    endDate: string | null;
    reviewId: string | null;
    companySlug: string | null;
    hasReview: boolean;
}>;
export type MyEmploymentEntry = z.infer<typeof myEmploymentEntrySchema>;
export declare const myReviewSchema: z.ZodObject<{
    id: z.ZodString;
    companyId: z.ZodString;
    workplaceType: z.ZodEnum<["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]>;
    corporateCultureScore: z.ZodNumber;
    leadershipScore: z.ZodNumber;
    infrastructureScore: z.ZodNumber;
    workLifeBalanceScore: z.ZodNumber;
    stabilityScore: z.ZodNumber;
    surveyAnswers: z.ZodRecord<z.ZodString, z.ZodEnum<["YES", "NO", "PREFER_NOT_TO_ANSWER"]>>;
    generalThoughts: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["PENDING_MODERATION", "PENDING_ADMIN_REVIEW", "PUBLISHED", "REJECTED"]>;
    isRandomizedIdentity: z.ZodBoolean;
    displayUsername: z.ZodNullable<z.ZodString>;
    city: z.ZodNullable<z.ZodString>;
    district: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "PUBLISHED" | "REJECTED" | "PENDING_MODERATION" | "PENDING_ADMIN_REVIEW";
    id: string;
    city: string | null;
    district: string | null;
    companyId: string;
    workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
    generalThoughts: string | null;
    isRandomizedIdentity: boolean;
    corporateCultureScore: number;
    leadershipScore: number;
    infrastructureScore: number;
    workLifeBalanceScore: number;
    stabilityScore: number;
    displayUsername: string | null;
    surveyAnswers: Record<string, "YES" | "NO" | "PREFER_NOT_TO_ANSWER">;
}, {
    status: "PUBLISHED" | "REJECTED" | "PENDING_MODERATION" | "PENDING_ADMIN_REVIEW";
    id: string;
    city: string | null;
    district: string | null;
    companyId: string;
    workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
    generalThoughts: string | null;
    isRandomizedIdentity: boolean;
    corporateCultureScore: number;
    leadershipScore: number;
    infrastructureScore: number;
    workLifeBalanceScore: number;
    stabilityScore: number;
    displayUsername: string | null;
    surveyAnswers: Record<string, "YES" | "NO" | "PREFER_NOT_TO_ANSWER">;
}>;
export type MyReview = z.infer<typeof myReviewSchema>;
export declare const myReviewListItemSchema: z.ZodObject<{
    id: z.ZodString;
    companyId: z.ZodString;
    workplaceType: z.ZodEnum<["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]>;
    corporateCultureScore: z.ZodNumber;
    leadershipScore: z.ZodNumber;
    infrastructureScore: z.ZodNumber;
    workLifeBalanceScore: z.ZodNumber;
    stabilityScore: z.ZodNumber;
    surveyAnswers: z.ZodRecord<z.ZodString, z.ZodEnum<["YES", "NO", "PREFER_NOT_TO_ANSWER"]>>;
    generalThoughts: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["PENDING_MODERATION", "PENDING_ADMIN_REVIEW", "PUBLISHED", "REJECTED"]>;
    isRandomizedIdentity: z.ZodBoolean;
    displayUsername: z.ZodNullable<z.ZodString>;
    city: z.ZodNullable<z.ZodString>;
    district: z.ZodNullable<z.ZodString>;
} & {
    companyName: z.ZodString;
    companySlug: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    publishedAt: z.ZodNullable<z.ZodString>;
    likeCount: z.ZodNumber;
    dislikeCount: z.ZodNumber;
    reply: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        content: z.ZodString;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        content: string;
    }, {
        id: string;
        createdAt: string;
        content: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "PUBLISHED" | "REJECTED" | "PENDING_MODERATION" | "PENDING_ADMIN_REVIEW";
    id: string;
    city: string | null;
    district: string | null;
    createdAt: string;
    companyId: string;
    companyName: string;
    workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
    generalThoughts: string | null;
    isRandomizedIdentity: boolean;
    corporateCultureScore: number;
    leadershipScore: number;
    infrastructureScore: number;
    workLifeBalanceScore: number;
    stabilityScore: number;
    publishedAt: string | null;
    likeCount: number;
    dislikeCount: number;
    reply: {
        id: string;
        createdAt: string;
        content: string;
    } | null;
    displayUsername: string | null;
    companySlug: string | null;
    surveyAnswers: Record<string, "YES" | "NO" | "PREFER_NOT_TO_ANSWER">;
}, {
    status: "PUBLISHED" | "REJECTED" | "PENDING_MODERATION" | "PENDING_ADMIN_REVIEW";
    id: string;
    city: string | null;
    district: string | null;
    createdAt: string;
    companyId: string;
    companyName: string;
    workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
    generalThoughts: string | null;
    isRandomizedIdentity: boolean;
    corporateCultureScore: number;
    leadershipScore: number;
    infrastructureScore: number;
    workLifeBalanceScore: number;
    stabilityScore: number;
    publishedAt: string | null;
    likeCount: number;
    dislikeCount: number;
    reply: {
        id: string;
        createdAt: string;
        content: string;
    } | null;
    displayUsername: string | null;
    companySlug: string | null;
    surveyAnswers: Record<string, "YES" | "NO" | "PREFER_NOT_TO_ANSWER">;
}>;
export type MyReviewListItem = z.infer<typeof myReviewListItemSchema>;
export declare const addEmploymentHistoryInputSchema: z.ZodObject<{
    companyId: z.ZodString;
    jobTitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    startDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    companyId: string;
    jobTitle?: string | null | undefined;
    startDate?: string | null | undefined;
    endDate?: string | null | undefined;
}, {
    companyId: string;
    jobTitle?: string | null | undefined;
    startDate?: string | null | undefined;
    endDate?: string | null | undefined;
}>;
export type AddEmploymentHistoryInput = z.infer<typeof addEmploymentHistoryInputSchema>;
export declare const updateEmploymentHistoryInputSchema: z.ZodEffects<z.ZodObject<{
    jobTitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    startDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    jobTitle?: string | null | undefined;
    startDate?: string | null | undefined;
    endDate?: string | null | undefined;
}, {
    jobTitle?: string | null | undefined;
    startDate?: string | null | undefined;
    endDate?: string | null | undefined;
}>, {
    jobTitle?: string | null | undefined;
    startDate?: string | null | undefined;
    endDate?: string | null | undefined;
}, {
    jobTitle?: string | null | undefined;
    startDate?: string | null | undefined;
    endDate?: string | null | undefined;
}>;
export type UpdateEmploymentHistoryInput = z.infer<typeof updateEmploymentHistoryInputSchema>;
export declare const surveyQuestionStatsSchema: z.ZodObject<{
    questionId: z.ZodString;
    category: z.ZodEnum<["corporateCulture", "leadership", "infrastructure", "workLifeBalance", "stability"]>;
    text: z.ZodString;
    agreeCount: z.ZodNumber;
    disagreeCount: z.ZodNumber;
    preferNotCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
    text: string;
    questionId: string;
    agreeCount: number;
    disagreeCount: number;
    preferNotCount: number;
}, {
    category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
    text: string;
    questionId: string;
    agreeCount: number;
    disagreeCount: number;
    preferNotCount: number;
}>;
export type SurveyQuestionStats = z.infer<typeof surveyQuestionStatsSchema>;
export declare const companyWorkplaceSurveyStatsSchema: z.ZodObject<{
    workplaceType: z.ZodEnum<["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]>;
    totalReviews: z.ZodNumber;
    questions: z.ZodArray<z.ZodObject<{
        questionId: z.ZodString;
        category: z.ZodEnum<["corporateCulture", "leadership", "infrastructure", "workLifeBalance", "stability"]>;
        text: z.ZodString;
        agreeCount: z.ZodNumber;
        disagreeCount: z.ZodNumber;
        preferNotCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
        text: string;
        questionId: string;
        agreeCount: number;
        disagreeCount: number;
        preferNotCount: number;
    }, {
        category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
        text: string;
        questionId: string;
        agreeCount: number;
        disagreeCount: number;
        preferNotCount: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
    totalReviews: number;
    questions: {
        category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
        text: string;
        questionId: string;
        agreeCount: number;
        disagreeCount: number;
        preferNotCount: number;
    }[];
}, {
    workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
    totalReviews: number;
    questions: {
        category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
        text: string;
        questionId: string;
        agreeCount: number;
        disagreeCount: number;
        preferNotCount: number;
    }[];
}>;
export type CompanyWorkplaceSurveyStats = z.infer<typeof companyWorkplaceSurveyStatsSchema>;
export declare const companySurveyStatsSchema: z.ZodObject<{
    byWorkplaceType: z.ZodArray<z.ZodObject<{
        workplaceType: z.ZodEnum<["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]>;
        totalReviews: z.ZodNumber;
        questions: z.ZodArray<z.ZodObject<{
            questionId: z.ZodString;
            category: z.ZodEnum<["corporateCulture", "leadership", "infrastructure", "workLifeBalance", "stability"]>;
            text: z.ZodString;
            agreeCount: z.ZodNumber;
            disagreeCount: z.ZodNumber;
            preferNotCount: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
            text: string;
            questionId: string;
            agreeCount: number;
            disagreeCount: number;
            preferNotCount: number;
        }, {
            category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
            text: string;
            questionId: string;
            agreeCount: number;
            disagreeCount: number;
            preferNotCount: number;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
        totalReviews: number;
        questions: {
            category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
            text: string;
            questionId: string;
            agreeCount: number;
            disagreeCount: number;
            preferNotCount: number;
        }[];
    }, {
        workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
        totalReviews: number;
        questions: {
            category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
            text: string;
            questionId: string;
            agreeCount: number;
            disagreeCount: number;
            preferNotCount: number;
        }[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    byWorkplaceType: {
        workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
        totalReviews: number;
        questions: {
            category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
            text: string;
            questionId: string;
            agreeCount: number;
            disagreeCount: number;
            preferNotCount: number;
        }[];
    }[];
}, {
    byWorkplaceType: {
        workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
        totalReviews: number;
        questions: {
            category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
            text: string;
            questionId: string;
            agreeCount: number;
            disagreeCount: number;
            preferNotCount: number;
        }[];
    }[];
}>;
export type CompanySurveyStats = z.infer<typeof companySurveyStatsSchema>;
export declare const flagColorSchema: z.ZodEnum<["GREEN", "RED"]>;
export type FlagColor = z.infer<typeof flagColorSchema>;
export declare const vibeFlagSchema: z.ZodObject<{
    category: z.ZodEnum<["corporateCulture", "leadership", "infrastructure", "workLifeBalance", "stability"]>;
    cluster: z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<2>]>;
    color: z.ZodEnum<["GREEN", "RED"]>;
    label: z.ZodString;
}, "strip", z.ZodTypeAny, {
    category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
    cluster: 1 | 2;
    color: "GREEN" | "RED";
    label: string;
}, {
    category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
    cluster: 1 | 2;
    color: "GREEN" | "RED";
    label: string;
}>;
export type VibeFlag = z.infer<typeof vibeFlagSchema>;
export declare const yellowVibeFlagSchema: z.ZodObject<{
    id: z.ZodString;
    workplaceType: z.ZodEnum<["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]>;
    label: z.ZodString;
    explanation: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
    label: string;
    explanation: string;
}, {
    id: string;
    workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
    label: string;
    explanation: string;
}>;
export type YellowVibeFlag = z.infer<typeof yellowVibeFlagSchema>;
export declare const companyWorkplaceVibeFlagsSchema: z.ZodObject<{
    workplaceType: z.ZodEnum<["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]>;
    totalReviews: z.ZodNumber;
    flags: z.ZodArray<z.ZodObject<{
        category: z.ZodEnum<["corporateCulture", "leadership", "infrastructure", "workLifeBalance", "stability"]>;
        cluster: z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<2>]>;
        color: z.ZodEnum<["GREEN", "RED"]>;
        label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
        cluster: 1 | 2;
        color: "GREEN" | "RED";
        label: string;
    }, {
        category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
        cluster: 1 | 2;
        color: "GREEN" | "RED";
        label: string;
    }>, "many">;
    yellowFlags: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        workplaceType: z.ZodEnum<["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]>;
        label: z.ZodString;
        explanation: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
        label: string;
        explanation: string;
    }, {
        id: string;
        workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
        label: string;
        explanation: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
    totalReviews: number;
    flags: {
        category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
        cluster: 1 | 2;
        color: "GREEN" | "RED";
        label: string;
    }[];
    yellowFlags: {
        id: string;
        workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
        label: string;
        explanation: string;
    }[];
}, {
    workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
    totalReviews: number;
    flags: {
        category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
        cluster: 1 | 2;
        color: "GREEN" | "RED";
        label: string;
    }[];
    yellowFlags: {
        id: string;
        workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
        label: string;
        explanation: string;
    }[];
}>;
export type CompanyWorkplaceVibeFlags = z.infer<typeof companyWorkplaceVibeFlagsSchema>;
export declare const companyVibeFlagsSchema: z.ZodObject<{
    byWorkplaceType: z.ZodArray<z.ZodObject<{
        workplaceType: z.ZodEnum<["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]>;
        totalReviews: z.ZodNumber;
        flags: z.ZodArray<z.ZodObject<{
            category: z.ZodEnum<["corporateCulture", "leadership", "infrastructure", "workLifeBalance", "stability"]>;
            cluster: z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<2>]>;
            color: z.ZodEnum<["GREEN", "RED"]>;
            label: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
            cluster: 1 | 2;
            color: "GREEN" | "RED";
            label: string;
        }, {
            category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
            cluster: 1 | 2;
            color: "GREEN" | "RED";
            label: string;
        }>, "many">;
        yellowFlags: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            workplaceType: z.ZodEnum<["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]>;
            label: z.ZodString;
            explanation: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
            label: string;
            explanation: string;
        }, {
            id: string;
            workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
            label: string;
            explanation: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
        totalReviews: number;
        flags: {
            category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
            cluster: 1 | 2;
            color: "GREEN" | "RED";
            label: string;
        }[];
        yellowFlags: {
            id: string;
            workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
            label: string;
            explanation: string;
        }[];
    }, {
        workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
        totalReviews: number;
        flags: {
            category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
            cluster: 1 | 2;
            color: "GREEN" | "RED";
            label: string;
        }[];
        yellowFlags: {
            id: string;
            workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
            label: string;
            explanation: string;
        }[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    byWorkplaceType: {
        workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
        totalReviews: number;
        flags: {
            category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
            cluster: 1 | 2;
            color: "GREEN" | "RED";
            label: string;
        }[];
        yellowFlags: {
            id: string;
            workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
            label: string;
            explanation: string;
        }[];
    }[];
}, {
    byWorkplaceType: {
        workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
        totalReviews: number;
        flags: {
            category: "corporateCulture" | "leadership" | "infrastructure" | "workLifeBalance" | "stability";
            cluster: 1 | 2;
            color: "GREEN" | "RED";
            label: string;
        }[];
        yellowFlags: {
            id: string;
            workplaceType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
            label: string;
            explanation: string;
        }[];
    }[];
}>;
export type CompanyVibeFlags = z.infer<typeof companyVibeFlagsSchema>;

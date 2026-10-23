-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "pii";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AuthProvider" AS ENUM ('EMAIL', 'GOOGLE', 'APPLE');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('MEMBER', 'ADMIN', 'COMPANY_OWNER');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('PENDING_PHONE', 'PENDING_PII', 'PENDING_HISTORY', 'PENDING_AVATAR', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."EduLevel" AS ENUM ('ELEMENTARY', 'HIGH_SCHOOL', 'COLLEGE');

-- CreateEnum
CREATE TYPE "public"."OwnerTier" AS ENUM ('FREE', 'STARTER', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "public"."RivalAnalyticsTier" AS ENUM ('STARTER', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "public"."PlanStatus" AS ENUM ('NONE', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."ReviewStatus" AS ENUM ('PENDING_MODERATION', 'PENDING_ADMIN_REVIEW', 'PUBLISHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."QueueStatus" AS ENUM ('OPEN', 'ASKED_FOR_SGK_DOC', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."OwnerClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."JobPostingStatus" AS ENUM ('PUBLISHED', 'PENDING_ADMIN', 'REJECTED', 'FILLED');

-- CreateEnum
CREATE TYPE "public"."JobPosition" AS ENUM ('SENIOR_EXECUTIVE', 'MIDDLE_MANAGER', 'MANAGEMENT_TRAINEE', 'SPECIALIST', 'ENTRY_LEVEL', 'FREELANCER', 'BLUE_COLLAR', 'INTERN', 'ASSISTANT_SPECIALIST', 'STAFF_MEMBER', 'SERVICE_STAFF');

-- CreateEnum
CREATE TYPE "public"."JobPostingBoostPaymentStatus" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "public"."WorkplaceType" AS ENUM ('OFFICE', 'HYBRID_REMOTE', 'SERVICE', 'MANUAL_LABOUR');

-- CreateEnum
CREATE TYPE "public"."StructureType" AS ENUM ('SETTLED', 'CITY_BASED', 'REGION_BASED');

-- CreateEnum
CREATE TYPE "public"."TurkeyRegion" AS ENUM ('MARMARA', 'EGE', 'AKDENIZ', 'IC_ANADOLU', 'KARADENIZ', 'DOGU_ANADOLU', 'GUNEYDOGU_ANADOLU');

-- CreateEnum
CREATE TYPE "public"."CommentIdentityMode" AS ENUM ('PERSONAL_CHOSEN', 'PERSONAL_RANDOM', 'OWNER_REAL_NAME');

-- CreateEnum
CREATE TYPE "public"."ConversationSide" AS ENUM ('REVIEWER', 'COMPANY');

-- CreateEnum
CREATE TYPE "public"."SummaryPatternCategory" AS ENUM ('INTRO', 'QNA_PRIMARY', 'QNA_SECONDARY', 'FLAG_FALLBACK', 'CONCLUSION');

-- CreateEnum
CREATE TYPE "public"."RivalAnalyticsPurchaseStatus" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "public"."SocialPostKind" AS ENUM ('PHOTO', 'UPDATE', 'POLL', 'EVENT', 'MILESTONE', 'HIRING');

-- CreateEnum
CREATE TYPE "public"."ScheduledSocialPostStatus" AS ENUM ('SCHEDULED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."SocialReaction" AS ENUM ('LIKE', 'WELL_DONE', 'CURIOUS');

-- CreateEnum
CREATE TYPE "public"."SocialQuestionVisibility" AS ENUM ('PENDING', 'HIDDEN', 'PUBLIC');

-- CreateEnum
CREATE TYPE "public"."BenefitKey" AS ENUM ('MEAL_CARD', 'TRANSPORT', 'PRIVATE_HEALTH_INSURANCE', 'BONUS', 'PRIVATE_PENSION', 'REMOTE_WORK_ALLOWANCE', 'TRAINING_BUDGET', 'COMPANY_CAR', 'GYM', 'PHONE');

-- CreateEnum
CREATE TYPE "public"."HrAnalyticsReportStatus" AS ENUM ('AWAITING_PAYMENT', 'QUEUED', 'RUNNING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."HrAnalyticsReportAccess" AS ENUM ('PLAN', 'MONTHLY_QUOTA', 'PAID');

-- CreateEnum
CREATE TYPE "public"."BenchmarkReportStatus" AS ENUM ('QUEUED', 'RUNNING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "authProvider" "public"."AuthProvider" NOT NULL,
    "providerSubId" TEXT,
    "passwordHash" TEXT,
    "role" "public"."UserRole" NOT NULL DEFAULT 'MEMBER',
    "status" "public"."UserStatus" NOT NULL DEFAULT 'PENDING_PHONE',
    "avatarKey" TEXT,
    "avatarGradient" TEXT,
    "reviewUsername" TEXT,
    "country" TEXT,
    "city" TEXT,
    "district" TEXT,
    "displayName" TEXT,
    "isPublicEmployee" BOOLEAN NOT NULL DEFAULT false,
    "showUsernameInHeader" BOOLEAN NOT NULL DEFAULT false,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "customExperienceText" TEXT,
    "cvPhotoUrl" TEXT,
    "phoneNumberHash" TEXT,
    "encPhoneNumber" BYTEA,
    "phoneVerifiedAt" TIMESTAMP(3),
    "workType" "public"."WorkplaceType",
    "sectorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PhoneOtpChallenge" (
    "userId" TEXT NOT NULL,
    "phoneNumberHash" TEXT NOT NULL,
    "encPhoneNumber" BYTEA NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneOtpChallenge_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "public"."AdminLoginOtpChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminLoginOtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanySuggestionDismissal" (
    "id" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "dismissedByAdminId" TEXT,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanySuggestionDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserSkill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Sector" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "workplaceTypes" "public"."WorkplaceType"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MemberReference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "position" "public"."JobPosition" NOT NULL,
    "email" TEXT,
    "phoneNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MemberCertificate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "issuedMonth" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EducationHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "public"."EduLevel" NOT NULL,
    "institutionName" TEXT NOT NULL,
    "graduationYear" INTEGER,
    "faculty" TEXT,
    "department" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EducationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmploymentHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT,
    "rawCompanyName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmploymentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Company" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "workplaceTypes" "public"."WorkplaceType"[] DEFAULT ARRAY['SERVICE']::"public"."WorkplaceType"[],
    "mainPhotoUrl" TEXT,
    "description" TEXT,
    "website" TEXT,
    "city" TEXT,
    "district" TEXT,
    "isVerifiedBadge" BOOLEAN NOT NULL DEFAULT false,
    "badgeTier" "public"."OwnerTier" NOT NULL DEFAULT 'FREE',
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "structureType" "public"."StructureType" NOT NULL DEFAULT 'SETTLED',
    "region" "public"."TurkeyRegion",
    "taxNumber" TEXT,
    "isChainStore" BOOLEAN NOT NULL DEFAULT false,
    "isHiring" BOOLEAN NOT NULL DEFAULT false,
    "contactEmail" TEXT,
    "contactEmail2" TEXT,
    "contactEmail3" TEXT,
    "contactPhone" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "whatsappUrl" TEXT,
    "xUrl" TEXT,
    "linkedinUrl" TEXT,
    "youtubeUrl" TEXT,
    "glassdoorUrl" TEXT,
    "bannerImageUrl" TEXT,
    "featuredReviewId" TEXT,
    "hiddenAt" TIMESTAMP(3),
    "riskScore" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyOwner" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tier" "public"."OwnerTier" NOT NULL DEFAULT 'FREE',
    "pendingTier" "public"."OwnerTier",
    "planStatus" "public"."PlanStatus" NOT NULL DEFAULT 'NONE',
    "iyzicoSubscriptionRef" TEXT,
    "planRenewsAt" TIMESTAMP(3),
    "claimStatus" "public"."OwnerClaimStatus" NOT NULL DEFAULT 'PENDING',
    "claimMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "rivalAnalyticsTier" "public"."RivalAnalyticsTier",
    "rivalAnalyticsFreeRequestUsed" BOOLEAN NOT NULL DEFAULT false,
    "showNameInMessages" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CompanyOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JobPosting" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "jobTitle" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "public"."JobPostingStatus" NOT NULL DEFAULT 'PUBLISHED',
    "workType" "public"."WorkplaceType",
    "positions" "public"."JobPosition"[] DEFAULT ARRAY[]::"public"."JobPosition"[],
    "autoReshareEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastResharedAt" TIMESTAMP(3),
    "filledAt" TIMESTAMP(3),
    "boostDurationDays" INTEGER,
    "boostIsFree" BOOLEAN NOT NULL DEFAULT false,
    "boostPaymentStatus" "public"."JobPostingBoostPaymentStatus",
    "boostExpiresAt" TIMESTAMP(3),
    "boostStartedAt" TIMESTAMP(3),
    "boostAdSpace" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JobApplication" (
    "id" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "applicantUserId" TEXT NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewedAt" TIMESTAMP(3),

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OwnerContactMessage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "OwnerContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Review" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employmentHistoryId" TEXT NOT NULL,
    "workplaceType" "public"."WorkplaceType" NOT NULL,
    "corporateCultureScore" INTEGER NOT NULL,
    "leadershipScore" INTEGER NOT NULL,
    "infrastructureScore" INTEGER NOT NULL,
    "workLifeBalanceScore" INTEGER NOT NULL,
    "stabilityScore" INTEGER NOT NULL,
    "surveyAnswers" JSONB NOT NULL,
    "generalThoughts" TEXT,
    "city" TEXT,
    "district" TEXT,
    "status" "public"."ReviewStatus" NOT NULL DEFAULT 'PENDING_MODERATION',
    "aiModerationScore" DOUBLE PRECISION,
    "aiTrustScore" DOUBLE PRECISION,
    "moderationDetails" JSONB,
    "isRandomizedIdentity" BOOLEAN NOT NULL DEFAULT false,
    "displayUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT date_trunc('day'::text, (now() AT TIME ZONE 'UTC'::text)),
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReviewVote" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyReply" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReviewConversation" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "endedAt" TIMESTAMP(3),
    "endedBy" "public"."ConversationSide",
    "reviewerLastReadSeq" INTEGER NOT NULL DEFAULT 0,
    "companyLastReadSeq" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT date_trunc('day'::text, (now() AT TIME ZONE 'UTC'::text)),

    CONSTRAINT "ReviewConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReviewConversationMessage" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "conversationId" TEXT NOT NULL,
    "side" "public"."ConversationSide" NOT NULL,
    "authorUserId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT date_trunc('day'::text, (now() AT TIME ZONE 'UTC'::text)),

    CONSTRAINT "ReviewConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyAggregateScore" (
    "companyId" TEXT NOT NULL,
    "overallAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "corporateCultureAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leadershipAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "infrastructureAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "workLifeBalanceAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stabilityAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyAggregateScore_pkey" PRIMARY KEY ("companyId")
);

-- CreateTable
CREATE TABLE "public"."CompanyNarrative" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workplaceType" "public"."WorkplaceType" NOT NULL,
    "description" TEXT NOT NULL,
    "reviewCountAtGen" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyNarrative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SummaryPattern" (
    "id" TEXT NOT NULL,
    "workplaceType" "public"."WorkplaceType" NOT NULL,
    "category" "public"."SummaryPatternCategory" NOT NULL,
    "qnaKey" TEXT,
    "flagKey" TEXT,
    "textBlock" TEXT NOT NULL,
    "characterCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SummaryPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ModerationQueueItem" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "aiSummary" TEXT,
    "status" "public"."QueueStatus" NOT NULL DEFAULT 'OPEN',
    "assignedAdminId" TEXT,
    "sgkDocUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT date_trunc('day'::text, (now() AT TIME ZONE 'UTC'::text)),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ModerationQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RivalAnalyticsPurchase" (
    "id" TEXT NOT NULL,
    "requestingCompanyId" TEXT NOT NULL,
    "requestingUserId" TEXT NOT NULL,
    "targetCompanyId" TEXT NOT NULL,
    "status" "public"."RivalAnalyticsPurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RivalAnalyticsPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InvestorApiKey" (
    "id" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "InvestorApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyLoginId" TEXT,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyLogin" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyLogin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SocialPost" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pinnedAt" TIMESTAMP(3),
    "editedAt" TIMESTAMP(3),
    "kind" "public"."SocialPostKind" NOT NULL DEFAULT 'PHOTO',
    "title" TEXT,
    "eventStartsAt" TIMESTAMP(3),
    "eventLocation" TEXT,
    "pollEndsAt" TIMESTAMP(3),
    "jobPostingId" TEXT,
    "imageAspectRatios" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "viewCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanySocialDay" (
    "companyId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "postViews" INTEGER NOT NULL DEFAULT 0,
    "followersGained" INTEGER NOT NULL DEFAULT 0,
    "followersLost" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CompanySocialDay_pkey" PRIMARY KEY ("companyId","day")
);

-- CreateTable
CREATE TABLE "public"."ScheduledSocialPost" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "publishAt" TIMESTAMP(3) NOT NULL,
    "status" "public"."ScheduledSocialPostStatus" NOT NULL DEFAULT 'SCHEDULED',
    "payload" JSONB NOT NULL,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imageAspectRatios" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledSocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SocialPollOption" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "SocialPollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SocialPollVote" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialPollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SocialComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parentCommentId" TEXT,
    "identityMode" "public"."CommentIdentityMode" NOT NULL DEFAULT 'PERSONAL_CHOSEN',
    "randomUsername" TEXT,
    "flaggedForReview" BOOLEAN NOT NULL DEFAULT false,
    "flaggedReviewReason" TEXT,

    CONSTRAINT "SocialComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SocialCommentIdentityLock" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "identityMode" "public"."CommentIdentityMode" NOT NULL,
    "randomUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialCommentIdentityLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SocialCommentReport" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "reporterId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialCommentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyReport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reporterId" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissedAt" TIMESTAMP(3),

    CONSTRAINT "CompanyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SocialCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialCommentVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SocialPostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT,
    "reaction" "public"."SocialReaction" NOT NULL DEFAULT 'LIKE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialPostLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SocialQuestion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "workType" "public"."WorkplaceType",
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "identityMode" "public"."CommentIdentityMode" NOT NULL DEFAULT 'PERSONAL_CHOSEN',
    "randomUsername" TEXT,
    "visibility" "public"."SocialQuestionVisibility" NOT NULL DEFAULT 'PUBLIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "flaggedForReview" BOOLEAN NOT NULL DEFAULT false,
    "flaggedReviewReason" TEXT,

    CONSTRAINT "SocialQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SocialAnswer" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "identityMode" "public"."CommentIdentityMode" NOT NULL DEFAULT 'PERSONAL_CHOSEN',
    "randomUsername" TEXT,
    "workedThere" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "flaggedForReview" BOOLEAN NOT NULL DEFAULT false,
    "flaggedReviewReason" TEXT,

    CONSTRAINT "SocialAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SocialAnswerVote" (
    "id" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialAnswerVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SocialQuestionReport" (
    "id" TEXT NOT NULL,
    "questionId" TEXT,
    "answerId" TEXT,
    "reporterId" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialQuestionReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyFollow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserFollow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SavedPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationRead" (
    "userId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRead_pkey" PRIMARY KEY ("userId","notificationId")
);

-- CreateTable
CREATE TABLE "public"."SavedJobPosting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedJobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrafficLog" (
    "id" TEXT NOT NULL,
    "encIp" BYTEA NOT NULL,
    "ipHash" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrafficLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pii"."PiiVault" (
    "userId" TEXT NOT NULL,
    "encFirstName" BYTEA NOT NULL,
    "encLastName" BYTEA NOT NULL,
    "encTcKimlikNo" BYTEA,
    "tcKimlikNoHash" TEXT,
    "encBirthDate" BYTEA NOT NULL,
    "dekWrapped" BYTEA NOT NULL,
    "dekVersion" INTEGER NOT NULL DEFAULT 1,
    "tcknPurgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PiiVault_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "pii"."EmployerProfile" (
    "userId" TEXT NOT NULL,
    "encFirstName" BYTEA,
    "encLastName" BYTEA,
    "encPhoneNumber" BYTEA,
    "encAddress" BYTEA,
    "encWorkAddress" BYTEA,
    "encTcKimlikNo" BYTEA,
    "tcKimlikNoHash" TEXT,
    "profilePictureUrl" TEXT,
    "dekWrapped" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployerProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "public"."SalarySubmission" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "monthlyNetSalary" INTEGER,
    "benefits" "public"."BenefitKey"[],
    "salaryYear" INTEGER NOT NULL,
    "kvkkCommercialConsent" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT date_trunc('day'::text, (now() AT TIME ZONE 'UTC'::text)),

    CONSTRAINT "SalarySubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HrAnalyticsReportJob" (
    "id" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "public"."HrAnalyticsReportStatus" NOT NULL DEFAULT 'QUEUED',
    "access" "public"."HrAnalyticsReportAccess" NOT NULL,
    "quotaMonth" TEXT,
    "retryOfJobId" TEXT,
    "pdf" BYTEA,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "HrAnalyticsReportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BenchmarkReportJob" (
    "id" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sectorCategory" TEXT NOT NULL,
    "city" TEXT,
    "status" "public"."BenchmarkReportStatus" NOT NULL DEFAULT 'QUEUED',
    "pdf" BYTEA,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "BenchmarkReportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_providerSubId_key" ON "public"."User"("providerSubId");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumberHash_key" ON "public"."User"("phoneNumberHash");

-- CreateIndex
CREATE INDEX "User_sectorId_idx" ON "public"."User"("sectorId");

-- CreateIndex
CREATE INDEX "AdminLoginOtpChallenge_userId_idx" ON "public"."AdminLoginOtpChallenge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySuggestionDismissal_nameKey_key" ON "public"."CompanySuggestionDismissal"("nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "public"."Skill"("name");

-- CreateIndex
CREATE INDEX "UserSkill_skillId_idx" ON "public"."UserSkill"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSkill_userId_skillId_key" ON "public"."UserSkill"("userId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "Sector_value_key" ON "public"."Sector"("value");

-- CreateIndex
CREATE INDEX "MemberReference_userId_idx" ON "public"."MemberReference"("userId");

-- CreateIndex
CREATE INDEX "MemberCertificate_userId_idx" ON "public"."MemberCertificate"("userId");

-- CreateIndex
CREATE INDEX "EducationHistory_userId_idx" ON "public"."EducationHistory"("userId");

-- CreateIndex
CREATE INDEX "EmploymentHistory_userId_idx" ON "public"."EmploymentHistory"("userId");

-- CreateIndex
CREATE INDEX "EmploymentHistory_companyId_idx" ON "public"."EmploymentHistory"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "public"."Company"("slug");

-- CreateIndex
CREATE INDEX "Company_name_idx" ON "public"."Company"("name");

-- CreateIndex
CREATE INDEX "Company_city_idx" ON "public"."Company"("city");

-- CreateIndex
CREATE INDEX "Company_district_idx" ON "public"."Company"("district");

-- CreateIndex
CREATE INDEX "Company_hiddenAt_idx" ON "public"."Company"("hiddenAt");

-- CreateIndex
CREATE INDEX "CompanyOwner_claimStatus_idx" ON "public"."CompanyOwner"("claimStatus");

-- CreateIndex
CREATE INDEX "CompanyOwner_companyId_claimStatus_idx" ON "public"."CompanyOwner"("companyId", "claimStatus");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyOwner_userId_companyId_key" ON "public"."CompanyOwner"("userId", "companyId");

-- CreateIndex
CREATE INDEX "JobPosting_companyId_idx" ON "public"."JobPosting"("companyId");

-- CreateIndex
CREATE INDEX "JobPosting_createdByUserId_idx" ON "public"."JobPosting"("createdByUserId");

-- CreateIndex
CREATE INDEX "JobPosting_companyId_jobTitle_workType_idx" ON "public"."JobPosting"("companyId", "jobTitle", "workType");

-- CreateIndex
CREATE INDEX "JobPosting_status_idx" ON "public"."JobPosting"("status");

-- CreateIndex
CREATE INDEX "JobApplication_companyId_idx" ON "public"."JobApplication"("companyId");

-- CreateIndex
CREATE INDEX "JobApplication_jobPostingId_idx" ON "public"."JobApplication"("jobPostingId");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_jobPostingId_applicantUserId_key" ON "public"."JobApplication"("jobPostingId", "applicantUserId");

-- CreateIndex
CREATE INDEX "OwnerContactMessage_companyId_idx" ON "public"."OwnerContactMessage"("companyId");

-- CreateIndex
CREATE INDEX "OwnerContactMessage_resolvedAt_idx" ON "public"."OwnerContactMessage"("resolvedAt");

-- CreateIndex
CREATE INDEX "Review_companyId_idx" ON "public"."Review"("companyId");

-- CreateIndex
CREATE INDEX "Review_companyId_district_idx" ON "public"."Review"("companyId", "district");

-- CreateIndex
CREATE INDEX "Review_companyId_city_idx" ON "public"."Review"("companyId", "city");

-- CreateIndex
CREATE INDEX "Review_companyId_workplaceType_status_publishedAt_idx" ON "public"."Review"("companyId", "workplaceType", "status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_companyId_key" ON "public"."Review"("userId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewVote_reviewId_userId_key" ON "public"."ReviewVote"("reviewId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyReply_reviewId_key" ON "public"."CompanyReply"("reviewId");

-- CreateIndex
CREATE INDEX "CompanyReply_companyId_idx" ON "public"."CompanyReply"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewConversation_reviewId_key" ON "public"."ReviewConversation"("reviewId");

-- CreateIndex
CREATE INDEX "ReviewConversation_companyId_idx" ON "public"."ReviewConversation"("companyId");

-- CreateIndex
CREATE INDEX "ReviewConversation_reviewerUserId_idx" ON "public"."ReviewConversation"("reviewerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewConversationMessage_seq_key" ON "public"."ReviewConversationMessage"("seq");

-- CreateIndex
CREATE INDEX "ReviewConversationMessage_conversationId_seq_idx" ON "public"."ReviewConversationMessage"("conversationId", "seq");

-- CreateIndex
CREATE INDEX "CompanyNarrative_companyId_idx" ON "public"."CompanyNarrative"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyNarrative_companyId_workplaceType_key" ON "public"."CompanyNarrative"("companyId", "workplaceType");

-- CreateIndex
CREATE INDEX "SummaryPattern_workplaceType_category_qnaKey_idx" ON "public"."SummaryPattern"("workplaceType", "category", "qnaKey");

-- CreateIndex
CREATE INDEX "SummaryPattern_workplaceType_category_flagKey_idx" ON "public"."SummaryPattern"("workplaceType", "category", "flagKey");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationQueueItem_reviewId_key" ON "public"."ModerationQueueItem"("reviewId");

-- CreateIndex
CREATE INDEX "ModerationQueueItem_status_idx" ON "public"."ModerationQueueItem"("status");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "public"."AuditLog"("actorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "InvestorApiKey_keyHash_key" ON "public"."InvestorApiKey"("keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "public"."RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "public"."RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_companyLoginId_idx" ON "public"."RefreshToken"("companyLoginId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyLogin_companyId_key" ON "public"."CompanyLogin"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyLogin_email_key" ON "public"."CompanyLogin"("email");

-- CreateIndex
CREATE INDEX "CompanyLogin_ownerUserId_idx" ON "public"."CompanyLogin"("ownerUserId");

-- CreateIndex
CREATE INDEX "SocialPost_companyId_idx" ON "public"."SocialPost"("companyId");

-- CreateIndex
CREATE INDEX "SocialPost_authorUserId_idx" ON "public"."SocialPost"("authorUserId");

-- CreateIndex
CREATE INDEX "SocialPost_createdAt_idx" ON "public"."SocialPost"("createdAt");

-- CreateIndex
CREATE INDEX "SocialPost_jobPostingId_idx" ON "public"."SocialPost"("jobPostingId");

-- CreateIndex
CREATE INDEX "ScheduledSocialPost_status_publishAt_idx" ON "public"."ScheduledSocialPost"("status", "publishAt");

-- CreateIndex
CREATE INDEX "ScheduledSocialPost_companyId_idx" ON "public"."ScheduledSocialPost"("companyId");

-- CreateIndex
CREATE INDEX "ScheduledSocialPost_authorUserId_idx" ON "public"."ScheduledSocialPost"("authorUserId");

-- CreateIndex
CREATE INDEX "SocialPollOption_postId_idx" ON "public"."SocialPollOption"("postId");

-- CreateIndex
CREATE INDEX "SocialPollVote_optionId_idx" ON "public"."SocialPollVote"("optionId");

-- CreateIndex
CREATE INDEX "SocialPollVote_userId_idx" ON "public"."SocialPollVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialPollVote_postId_userId_key" ON "public"."SocialPollVote"("postId", "userId");

-- CreateIndex
CREATE INDEX "SocialComment_postId_idx" ON "public"."SocialComment"("postId");

-- CreateIndex
CREATE INDEX "SocialComment_authorUserId_idx" ON "public"."SocialComment"("authorUserId");

-- CreateIndex
CREATE INDEX "SocialComment_parentCommentId_idx" ON "public"."SocialComment"("parentCommentId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialCommentIdentityLock_postId_userId_key" ON "public"."SocialCommentIdentityLock"("postId", "userId");

-- CreateIndex
CREATE INDEX "SocialCommentReport_commentId_idx" ON "public"."SocialCommentReport"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialCommentReport_commentId_reporterId_key" ON "public"."SocialCommentReport"("commentId", "reporterId");

-- CreateIndex
CREATE INDEX "CompanyReport_companyId_idx" ON "public"."CompanyReport"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyReport_companyId_reporterId_key" ON "public"."CompanyReport"("companyId", "reporterId");

-- CreateIndex
CREATE INDEX "SocialCommentVote_userId_idx" ON "public"."SocialCommentVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialCommentVote_commentId_userId_key" ON "public"."SocialCommentVote"("commentId", "userId");

-- CreateIndex
CREATE INDEX "SocialPostLike_userId_idx" ON "public"."SocialPostLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialPostLike_postId_userId_key" ON "public"."SocialPostLike"("postId", "userId");

-- CreateIndex
CREATE INDEX "SocialQuestion_companyId_visibility_idx" ON "public"."SocialQuestion"("companyId", "visibility");

-- CreateIndex
CREATE INDEX "SocialQuestion_workType_idx" ON "public"."SocialQuestion"("workType");

-- CreateIndex
CREATE INDEX "SocialQuestion_authorUserId_idx" ON "public"."SocialQuestion"("authorUserId");

-- CreateIndex
CREATE INDEX "SocialQuestion_createdAt_idx" ON "public"."SocialQuestion"("createdAt");

-- CreateIndex
CREATE INDEX "SocialAnswer_questionId_idx" ON "public"."SocialAnswer"("questionId");

-- CreateIndex
CREATE INDEX "SocialAnswer_authorUserId_idx" ON "public"."SocialAnswer"("authorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAnswer_questionId_authorUserId_key" ON "public"."SocialAnswer"("questionId", "authorUserId");

-- CreateIndex
CREATE INDEX "SocialAnswerVote_userId_idx" ON "public"."SocialAnswerVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAnswerVote_answerId_userId_key" ON "public"."SocialAnswerVote"("answerId", "userId");

-- CreateIndex
CREATE INDEX "SocialQuestionReport_questionId_idx" ON "public"."SocialQuestionReport"("questionId");

-- CreateIndex
CREATE INDEX "SocialQuestionReport_answerId_idx" ON "public"."SocialQuestionReport"("answerId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialQuestionReport_questionId_reporterId_key" ON "public"."SocialQuestionReport"("questionId", "reporterId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialQuestionReport_answerId_reporterId_key" ON "public"."SocialQuestionReport"("answerId", "reporterId");

-- CreateIndex
CREATE INDEX "CompanyFollow_companyId_idx" ON "public"."CompanyFollow"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyFollow_userId_companyId_key" ON "public"."CompanyFollow"("userId", "companyId");

-- CreateIndex
CREATE INDEX "UserFollow_followingId_idx" ON "public"."UserFollow"("followingId");

-- CreateIndex
CREATE UNIQUE INDEX "UserFollow_followerId_followingId_key" ON "public"."UserFollow"("followerId", "followingId");

-- CreateIndex
CREATE INDEX "SavedPost_postId_idx" ON "public"."SavedPost"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedPost_userId_postId_key" ON "public"."SavedPost"("userId", "postId");

-- CreateIndex
CREATE INDEX "SavedJobPosting_jobPostingId_idx" ON "public"."SavedJobPosting"("jobPostingId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedJobPosting_userId_jobPostingId_key" ON "public"."SavedJobPosting"("userId", "jobPostingId");

-- CreateIndex
CREATE INDEX "TrafficLog_createdAt_idx" ON "public"."TrafficLog"("createdAt");

-- CreateIndex
CREATE INDEX "TrafficLog_ipHash_idx" ON "public"."TrafficLog"("ipHash");

-- CreateIndex
CREATE UNIQUE INDEX "PiiVault_tcKimlikNoHash_key" ON "pii"."PiiVault"("tcKimlikNoHash");

-- CreateIndex
CREATE UNIQUE INDEX "EmployerProfile_tcKimlikNoHash_key" ON "pii"."EmployerProfile"("tcKimlikNoHash");

-- CreateIndex
CREATE UNIQUE INDEX "SalarySubmission_reviewId_key" ON "public"."SalarySubmission"("reviewId");

-- CreateIndex
CREATE INDEX "SalarySubmission_companyId_salaryYear_idx" ON "public"."SalarySubmission"("companyId", "salaryYear");

-- CreateIndex
CREATE UNIQUE INDEX "HrAnalyticsReportJob_retryOfJobId_key" ON "public"."HrAnalyticsReportJob"("retryOfJobId");

-- CreateIndex
CREATE INDEX "HrAnalyticsReportJob_status_createdAt_idx" ON "public"."HrAnalyticsReportJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "HrAnalyticsReportJob_companyId_createdAt_idx" ON "public"."HrAnalyticsReportJob"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrAnalyticsReportJob_companyId_quotaMonth_key" ON "public"."HrAnalyticsReportJob"("companyId", "quotaMonth");

-- CreateIndex
CREATE INDEX "BenchmarkReportJob_status_createdAt_idx" ON "public"."BenchmarkReportJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BenchmarkReportJob_companyId_createdAt_idx" ON "public"."BenchmarkReportJob"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "BenchmarkReportJob_requestedByUserId_status_idx" ON "public"."BenchmarkReportJob"("requestedByUserId", "status");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "public"."Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PhoneOtpChallenge" ADD CONSTRAINT "PhoneOtpChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AdminLoginOtpChallenge" ADD CONSTRAINT "AdminLoginOtpChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserSkill" ADD CONSTRAINT "UserSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserSkill" ADD CONSTRAINT "UserSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "public"."Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberReference" ADD CONSTRAINT "MemberReference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MemberCertificate" ADD CONSTRAINT "MemberCertificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EducationHistory" ADD CONSTRAINT "EducationHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmploymentHistory" ADD CONSTRAINT "EmploymentHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmploymentHistory" ADD CONSTRAINT "EmploymentHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyOwner" ADD CONSTRAINT "CompanyOwner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyOwner" ADD CONSTRAINT "CompanyOwner_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobPosting" ADD CONSTRAINT "JobPosting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobPosting" ADD CONSTRAINT "JobPosting_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobApplication" ADD CONSTRAINT "JobApplication_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "public"."JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobApplication" ADD CONSTRAINT "JobApplication_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobApplication" ADD CONSTRAINT "JobApplication_applicantUserId_fkey" FOREIGN KEY ("applicantUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OwnerContactMessage" ADD CONSTRAINT "OwnerContactMessage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OwnerContactMessage" ADD CONSTRAINT "OwnerContactMessage_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Review" ADD CONSTRAINT "Review_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Review" ADD CONSTRAINT "Review_employmentHistoryId_fkey" FOREIGN KEY ("employmentHistoryId") REFERENCES "public"."EmploymentHistory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewVote" ADD CONSTRAINT "ReviewVote_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "public"."Review"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewVote" ADD CONSTRAINT "ReviewVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyReply" ADD CONSTRAINT "CompanyReply_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "public"."Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyReply" ADD CONSTRAINT "CompanyReply_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyReply" ADD CONSTRAINT "CompanyReply_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewConversation" ADD CONSTRAINT "ReviewConversation_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "public"."Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewConversation" ADD CONSTRAINT "ReviewConversation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewConversation" ADD CONSTRAINT "ReviewConversation_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewConversationMessage" ADD CONSTRAINT "ReviewConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."ReviewConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewConversationMessage" ADD CONSTRAINT "ReviewConversationMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyAggregateScore" ADD CONSTRAINT "CompanyAggregateScore_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyNarrative" ADD CONSTRAINT "CompanyNarrative_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ModerationQueueItem" ADD CONSTRAINT "ModerationQueueItem_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "public"."Review"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RefreshToken" ADD CONSTRAINT "RefreshToken_companyLoginId_fkey" FOREIGN KEY ("companyLoginId") REFERENCES "public"."CompanyLogin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyLogin" ADD CONSTRAINT "CompanyLogin_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyLogin" ADD CONSTRAINT "CompanyLogin_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialPost" ADD CONSTRAINT "SocialPost_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialPost" ADD CONSTRAINT "SocialPost_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialPost" ADD CONSTRAINT "SocialPost_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "public"."JobPosting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanySocialDay" ADD CONSTRAINT "CompanySocialDay_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScheduledSocialPost" ADD CONSTRAINT "ScheduledSocialPost_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScheduledSocialPost" ADD CONSTRAINT "ScheduledSocialPost_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialPollOption" ADD CONSTRAINT "SocialPollOption_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialPollVote" ADD CONSTRAINT "SocialPollVote_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialPollVote" ADD CONSTRAINT "SocialPollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "public"."SocialPollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialPollVote" ADD CONSTRAINT "SocialPollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialComment" ADD CONSTRAINT "SocialComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialComment" ADD CONSTRAINT "SocialComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialComment" ADD CONSTRAINT "SocialComment_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "public"."SocialComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialCommentIdentityLock" ADD CONSTRAINT "SocialCommentIdentityLock_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialCommentIdentityLock" ADD CONSTRAINT "SocialCommentIdentityLock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialCommentReport" ADD CONSTRAINT "SocialCommentReport_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."SocialComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialCommentReport" ADD CONSTRAINT "SocialCommentReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyReport" ADD CONSTRAINT "CompanyReport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyReport" ADD CONSTRAINT "CompanyReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialCommentVote" ADD CONSTRAINT "SocialCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "public"."SocialComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialCommentVote" ADD CONSTRAINT "SocialCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialPostLike" ADD CONSTRAINT "SocialPostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialPostLike" ADD CONSTRAINT "SocialPostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialQuestion" ADD CONSTRAINT "SocialQuestion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialQuestion" ADD CONSTRAINT "SocialQuestion_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialAnswer" ADD CONSTRAINT "SocialAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."SocialQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialAnswer" ADD CONSTRAINT "SocialAnswer_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialAnswerVote" ADD CONSTRAINT "SocialAnswerVote_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "public"."SocialAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialAnswerVote" ADD CONSTRAINT "SocialAnswerVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialQuestionReport" ADD CONSTRAINT "SocialQuestionReport_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "public"."SocialQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialQuestionReport" ADD CONSTRAINT "SocialQuestionReport_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "public"."SocialAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SocialQuestionReport" ADD CONSTRAINT "SocialQuestionReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyFollow" ADD CONSTRAINT "CompanyFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyFollow" ADD CONSTRAINT "CompanyFollow_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserFollow" ADD CONSTRAINT "UserFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserFollow" ADD CONSTRAINT "UserFollow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SavedPost" ADD CONSTRAINT "SavedPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SavedPost" ADD CONSTRAINT "SavedPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."SocialPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NotificationRead" ADD CONSTRAINT "NotificationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SavedJobPosting" ADD CONSTRAINT "SavedJobPosting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SavedJobPosting" ADD CONSTRAINT "SavedJobPosting_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "public"."JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pii"."EmployerProfile" ADD CONSTRAINT "EmployerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalarySubmission" ADD CONSTRAINT "SalarySubmission_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "public"."Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HrAnalyticsReportJob" ADD CONSTRAINT "HrAnalyticsReportJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BenchmarkReportJob" ADD CONSTRAINT "BenchmarkReportJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


import { z } from "zod";
export declare const ownerClaimStatusSchema: z.ZodEnum<["PENDING", "APPROVED", "REJECTED"]>;
export type OwnerClaimStatus = z.infer<typeof ownerClaimStatusSchema>;
export declare const claimCompanyInputSchema: z.ZodObject<{
    message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    message?: string | undefined;
}, {
    message?: string | undefined;
}>;
export type ClaimCompanyInput = z.infer<typeof claimCompanyInputSchema>;
export declare const rivalAnalyticsTierSchema: z.ZodEnum<["STARTER", "PRO", "ENTERPRISE"]>;
export type RivalAnalyticsTier = z.infer<typeof rivalAnalyticsTierSchema>;
export declare const myCompanyClaimSchema: z.ZodObject<{
    id: z.ZodString;
    companyId: z.ZodString;
    companyName: z.ZodString;
    companySlug: z.ZodString;
    tier: z.ZodEnum<["FREE", "BLUE", "BLUE_PLUS", "ENTERPRISE"]>;
    planStatus: z.ZodEnum<["NONE", "ACTIVE", "PAST_DUE", "CANCELED"]>;
    isVerifiedBadge: z.ZodBoolean;
    claimStatus: z.ZodEnum<["PENDING", "APPROVED", "REJECTED"]>;
    createdAt: z.ZodString;
    resolvedAt: z.ZodNullable<z.ZodString>;
    rivalAnalyticsTier: z.ZodNullable<z.ZodEnum<["STARTER", "PRO", "ENTERPRISE"]>>;
    rivalAnalyticsFreeRequestUsed: z.ZodBoolean;
    hidden: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    companyId: string;
    companyName: string;
    isVerifiedBadge: boolean;
    hidden: boolean;
    companySlug: string;
    tier: "BLUE" | "BLUE_PLUS" | "ENTERPRISE" | "FREE";
    planStatus: "ACTIVE" | "NONE" | "PAST_DUE" | "CANCELED";
    claimStatus: "REJECTED" | "APPROVED" | "PENDING";
    resolvedAt: string | null;
    rivalAnalyticsTier: "ENTERPRISE" | "STARTER" | "PRO" | null;
    rivalAnalyticsFreeRequestUsed: boolean;
}, {
    id: string;
    createdAt: string;
    companyId: string;
    companyName: string;
    isVerifiedBadge: boolean;
    hidden: boolean;
    companySlug: string;
    tier: "BLUE" | "BLUE_PLUS" | "ENTERPRISE" | "FREE";
    planStatus: "ACTIVE" | "NONE" | "PAST_DUE" | "CANCELED";
    claimStatus: "REJECTED" | "APPROVED" | "PENDING";
    resolvedAt: string | null;
    rivalAnalyticsTier: "ENTERPRISE" | "STARTER" | "PRO" | null;
    rivalAnalyticsFreeRequestUsed: boolean;
}>;
export type MyCompanyClaim = z.infer<typeof myCompanyClaimSchema>;
export declare const adminOwnerClaimSchema: z.ZodObject<{
    id: z.ZodString;
    companyId: z.ZodString;
    companyName: z.ZodString;
    claimantUserId: z.ZodString;
    claimantEmail: z.ZodNullable<z.ZodString>;
    claimMessage: z.ZodNullable<z.ZodString>;
    claimStatus: z.ZodEnum<["PENDING", "APPROVED", "REJECTED"]>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    companyId: string;
    companyName: string;
    claimStatus: "REJECTED" | "APPROVED" | "PENDING";
    claimantUserId: string;
    claimantEmail: string | null;
    claimMessage: string | null;
}, {
    id: string;
    createdAt: string;
    companyId: string;
    companyName: string;
    claimStatus: "REJECTED" | "APPROVED" | "PENDING";
    claimantUserId: string;
    claimantEmail: string | null;
    claimMessage: string | null;
}>;
export type AdminOwnerClaim = z.infer<typeof adminOwnerClaimSchema>;
export declare const updateCompanyInputSchema: z.ZodEffects<z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    workplaceTypes: z.ZodOptional<z.ZodArray<z.ZodEnum<["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]>, "many">>;
    mainPhotoUrl: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    city: z.ZodOptional<z.ZodString>;
    district: z.ZodOptional<z.ZodString>;
    contactEmail: z.ZodOptional<z.ZodString>;
    contactPhone: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    facebookUrl: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    instagramUrl: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    whatsappUrl: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    xUrl: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    isHiring: z.ZodOptional<z.ZodBoolean>;
    linkedinUrl: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    youtubeUrl: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    glassdoorUrl: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    description: z.ZodOptional<z.ZodString>;
    website: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    bannerImageUrl: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    featuredReviewId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    city?: string | undefined;
    district?: string | undefined;
    description?: string | undefined;
    name?: string | undefined;
    category?: string | undefined;
    workplaceTypes?: ("OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR")[] | undefined;
    mainPhotoUrl?: string | undefined;
    website?: string | undefined;
    isHiring?: boolean | undefined;
    contactEmail?: string | undefined;
    contactPhone?: string | undefined;
    facebookUrl?: string | undefined;
    instagramUrl?: string | undefined;
    whatsappUrl?: string | undefined;
    xUrl?: string | undefined;
    linkedinUrl?: string | undefined;
    youtubeUrl?: string | undefined;
    glassdoorUrl?: string | undefined;
    bannerImageUrl?: string | undefined;
    featuredReviewId?: string | null | undefined;
}, {
    city?: string | undefined;
    district?: string | undefined;
    description?: string | undefined;
    name?: string | undefined;
    category?: string | undefined;
    workplaceTypes?: ("OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR")[] | undefined;
    mainPhotoUrl?: string | undefined;
    website?: string | undefined;
    isHiring?: boolean | undefined;
    contactEmail?: string | undefined;
    contactPhone?: string | undefined;
    facebookUrl?: string | undefined;
    instagramUrl?: string | undefined;
    whatsappUrl?: string | undefined;
    xUrl?: string | undefined;
    linkedinUrl?: string | undefined;
    youtubeUrl?: string | undefined;
    glassdoorUrl?: string | undefined;
    bannerImageUrl?: string | undefined;
    featuredReviewId?: string | null | undefined;
}>, {
    city?: string | undefined;
    district?: string | undefined;
    description?: string | undefined;
    name?: string | undefined;
    category?: string | undefined;
    workplaceTypes?: ("OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR")[] | undefined;
    mainPhotoUrl?: string | undefined;
    website?: string | undefined;
    isHiring?: boolean | undefined;
    contactEmail?: string | undefined;
    contactPhone?: string | undefined;
    facebookUrl?: string | undefined;
    instagramUrl?: string | undefined;
    whatsappUrl?: string | undefined;
    xUrl?: string | undefined;
    linkedinUrl?: string | undefined;
    youtubeUrl?: string | undefined;
    glassdoorUrl?: string | undefined;
    bannerImageUrl?: string | undefined;
    featuredReviewId?: string | null | undefined;
}, {
    city?: string | undefined;
    district?: string | undefined;
    description?: string | undefined;
    name?: string | undefined;
    category?: string | undefined;
    workplaceTypes?: ("OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR")[] | undefined;
    mainPhotoUrl?: string | undefined;
    website?: string | undefined;
    isHiring?: boolean | undefined;
    contactEmail?: string | undefined;
    contactPhone?: string | undefined;
    facebookUrl?: string | undefined;
    instagramUrl?: string | undefined;
    whatsappUrl?: string | undefined;
    xUrl?: string | undefined;
    linkedinUrl?: string | undefined;
    youtubeUrl?: string | undefined;
    glassdoorUrl?: string | undefined;
    bannerImageUrl?: string | undefined;
    featuredReviewId?: string | null | undefined;
}>;
export type UpdateCompanyInput = z.infer<typeof updateCompanyInputSchema>;
export declare const contactAdminInputSchema: z.ZodObject<{
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
}, {
    message: string;
}>;
export type ContactAdminInput = z.infer<typeof contactAdminInputSchema>;
export declare const ownerContactMessageSchema: z.ZodObject<{
    id: z.ZodString;
    companyId: z.ZodString;
    companyName: z.ZodString;
    ownerEmail: z.ZodNullable<z.ZodString>;
    message: z.ZodString;
    createdAt: z.ZodString;
    resolvedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    message: string;
    id: string;
    createdAt: string;
    companyId: string;
    companyName: string;
    resolvedAt: string | null;
    ownerEmail: string | null;
}, {
    message: string;
    id: string;
    createdAt: string;
    companyId: string;
    companyName: string;
    resolvedAt: string | null;
    ownerEmail: string | null;
}>;
export type OwnerContactMessage = z.infer<typeof ownerContactMessageSchema>;
export declare const ownedCompanySchema: z.ZodObject<{
    companyId: z.ZodString;
    companyName: z.ZodString;
    companySlug: z.ZodString;
    tier: z.ZodEnum<["FREE", "BLUE", "BLUE_PLUS", "ENTERPRISE"]>;
    planStatus: z.ZodEnum<["NONE", "ACTIVE", "PAST_DUE", "CANCELED"]>;
    isVerifiedBadge: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    companyId: string;
    companyName: string;
    isVerifiedBadge: boolean;
    companySlug: string;
    tier: "BLUE" | "BLUE_PLUS" | "ENTERPRISE" | "FREE";
    planStatus: "ACTIVE" | "NONE" | "PAST_DUE" | "CANCELED";
}, {
    companyId: string;
    companyName: string;
    isVerifiedBadge: boolean;
    companySlug: string;
    tier: "BLUE" | "BLUE_PLUS" | "ENTERPRISE" | "FREE";
    planStatus: "ACTIVE" | "NONE" | "PAST_DUE" | "CANCELED";
}>;
export type OwnedCompany = z.infer<typeof ownedCompanySchema>;
export declare const plusCheckoutResultSchema: z.ZodObject<{
    checkoutFormContent: z.ZodString;
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    checkoutFormContent: string;
    token: string;
}, {
    checkoutFormContent: string;
    token: string;
}>;
export type PlusCheckoutResult = z.infer<typeof plusCheckoutResultSchema>;
export declare const rivalAnalyticsRequestInputSchema: z.ZodObject<{
    requestingCompanyId: z.ZodString;
    billing: z.ZodOptional<z.ZodObject<{
        buyerName: z.ZodString;
        buyerSurname: z.ZodString;
        buyerIdentityNumber: z.ZodString;
        buyerEmail: z.ZodString;
        buyerGsmNumber: z.ZodOptional<z.ZodString>;
        billingAddress: z.ZodObject<{
            contactName: z.ZodString;
            city: z.ZodString;
            country: z.ZodString;
            address: z.ZodString;
            zipCode: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            city: string;
            country: string;
            contactName: string;
            address: string;
            zipCode?: string | undefined;
        }, {
            city: string;
            country: string;
            contactName: string;
            address: string;
            zipCode?: string | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        buyerName: string;
        buyerSurname: string;
        buyerIdentityNumber: string;
        buyerEmail: string;
        billingAddress: {
            city: string;
            country: string;
            contactName: string;
            address: string;
            zipCode?: string | undefined;
        };
        buyerGsmNumber?: string | undefined;
    }, {
        buyerName: string;
        buyerSurname: string;
        buyerIdentityNumber: string;
        buyerEmail: string;
        billingAddress: {
            city: string;
            country: string;
            contactName: string;
            address: string;
            zipCode?: string | undefined;
        };
        buyerGsmNumber?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    requestingCompanyId: string;
    billing?: {
        buyerName: string;
        buyerSurname: string;
        buyerIdentityNumber: string;
        buyerEmail: string;
        billingAddress: {
            city: string;
            country: string;
            contactName: string;
            address: string;
            zipCode?: string | undefined;
        };
        buyerGsmNumber?: string | undefined;
    } | undefined;
}, {
    requestingCompanyId: string;
    billing?: {
        buyerName: string;
        buyerSurname: string;
        buyerIdentityNumber: string;
        buyerEmail: string;
        billingAddress: {
            city: string;
            country: string;
            contactName: string;
            address: string;
            zipCode?: string | undefined;
        };
        buyerGsmNumber?: string | undefined;
    } | undefined;
}>;
export type RivalAnalyticsRequestInput = z.infer<typeof rivalAnalyticsRequestInputSchema>;
export declare const rivalAnalyticsRequestResultSchema: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
    status: z.ZodLiteral<"SENT">;
    recipientEmail: z.ZodString;
    usedFreeCredit: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    status: "SENT";
    recipientEmail: string;
    usedFreeCredit: boolean;
}, {
    status: "SENT";
    recipientEmail: string;
    usedFreeCredit: boolean;
}>, z.ZodObject<{
    status: z.ZodLiteral<"PAYMENT_REQUIRED">;
    priceNote: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "PAYMENT_REQUIRED";
    priceNote: string;
}, {
    status: "PAYMENT_REQUIRED";
    priceNote: string;
}>, z.ZodObject<{
    status: z.ZodLiteral<"CHECKOUT_REQUIRED">;
    checkoutFormContent: z.ZodString;
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "CHECKOUT_REQUIRED";
    checkoutFormContent: string;
    token: string;
}, {
    status: "CHECKOUT_REQUIRED";
    checkoutFormContent: string;
    token: string;
}>]>;
export type RivalAnalyticsRequestResult = z.infer<typeof rivalAnalyticsRequestResultSchema>;

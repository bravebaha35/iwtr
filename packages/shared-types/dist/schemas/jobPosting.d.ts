import { z } from "zod";
export declare const jobPostingStatusSchema: z.ZodEnum<["PUBLISHED", "PENDING_ADMIN", "REJECTED", "FILLED"]>;
export type JobPostingStatus = z.infer<typeof jobPostingStatusSchema>;
export declare const boostDurationDaysSchema: z.ZodUnion<[z.ZodLiteral<7>, z.ZodLiteral<14>, z.ZodLiteral<21>]>;
export type BoostDurationDays = z.infer<typeof boostDurationDaysSchema>;
export declare const membershipTierKeySchema: z.ZodEnum<["free", "starter", "pro", "enterprise"]>;
export type MembershipTierKey = z.infer<typeof membershipTierKeySchema>;
export declare const jobPostingSchema: z.ZodObject<{
    id: z.ZodString;
    companyId: z.ZodString;
    jobTitle: z.ZodString;
    description: z.ZodString;
    workType: z.ZodNullable<z.ZodEnum<["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]>>;
    status: z.ZodEnum<["PUBLISHED", "PENDING_ADMIN", "REJECTED", "FILLED"]>;
    boostDurationDays: z.ZodNullable<z.ZodUnion<[z.ZodLiteral<7>, z.ZodLiteral<14>, z.ZodLiteral<21>]>>;
    boostExpiresAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "PUBLISHED" | "PENDING_ADMIN" | "REJECTED" | "FILLED";
    id: string;
    createdAt: string;
    companyId: string;
    jobTitle: string;
    description: string;
    workType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR" | null;
    boostDurationDays: 14 | 7 | 21 | null;
    boostExpiresAt: string | null;
}, {
    status: "PUBLISHED" | "PENDING_ADMIN" | "REJECTED" | "FILLED";
    id: string;
    createdAt: string;
    companyId: string;
    jobTitle: string;
    description: string;
    workType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR" | null;
    boostDurationDays: 14 | 7 | 21 | null;
    boostExpiresAt: string | null;
}>;
export type JobPosting = z.infer<typeof jobPostingSchema>;
export declare const publicJobPostingSchema: z.ZodObject<{
    id: z.ZodString;
    jobTitle: z.ZodString;
    description: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    jobTitle: string;
    description: string;
}, {
    id: string;
    jobTitle: string;
    description: string;
}>;
export type PublicJobPosting = z.infer<typeof publicJobPostingSchema>;
export declare const companyJobPostingsSchema: z.ZodObject<{
    jobPostings: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        jobTitle: z.ZodString;
        description: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        jobTitle: string;
        description: string;
    }, {
        id: string;
        jobTitle: string;
        description: string;
    }>, "many">;
    jobTitles: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    jobPostings: {
        id: string;
        jobTitle: string;
        description: string;
    }[];
    jobTitles: string[];
}, {
    jobPostings: {
        id: string;
        jobTitle: string;
        description: string;
    }[];
    jobTitles: string[];
}>;
export type CompanyJobPostings = z.infer<typeof companyJobPostingsSchema>;
export declare const createJobPostingInputSchema: z.ZodObject<{
    jobTitle: z.ZodString;
    description: z.ZodString;
    workType: z.ZodEnum<["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]>;
    autoReshareEnabled: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    boost: z.ZodNullable<z.ZodObject<{
        durationDays: z.ZodUnion<[z.ZodLiteral<7>, z.ZodLiteral<14>, z.ZodLiteral<21>]>;
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
        durationDays: 14 | 7 | 21;
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
        durationDays: 14 | 7 | 21;
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
    }>>;
}, "strip", z.ZodTypeAny, {
    jobTitle: string;
    description: string;
    workType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
    autoReshareEnabled: boolean;
    boost: {
        durationDays: 14 | 7 | 21;
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
    } | null;
}, {
    jobTitle: string;
    description: string;
    workType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
    boost: {
        durationDays: 14 | 7 | 21;
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
    } | null;
    autoReshareEnabled?: boolean | undefined;
}>;
export type CreateJobPostingInput = z.infer<typeof createJobPostingInputSchema>;
export declare const createJobPostingResultSchema: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
    status: z.ZodLiteral<"PUBLISHED">;
    jobPosting: z.ZodObject<{
        id: z.ZodString;
        companyId: z.ZodString;
        jobTitle: z.ZodString;
        description: z.ZodString;
        workType: z.ZodNullable<z.ZodEnum<["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]>>;
        status: z.ZodEnum<["PUBLISHED", "PENDING_ADMIN", "REJECTED", "FILLED"]>;
        boostDurationDays: z.ZodNullable<z.ZodUnion<[z.ZodLiteral<7>, z.ZodLiteral<14>, z.ZodLiteral<21>]>>;
        boostExpiresAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "PUBLISHED" | "PENDING_ADMIN" | "REJECTED" | "FILLED";
        id: string;
        createdAt: string;
        companyId: string;
        jobTitle: string;
        description: string;
        workType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR" | null;
        boostDurationDays: 14 | 7 | 21 | null;
        boostExpiresAt: string | null;
    }, {
        status: "PUBLISHED" | "PENDING_ADMIN" | "REJECTED" | "FILLED";
        id: string;
        createdAt: string;
        companyId: string;
        jobTitle: string;
        description: string;
        workType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR" | null;
        boostDurationDays: 14 | 7 | 21 | null;
        boostExpiresAt: string | null;
    }>;
}, "strip", z.ZodTypeAny, {
    status: "PUBLISHED";
    jobPosting: {
        status: "PUBLISHED" | "PENDING_ADMIN" | "REJECTED" | "FILLED";
        id: string;
        createdAt: string;
        companyId: string;
        jobTitle: string;
        description: string;
        workType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR" | null;
        boostDurationDays: 14 | 7 | 21 | null;
        boostExpiresAt: string | null;
    };
}, {
    status: "PUBLISHED";
    jobPosting: {
        status: "PUBLISHED" | "PENDING_ADMIN" | "REJECTED" | "FILLED";
        id: string;
        createdAt: string;
        companyId: string;
        jobTitle: string;
        description: string;
        workType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR" | null;
        boostDurationDays: 14 | 7 | 21 | null;
        boostExpiresAt: string | null;
    };
}>, z.ZodObject<{
    status: z.ZodLiteral<"PENDING_ADMIN">;
    jobPosting: z.ZodObject<{
        id: z.ZodString;
        companyId: z.ZodString;
        jobTitle: z.ZodString;
        description: z.ZodString;
        workType: z.ZodNullable<z.ZodEnum<["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]>>;
        status: z.ZodEnum<["PUBLISHED", "PENDING_ADMIN", "REJECTED", "FILLED"]>;
        boostDurationDays: z.ZodNullable<z.ZodUnion<[z.ZodLiteral<7>, z.ZodLiteral<14>, z.ZodLiteral<21>]>>;
        boostExpiresAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "PUBLISHED" | "PENDING_ADMIN" | "REJECTED" | "FILLED";
        id: string;
        createdAt: string;
        companyId: string;
        jobTitle: string;
        description: string;
        workType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR" | null;
        boostDurationDays: 14 | 7 | 21 | null;
        boostExpiresAt: string | null;
    }, {
        status: "PUBLISHED" | "PENDING_ADMIN" | "REJECTED" | "FILLED";
        id: string;
        createdAt: string;
        companyId: string;
        jobTitle: string;
        description: string;
        workType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR" | null;
        boostDurationDays: 14 | 7 | 21 | null;
        boostExpiresAt: string | null;
    }>;
}, "strip", z.ZodTypeAny, {
    status: "PENDING_ADMIN";
    jobPosting: {
        status: "PUBLISHED" | "PENDING_ADMIN" | "REJECTED" | "FILLED";
        id: string;
        createdAt: string;
        companyId: string;
        jobTitle: string;
        description: string;
        workType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR" | null;
        boostDurationDays: 14 | 7 | 21 | null;
        boostExpiresAt: string | null;
    };
}, {
    status: "PENDING_ADMIN";
    jobPosting: {
        status: "PUBLISHED" | "PENDING_ADMIN" | "REJECTED" | "FILLED";
        id: string;
        createdAt: string;
        companyId: string;
        jobTitle: string;
        description: string;
        workType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR" | null;
        boostDurationDays: 14 | 7 | 21 | null;
        boostExpiresAt: string | null;
    };
}>, z.ZodObject<{
    status: z.ZodLiteral<"CHECKOUT_REQUIRED">;
    jobPosting: z.ZodObject<{
        id: z.ZodString;
        companyId: z.ZodString;
        jobTitle: z.ZodString;
        description: z.ZodString;
        workType: z.ZodNullable<z.ZodEnum<["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]>>;
        status: z.ZodEnum<["PUBLISHED", "PENDING_ADMIN", "REJECTED", "FILLED"]>;
        boostDurationDays: z.ZodNullable<z.ZodUnion<[z.ZodLiteral<7>, z.ZodLiteral<14>, z.ZodLiteral<21>]>>;
        boostExpiresAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "PUBLISHED" | "PENDING_ADMIN" | "REJECTED" | "FILLED";
        id: string;
        createdAt: string;
        companyId: string;
        jobTitle: string;
        description: string;
        workType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR" | null;
        boostDurationDays: 14 | 7 | 21 | null;
        boostExpiresAt: string | null;
    }, {
        status: "PUBLISHED" | "PENDING_ADMIN" | "REJECTED" | "FILLED";
        id: string;
        createdAt: string;
        companyId: string;
        jobTitle: string;
        description: string;
        workType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR" | null;
        boostDurationDays: 14 | 7 | 21 | null;
        boostExpiresAt: string | null;
    }>;
    checkoutFormContent: z.ZodString;
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "CHECKOUT_REQUIRED";
    jobPosting: {
        status: "PUBLISHED" | "PENDING_ADMIN" | "REJECTED" | "FILLED";
        id: string;
        createdAt: string;
        companyId: string;
        jobTitle: string;
        description: string;
        workType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR" | null;
        boostDurationDays: 14 | 7 | 21 | null;
        boostExpiresAt: string | null;
    };
    checkoutFormContent: string;
    token: string;
}, {
    status: "CHECKOUT_REQUIRED";
    jobPosting: {
        status: "PUBLISHED" | "PENDING_ADMIN" | "REJECTED" | "FILLED";
        id: string;
        createdAt: string;
        companyId: string;
        jobTitle: string;
        description: string;
        workType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR" | null;
        boostDurationDays: 14 | 7 | 21 | null;
        boostExpiresAt: string | null;
    };
    checkoutFormContent: string;
    token: string;
}>]>;
export type CreateJobPostingResult = z.infer<typeof createJobPostingResultSchema>;
export declare const boostPricingOptionSchema: z.ZodObject<{
    durationDays: z.ZodUnion<[z.ZodLiteral<7>, z.ZodLiteral<14>, z.ZodLiteral<21>]>;
    priceTry: z.ZodString;
}, "strip", z.ZodTypeAny, {
    durationDays: 14 | 7 | 21;
    priceTry: string;
}, {
    durationDays: 14 | 7 | 21;
    priceTry: string;
}>;
export type BoostPricingOption = z.infer<typeof boostPricingOptionSchema>;
export declare const jobPostingBoostStatusSchema: z.ZodObject<{
    tierKey: z.ZodEnum<["free", "starter", "pro", "enterprise"]>;
    freeBoostsRemaining: z.ZodNumber;
    pricing: z.ZodArray<z.ZodObject<{
        durationDays: z.ZodUnion<[z.ZodLiteral<7>, z.ZodLiteral<14>, z.ZodLiteral<21>]>;
        priceTry: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        durationDays: 14 | 7 | 21;
        priceTry: string;
    }, {
        durationDays: 14 | 7 | 21;
        priceTry: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    tierKey: "free" | "starter" | "pro" | "enterprise";
    freeBoostsRemaining: number;
    pricing: {
        durationDays: 14 | 7 | 21;
        priceTry: string;
    }[];
}, {
    tierKey: "free" | "starter" | "pro" | "enterprise";
    freeBoostsRemaining: number;
    pricing: {
        durationDays: 14 | 7 | 21;
        priceTry: string;
    }[];
}>;
export type JobPostingBoostStatus = z.infer<typeof jobPostingBoostStatusSchema>;
export declare const adminJobPostingSchema: z.ZodObject<{
    id: z.ZodString;
    companyId: z.ZodString;
    jobTitle: z.ZodString;
    description: z.ZodString;
    workType: z.ZodNullable<z.ZodEnum<["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]>>;
    status: z.ZodEnum<["PUBLISHED", "PENDING_ADMIN", "REJECTED", "FILLED"]>;
    boostDurationDays: z.ZodNullable<z.ZodUnion<[z.ZodLiteral<7>, z.ZodLiteral<14>, z.ZodLiteral<21>]>>;
    boostExpiresAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
} & {
    companyName: z.ZodString;
    createdByUserEmail: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "PUBLISHED" | "PENDING_ADMIN" | "REJECTED" | "FILLED";
    id: string;
    createdAt: string;
    companyId: string;
    jobTitle: string;
    description: string;
    workType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR" | null;
    boostDurationDays: 14 | 7 | 21 | null;
    boostExpiresAt: string | null;
    companyName: string;
    createdByUserEmail: string | null;
}, {
    status: "PUBLISHED" | "PENDING_ADMIN" | "REJECTED" | "FILLED";
    id: string;
    createdAt: string;
    companyId: string;
    jobTitle: string;
    description: string;
    workType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR" | null;
    boostDurationDays: 14 | 7 | 21 | null;
    boostExpiresAt: string | null;
    companyName: string;
    createdByUserEmail: string | null;
}>;
export type AdminJobPosting = z.infer<typeof adminJobPostingSchema>;
export declare const ownerJobPostingSchema: z.ZodObject<{
    id: z.ZodString;
    companyId: z.ZodString;
    jobTitle: z.ZodString;
    description: z.ZodString;
    workType: z.ZodNullable<z.ZodEnum<["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]>>;
    status: z.ZodEnum<["PUBLISHED", "PENDING_ADMIN", "REJECTED", "FILLED"]>;
    boostDurationDays: z.ZodNullable<z.ZodUnion<[z.ZodLiteral<7>, z.ZodLiteral<14>, z.ZodLiteral<21>]>>;
    boostExpiresAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
} & {
    daysRemaining: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "PUBLISHED" | "PENDING_ADMIN" | "REJECTED" | "FILLED";
    id: string;
    createdAt: string;
    companyId: string;
    jobTitle: string;
    description: string;
    workType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR" | null;
    boostDurationDays: 14 | 7 | 21 | null;
    boostExpiresAt: string | null;
    daysRemaining: number;
}, {
    status: "PUBLISHED" | "PENDING_ADMIN" | "REJECTED" | "FILLED";
    id: string;
    createdAt: string;
    companyId: string;
    jobTitle: string;
    description: string;
    workType: "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR" | null;
    boostDurationDays: 14 | 7 | 21 | null;
    boostExpiresAt: string | null;
    daysRemaining: number;
}>;
export type OwnerJobPosting = z.infer<typeof ownerJobPostingSchema>;

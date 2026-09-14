import { z } from "zod";
export declare const userRoleSchema: z.ZodEnum<["MEMBER", "ADMIN", "COMPANY_OWNER"]>;
export type UserRole = z.infer<typeof userRoleSchema>;
export declare const userStatusSchema: z.ZodEnum<["PENDING_PHONE", "PENDING_PII", "PENDING_HISTORY", "PENDING_AVATAR", "ACTIVE", "SUSPENDED"]>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export declare const requestPhoneOtpSchema: z.ZodObject<{
    phoneNumber: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phoneNumber: string;
}, {
    phoneNumber: string;
}>;
export type RequestPhoneOtpInput = z.infer<typeof requestPhoneOtpSchema>;
export declare const verifyPhoneOtpSchema: z.ZodObject<{
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
}, {
    code: string;
}>;
export type VerifyPhoneOtpInput = z.infer<typeof verifyPhoneOtpSchema>;
export declare const publicUserSchema: z.ZodObject<{
    id: z.ZodString;
    role: z.ZodEnum<["MEMBER", "ADMIN", "COMPANY_OWNER"]>;
    status: z.ZodEnum<["PENDING_PHONE", "PENDING_PII", "PENDING_HISTORY", "PENDING_AVATAR", "ACTIVE", "SUSPENDED"]>;
    avatarKey: z.ZodNullable<z.ZodString>;
    city: z.ZodNullable<z.ZodString>;
    district: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "PENDING_PHONE" | "PENDING_PII" | "PENDING_HISTORY" | "PENDING_AVATAR" | "ACTIVE" | "SUSPENDED";
    id: string;
    role: "MEMBER" | "ADMIN" | "COMPANY_OWNER";
    avatarKey: string | null;
    city: string | null;
    district: string | null;
    createdAt: string;
}, {
    status: "PENDING_PHONE" | "PENDING_PII" | "PENDING_HISTORY" | "PENDING_AVATAR" | "ACTIVE" | "SUSPENDED";
    id: string;
    role: "MEMBER" | "ADMIN" | "COMPANY_OWNER";
    avatarKey: string | null;
    city: string | null;
    district: string | null;
    createdAt: string;
}>;
export type PublicUser = z.infer<typeof publicUserSchema>;
export declare const piiOnboardingInputSchema: z.ZodObject<{
    firstName: z.ZodString;
    lastName: z.ZodString;
    birthDate: z.ZodString;
    country: z.ZodString;
    city: z.ZodString;
    district: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    city: string;
    firstName: string;
    lastName: string;
    birthDate: string;
    country: string;
    district?: string | undefined;
}, {
    city: string;
    firstName: string;
    lastName: string;
    birthDate: string;
    country: string;
    district?: string | undefined;
}>;
export type PiiOnboardingInput = z.infer<typeof piiOnboardingInputSchema>;
export declare const updateIdentityInputSchema: z.ZodObject<{
    birthDate: z.ZodString;
}, "strip", z.ZodTypeAny, {
    birthDate: string;
}, {
    birthDate: string;
}>;
export type UpdateIdentityInput = z.infer<typeof updateIdentityInputSchema>;
export declare const eduLevelSchema: z.ZodEnum<["ELEMENTARY", "HIGH_SCHOOL", "COLLEGE"]>;
export type EduLevel = z.infer<typeof eduLevelSchema>;
export declare const educationHistoryInputSchema: z.ZodObject<{
    level: z.ZodEnum<["ELEMENTARY", "HIGH_SCHOOL", "COLLEGE"]>;
    institutionName: z.ZodString;
    graduationYear: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    faculty: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    department: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    level: "ELEMENTARY" | "HIGH_SCHOOL" | "COLLEGE";
    institutionName: string;
    graduationYear?: number | null | undefined;
    faculty?: string | null | undefined;
    department?: string | null | undefined;
}, {
    level: "ELEMENTARY" | "HIGH_SCHOOL" | "COLLEGE";
    institutionName: string;
    graduationYear?: number | null | undefined;
    faculty?: string | null | undefined;
    department?: string | null | undefined;
}>;
export type EducationHistoryInput = z.infer<typeof educationHistoryInputSchema>;
export declare const updateEducationHistoryInputSchema: z.ZodEffects<z.ZodObject<{
    level: z.ZodOptional<z.ZodEnum<["ELEMENTARY", "HIGH_SCHOOL", "COLLEGE"]>>;
    institutionName: z.ZodOptional<z.ZodString>;
    graduationYear: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    faculty: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    department: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    level?: "ELEMENTARY" | "HIGH_SCHOOL" | "COLLEGE" | undefined;
    institutionName?: string | undefined;
    graduationYear?: number | null | undefined;
    faculty?: string | null | undefined;
    department?: string | null | undefined;
}, {
    level?: "ELEMENTARY" | "HIGH_SCHOOL" | "COLLEGE" | undefined;
    institutionName?: string | undefined;
    graduationYear?: number | null | undefined;
    faculty?: string | null | undefined;
    department?: string | null | undefined;
}>, {
    level?: "ELEMENTARY" | "HIGH_SCHOOL" | "COLLEGE" | undefined;
    institutionName?: string | undefined;
    graduationYear?: number | null | undefined;
    faculty?: string | null | undefined;
    department?: string | null | undefined;
}, {
    level?: "ELEMENTARY" | "HIGH_SCHOOL" | "COLLEGE" | undefined;
    institutionName?: string | undefined;
    graduationYear?: number | null | undefined;
    faculty?: string | null | undefined;
    department?: string | null | undefined;
}>;
export type UpdateEducationHistoryInput = z.infer<typeof updateEducationHistoryInputSchema>;
export declare const educationHistorySchema: z.ZodObject<{
    level: z.ZodEnum<["ELEMENTARY", "HIGH_SCHOOL", "COLLEGE"]>;
    institutionName: z.ZodString;
    graduationYear: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    faculty: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    department: z.ZodOptional<z.ZodNullable<z.ZodString>>;
} & {
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    level: "ELEMENTARY" | "HIGH_SCHOOL" | "COLLEGE";
    institutionName: string;
    graduationYear?: number | null | undefined;
    faculty?: string | null | undefined;
    department?: string | null | undefined;
}, {
    id: string;
    level: "ELEMENTARY" | "HIGH_SCHOOL" | "COLLEGE";
    institutionName: string;
    graduationYear?: number | null | undefined;
    faculty?: string | null | undefined;
    department?: string | null | undefined;
}>;
export type EducationHistoryEntry = z.infer<typeof educationHistorySchema>;
export declare const employmentHistoryInputSchema: z.ZodObject<{
    rawCompanyName: z.ZodString;
    companyId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    jobTitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    startDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    rawCompanyName: string;
    companyId?: string | null | undefined;
    jobTitle?: string | null | undefined;
    startDate?: string | null | undefined;
    endDate?: string | null | undefined;
}, {
    rawCompanyName: string;
    companyId?: string | null | undefined;
    jobTitle?: string | null | undefined;
    startDate?: string | null | undefined;
    endDate?: string | null | undefined;
}>;
export type EmploymentHistoryInput = z.infer<typeof employmentHistoryInputSchema>;
export declare const employmentHistorySchema: z.ZodObject<{
    rawCompanyName: z.ZodString;
    companyId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    jobTitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    startDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
} & {
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    rawCompanyName: string;
    companyId?: string | null | undefined;
    jobTitle?: string | null | undefined;
    startDate?: string | null | undefined;
    endDate?: string | null | undefined;
}, {
    id: string;
    rawCompanyName: string;
    companyId?: string | null | undefined;
    jobTitle?: string | null | undefined;
    startDate?: string | null | undefined;
    endDate?: string | null | undefined;
}>;
export type EmploymentHistory = z.infer<typeof employmentHistorySchema>;
export declare const historySubmissionSchema: z.ZodObject<{
    education: z.ZodArray<z.ZodObject<{
        level: z.ZodEnum<["ELEMENTARY", "HIGH_SCHOOL", "COLLEGE"]>;
        institutionName: z.ZodString;
        graduationYear: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        faculty: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        department: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        level: "ELEMENTARY" | "HIGH_SCHOOL" | "COLLEGE";
        institutionName: string;
        graduationYear?: number | null | undefined;
        faculty?: string | null | undefined;
        department?: string | null | undefined;
    }, {
        level: "ELEMENTARY" | "HIGH_SCHOOL" | "COLLEGE";
        institutionName: string;
        graduationYear?: number | null | undefined;
        faculty?: string | null | undefined;
        department?: string | null | undefined;
    }>, "many">;
    employment: z.ZodArray<z.ZodObject<{
        rawCompanyName: z.ZodString;
        companyId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        jobTitle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        startDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        endDate: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        rawCompanyName: string;
        companyId?: string | null | undefined;
        jobTitle?: string | null | undefined;
        startDate?: string | null | undefined;
        endDate?: string | null | undefined;
    }, {
        rawCompanyName: string;
        companyId?: string | null | undefined;
        jobTitle?: string | null | undefined;
        startDate?: string | null | undefined;
        endDate?: string | null | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    education: {
        level: "ELEMENTARY" | "HIGH_SCHOOL" | "COLLEGE";
        institutionName: string;
        graduationYear?: number | null | undefined;
        faculty?: string | null | undefined;
        department?: string | null | undefined;
    }[];
    employment: {
        rawCompanyName: string;
        companyId?: string | null | undefined;
        jobTitle?: string | null | undefined;
        startDate?: string | null | undefined;
        endDate?: string | null | undefined;
    }[];
}, {
    education: {
        level: "ELEMENTARY" | "HIGH_SCHOOL" | "COLLEGE";
        institutionName: string;
        graduationYear?: number | null | undefined;
        faculty?: string | null | undefined;
        department?: string | null | undefined;
    }[];
    employment: {
        rawCompanyName: string;
        companyId?: string | null | undefined;
        jobTitle?: string | null | undefined;
        startDate?: string | null | undefined;
        endDate?: string | null | undefined;
    }[];
}>;
export type HistorySubmission = z.infer<typeof historySubmissionSchema>;
export declare const avatarSelectionSchema: z.ZodObject<{
    avatarKey: z.ZodString;
    avatarGradient: z.ZodString;
}, "strip", z.ZodTypeAny, {
    avatarKey: string;
    avatarGradient: string;
}, {
    avatarKey: string;
    avatarGradient: string;
}>;
export type AvatarSelection = z.infer<typeof avatarSelectionSchema>;
export declare const onboardingStatusSchema: z.ZodObject<{
    status: z.ZodEnum<["PENDING_PHONE", "PENDING_PII", "PENDING_HISTORY", "PENDING_AVATAR", "ACTIVE", "SUSPENDED"]>;
    country: z.ZodNullable<z.ZodString>;
    city: z.ZodNullable<z.ZodString>;
    district: z.ZodNullable<z.ZodString>;
    avatarKey: z.ZodNullable<z.ZodString>;
    avatarGradient: z.ZodNullable<z.ZodString>;
    reviewUsername: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "PENDING_PHONE" | "PENDING_PII" | "PENDING_HISTORY" | "PENDING_AVATAR" | "ACTIVE" | "SUSPENDED";
    avatarKey: string | null;
    city: string | null;
    district: string | null;
    country: string | null;
    avatarGradient: string | null;
    reviewUsername: string | null;
}, {
    status: "PENDING_PHONE" | "PENDING_PII" | "PENDING_HISTORY" | "PENDING_AVATAR" | "ACTIVE" | "SUSPENDED";
    avatarKey: string | null;
    city: string | null;
    district: string | null;
    country: string | null;
    avatarGradient: string | null;
    reviewUsername: string | null;
}>;
export type OnboardingStatus = z.infer<typeof onboardingStatusSchema>;
export declare const myProfileSchema: z.ZodObject<{
    reviewUsername: z.ZodNullable<z.ZodString>;
    avatarKey: z.ZodNullable<z.ZodString>;
    avatarGradient: z.ZodNullable<z.ZodString>;
    country: z.ZodNullable<z.ZodString>;
    city: z.ZodNullable<z.ZodString>;
    district: z.ZodNullable<z.ZodString>;
    education: z.ZodArray<z.ZodObject<{
        level: z.ZodEnum<["ELEMENTARY", "HIGH_SCHOOL", "COLLEGE"]>;
        institutionName: z.ZodString;
        graduationYear: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        faculty: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        department: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    } & {
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        level: "ELEMENTARY" | "HIGH_SCHOOL" | "COLLEGE";
        institutionName: string;
        graduationYear?: number | null | undefined;
        faculty?: string | null | undefined;
        department?: string | null | undefined;
    }, {
        id: string;
        level: "ELEMENTARY" | "HIGH_SCHOOL" | "COLLEGE";
        institutionName: string;
        graduationYear?: number | null | undefined;
        faculty?: string | null | undefined;
        department?: string | null | undefined;
    }>, "many">;
    firstName: z.ZodNullable<z.ZodString>;
    lastName: z.ZodNullable<z.ZodString>;
    birthDate: z.ZodNullable<z.ZodString>;
    phoneNumber: z.ZodNullable<z.ZodString>;
    email: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email: string | null;
    phoneNumber: string | null;
    avatarKey: string | null;
    city: string | null;
    district: string | null;
    firstName: string | null;
    lastName: string | null;
    birthDate: string | null;
    country: string | null;
    education: {
        id: string;
        level: "ELEMENTARY" | "HIGH_SCHOOL" | "COLLEGE";
        institutionName: string;
        graduationYear?: number | null | undefined;
        faculty?: string | null | undefined;
        department?: string | null | undefined;
    }[];
    avatarGradient: string | null;
    reviewUsername: string | null;
}, {
    email: string | null;
    phoneNumber: string | null;
    avatarKey: string | null;
    city: string | null;
    district: string | null;
    firstName: string | null;
    lastName: string | null;
    birthDate: string | null;
    country: string | null;
    education: {
        id: string;
        level: "ELEMENTARY" | "HIGH_SCHOOL" | "COLLEGE";
        institutionName: string;
        graduationYear?: number | null | undefined;
        faculty?: string | null | undefined;
        department?: string | null | undefined;
    }[];
    avatarGradient: string | null;
    reviewUsername: string | null;
}>;
export type MyProfile = z.infer<typeof myProfileSchema>;
export declare const updateProfileInputSchema: z.ZodEffects<z.ZodObject<{
    reviewUsername: z.ZodOptional<z.ZodString>;
    avatarKey: z.ZodOptional<z.ZodString>;
    avatarGradient: z.ZodOptional<z.ZodString>;
    country: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    district: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    avatarKey?: string | undefined;
    city?: string | undefined;
    district?: string | undefined;
    country?: string | undefined;
    avatarGradient?: string | undefined;
    reviewUsername?: string | undefined;
}, {
    avatarKey?: string | undefined;
    city?: string | undefined;
    district?: string | undefined;
    country?: string | undefined;
    avatarGradient?: string | undefined;
    reviewUsername?: string | undefined;
}>, {
    avatarKey?: string | undefined;
    city?: string | undefined;
    district?: string | undefined;
    country?: string | undefined;
    avatarGradient?: string | undefined;
    reviewUsername?: string | undefined;
}, {
    avatarKey?: string | undefined;
    city?: string | undefined;
    district?: string | undefined;
    country?: string | undefined;
    avatarGradient?: string | undefined;
    reviewUsername?: string | undefined;
}>;
export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;

import { z } from "zod";
export declare const tcKimlikNoSchema: z.ZodString;
export declare const employerProfileInputSchema: z.ZodEffects<z.ZodObject<{
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    phoneNumber: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    workAddress: z.ZodOptional<z.ZodString>;
    tcKimlikNo: z.ZodOptional<z.ZodString>;
    profilePictureUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    phoneNumber?: string | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    address?: string | undefined;
    workAddress?: string | undefined;
    tcKimlikNo?: string | undefined;
    profilePictureUrl?: string | undefined;
}, {
    phoneNumber?: string | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    address?: string | undefined;
    workAddress?: string | undefined;
    tcKimlikNo?: string | undefined;
    profilePictureUrl?: string | undefined;
}>, {
    phoneNumber?: string | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    address?: string | undefined;
    workAddress?: string | undefined;
    tcKimlikNo?: string | undefined;
    profilePictureUrl?: string | undefined;
}, {
    phoneNumber?: string | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    address?: string | undefined;
    workAddress?: string | undefined;
    tcKimlikNo?: string | undefined;
    profilePictureUrl?: string | undefined;
}>;
export type EmployerProfileInput = z.infer<typeof employerProfileInputSchema>;
export declare const employerProfileSchema: z.ZodObject<{
    firstName: z.ZodNullable<z.ZodString>;
    lastName: z.ZodNullable<z.ZodString>;
    phoneNumber: z.ZodNullable<z.ZodString>;
    address: z.ZodNullable<z.ZodString>;
    workAddress: z.ZodNullable<z.ZodString>;
    tcKimlikNo: z.ZodNullable<z.ZodString>;
    profilePictureUrl: z.ZodNullable<z.ZodString>;
    isComplete: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    phoneNumber: string | null;
    firstName: string | null;
    lastName: string | null;
    address: string | null;
    workAddress: string | null;
    tcKimlikNo: string | null;
    profilePictureUrl: string | null;
    isComplete: boolean;
}, {
    phoneNumber: string | null;
    firstName: string | null;
    lastName: string | null;
    address: string | null;
    workAddress: string | null;
    tcKimlikNo: string | null;
    profilePictureUrl: string | null;
    isComplete: boolean;
}>;
export type EmployerProfileView = z.infer<typeof employerProfileSchema>;
export declare const adminEmployerProfileSchema: z.ZodObject<{
    firstName: z.ZodNullable<z.ZodString>;
    lastName: z.ZodNullable<z.ZodString>;
    phoneNumber: z.ZodNullable<z.ZodString>;
    address: z.ZodNullable<z.ZodString>;
    workAddress: z.ZodNullable<z.ZodString>;
    tcKimlikNo: z.ZodNullable<z.ZodString>;
    profilePictureUrl: z.ZodNullable<z.ZodString>;
    isComplete: z.ZodBoolean;
} & {
    userId: z.ZodString;
    email: z.ZodNullable<z.ZodString>;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string | null;
    phoneNumber: string | null;
    firstName: string | null;
    lastName: string | null;
    address: string | null;
    workAddress: string | null;
    tcKimlikNo: string | null;
    profilePictureUrl: string | null;
    isComplete: boolean;
    userId: string;
    updatedAt: string;
}, {
    email: string | null;
    phoneNumber: string | null;
    firstName: string | null;
    lastName: string | null;
    address: string | null;
    workAddress: string | null;
    tcKimlikNo: string | null;
    profilePictureUrl: string | null;
    isComplete: boolean;
    userId: string;
    updatedAt: string;
}>;
export type AdminEmployerProfile = z.infer<typeof adminEmployerProfileSchema>;

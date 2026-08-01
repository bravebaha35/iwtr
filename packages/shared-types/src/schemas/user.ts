import { z } from "zod";

export const userRoleSchema = z.enum(["MEMBER", "ADMIN", "COMPANY_OWNER"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const userStatusSchema = z.enum([
  "PENDING_PII",
  "PENDING_HISTORY",
  "PENDING_AVATAR",
  "ACTIVE",
  "SUSPENDED",
]);
export type UserStatus = z.infer<typeof userStatusSchema>;

// Public-safe profile. Never includes name, T.C. Kimlik No, birth date, or phone —
// those live only in the PII vault (apps/api pii-vault module) and are never
// serialized into any API response.
export const publicUserSchema = z.object({
  id: z.string().uuid(),
  role: userRoleSchema,
  status: userStatusSchema,
  avatarKey: z.string().nullable(),
  city: z.string().nullable(),
  district: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

// Input-only shape for the onboarding PII step. This is sent over the wire once,
// encrypted at rest in PiiVault, and never returned by any endpoint.
export const piiOnboardingInputSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  // T.C. Kimlik Numarasi: 11-digit Turkish national ID.
  tcKimlikNo: z.string().regex(/^[0-9]{11}$/, "Must be 11 digits"),
  birthDate: z.string().date(),
  city: z.string().min(1),
  district: z.string().min(1),
  phoneNumber: z.string().min(7),
});
export type PiiOnboardingInput = z.infer<typeof piiOnboardingInputSchema>;

export const eduLevelSchema = z.enum(["ELEMENTARY", "HIGH_SCHOOL", "COLLEGE"]);
export type EduLevel = z.infer<typeof eduLevelSchema>;

export const educationHistoryInputSchema = z.object({
  level: eduLevelSchema,
  institutionName: z.string().min(1),
  graduationYear: z.number().int().min(1950).max(2100).nullable().optional(),
});
export type EducationHistoryInput = z.infer<typeof educationHistoryInputSchema>;

export const employmentHistoryInputSchema = z.object({
  rawCompanyName: z.string().min(1),
  companyId: z.string().uuid().nullable().optional(),
  startDate: z.string().date().nullable().optional(),
  endDate: z.string().date().nullable().optional(),
});
export type EmploymentHistoryInput = z.infer<typeof employmentHistoryInputSchema>;

export const employmentHistorySchema = employmentHistoryInputSchema.extend({
  id: z.string().uuid(),
});
export type EmploymentHistory = z.infer<typeof employmentHistorySchema>;

export const historySubmissionSchema = z.object({
  education: z.array(educationHistoryInputSchema).min(1),
  employment: z.array(employmentHistoryInputSchema).min(1),
});
export type HistorySubmission = z.infer<typeof historySubmissionSchema>;

export const avatarSelectionSchema = z.object({
  avatarKey: z.string().min(1),
});
export type AvatarSelection = z.infer<typeof avatarSelectionSchema>;

export const onboardingStatusSchema = z.object({
  status: userStatusSchema,
  city: z.string().nullable(),
  district: z.string().nullable(),
  avatarKey: z.string().nullable(),
});
export type OnboardingStatus = z.infer<typeof onboardingStatusSchema>;

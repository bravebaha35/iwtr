import { z } from "zod";

export const userRoleSchema = z.enum(["MEMBER", "ADMIN", "COMPANY_OWNER"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const userStatusSchema = z.enum([
  "PENDING_PHONE",
  "PENDING_PII",
  "PENDING_HISTORY",
  "PENDING_AVATAR",
  "ACTIVE",
  "SUSPENDED",
]);
export type UserStatus = z.infer<typeof userStatusSchema>;

// E.164 format (leading +, country code, no spaces/dashes) — the client is
// responsible for formatting to this before submitting.
export const requestPhoneOtpSchema = z.object({
  phoneNumber: z.string().regex(/^\+[1-9]\d{7,14}$/, "Must be a phone number in E.164 format, e.g. +905551234567"),
});
export type RequestPhoneOtpInput = z.infer<typeof requestPhoneOtpSchema>;

export const verifyPhoneOtpSchema = z.object({
  code: z.string().regex(/^[0-9]{6}$/, "Must be a 6-digit code"),
});
export type VerifyPhoneOtpInput = z.infer<typeof verifyPhoneOtpSchema>;

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
//
// T.C. Kimlik No is deliberately NOT collected here (2026-08-02 decision) —
// it'll come later from the account-settings page once that verification
// flow is actually built, not bundled into registration. See
// PiiVaultService.submitPii for how the absence is handled server-side.
export const piiOnboardingInputSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  birthDate: z.string().date(),
  country: z.string().min(1),
  city: z.string().min(1),
  district: z.string().min(1).optional(),
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

export const updateEducationHistoryInputSchema = z
  .object({
    level: eduLevelSchema.optional(),
    institutionName: z.string().min(1).optional(),
    graduationYear: z.number().int().min(1950).max(2100).nullable().optional(),
  })
  .refine((v) => v.level !== undefined || v.institutionName !== undefined || v.graduationYear !== undefined, {
    message: "Provide at least one field to update",
  });
export type UpdateEducationHistoryInput = z.infer<typeof updateEducationHistoryInputSchema>;

export const educationHistorySchema = educationHistoryInputSchema.extend({
  id: z.string().uuid(),
});
export type EducationHistoryEntry = z.infer<typeof educationHistorySchema>;

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

// avatarGradient is loosely validated (like avatarKey) rather than a fixed
// enum — the actual palette lives in apps/web/src/lib/avatarGradients.ts and
// can grow without touching this schema.
export const avatarSelectionSchema = z.object({
  avatarKey: z.string().min(1),
  avatarGradient: z.string().min(1),
});
export type AvatarSelection = z.infer<typeof avatarSelectionSchema>;

export const onboardingStatusSchema = z.object({
  status: userStatusSchema,
  country: z.string().nullable(),
  city: z.string().nullable(),
  district: z.string().nullable(),
  avatarKey: z.string().nullable(),
  avatarGradient: z.string().nullable(),
  // Self-chosen pseudonym, shown only to the account that set it (e.g. the
  // header). NOT identity PII — purely decorative, never surfaced on a
  // review, vote, or any other public-facing payload. Falls back to the
  // avatar's workplace-type label client-side when unset.
  displayName: z.string().nullable(),
});
export type OnboardingStatus = z.infer<typeof onboardingStatusSchema>;

// Everything the account-settings page ("/me") reads about the current user.
// firstName/lastName/birthDate/phoneNumber are read-only, self-view-only
// decrypts of what was submitted once during onboarding (see
// PiiVaultService.getMyIdentity / PhoneVerificationService.getMyPhoneNumber)
// — never editable here, and T.C. Kimlik No is never included at all: it's
// either already purged or on its way to being purged, by design (see
// CLAUDE.md's Data Model section).
export const myProfileSchema = z.object({
  displayName: z.string().nullable(),
  avatarKey: z.string().nullable(),
  avatarGradient: z.string().nullable(),
  country: z.string().nullable(),
  city: z.string().nullable(),
  district: z.string().nullable(),
  education: z.array(educationHistorySchema),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  birthDate: z.string().nullable(),
  phoneNumber: z.string().nullable(),
});
export type MyProfile = z.infer<typeof myProfileSchema>;

export const updateProfileInputSchema = z
  .object({
    displayName: z.string().trim().max(30).optional(),
    avatarKey: z.string().min(1).optional(),
    avatarGradient: z.string().min(1).optional(),
    country: z.string().min(1).optional(),
    city: z.string().min(1).optional(),
    district: z.string().min(1).optional(),
  })
  .refine(
    (v) =>
      v.displayName !== undefined ||
      v.avatarKey !== undefined ||
      v.avatarGradient !== undefined ||
      v.country !== undefined ||
      v.city !== undefined ||
      v.district !== undefined,
    { message: "Provide at least one field to update" },
  );
export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;

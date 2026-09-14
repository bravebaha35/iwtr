"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfileInputSchema = exports.myProfileSchema = exports.onboardingStatusSchema = exports.avatarSelectionSchema = exports.historySubmissionSchema = exports.employmentHistorySchema = exports.employmentHistoryInputSchema = exports.educationHistorySchema = exports.updateEducationHistoryInputSchema = exports.educationHistoryInputSchema = exports.eduLevelSchema = exports.updateIdentityInputSchema = exports.piiOnboardingInputSchema = exports.publicUserSchema = exports.verifyPhoneOtpSchema = exports.requestPhoneOtpSchema = exports.userStatusSchema = exports.userRoleSchema = void 0;
const zod_1 = require("zod");
exports.userRoleSchema = zod_1.z.enum(["MEMBER", "ADMIN", "COMPANY_OWNER"]);
exports.userStatusSchema = zod_1.z.enum([
    "PENDING_PHONE",
    "PENDING_PII",
    "PENDING_HISTORY",
    "PENDING_AVATAR",
    "ACTIVE",
    "SUSPENDED",
]);
// E.164 format (leading +, country code, no spaces/dashes) — the client is
// responsible for formatting to this before submitting.
exports.requestPhoneOtpSchema = zod_1.z.object({
    phoneNumber: zod_1.z.string().regex(/^\+[1-9]\d{7,14}$/, "Must be a phone number in E.164 format, e.g. +905551234567"),
});
exports.verifyPhoneOtpSchema = zod_1.z.object({
    code: zod_1.z.string().regex(/^[0-9]{6}$/, "Must be a 6-digit code"),
});
// Public-safe profile. Never includes name, T.C. Kimlik No, birth date, or phone —
// those live only in the PII vault (apps/api pii-vault module) and are never
// serialized into any API response.
exports.publicUserSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    role: exports.userRoleSchema,
    status: exports.userStatusSchema,
    avatarKey: zod_1.z.string().nullable(),
    city: zod_1.z.string().nullable(),
    district: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string().datetime(),
});
// Input-only shape for the onboarding PII step. This is sent over the wire once,
// encrypted at rest in PiiVault, and never returned by any endpoint.
//
// T.C. Kimlik No is deliberately NOT collected here (2026-08-02 decision) —
// it'll come later from the account-settings page once that verification
// flow is actually built, not bundled into registration. See
// PiiVaultService.submitPii for how the absence is handled server-side.
//
// No phoneNumber field here on purpose — it's already collected and
// OTP-verified in the PENDING_PHONE step that comes before this one (see
// requestPhoneOtpSchema above), so asking again here would just be a
// duplicate, unverified second copy of the same field.
exports.piiOnboardingInputSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1),
    lastName: zod_1.z.string().min(1),
    birthDate: zod_1.z.string().date(),
    country: zod_1.z.string().min(1),
    city: zod_1.z.string().min(1),
    district: zod_1.z.string().min(1).optional(),
});
// Post-onboarding self-correction of a typo — deliberately narrower than
// piiOnboardingInputSchema: firstName/lastName are NOT included here on
// purpose and have no update endpoint at all. Once submitted at
// registration they're permanent; the only way to change them is to email
// the site (see the /me page's identity section). birthDate is the one
// field a typo is both plausible and low-risk to self-correct.
exports.updateIdentityInputSchema = zod_1.z.object({
    birthDate: zod_1.z.string().date(),
});
exports.eduLevelSchema = zod_1.z.enum(["ELEMENTARY", "HIGH_SCHOOL", "COLLEGE"]);
exports.educationHistoryInputSchema = zod_1.z.object({
    level: exports.eduLevelSchema,
    institutionName: zod_1.z.string().min(1),
    graduationYear: zod_1.z.number().int().min(1950).max(2100).nullable().optional(),
    // Only meaningful for level === "COLLEGE" — the UI only shows these two
    // fields once a university/college name has been entered — but left
    // unconstrained by level here rather than refined against it, since a
    // harmless extra faculty/department value on a non-college row isn't worth
    // rejecting the whole submission over.
    faculty: zod_1.z.string().min(1).nullable().optional(),
    department: zod_1.z.string().min(1).nullable().optional(),
});
exports.updateEducationHistoryInputSchema = zod_1.z
    .object({
    level: exports.eduLevelSchema.optional(),
    institutionName: zod_1.z.string().min(1).optional(),
    graduationYear: zod_1.z.number().int().min(1950).max(2100).nullable().optional(),
    faculty: zod_1.z.string().min(1).nullable().optional(),
    department: zod_1.z.string().min(1).nullable().optional(),
})
    .refine((v) => v.level !== undefined ||
    v.institutionName !== undefined ||
    v.graduationYear !== undefined ||
    v.faculty !== undefined ||
    v.department !== undefined, { message: "Provide at least one field to update" });
exports.educationHistorySchema = exports.educationHistoryInputSchema.extend({
    id: zod_1.z.string().uuid(),
});
exports.employmentHistoryInputSchema = zod_1.z.object({
    rawCompanyName: zod_1.z.string().min(1),
    companyId: zod_1.z.string().uuid().nullable().optional(),
    jobTitle: zod_1.z.string().min(1).max(200).nullable().optional(),
    startDate: zod_1.z.string().date().nullable().optional(),
    endDate: zod_1.z.string().date().nullable().optional(),
});
exports.employmentHistorySchema = exports.employmentHistoryInputSchema.extend({
    id: zod_1.z.string().uuid(),
});
exports.historySubmissionSchema = zod_1.z.object({
    education: zod_1.z.array(exports.educationHistoryInputSchema).min(1),
    employment: zod_1.z.array(exports.employmentHistoryInputSchema).min(1),
});
// avatarGradient is loosely validated (like avatarKey) rather than a fixed
// enum — the actual palette lives in apps/web/src/lib/avatarGradients.ts and
// can grow without touching this schema.
exports.avatarSelectionSchema = zod_1.z.object({
    avatarKey: zod_1.z.string().min(1),
    avatarGradient: zod_1.z.string().min(1),
});
exports.onboardingStatusSchema = zod_1.z.object({
    status: exports.userStatusSchema,
    country: zod_1.z.string().nullable(),
    city: zod_1.z.string().nullable(),
    district: zod_1.z.string().nullable(),
    avatarKey: zod_1.z.string().nullable(),
    avatarGradient: zod_1.z.string().nullable(),
    // Permanent, self-chosen anonymous handle (see ANONYMOUS_USERNAMES_BY_
    // WORKPLACE_TYPE in review.ts) — auto-assigned once at onboarding (see
    // OnboardingService.submitAvatar) and changeable later on the
    // account-settings "Customize" page. Shown in the header (falling back to
    // the avatar's workplace-type label when null) AND on the user's own
    // reviews — this fully replaced the old numeric User.memberNumber system.
    reviewUsername: zod_1.z.string().nullable(),
});
// Everything the account-settings page ("/me") reads about the current user.
// firstName/lastName/birthDate/phoneNumber are read-only, self-view-only
// decrypts of what was submitted once during onboarding (see
// PiiVaultService.getMyIdentity / PhoneVerificationService.getMyPhoneNumber)
// — never editable here, and T.C. Kimlik No is never included at all: it's
// either already purged or on its way to being purged, by design (see
// CLAUDE.md's Data Model section).
exports.myProfileSchema = zod_1.z.object({
    // Permanent, self-chosen anonymous handle — see reviewUsername's comment
    // in onboardingStatusSchema above. Editable via updateProfileInputSchema
    // below, validated server-side against ANONYMOUS_USERNAMES_BY_WORKPLACE_
    // TYPE (never free text) — see ProfileService.updateProfile.
    reviewUsername: zod_1.z.string().nullable(),
    avatarKey: zod_1.z.string().nullable(),
    avatarGradient: zod_1.z.string().nullable(),
    country: zod_1.z.string().nullable(),
    city: zod_1.z.string().nullable(),
    district: zod_1.z.string().nullable(),
    education: zod_1.z.array(exports.educationHistorySchema),
    firstName: zod_1.z.string().nullable(),
    lastName: zod_1.z.string().nullable(),
    birthDate: zod_1.z.string().nullable(),
    phoneNumber: zod_1.z.string().nullable(),
    // The login email — not PII-vault material (it's already the account's
    // public-to-the-account-holder identifier, shown back to themselves on the
    // Contact Information tab), read straight off User.email.
    email: zod_1.z.string().nullable(),
});
exports.updateProfileInputSchema = zod_1.z
    .object({
    // Must be one of ANONYMOUS_USERNAMES_BY_WORKPLACE_TYPE's 40 entries
    // (review.ts) — checked server-side (ProfileService.updateProfile), not
    // free text, so there's no offensive-content/identifying-name risk the
    // way the old free-typed displayName needed moderation for.
    reviewUsername: zod_1.z.string().min(1).optional(),
    avatarKey: zod_1.z.string().min(1).optional(),
    avatarGradient: zod_1.z.string().min(1).optional(),
    country: zod_1.z.string().min(1).optional(),
    city: zod_1.z.string().min(1).optional(),
    district: zod_1.z.string().min(1).optional(),
})
    .refine((v) => v.reviewUsername !== undefined ||
    v.avatarKey !== undefined ||
    v.avatarGradient !== undefined ||
    v.country !== undefined ||
    v.city !== undefined ||
    v.district !== undefined, { message: "Provide at least one field to update" });

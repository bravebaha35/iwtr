"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminEmployerProfileSchema = exports.employerProfileSchema = exports.employerProfileInputSchema = exports.tcKimlikNoSchema = void 0;
const zod_1 = require("zod");
// Same 11-digit, first-digit-1-9 shape used everywhere else T.C. Kimlik No is
// ever validated in this codebase (see PiiVault's future collection flow) —
// kept here rather than imported from user.ts since it's not exported there
// as a standalone schema yet, only inlined.
exports.tcKimlikNoSchema = zod_1.z.string().regex(/^[1-9]\d{10}$/, "Must be an 11-digit T.C. Kimlik No");
// Same E.164 shape as requestPhoneOtpSchema in user.ts.
const e164PhoneSchema = zod_1.z.string().regex(/^\+[1-9]\d{7,14}$/, "Must be a phone number in E.164 format, e.g. +905551234567");
// The verified-employer legal-contact profile a CompanyOwner fills in once
// their claim is APPROVED (see CLAUDE.md's "employers lose anonymous
// employee privileges" requirement) — a real, admin-visible identity, not
// the anonymous review-facing avatar/reviewUsername on User, which this
// deliberately does NOT touch or replace (see EmployerProfile's schema.prisma
// comment for why those stay separate).
exports.employerProfileInputSchema = zod_1.z
    .object({
    firstName: zod_1.z.string().min(1).max(100).optional(),
    lastName: zod_1.z.string().min(1).max(100).optional(),
    phoneNumber: e164PhoneSchema.optional(),
    address: zod_1.z.string().min(1).max(500).optional(),
    workAddress: zod_1.z.string().min(1).max(500).optional(),
    // Optional here (a profile can be saved incrementally, field by field, the
    // same way updateProfileInputSchema works elsewhere) — the service layer
    // is what actually requires every field to be present before treating the
    // profile as "complete" for legal-compliance purposes.
    tcKimlikNo: exports.tcKimlikNoSchema.optional(),
    profilePictureUrl: zod_1.z.string().url().optional(),
})
    .refine((v) => v.firstName !== undefined ||
    v.lastName !== undefined ||
    v.phoneNumber !== undefined ||
    v.address !== undefined ||
    v.workAddress !== undefined ||
    v.tcKimlikNo !== undefined ||
    v.profilePictureUrl !== undefined, { message: "Provide at least one field to update" });
// Self-view: the verified employer editing their own profile back. Unlike
// PiiVault's identity data, T.C. Kimlik No IS shown back here — this is the
// person's own editable business-contact record, not a one-time anonymous
// identity proof, so there's no anonymity reason to withhold it from them.
exports.employerProfileSchema = zod_1.z.object({
    firstName: zod_1.z.string().nullable(),
    lastName: zod_1.z.string().nullable(),
    phoneNumber: zod_1.z.string().nullable(),
    address: zod_1.z.string().nullable(),
    workAddress: zod_1.z.string().nullable(),
    tcKimlikNo: zod_1.z.string().nullable(),
    profilePictureUrl: zod_1.z.string().nullable(),
    // Whether every required field has been filled in at least once — drives
    // the "complete your verified profile" prompt on the employer dashboard.
    isComplete: zod_1.z.boolean(),
});
// Admin listing/detail view — same shape as the self-view plus which user/
// company this belongs to, since "100% visible to admins for legal
// compliance" means an admin browsing this needs to know whose record
// they're looking at, not just the raw fields.
exports.adminEmployerProfileSchema = exports.employerProfileSchema.extend({
    userId: zod_1.z.string().uuid(),
    email: zod_1.z.string().nullable(),
    updatedAt: zod_1.z.string().datetime(),
});

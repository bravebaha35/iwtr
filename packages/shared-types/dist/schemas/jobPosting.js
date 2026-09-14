"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ownerJobPostingSchema = exports.adminJobPostingSchema = exports.jobPostingBoostStatusSchema = exports.boostPricingOptionSchema = exports.createJobPostingResultSchema = exports.createJobPostingInputSchema = exports.companyJobPostingsSchema = exports.publicJobPostingSchema = exports.jobPostingSchema = exports.membershipTierKeySchema = exports.boostDurationDaysSchema = exports.jobPostingStatusSchema = void 0;
const zod_1 = require("zod");
const payment_1 = require("./payment");
const workplaceType_1 = require("./workplaceType");
exports.jobPostingStatusSchema = zod_1.z.enum(["PUBLISHED", "PENDING_ADMIN", "REJECTED", "FILLED"]);
exports.boostDurationDaysSchema = zod_1.z.union([zod_1.z.literal(7), zod_1.z.literal(14), zod_1.z.literal(21)]);
// Mirrors PricingTierKey in apps/web/src/lib/pricingTiers.ts — kept as a
// separate shared-types enum since apps/api needs it too (to compute
// freeBoostsRemaining), not just the web app.
exports.membershipTierKeySchema = zod_1.z.enum(["free", "starter", "pro", "enterprise"]);
exports.jobPostingSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    companyId: zod_1.z.string().uuid(),
    jobTitle: zod_1.z.string(),
    description: zod_1.z.string(),
    workType: workplaceType_1.workplaceTypeSchema.nullable(),
    status: exports.jobPostingStatusSchema,
    boostDurationDays: exports.boostDurationDaysSchema.nullable(),
    boostExpiresAt: zod_1.z.string().datetime().nullable(),
    createdAt: zod_1.z.string().datetime(),
});
// What a job-seeker sees on a hiring company's card (JobsBrowser.tsx) —
// deliberately thinner than jobPostingSchema above, no id/status/boost
// internals, those are an owner-facing concern only.
exports.publicJobPostingSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    jobTitle: zod_1.z.string(),
    description: zod_1.z.string(),
});
// One company's public job data, served by GET /companies/:slug/job-postings
// for the "Job Postings" tab on its profile page. The exact two arrays a
// /jobs card already renders (see companyListItemSchema in company.ts):
// owner-authored, currently-PUBLISHED postings, plus the auto-classified
// EmploymentHistory job-title fallback. Kept as its own slug-scoped endpoint
// (not folded into CompanyDetail) so the tab fetches this stream on its own,
// independently of the ratings/social streams.
exports.companyJobPostingsSchema = zod_1.z.object({
    jobPostings: zod_1.z.array(exports.publicJobPostingSchema),
    jobTitles: zod_1.z.array(zod_1.z.string()),
});
// boost is null for "Continue without boost". billing is required only when
// the chosen boost isn't covered by a free monthly allowance — same
// optional-only-on-the-paid-path shape rivalAnalyticsRequestInputSchema
// already uses for the exact same iyzico one-time-checkout mechanism (see
// owner.ts), reusing checkoutBillingInputSchema rather than a new billing shape.
exports.createJobPostingInputSchema = zod_1.z.object({
    jobTitle: zod_1.z.string().trim().min(1).max(200),
    description: zod_1.z.string().min(1).max(600),
    workType: workplaceType_1.workplaceTypeSchema,
    autoReshareEnabled: zod_1.z.boolean().optional().default(false),
    boost: zod_1.z
        .object({
        durationDays: exports.boostDurationDaysSchema,
        billing: payment_1.checkoutBillingInputSchema.optional(),
    })
        .nullable(),
});
exports.createJobPostingResultSchema = zod_1.z.discriminatedUnion("status", [
    zod_1.z.object({ status: zod_1.z.literal("PUBLISHED"), jobPosting: exports.jobPostingSchema }),
    zod_1.z.object({ status: zod_1.z.literal("PENDING_ADMIN"), jobPosting: exports.jobPostingSchema }),
    // iyzico is configured and the boost picked isn't covered by a free
    // credit — same shape as rivalAnalyticsRequestResultSchema's
    // CHECKOUT_REQUIRED branch (owner.ts).
    zod_1.z.object({
        status: zod_1.z.literal("CHECKOUT_REQUIRED"),
        jobPosting: exports.jobPostingSchema,
        checkoutFormContent: zod_1.z.string(),
        token: zod_1.z.string(),
    }),
]);
exports.boostPricingOptionSchema = zod_1.z.object({
    durationDays: exports.boostDurationDaysSchema,
    priceTry: zod_1.z.string(),
});
exports.jobPostingBoostStatusSchema = zod_1.z.object({
    tierKey: exports.membershipTierKeySchema,
    freeBoostsRemaining: zod_1.z.number().int().min(0),
    pricing: zod_1.z.array(exports.boostPricingOptionSchema),
});
// Admin queue view — same shape as jobPostingSchema plus the context an
// admin needs to judge a flagged posting, same pattern as
// adminOwnerClaimSchema extending its own base shape in owner.ts.
exports.adminJobPostingSchema = exports.jobPostingSchema.extend({
    companyName: zod_1.z.string(),
    createdByUserEmail: zod_1.z.string().nullable(),
});
// The owner's own view of one of their postings (GET
// my-companies/:companyId/job-postings) — jobPostingSchema plus how many
// days are left before it naturally lapses (0 once it's stopped being
// publicly live, whatever the reason).
exports.ownerJobPostingSchema = exports.jobPostingSchema.extend({
    daysRemaining: zod_1.z.number().int().min(0),
});

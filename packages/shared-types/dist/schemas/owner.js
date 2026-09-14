"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rivalAnalyticsRequestResultSchema = exports.rivalAnalyticsRequestInputSchema = exports.plusCheckoutResultSchema = exports.ownedCompanySchema = exports.ownerContactMessageSchema = exports.contactAdminInputSchema = exports.updateCompanyInputSchema = exports.adminOwnerClaimSchema = exports.myCompanyClaimSchema = exports.rivalAnalyticsTierSchema = exports.claimCompanyInputSchema = exports.ownerClaimStatusSchema = void 0;
const zod_1 = require("zod");
const company_1 = require("./company");
const turkishPhone_1 = require("./turkishPhone");
const payment_1 = require("./payment");
exports.ownerClaimStatusSchema = zod_1.z.enum(["PENDING", "APPROVED", "REJECTED"]);
exports.claimCompanyInputSchema = zod_1.z.object({
    // Free-text context to help an admin sanity-check the claim manually (no
    // automated verification exists yet) — e.g. a work email domain, a role.
    message: zod_1.z.string().max(1000).optional(),
});
// Rival Analytics add-on tier — a separate axis from OwnerTier/PlanStatus
// above (see RivalAnalyticsTier's own comment in schema.prisma). Declared
// here (rather than further down, next to the request/result schemas) so
// myCompanyClaimSchema below can reference it.
exports.rivalAnalyticsTierSchema = zod_1.z.enum(["STARTER", "PRO", "ENTERPRISE"]);
// What a claimant sees about their own claim(s).
exports.myCompanyClaimSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    companyId: zod_1.z.string().uuid(),
    companyName: zod_1.z.string(),
    companySlug: zod_1.z.string(),
    tier: company_1.ownerTierSchema,
    planStatus: company_1.planStatusSchema,
    isVerifiedBadge: zod_1.z.boolean(),
    claimStatus: exports.ownerClaimStatusSchema,
    createdAt: zod_1.z.string().datetime(),
    resolvedAt: zod_1.z.string().datetime().nullable(),
    // Null means "no Rival Analytics subscription yet" — same meaning as the
    // nullable column it mirrors (CompanyOwner.rivalAnalyticsTier).
    rivalAnalyticsTier: exports.rivalAnalyticsTierSchema.nullable(),
    rivalAnalyticsFreeRequestUsed: zod_1.z.boolean(),
    // True when an ADMIN has hidden this company (Company.hiddenAt !== null --
    // see setCompanyVisibilityInputSchema in company.ts). The company keeps
    // all its data but is invisible on every public surface; the owner's
    // dashboard uses this to show a "hidden by admin" notice and lock the
    // edit form rather than let them keep editing a company nobody can see.
    hidden: zod_1.z.boolean(),
});
// What an admin sees while reviewing claims — includes the claimant's email,
// since deciding whether to trust a claim requires knowing who's asking. This
// is a different trust boundary than reviewer anonymity: owner claims are
// never anonymous to admins the way review authorship is.
exports.adminOwnerClaimSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    companyId: zod_1.z.string().uuid(),
    companyName: zod_1.z.string(),
    claimantUserId: zod_1.z.string().uuid(),
    claimantEmail: zod_1.z.string().nullable(),
    claimMessage: zod_1.z.string().nullable(),
    claimStatus: exports.ownerClaimStatusSchema,
    createdAt: zod_1.z.string().datetime(),
});
// Every field any owner could ever submit. The shape alone doesn't grant
// access — description/website are Plus-only and rejected server-side
// (owner.service.ts) unless the caller's CompanyOwner row is tier=PLUS with
// planStatus=ACTIVE. Keeping one schema (rather than Free/Plus variants)
// means the allowlist lives in exactly one place: the service layer.
//
// workplaceTypes became owner-editable (free tier) so the dashboard's
// General Information box can replace the old free-text Category field with
// a pick-up-to-2 Office/Hybrid-Remote/Service/Manual-Labour selector —
// superseding the earlier "deferred to a future Plus phase, admin-only"
// note this schema used to carry. `companyWorkplaceTypesSchema` already
// enforces the 1-2 length cap; admin creation (CompaniesService.createByAdmin)
// still sets the initial value the same way.
exports.updateCompanyInputSchema = zod_1.z
    .object({
    name: zod_1.z.string().min(1).optional(),
    category: zod_1.z.string().min(1).optional(),
    workplaceTypes: company_1.companyWorkplaceTypesSchema.optional(),
    mainPhotoUrl: company_1.httpUrlSchema.optional(),
    // Free tier: location and public contact/socials.
    city: zod_1.z.string().min(1).optional(),
    district: zod_1.z.string().min(1).optional(),
    contactEmail: zod_1.z.string().email().optional(),
    // Turkey-specific: a mobile number (any 05XX prefix) or a landline whose
    // area code is a real one of the 81 provinces' — see
    // schemas/turkishPhone.ts. Deliberately stricter than the generic E.164
    // pattern used for personal phone numbers elsewhere (user.ts,
    // employerProfile.ts) since this platform is Turkey-only and the
    // dashboard's own guidance note promises area-code validation.
    contactPhone: turkishPhone_1.companyContactPhoneSchema.optional(),
    facebookUrl: company_1.httpUrlSchema.optional(),
    instagramUrl: company_1.httpUrlSchema.optional(),
    whatsappUrl: company_1.httpUrlSchema.optional(),
    xUrl: company_1.httpUrlSchema.optional(),
    // "We're hiring" toggle for the /jobs page — free tier, same as the
    // fields above (see Company.isHiring's schema.prisma comment).
    isHiring: zod_1.z.boolean().optional(),
    linkedinUrl: company_1.httpUrlSchema.optional(),
    youtubeUrl: company_1.httpUrlSchema.optional(),
    glassdoorUrl: company_1.httpUrlSchema.optional(),
    // Paid-tier only (any tier above FREE):
    description: zod_1.z.string().max(2000).optional(),
    website: company_1.httpUrlSchema.optional(),
    bannerImageUrl: company_1.httpUrlSchema.optional(),
    featuredReviewId: zod_1.z.string().uuid().nullable().optional(),
})
    .refine((v) => Object.values(v).some((value) => value !== undefined), {
    message: "Provide at least one field to update",
});
exports.contactAdminInputSchema = zod_1.z.object({
    message: zod_1.z.string().min(1).max(2000),
});
exports.ownerContactMessageSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    companyId: zod_1.z.string().uuid(),
    companyName: zod_1.z.string(),
    ownerEmail: zod_1.z.string().nullable(),
    message: zod_1.z.string(),
    createdAt: zod_1.z.string().datetime(),
    resolvedAt: zod_1.z.string().datetime().nullable(),
});
// A company the current user is an APPROVED owner of, returned by /me/owned-companies
// so the web app can drive an owner dashboard.
exports.ownedCompanySchema = zod_1.z.object({
    companyId: zod_1.z.string().uuid(),
    companyName: zod_1.z.string(),
    companySlug: zod_1.z.string(),
    tier: company_1.ownerTierSchema,
    planStatus: company_1.planStatusSchema,
    isVerifiedBadge: zod_1.z.boolean(),
});
// Returned by the Plus checkout-initiation endpoint. iyzico's Checkout Form
// model hands back an embeddable HTML/JS snippet (checkoutFormContent) rather
// than just a redirect URL — the web app injects it into the page.
exports.plusCheckoutResultSchema = zod_1.z.object({
    checkoutFormContent: zod_1.z.string(),
    token: zod_1.z.string(),
});
// Only Enterprise gets a one-time free pull; every other tier (including no
// tier at all) always pays, gated by apps/api's decideRivalAnalyticsAccess.
// `billing` is required only on the paid path — omitted entirely on a free
// Enterprise pull, which needs no invoice/checkout details at all.
exports.rivalAnalyticsRequestInputSchema = zod_1.z.object({
    requestingCompanyId: zod_1.z.string().uuid(),
    billing: payment_1.checkoutBillingInputSchema.optional(),
});
exports.rivalAnalyticsRequestResultSchema = zod_1.z.discriminatedUnion("status", [
    zod_1.z.object({ status: zod_1.z.literal("SENT"), recipientEmail: zod_1.z.string(), usedFreeCredit: zod_1.z.boolean() }),
    // iyzico isn't configured with real credentials yet (see IyzicoProvider) —
    // same "not set up yet" condition the Plus checkout flow already surfaces.
    zod_1.z.object({ status: zod_1.z.literal("PAYMENT_REQUIRED"), priceNote: zod_1.z.string() }),
    // iyzico IS configured — here's the hosted Checkout Form to complete
    // payment; the report is generated and emailed once the callback confirms
    // the charge succeeded, not synchronously with this response.
    zod_1.z.object({ status: zod_1.z.literal("CHECKOUT_REQUIRED"), checkoutFormContent: zod_1.z.string(), token: zod_1.z.string() }),
]);

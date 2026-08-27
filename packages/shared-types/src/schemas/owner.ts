import { z } from "zod";
import { companyWorkplaceTypesSchema, httpUrlSchema, ownerTierSchema, planStatusSchema } from "./company";
import { companyContactPhoneSchema } from "./turkishPhone";

export const ownerClaimStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export type OwnerClaimStatus = z.infer<typeof ownerClaimStatusSchema>;

export const claimCompanyInputSchema = z.object({
  // Free-text context to help an admin sanity-check the claim manually (no
  // automated verification exists yet) — e.g. a work email domain, a role.
  message: z.string().max(1000).optional(),
});
export type ClaimCompanyInput = z.infer<typeof claimCompanyInputSchema>;

// What a claimant sees about their own claim(s).
export const myCompanyClaimSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  companyName: z.string(),
  companySlug: z.string(),
  tier: ownerTierSchema,
  planStatus: planStatusSchema,
  isVerifiedBadge: z.boolean(),
  claimStatus: ownerClaimStatusSchema,
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
});
export type MyCompanyClaim = z.infer<typeof myCompanyClaimSchema>;

// What an admin sees while reviewing claims — includes the claimant's email,
// since deciding whether to trust a claim requires knowing who's asking. This
// is a different trust boundary than reviewer anonymity: owner claims are
// never anonymous to admins the way review authorship is.
export const adminOwnerClaimSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  companyName: z.string(),
  claimantUserId: z.string().uuid(),
  claimantEmail: z.string().nullable(),
  claimMessage: z.string().nullable(),
  claimStatus: ownerClaimStatusSchema,
  createdAt: z.string().datetime(),
});
export type AdminOwnerClaim = z.infer<typeof adminOwnerClaimSchema>;

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
export const updateCompanyInputSchema = z
  .object({
    name: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
    workplaceTypes: companyWorkplaceTypesSchema.optional(),
    mainPhotoUrl: httpUrlSchema.optional(),
    // Free tier: location and public contact/socials.
    city: z.string().min(1).optional(),
    district: z.string().min(1).optional(),
    contactEmail: z.string().email().optional(),
    // Turkey-specific: a mobile number (any 05XX prefix) or a landline whose
    // area code is a real one of the 81 provinces' — see
    // schemas/turkishPhone.ts. Deliberately stricter than the generic E.164
    // pattern used for personal phone numbers elsewhere (user.ts,
    // employerProfile.ts) since this platform is Turkey-only and the
    // dashboard's own guidance note promises area-code validation.
    contactPhone: companyContactPhoneSchema.optional(),
    facebookUrl: httpUrlSchema.optional(),
    instagramUrl: httpUrlSchema.optional(),
    whatsappUrl: httpUrlSchema.optional(),
    xUrl: httpUrlSchema.optional(),
    // Plus-tier only:
    description: z.string().max(2000).optional(),
    website: httpUrlSchema.optional(),
  })
  .refine((v) => Object.values(v).some((value) => value !== undefined), {
    message: "Provide at least one field to update",
  });
export type UpdateCompanyInput = z.infer<typeof updateCompanyInputSchema>;

export const contactAdminInputSchema = z.object({
  message: z.string().min(1).max(2000),
});
export type ContactAdminInput = z.infer<typeof contactAdminInputSchema>;

export const ownerContactMessageSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  companyName: z.string(),
  ownerEmail: z.string().nullable(),
  message: z.string(),
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
});
export type OwnerContactMessage = z.infer<typeof ownerContactMessageSchema>;

// A company the current user is an APPROVED owner of, returned by /me/owned-companies
// so the web app can drive an owner dashboard.
export const ownedCompanySchema = z.object({
  companyId: z.string().uuid(),
  companyName: z.string(),
  companySlug: z.string(),
  tier: ownerTierSchema,
  planStatus: planStatusSchema,
  isVerifiedBadge: z.boolean(),
});
export type OwnedCompany = z.infer<typeof ownedCompanySchema>;

// Returned by the Plus checkout-initiation endpoint. iyzico's Checkout Form
// model hands back an embeddable HTML/JS snippet (checkoutFormContent) rather
// than just a redirect URL — the web app injects it into the page.
export const plusCheckoutResultSchema = z.object({
  checkoutFormContent: z.string(),
  token: z.string(),
});
export type PlusCheckoutResult = z.infer<typeof plusCheckoutResultSchema>;

// Rival Analytics add-on — a separate axis from OwnerTier/PlanStatus above
// (see RivalAnalyticsTier's own comment in schema.prisma). Only Enterprise
// gets a one-time free pull; every other tier (including no tier at all)
// always pays, gated by apps/api's decideRivalAnalyticsAccess.
export const rivalAnalyticsTierSchema = z.enum(["STARTER", "PRO", "ENTERPRISE"]);
export type RivalAnalyticsTier = z.infer<typeof rivalAnalyticsTierSchema>;

export const rivalAnalyticsRequestInputSchema = z.object({
  requestingCompanyId: z.string().uuid(),
});
export type RivalAnalyticsRequestInput = z.infer<typeof rivalAnalyticsRequestInputSchema>;

export const rivalAnalyticsRequestResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("SENT"), recipientEmail: z.string(), usedFreeCredit: z.boolean() }),
  z.object({ status: z.literal("PAYMENT_REQUIRED"), priceNote: z.string() }),
]);
export type RivalAnalyticsRequestResult = z.infer<typeof rivalAnalyticsRequestResultSchema>;

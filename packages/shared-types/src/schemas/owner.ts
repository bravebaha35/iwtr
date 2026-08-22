import { z } from "zod";
import { httpUrlSchema, ownerTierSchema, planStatusSchema } from "./company";

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
// workplaceTypes is deliberately NOT owner-editable here (even though it was
// before Company.workplaceType became a multi-value array) — self-service
// editing of a company's workplace-type tags is deferred to a future Plus
// company-profile phase, not part of this pass. Only admins can set it
// (CompaniesService.createByAdmin) until that's designed.
// Same E.164 pattern used for user/employer-profile phone numbers
// (user.ts, employerProfile.ts) — duplicated rather than imported since
// those live in a different domain area of this package.
const e164PhoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/, "Must be a phone number in E.164 format, e.g. +905551234567");

export const updateCompanyInputSchema = z
  .object({
    name: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
    mainPhotoUrl: httpUrlSchema.optional(),
    // Free tier: location and public contact/socials.
    city: z.string().min(1).optional(),
    district: z.string().min(1).optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: e164PhoneSchema.optional(),
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

import { z } from "zod";
import { ownerTierSchema, planStatusSchema, workplaceTypeSchema } from "./company";

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

// Free tier can only edit name/photo/category (server-enforced allowlist —
// see companies plan doc). Plus-only fields (description/website/gallery)
// stay out of this schema entirely until Phase 5 wires up payments; adding
// them then just means adding fields here, not changing the enforcement.
export const updateCompanyFreeTierInputSchema = z
  .object({
    name: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
    workplaceType: workplaceTypeSchema.optional(),
    mainPhotoUrl: z.string().url().optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.category !== undefined ||
      v.workplaceType !== undefined ||
      v.mainPhotoUrl !== undefined,
    { message: "Provide at least one field to update" },
  );
export type UpdateCompanyFreeTierInput = z.infer<typeof updateCompanyFreeTierInputSchema>;

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
});
export type OwnedCompany = z.infer<typeof ownedCompanySchema>;

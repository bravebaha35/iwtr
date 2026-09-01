import { z } from "zod";
import { plusCheckoutInputSchema } from "./payment";

export const jobPostingStatusSchema = z.enum(["PUBLISHED", "PENDING_ADMIN", "REJECTED"]);
export type JobPostingStatus = z.infer<typeof jobPostingStatusSchema>;

export const boostDurationDaysSchema = z.union([z.literal(7), z.literal(14), z.literal(21)]);
export type BoostDurationDays = z.infer<typeof boostDurationDaysSchema>;

// Mirrors PricingTierKey in apps/web/src/lib/pricingTiers.ts — kept as a
// separate shared-types enum since apps/api needs it too (to compute
// freeBoostsRemaining), not just the web app.
export const membershipTierKeySchema = z.enum(["free", "starter", "pro", "enterprise"]);
export type MembershipTierKey = z.infer<typeof membershipTierKeySchema>;

export const jobPostingSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  jobTitle: z.string(),
  description: z.string(),
  status: jobPostingStatusSchema,
  boostDurationDays: boostDurationDaysSchema.nullable(),
  boostExpiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type JobPosting = z.infer<typeof jobPostingSchema>;

// What a job-seeker sees on a hiring company's card (JobsBrowser.tsx) —
// deliberately thinner than jobPostingSchema above, no id/status/boost
// internals, those are an owner-facing concern only.
export const publicJobPostingSchema = z.object({
  jobTitle: z.string(),
  description: z.string(),
});
export type PublicJobPosting = z.infer<typeof publicJobPostingSchema>;

// boost is null for "Continue without boost". billing is required only when
// the chosen boost isn't covered by a free monthly allowance — same
// optional-only-on-the-paid-path shape rivalAnalyticsRequestInputSchema
// already uses for the exact same iyzico one-time-checkout mechanism (see
// owner.ts), reusing plusCheckoutInputSchema rather than a new billing shape.
export const createJobPostingInputSchema = z.object({
  jobTitle: z.string().min(1).max(200),
  description: z.string().min(1).max(600),
  boost: z
    .object({
      durationDays: boostDurationDaysSchema,
      billing: plusCheckoutInputSchema.optional(),
    })
    .nullable(),
});
export type CreateJobPostingInput = z.infer<typeof createJobPostingInputSchema>;

export const createJobPostingResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("PUBLISHED"), jobPosting: jobPostingSchema }),
  z.object({ status: z.literal("PENDING_ADMIN"), jobPosting: jobPostingSchema }),
  // iyzico is configured and the boost picked isn't covered by a free
  // credit — same shape as rivalAnalyticsRequestResultSchema's
  // CHECKOUT_REQUIRED branch (owner.ts).
  z.object({
    status: z.literal("CHECKOUT_REQUIRED"),
    jobPosting: jobPostingSchema,
    checkoutFormContent: z.string(),
    token: z.string(),
  }),
]);
export type CreateJobPostingResult = z.infer<typeof createJobPostingResultSchema>;

export const boostPricingOptionSchema = z.object({
  durationDays: boostDurationDaysSchema,
  priceTry: z.string(),
});
export type BoostPricingOption = z.infer<typeof boostPricingOptionSchema>;

export const jobPostingBoostStatusSchema = z.object({
  tierKey: membershipTierKeySchema,
  freeBoostsRemaining: z.number().int().min(0),
  pricing: z.array(boostPricingOptionSchema),
});
export type JobPostingBoostStatus = z.infer<typeof jobPostingBoostStatusSchema>;

// Admin queue view — same shape as jobPostingSchema plus the context an
// admin needs to judge a flagged posting, same pattern as
// adminOwnerClaimSchema extending its own base shape in owner.ts.
export const adminJobPostingSchema = jobPostingSchema.extend({
  companyName: z.string(),
  createdByUserEmail: z.string().nullable(),
});
export type AdminJobPosting = z.infer<typeof adminJobPostingSchema>;

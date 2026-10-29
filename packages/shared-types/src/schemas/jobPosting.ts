import { z } from "zod";
import { checkoutBillingInputSchema } from "./payment";
import { workplaceTypeSchema } from "./workplaceType";

export const jobPostingStatusSchema = z.enum(["PUBLISHED", "PENDING_ADMIN", "REJECTED", "FILLED"]);
export type JobPostingStatus = z.infer<typeof jobPostingStatusSchema>;

// The three things an owner can buy for a posting:
// - FEATURED_7 / FEATURED_14: the gold "Featured jobs" row on the Jobs page
//   for 7 or 14 days (only FEATURED_7 can come out of the free monthly
//   allowance);
// - AD_SPACE_14: the company's own ad in the employer ad space beside the
//   search bar on the Rating and Jobs pages for 14 days. Ad space only: it
//   does not put the posting in the Featured row.
export const boostOptionSchema = z.enum(["FEATURED_7", "FEATURED_14", "AD_SPACE_14"]);
export type BoostOption = z.infer<typeof boostOptionSchema>;
export const BOOST_OPTION_DAYS: Record<BoostOption, number> = { FEATURED_7: 7, FEATURED_14: 14, AD_SPACE_14: 14 };

// The level(s) a posting is hiring for. The owner ticks 1 to 3 when
// creating it (Post a job > Position); the Jobs page filters on them, and
// the full job card lists them. This order is the display order everywhere.
export const jobPositionSchema = z.enum([
  "SENIOR_EXECUTIVE",
  "MIDDLE_MANAGER",
  "MANAGEMENT_TRAINEE",
  "SPECIALIST",
  "ENTRY_LEVEL",
  "FREELANCER",
  "BLUE_COLLAR",
  "INTERN",
  "ASSISTANT_SPECIALIST",
  "STAFF_MEMBER",
  "SERVICE_STAFF",
]);
export type JobPosition = z.infer<typeof jobPositionSchema>;
export const MAX_JOB_POSITIONS = 3;

// "Tell us more": plain text, bullet lines included.
export const JOB_DESCRIPTION_MAX_LENGTH = 4000;

// Salary Information (2026-10-29): a monthly net amount in the currency the
// owner picked. Never converted - a posting in $ stays in $. Or, instead of
// an amount, "shared at the interview".
export const SALARY_CURRENCIES = ["TRY", "USD", "EUR"] as const;
export const salaryCurrencySchema = z.enum(SALARY_CURRENCIES);
export type SalaryCurrency = z.infer<typeof salaryCurrencySchema>;
export const SALARY_CURRENCY_SYMBOL: Record<SalaryCurrency, string> = { TRY: "₺", USD: "$", EUR: "€" };
export const MAX_MONTHLY_SALARY = 10_000_000;

// What a posting says about pay. A whole posting's `salary` is null when it
// was created before this existed.
export const jobSalarySchema = z.object({
  amount: z.number().int().positive().nullable(),
  currency: salaryCurrencySchema.nullable(),
  atInterview: z.boolean(),
});
export type JobSalary = z.infer<typeof jobSalarySchema>;

// The owner's choice: an amount and a currency, or the "shared at the
// interview" tick (then amount and currency are ignored).
export const jobSalaryInputSchema = z
  .object({
    amount: z.number().int().min(1, "Enter the monthly salary").max(MAX_MONTHLY_SALARY).nullable().optional(),
    currency: salaryCurrencySchema.nullable().optional(),
    atInterview: z.boolean(),
  })
  .refine((v) => v.atInterview || (v.amount != null && v.currency != null), {
    message: "Enter the monthly salary, or tick that it will be shared at the interview",
    path: ["amount"],
  });
export type JobSalaryInput = z.input<typeof jobSalaryInputSchema>;

// The sector's average monthly salary shown under Salary Information while
// posting a job: from other job ads in the same sector that gave an amount in
// ₺ (other currencies are never converted, so they are left out). Only shown
// once ads from at least SECTOR_SALARY_MIN_COMPANIES different companies are
// behind it, so it never gives one company's pay away.
export const SECTOR_SALARY_MIN_COMPANIES = 3;
export const sectorSalaryAverageSchema = z.object({
  sector: z.string(),
  averageMonthlyTry: z.number().int().nullable(),
  postingCount: z.number().int(),
});
export type SectorSalaryAverage = z.infer<typeof sectorSalaryAverageSchema>;

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
  workType: workplaceTypeSchema.nullable(),
  // Empty for postings created before positions existed.
  positions: z.array(jobPositionSchema).default([]),
  status: jobPostingStatusSchema,
  // Days of the current/last boost (legacy rows may hold 21).
  boostDurationDays: z.number().int().nullable(),
  boostExpiresAt: z.string().datetime().nullable(),
  // The boost includes the employer ad space (AD_SPACE_14).
  boostAdSpace: z.boolean().default(false),
  salary: jobSalarySchema.nullable().default(null),
  createdAt: z.string().datetime(),
});
export type JobPosting = z.infer<typeof jobPostingSchema>;

// What a job-seeker sees on a hiring company's card (JobsBrowser.tsx) —
// deliberately thinner than jobPostingSchema above, no id/status/boost
// internals, those are an owner-facing concern only. workType is nullable
// only for legacy rows created before the work-type picker existed —
// every posting created through JobSetupModal now always has one.
export const publicJobPostingSchema = z.object({
  id: z.string().uuid(),
  jobTitle: z.string(),
  description: z.string(),
  workType: workplaceTypeSchema.nullable().default(null),
  positions: z.array(jobPositionSchema).default([]),
  salary: jobSalarySchema.nullable().default(null),
});
export type PublicJobPosting = z.infer<typeof publicJobPostingSchema>;

// A job title inferred from EmploymentHistory (no real owner-authored
// posting behind it) plus the work-type classifyJobRole already assigns it
// server-side — carried through so a fallback job card can show one
// specific work-type instead of the company's whole workplaceTypes list.
export const classifiedJobTitleSchema = z.object({
  title: z.string(),
  workType: workplaceTypeSchema,
});
export type ClassifiedJobTitle = z.infer<typeof classifiedJobTitleSchema>;

// One company's public job data, served by GET /companies/:slug/job-postings
// for the "Job Postings" tab on its profile page. The exact two arrays a
// /jobs card already renders (see companyListItemSchema in company.ts):
// owner-authored, currently-PUBLISHED postings, plus the auto-classified
// EmploymentHistory job-title fallback. Kept as its own slug-scoped endpoint
// (not folded into CompanyDetail) so the tab fetches this stream on its own,
// independently of the ratings/social streams.
export const companyJobPostingsSchema = z.object({
  jobPostings: z.array(publicJobPostingSchema),
  jobTitles: z.array(classifiedJobTitleSchema),
});
export type CompanyJobPostings = z.infer<typeof companyJobPostingsSchema>;

// boost is null for "Continue without boost". billing is required only when
// the chosen boost isn't covered by a free monthly allowance (iyzico
// one-time checkout), reusing checkoutBillingInputSchema rather than a new
// billing shape.
export const createJobPostingInputSchema = z.object({
  jobTitle: z.string().trim().min(1).max(200),
  description: z.string().min(1).max(JOB_DESCRIPTION_MAX_LENGTH),
  workType: workplaceTypeSchema,
  positions: z
    .array(jobPositionSchema)
    .min(1, "Pick at least one position")
    .max(MAX_JOB_POSITIONS, "Pick at most 3 positions")
    .refine((v) => new Set(v).size === v.length, "Each position can be picked once"),
  salary: jobSalaryInputSchema,
  autoReshareEnabled: z.boolean().optional().default(false),
  boost: z
    .object({
      option: boostOptionSchema,
      billing: checkoutBillingInputSchema.optional(),
    })
    .nullable(),
});
export type CreateJobPostingInput = z.input<typeof createJobPostingInputSchema>;

// boostError is set only when a paid boost was requested but the payment
// page couldn't be started (e.g. iyzico not configured yet). The posting
// itself was still created and is returned as normal, just without a boost
// — the frontend must NOT treat this as a failed create, or the owner
// resubmits and ends up with a duplicate posting.
export const createJobPostingResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("PUBLISHED"), jobPosting: jobPostingSchema, boostError: z.string().optional() }),
  z.object({ status: z.literal("PENDING_ADMIN"), jobPosting: jobPostingSchema, boostError: z.string().optional() }),
  // iyzico is configured and the boost picked isn't covered by a free
  // credit - here is the hosted checkout form to pay for it.
  z.object({
    status: z.literal("CHECKOUT_REQUIRED"),
    jobPosting: jobPostingSchema,
    checkoutFormContent: z.string(),
    token: z.string(),
  }),
]);
export type CreateJobPostingResult = z.infer<typeof createJobPostingResultSchema>;

export const boostPricingOptionSchema = z.object({
  option: boostOptionSchema,
  durationDays: z.number().int(),
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

// The owner's own view of one of their postings (GET
// my-companies/:companyId/job-postings) — jobPostingSchema plus how many
// days are left before it naturally lapses (0 once it's stopped being
// publicly live, whatever the reason).
export const ownerJobPostingSchema = jobPostingSchema.extend({
  daysRemaining: z.number().int().min(0),
});
export type OwnerJobPosting = z.infer<typeof ownerJobPostingSchema>;

// The owner's "Edit" on a live posting (PATCH my-companies/:companyId/
// job-postings/:jobPostingId). The job title and work type are fixed once
// posted - the description and the positions can change, and a boost can be
// added to a posting that isn't boosted right now. Same positions rule and
// boost/billing shape as create.
export const updateJobPostingInputSchema = z
  .object({
    description: z.string().min(1).max(JOB_DESCRIPTION_MAX_LENGTH).optional(),
    positions: createJobPostingInputSchema.shape.positions.optional(),
    salary: jobSalaryInputSchema.optional(),
    boost: createJobPostingInputSchema.shape.boost.optional(),
  })
  .refine(
    (v) =>
      v.description !== undefined ||
      v.positions !== undefined ||
      v.salary !== undefined ||
      (v.boost !== undefined && v.boost !== null),
    { message: "Change the description, the positions or the salary, or pick a boost" },
  );
export type UpdateJobPostingInput = z.input<typeof updateJobPostingInputSchema>;

// Same three outcomes as a create: saved (live, or back in review when the
// new description was flagged), or a payment page to finish a paid boost.
export const updateJobPostingResultSchema = createJobPostingResultSchema;
export type UpdateJobPostingResult = CreateJobPostingResult;

// The Jobs page's featured row: up to 8 boosted postings shown above the
// standard cards on page 1, each with the company card it belongs to.
export const FEATURED_JOBS_LIMIT = 8;

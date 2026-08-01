import { z } from "zod";

export const ownerTierSchema = z.enum(["FREE", "PLUS"]);
export type OwnerTier = z.infer<typeof ownerTierSchema>;

export const planStatusSchema = z.enum(["NONE", "ACTIVE", "PAST_DUE", "CANCELED"]);
export type PlanStatus = z.infer<typeof planStatusSchema>;

export const companySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  category: z.string(),
  mainPhotoUrl: z.string().url().nullable(),
  description: z.string().nullable(),
  website: z.string().url().nullable(),
  city: z.string().nullable(),
  isVerifiedBadge: z.boolean(),
});
export type Company = z.infer<typeof companySchema>;

// The browse/search list view is a superset of Company — it also carries the
// aggregate score so a results grid can show a rating per card without a
// separate request per company.
export const companyListItemSchema = companySchema.extend({
  overallAvg: z.number().min(0).max(5).nullable(),
  reviewCount: z.number().int().min(0),
});
export type CompanyListItem = z.infer<typeof companyListItemSchema>;

// Distinct category/city values currently in use, to drive filter UI
// (sidebar category list, city/location picker) without hardcoding options.
export const companyFiltersSchema = z.object({
  categories: z.array(z.string()),
  cities: z.array(z.string()),
});
export type CompanyFilters = z.infer<typeof companyFiltersSchema>;

export const adminCreateCompanyInputSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  city: z.string().min(1).optional(),
  mainPhotoUrl: z.string().url().optional(),
});
export type AdminCreateCompanyInput = z.infer<typeof adminCreateCompanyInputSchema>;

// 1.0-5.0 average maps to a fixed label band shown on every company page.
export const scoreBands = [
  { min: 0, max: 1.5, label: "Unsatisfactory" },
  { min: 1.5, max: 2.5, label: "Developing" },
  { min: 2.5, max: 3.5, label: "Effective" },
  { min: 3.5, max: 4.5, label: "Superb" },
  { min: 4.5, max: 5.01, label: "Exemplary" },
] as const;

export function scoreBandLabel(avg: number): string {
  const band = scoreBands.find((b) => avg >= b.min && avg < b.max);
  return band?.label ?? "Unsatisfactory";
}

export const companyAggregateScoreSchema = z.object({
  companyId: z.string().uuid(),
  overallAvg: z.number().min(0).max(5),
  corporateCultureAvg: z.number().min(0).max(5),
  leadershipAvg: z.number().min(0).max(5),
  infrastructureAvg: z.number().min(0).max(5),
  workLifeBalanceAvg: z.number().min(0).max(5),
  stabilityAvg: z.number().min(0).max(5),
  reviewCount: z.number().int().min(0),
});
export type CompanyAggregateScore = z.infer<typeof companyAggregateScoreSchema>;

export const companyDetailSchema = z.object({
  company: companySchema,
  aggregate: companyAggregateScoreSchema.nullable(),
});
export type CompanyDetail = z.infer<typeof companyDetailSchema>;

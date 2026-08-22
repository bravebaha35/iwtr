import { z } from "zod";

export const ownerTierSchema = z.enum(["FREE", "PLUS"]);
export type OwnerTier = z.infer<typeof ownerTierSchema>;

export const planStatusSchema = z.enum(["NONE", "ACTIVE", "PAST_DUE", "CANCELED"]);
export type PlanStatus = z.infer<typeof planStatusSchema>;

// A deliberately small, fixed classification of the *nature* of the work —
// distinct from `category`, which is the specific business type (e.g.
// "Software", "Restaurant"). This is what drives the browse-page filter
// sidebar; `category` does not. Display labels live in apps/web (presentation
// concern), not here — see apps/web/src/lib/workplaceTypes.ts.
export const workplaceTypeSchema = z.enum(["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]);
export type WorkplaceType = z.infer<typeof workplaceTypeSchema>;

// A company can genuinely span more than one kind of work (e.g. a hospital
// is SERVICE + OFFICE) but never more than 2 — a reviewer's own review still
// records a single workplaceType (see review.ts's createReviewInputSchema),
// picked from this set at rating time.
export const companyWorkplaceTypesSchema = z.array(workplaceTypeSchema).min(1).max(2);

// Plain z.string().url() accepts any syntactically valid URL, including
// `javascript:`/`data:`/`vbscript:` schemes (the WHATWG URL parser doesn't
// reject those — `new URL("javascript:alert(1)")` doesn't throw). Neither of
// these fields is currently rendered as a clickable link anywhere in
// apps/web, but the moment one is (an obvious near-term feature for
// mainPhotoUrl/website), an unrestricted scheme here becomes a stored-XSS
// vector with no further code change needed on an attacker's part. Restrict
// to http(s) now rather than the day that link is added.
export const httpUrlSchema = z
  .string()
  .url()
  .refine((url) => /^https?:\/\//i.test(url), { message: "Must be an http:// or https:// URL" });

export const companySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  category: z.string(),
  workplaceTypes: companyWorkplaceTypesSchema,
  mainPhotoUrl: httpUrlSchema.nullable(),
  description: z.string().nullable(),
  website: httpUrlSchema.nullable(),
  // city/district: admin-set at creation, and owner-editable from the "My
  // companies" dashboard (OwnerService.updateMyCompany) via the same
  // resolveLocation validation admin creation uses.
  city: z.string().nullable(),
  district: z.string().nullable(),
  isVerifiedBadge: z.boolean(),
  // Public contact/socials — owner-editable, free tier (not Plus-gated like
  // description/website). All nullable: most companies won't have these
  // filled in until an owner claims and sets them.
  contactEmail: z.string().email().nullable(),
  contactPhone: z.string().nullable(),
  facebookUrl: httpUrlSchema.nullable(),
  instagramUrl: httpUrlSchema.nullable(),
  whatsappUrl: httpUrlSchema.nullable(),
  xUrl: httpUrlSchema.nullable(),
});
export type Company = z.infer<typeof companySchema>;

// GET /companies query params. All filtering (name search, category,
// workplaceType, city/district, minimum rating) now happens server-side —
// previously only `q` was ever sent, and the client filtered the entire
// (up to 5000-row) result set in the browser for everything else. `cities`/
// `districtKeys` are comma-separated because they're genuinely
// multi-select in the UI (CityDistrictPicker lets you pick several
// provinces/districts at once) — `districtKeys` reuses the exact
// `${province}::${district}` key format apps/web's CityDistrictPicker
// already generates (see apps/web/src/components/CityDistrictPicker.tsx's
// districtKey()), so the client doesn't need to reshape anything to send it.
export const companySearchQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.string().trim().max(200).optional(),
  // Comma-separated, like cities/districtKeys below — the sidebar's
  // "Workplace" filter is a multi-select (e.g. Office + Service at once),
  // not a single value, so this can't be a bare workplaceTypeSchema.
  workplaceTypes: z.string().trim().max(200).optional(),
  cities: z.string().trim().max(2000).optional(),
  districtKeys: z.string().trim().max(4000).optional(),
  // Query params arrive as strings — z.coerce.number() converts "3.5" to
  // 3.5 the same way the rest of this schema's callers already expect a
  // parsed value out the other end.
  minRating: z.coerce.number().min(0).max(5).optional(),
});
export type CompanySearchQuery = z.infer<typeof companySearchQuerySchema>;

// The browse/search list view is a superset of Company — it also carries the
// aggregate score so a results grid can show a rating per card without a
// separate request per company.
export const companyListItemSchema = companySchema.extend({
  overallAvg: z.number().min(0).max(5).nullable(),
  reviewCount: z.number().int().min(0),
});
export type CompanyListItem = z.infer<typeof companyListItemSchema>;

// Distinct city values currently in use, to drive the location picker without
// hardcoding a fixed option list. workplaceType is NOT included here — it's a
// small closed enum, so the client just reads workplaceTypeSchema.options
// directly rather than round-tripping a list that never changes.
export const companyFiltersSchema = z.object({
  cities: z.array(z.string()),
});
export type CompanyFilters = z.infer<typeof companyFiltersSchema>;

export const adminCreateCompanyInputSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  workplaceTypes: companyWorkplaceTypesSchema,
  city: z.string().min(1).optional(),
  district: z.string().min(1).optional(),
  mainPhotoUrl: httpUrlSchema.optional(),
});
export type AdminCreateCompanyInput = z.infer<typeof adminCreateCompanyInputSchema>;

// 1.0-5.0 average maps to a fixed label band shown on every company page.
// Exemplary is reserved for a literal perfect 5.0 average (2026-08-02
// correction — it previously started at 4.5, which meant a mediocre-leaning
// 4.6 average could read as "Exemplary"); Superb covers the rest of the top
// point of the scale, 4.0 up to (not including) a perfect 5.0.
export const scoreBands = [
  { min: 0, max: 2.0, label: "Unsatisfactory" },
  { min: 2.0, max: 3.0, label: "Developing" },
  { min: 3.0, max: 4.0, label: "Effective" },
  { min: 4.0, max: 5.0, label: "Superb" },
  { min: 5.0, max: 5.01, label: "Exemplary" },
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

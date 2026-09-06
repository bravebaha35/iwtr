import { z } from "zod";
import { turkeyRegionKeySchema } from "../geo/turkeyRegions";
import { publicJobPostingSchema } from "./jobPosting";

// How a company's reviews are scoped to a physical location — see the
// matching Prisma `StructureType` enum comment in schema.prisma for the full
// explanation of each value.
export const structureTypeSchema = z.enum(["SETTLED", "CITY_BASED", "REGION_BASED"]);
export type StructureType = z.infer<typeof structureTypeSchema>;

export const ownerTierSchema = z.enum(["FREE", "BLUE", "BLUE_PLUS", "ENTERPRISE"]);
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
  // See structureTypeSchema above. region is only ever non-null when
  // structureType is REGION_BASED (enforced at write time, not by this
  // output schema — a plain nullable field is the correct *read* shape
  // regardless of which structureType produced the null/non-null value).
  structureType: structureTypeSchema,
  region: turkeyRegionKeySchema.nullable(),
  isVerifiedBadge: z.boolean(),
  // Admin-only fields (AdminCompaniesService) — see Prisma schema comments.
  // taxNumber is public trade-registry info, not personal PII.
  taxNumber: z.string().nullable(),
  isChainStore: z.boolean(),
  // Owner-editable "currently hiring" toggle — see schema.prisma's comment.
  // Gates visibility on the /jobs page only; the company itself is otherwise
  // unaffected (still shows on the rating homepage regardless of this flag).
  isHiring: z.boolean(),
  // Public contact/socials — owner-editable, free tier (not Plus-gated like
  // description/website). All nullable: most companies won't have these
  // filled in until an owner claims and sets them.
  contactEmail: z.string().email().nullable(),
  contactPhone: z.string().nullable(),
  facebookUrl: httpUrlSchema.nullable(),
  instagramUrl: httpUrlSchema.nullable(),
  whatsappUrl: httpUrlSchema.nullable(),
  xUrl: httpUrlSchema.nullable(),
  linkedinUrl: httpUrlSchema.nullable(),
  youtubeUrl: httpUrlSchema.nullable(),
  glassdoorUrl: httpUrlSchema.nullable(),
  // Denormalized copy of the approved owner's OwnerTier — public-safe,
  // drives the badge shown on browse cards/company page/dashboard. See
  // Company.badgeTier's schema.prisma comment.
  badgeTier: ownerTierSchema,
  // Premium Features box (owner dashboard), paid-tier-gated like
  // description/website above.
  bannerImageUrl: httpUrlSchema.nullable(),
  featuredReviewId: z.string().uuid().nullable(),
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
  // The /jobs page's one addition to the exact same GET /companies search
  // used by the rating homepage (see CLAUDE.md's monorepo-boundary note and
  // CompaniesService.search) — never sent by WorkplaceBrowser. When true,
  // the server also scopes results to isHiring companies and attaches each
  // one's classified jobTitles; when omitted, behavior (and cost) is
  // unchanged for every existing caller.
  includeJobTitles: z.coerce.boolean().optional(),
});
export type CompanySearchQuery = z.infer<typeof companySearchQuerySchema>;

// The browse/search list view is a superset of Company — it also carries the
// aggregate score so a results grid can show a rating per card without a
// separate request per company.
export const companyListItemSchema = companySchema.extend({
  overallAvg: z.number().min(0).max(5).nullable(),
  reviewCount: z.number().int().min(0),
  // Distinct, classified job titles drawn from this company's own
  // EmploymentHistory rows (see classifyJobRole) — only ever populated when
  // the request set includeJobTitles; otherwise always [], never omitted, so
  // every CompanyListItem consumer can rely on the field existing.
  jobTitles: z.array(z.string()),
  // Individually-authored, currently-PUBLISHED job postings (see
  // schemas/jobPosting.ts) — same includeJobTitles-only population rule and
  // always-array convention as jobTitles above.
  jobPostings: z.array(publicJobPostingSchema),
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

export const adminCreateCompanyInputSchema = z
  .object({
    name: z.string().min(1),
    category: z.string().min(1),
    workplaceTypes: companyWorkplaceTypesSchema,
    city: z.string().min(1).optional(),
    district: z.string().min(1).optional(),
    // Defaults to SETTLED (a normal single-address company) when omitted —
    // every pre-existing company in the directory is implicitly this case.
    structureType: structureTypeSchema.optional(),
    region: turkeyRegionKeySchema.optional(),
    mainPhotoUrl: httpUrlSchema.optional(),
    taxNumber: z.string().trim().min(1).optional(),
    isChainStore: z.boolean().optional(),
    // Set by the admin dashboard's "Pending Review Queue" when this create
    // call is approving a worker-suggested name rather than starting from
    // scratch — purely so AdminCompaniesController can log AuditLog's
    // actionType as APPROVE instead of CREATE (AdminCompaniesService.create
    // still runs the exact same logic either way).
    fromSuggestion: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    const structureType = v.structureType ?? "SETTLED";
    if (structureType === "CITY_BASED" && !v.city) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["city"], message: "A city-based company needs a city." });
    }
    if (structureType === "CITY_BASED" && v.region) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["region"], message: "A city-based company can't also have a region." });
    }
    if (structureType === "REGION_BASED" && !v.region) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["region"], message: "A region-based company needs a region." });
    }
    if (structureType === "REGION_BASED" && (v.city || v.district)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["city"], message: "A region-based company can't also have a city/district." });
    }
    if (structureType === "SETTLED" && v.region) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["region"], message: "A settled company can't have a region." });
    }
  });
export type AdminCreateCompanyInput = z.infer<typeof adminCreateCompanyInputSchema>;

// Admin edit ("Edit Company Data" dashboard module) — deliberately the same
// field set an owner can already touch (updateCompanyInputSchema in
// owner.ts) plus the two admin-only fields above, rather than a
// hand-duplicated shape. See AdminCompaniesService.update.
export const adminUpdateCompanyInputSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  workplaceTypes: companyWorkplaceTypesSchema.optional(),
  mainPhotoUrl: httpUrlSchema.optional(),
  description: z.string().optional(),
  website: httpUrlSchema.optional(),
  // Nullable (not just optional): omitting the field means "leave
  // unchanged" (AdminCompaniesService.update), but the admin dashboard's
  // structure-type radio group needs to be able to actively CLEAR city/
  // district/region when switching structureType — e.g. Region-Based ->
  // Settled must null out the now-irrelevant region, not silently leave the
  // old one in place. See AdminCompaniesService.update's use of `?? undefined`.
  city: z.string().min(1).nullable().optional(),
  district: z.string().min(1).nullable().optional(),
  // Cross-field consistency with structureType (e.g. a REGION_BASED company
  // can't also carry a city) is validated in AdminCompaniesService.update
  // against the EXISTING row merged with whatever this partial update
  // actually changes — a zod-level superRefine can't see prior DB state, so
  // it isn't attempted here (unlike adminCreateCompanyInputSchema, where
  // every relevant field is always present in the same call).
  structureType: structureTypeSchema.optional(),
  region: turkeyRegionKeySchema.nullable().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  facebookUrl: httpUrlSchema.optional(),
  instagramUrl: httpUrlSchema.optional(),
  whatsappUrl: httpUrlSchema.optional(),
  xUrl: httpUrlSchema.optional(),
  taxNumber: z.string().trim().min(1).optional(),
  isChainStore: z.boolean().optional(),
});
export type AdminUpdateCompanyInput = z.infer<typeof adminUpdateCompanyInputSchema>;

// A lightweight row for the admin dashboard's search-and-edit list and the
// two "Merge Duplicates" dropdowns — not the full public Company shape,
// just enough to identify one in a list.
export const adminCompanySummarySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  city: z.string().nullable(),
  district: z.string().nullable(),
});
export type AdminCompanySummary = z.infer<typeof adminCompanySummarySchema>;

// One distinct worker-suggested employer name waiting in the "Pending
// Review Queue" — see EmploymentHistory.rawCompanyName / companyId(null)
// and CompanySuggestionDismissal.
export const companySuggestionSchema = z.object({
  nameKey: z.string(),
  rawCompanyName: z.string(),
  workerCount: z.number().int().min(1),
});
export type CompanySuggestion = z.infer<typeof companySuggestionSchema>;

// rawCompanyName only, not nameKey — the server derives the same normalized
// key from it (AdminCompaniesService.dismissSuggestion), so there's exactly
// one place that ever computes it.
export const dismissCompanySuggestionInputSchema = z.object({
  rawCompanyName: z.string().min(1),
});
export type DismissCompanySuggestionInput = z.infer<typeof dismissCompanySuggestionInputSchema>;

// "Merge Duplicates": duplicateId gets folded into masterId and deleted.
export const mergeCompaniesInputSchema = z
  .object({
    masterId: z.string().uuid(),
    duplicateId: z.string().uuid(),
  })
  .refine((v) => v.masterId !== v.duplicateId, { message: "Pick two different companies to merge." });
export type MergeCompaniesInput = z.infer<typeof mergeCompaniesInputSchema>;

export const mergeCompaniesResultSchema = z.object({
  mergedReviewCount: z.number().int().min(0),
  droppedReviewCount: z.number().int().min(0),
  droppedOwnerCount: z.number().int().min(0),
});
export type MergeCompaniesResult = z.infer<typeof mergeCompaniesResultSchema>;

// 1.0-5.0 average maps to a fixed label band shown on every company page and
// browse card. 2026-08-30 relabel: the top of the scale is now split at 4.5
// ("Highly Effective" 4.0-4.5, "Exemplary" 4.5-5.0) rather than reserving
// "Exemplary" for a literal perfect 5.0. The 2.0/3.0/4.0 cut points are
// unchanged. scoreBandLabel() is the single source of these strings — the
// browse card (WorkplaceBrowser.tsx) and owner dashboard already call it.
export const scoreBands = [
  { min: 0, max: 2.0, label: "Unsatisfactory" },
  { min: 2.0, max: 3.0, label: "Developing" },
  { min: 3.0, max: 4.0, label: "Effective" },
  { min: 4.0, max: 4.5, label: "Highly Effective" },
  { min: 4.5, max: 5.01, label: "Exemplary" },
] as const;

export function scoreBandLabel(avg: number): string {
  const band = scoreBands.find((b) => avg >= b.min && avg < b.max);
  return band?.label ?? "Unsatisfactory";
}

// GET /companies/:slug/narrative — the company page's rating-narrative box.
// `description` is: a 450-600 char summary assembled from pre-authored
// SummaryPattern rows (see PatternGeneratorService) when the primary
// work-type has 3+ published reviews; a plain numbers-only sentence when 3+
// reviews but no pattern content is authored yet for that workplaceType;
// null when under 3 reviews (the box then shows a short "summary appears at
// 3 reviews" line built from reviewCount). See
// apps/api/src/modules/company-narrative.
export const companyNarrativeSchema = z.object({
  workplaceType: workplaceTypeSchema,
  reviewCount: z.number().int().min(0),
  description: z.string().max(600).nullable(),
});
export type CompanyNarrative = z.infer<typeof companyNarrativeSchema>;

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

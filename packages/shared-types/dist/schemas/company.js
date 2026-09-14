"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.companyDetailSchema = exports.companyAggregateScoreSchema = exports.companyNarrativeSchema = exports.scoreBands = exports.mergeCompaniesResultSchema = exports.mergeCompaniesInputSchema = exports.dismissCompanySuggestionInputSchema = exports.companySuggestionSchema = exports.adminCompanySummarySchema = exports.setCompanyVisibilityInputSchema = exports.adminUpdateCompanyInputSchema = exports.adminCreateCompanyInputSchema = exports.companyFiltersSchema = exports.companyListItemSchema = exports.companySearchQuerySchema = exports.companySchema = exports.httpUrlSchema = exports.planStatusSchema = exports.ownerTierSchema = exports.structureTypeSchema = exports.defaultBannerUrlForWorkplaceType = exports.DEFAULT_BANNER_URL_BY_WORKPLACE_TYPE = exports.secondaryWorkplaceType = exports.primaryWorkplaceType = exports.companyWorkplaceTypesSchema = exports.workplaceTypeSchema = void 0;
exports.scoreBandLabel = scoreBandLabel;
const zod_1 = require("zod");
const turkeyRegions_1 = require("../geo/turkeyRegions");
const jobPosting_1 = require("./jobPosting");
const workplaceType_1 = require("./workplaceType");
Object.defineProperty(exports, "workplaceTypeSchema", { enumerable: true, get: function () { return workplaceType_1.workplaceTypeSchema; } });
Object.defineProperty(exports, "companyWorkplaceTypesSchema", { enumerable: true, get: function () { return workplaceType_1.companyWorkplaceTypesSchema; } });
Object.defineProperty(exports, "primaryWorkplaceType", { enumerable: true, get: function () { return workplaceType_1.primaryWorkplaceType; } });
Object.defineProperty(exports, "secondaryWorkplaceType", { enumerable: true, get: function () { return workplaceType_1.secondaryWorkplaceType; } });
Object.defineProperty(exports, "DEFAULT_BANNER_URL_BY_WORKPLACE_TYPE", { enumerable: true, get: function () { return workplaceType_1.DEFAULT_BANNER_URL_BY_WORKPLACE_TYPE; } });
Object.defineProperty(exports, "defaultBannerUrlForWorkplaceType", { enumerable: true, get: function () { return workplaceType_1.defaultBannerUrlForWorkplaceType; } });
// How a company's reviews are scoped to a physical location — see the
// matching Prisma `StructureType` enum comment in schema.prisma for the full
// explanation of each value.
exports.structureTypeSchema = zod_1.z.enum(["SETTLED", "CITY_BASED", "REGION_BASED"]);
exports.ownerTierSchema = zod_1.z.enum(["FREE", "BLUE", "BLUE_PLUS", "ENTERPRISE"]);
exports.planStatusSchema = zod_1.z.enum(["NONE", "ACTIVE", "PAST_DUE", "CANCELED"]);
// Plain z.string().url() accepts any syntactically valid URL, including
// `javascript:`/`data:`/`vbscript:` schemes (the WHATWG URL parser doesn't
// reject those — `new URL("javascript:alert(1)")` doesn't throw). Neither of
// these fields is currently rendered as a clickable link anywhere in
// apps/web, but the moment one is (an obvious near-term feature for
// mainPhotoUrl/website), an unrestricted scheme here becomes a stored-XSS
// vector with no further code change needed on an attacker's part. Restrict
// to http(s) now rather than the day that link is added.
exports.httpUrlSchema = zod_1.z
    .string()
    .url()
    .refine((url) => /^https?:\/\//i.test(url), { message: "Must be an http:// or https:// URL" });
exports.companySchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    slug: zod_1.z.string(),
    name: zod_1.z.string(),
    category: zod_1.z.string(),
    workplaceTypes: workplaceType_1.companyWorkplaceTypesSchema,
    mainPhotoUrl: exports.httpUrlSchema.nullable(),
    description: zod_1.z.string().nullable(),
    website: exports.httpUrlSchema.nullable(),
    // city/district: admin-set at creation, and owner-editable from the "My
    // companies" dashboard (OwnerService.updateMyCompany) via the same
    // resolveLocation validation admin creation uses.
    city: zod_1.z.string().nullable(),
    district: zod_1.z.string().nullable(),
    // See structureTypeSchema above. region is only ever non-null when
    // structureType is REGION_BASED (enforced at write time, not by this
    // output schema — a plain nullable field is the correct *read* shape
    // regardless of which structureType produced the null/non-null value).
    structureType: exports.structureTypeSchema,
    region: turkeyRegions_1.turkeyRegionKeySchema.nullable(),
    isVerifiedBadge: zod_1.z.boolean(),
    // Admin-only fields (AdminCompaniesService) — see Prisma schema comments.
    // taxNumber is public trade-registry info, not personal PII.
    taxNumber: zod_1.z.string().nullable(),
    isChainStore: zod_1.z.boolean(),
    // Owner-editable "currently hiring" toggle — see schema.prisma's comment.
    // Gates visibility on the /jobs page only; the company itself is otherwise
    // unaffected (still shows on the rating homepage regardless of this flag).
    isHiring: zod_1.z.boolean(),
    // Public contact/socials — owner-editable, free tier (not Plus-gated like
    // description/website). All nullable: most companies won't have these
    // filled in until an owner claims and sets them.
    contactEmail: zod_1.z.string().email().nullable(),
    contactPhone: zod_1.z.string().nullable(),
    facebookUrl: exports.httpUrlSchema.nullable(),
    instagramUrl: exports.httpUrlSchema.nullable(),
    whatsappUrl: exports.httpUrlSchema.nullable(),
    xUrl: exports.httpUrlSchema.nullable(),
    linkedinUrl: exports.httpUrlSchema.nullable(),
    youtubeUrl: exports.httpUrlSchema.nullable(),
    glassdoorUrl: exports.httpUrlSchema.nullable(),
    // Denormalized copy of the approved owner's OwnerTier — public-safe,
    // drives the badge shown on browse cards/company page/dashboard. See
    // Company.badgeTier's schema.prisma comment.
    badgeTier: exports.ownerTierSchema,
    // Premium Features box (owner dashboard), paid-tier-gated like
    // description/website above.
    bannerImageUrl: exports.httpUrlSchema.nullable(),
    // System-assigned default banner for this company, keyed on its primary
    // work-type (see DEFAULT_BANNER_URL_BY_WORKPLACE_TYPE). Always present -
    // the frontend shows bannerImageUrl when set (a paid-tier custom banner),
    // otherwise this. Computed by the read endpoint, never stored.
    defaultBannerUrl: zod_1.z.string(),
    // True when this company has an approved owner (any tier). Drives the
    // "claimed" signals: a Free-tier owned company gets a minimal check-mark,
    // and any owned company shows its default banner in colour while an
    // unowned one is rendered greyscale. Computed, never stored.
    hasApprovedOwner: zod_1.z.boolean(),
    featuredReviewId: zod_1.z.string().uuid().nullable(),
    // 0-3. Increments when this company reposts a title+workType that matches
    // an earlier posting of theirs already marked FILLED — see
    // JobPostingsService.create. Visible to every worker, by design (the
    // whole point is public accountability for repost-after-claiming-a-hire
    // spam).
    riskScore: zod_1.z.number().int().min(0).max(3),
    // Computed (not stored) — true when both of this company's workplaceTypes
    // already have a PUBLISHED review, which locks OwnerService.updateMyCompany
    // against further workplaceTypes edits. Only ever computed on the
    // single-company detail fetch (CompaniesService.getBySlug) — omitted
    // (undefined) on browse/search list rows, where per-row lock status isn't
    // needed and computing it for every row would add a query per card.
    workplaceTypesLocked: zod_1.z.boolean().optional(),
});
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
exports.companySearchQuerySchema = zod_1.z.object({
    q: zod_1.z.string().trim().max(200).optional(),
    category: zod_1.z.string().trim().max(200).optional(),
    // Comma-separated, like cities/districtKeys below — the sidebar's
    // "Workplace" filter is a multi-select (e.g. Office + Service at once),
    // not a single value, so this can't be a bare workplaceTypeSchema.
    workplaceTypes: zod_1.z.string().trim().max(200).optional(),
    cities: zod_1.z.string().trim().max(2000).optional(),
    districtKeys: zod_1.z.string().trim().max(4000).optional(),
    // Query params arrive as strings — z.coerce.number() converts "3.5" to
    // 3.5 the same way the rest of this schema's callers already expect a
    // parsed value out the other end.
    minRating: zod_1.z.coerce.number().min(0).max(5).optional(),
    // The /jobs page's one addition to the exact same GET /companies search
    // used by the rating homepage (see CLAUDE.md's monorepo-boundary note and
    // CompaniesService.search) — never sent by WorkplaceBrowser. When true,
    // the server also scopes results to isHiring companies and attaches each
    // one's classified jobTitles; when omitted, behavior (and cost) is
    // unchanged for every existing caller.
    includeJobTitles: zod_1.z.coerce.boolean().optional(),
});
// The browse/search list view is a superset of Company — it also carries the
// aggregate score so a results grid can show a rating per card without a
// separate request per company.
exports.companyListItemSchema = exports.companySchema.extend({
    overallAvg: zod_1.z.number().min(0).max(5).nullable(),
    reviewCount: zod_1.z.number().int().min(0),
    // Distinct, classified job titles drawn from this company's own
    // EmploymentHistory rows (see classifyJobRole) — only ever populated when
    // the request set includeJobTitles; otherwise always [], never omitted, so
    // every CompanyListItem consumer can rely on the field existing.
    jobTitles: zod_1.z.array(zod_1.z.string()),
    // Individually-authored, currently-PUBLISHED job postings (see
    // schemas/jobPosting.ts) — same includeJobTitles-only population rule and
    // always-array convention as jobTitles above.
    jobPostings: zod_1.z.array(jobPosting_1.publicJobPostingSchema),
});
// Distinct city values currently in use, to drive the location picker without
// hardcoding a fixed option list. workplaceType is NOT included here — it's a
// small closed enum, so the client just reads workplaceTypeSchema.options
// directly rather than round-tripping a list that never changes.
exports.companyFiltersSchema = zod_1.z.object({
    cities: zod_1.z.array(zod_1.z.string()),
});
exports.adminCreateCompanyInputSchema = zod_1.z
    .object({
    name: zod_1.z.string().min(1),
    category: zod_1.z.string().min(1),
    workplaceTypes: workplaceType_1.companyWorkplaceTypesSchema,
    city: zod_1.z.string().min(1).optional(),
    district: zod_1.z.string().min(1).optional(),
    // Defaults to SETTLED (a normal single-address company) when omitted —
    // every pre-existing company in the directory is implicitly this case.
    structureType: exports.structureTypeSchema.optional(),
    region: turkeyRegions_1.turkeyRegionKeySchema.optional(),
    mainPhotoUrl: exports.httpUrlSchema.optional(),
    taxNumber: zod_1.z.string().trim().min(1).optional(),
    isChainStore: zod_1.z.boolean().optional(),
    // Set by the admin dashboard's "Pending Review Queue" when this create
    // call is approving a worker-suggested name rather than starting from
    // scratch — purely so AdminCompaniesController can log AuditLog's
    // actionType as APPROVE instead of CREATE (AdminCompaniesService.create
    // still runs the exact same logic either way).
    fromSuggestion: zod_1.z.boolean().optional(),
})
    .superRefine((v, ctx) => {
    const structureType = v.structureType ?? "SETTLED";
    if (structureType === "CITY_BASED" && !v.city) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["city"], message: "A city-based company needs a city." });
    }
    if (structureType === "CITY_BASED" && v.region) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["region"], message: "A city-based company can't also have a region." });
    }
    if (structureType === "REGION_BASED" && !v.region) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["region"], message: "A region-based company needs a region." });
    }
    if (structureType === "REGION_BASED" && (v.city || v.district)) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["city"], message: "A region-based company can't also have a city/district." });
    }
    if (structureType === "SETTLED" && v.region) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["region"], message: "A settled company can't have a region." });
    }
});
// Admin edit ("Edit Company Data" dashboard module) — deliberately the same
// field set an owner can already touch (updateCompanyInputSchema in
// owner.ts) plus the two admin-only fields above, rather than a
// hand-duplicated shape. See AdminCompaniesService.update.
exports.adminUpdateCompanyInputSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    category: zod_1.z.string().min(1).optional(),
    workplaceTypes: workplaceType_1.companyWorkplaceTypesSchema.optional(),
    mainPhotoUrl: exports.httpUrlSchema.optional(),
    description: zod_1.z.string().optional(),
    website: exports.httpUrlSchema.optional(),
    // Nullable (not just optional): omitting the field means "leave
    // unchanged" (AdminCompaniesService.update), but the admin dashboard's
    // structure-type radio group needs to be able to actively CLEAR city/
    // district/region when switching structureType — e.g. Region-Based ->
    // Settled must null out the now-irrelevant region, not silently leave the
    // old one in place. See AdminCompaniesService.update's use of `?? undefined`.
    city: zod_1.z.string().min(1).nullable().optional(),
    district: zod_1.z.string().min(1).nullable().optional(),
    // Cross-field consistency with structureType (e.g. a REGION_BASED company
    // can't also carry a city) is validated in AdminCompaniesService.update
    // against the EXISTING row merged with whatever this partial update
    // actually changes — a zod-level superRefine can't see prior DB state, so
    // it isn't attempted here (unlike adminCreateCompanyInputSchema, where
    // every relevant field is always present in the same call).
    structureType: exports.structureTypeSchema.optional(),
    region: turkeyRegions_1.turkeyRegionKeySchema.nullable().optional(),
    contactEmail: zod_1.z.string().email().optional(),
    contactPhone: zod_1.z.string().optional(),
    facebookUrl: exports.httpUrlSchema.optional(),
    instagramUrl: exports.httpUrlSchema.optional(),
    whatsappUrl: exports.httpUrlSchema.optional(),
    xUrl: exports.httpUrlSchema.optional(),
    taxNumber: zod_1.z.string().trim().min(1).optional(),
    isChainStore: zod_1.z.boolean().optional(),
});
// PATCH /admin/companies/:id/visibility — an ADMIN hides an entire company
// (hidden: true stamps Company.hiddenAt) or restores it (hidden: false clears
// it). A hidden company keeps all its data but vanishes from every public
// surface via the shared PUBLIC_COMPANY_WHERE / assertCompanyVisibleOrThrow
// gate. See AdminCompaniesService.setVisibility.
exports.setCompanyVisibilityInputSchema = zod_1.z.object({ hidden: zod_1.z.boolean() });
// A lightweight row for the admin dashboard's search-and-edit list and the
// two "Merge Duplicates" dropdowns — not the full public Company shape,
// just enough to identify one in a list.
exports.adminCompanySummarySchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    slug: zod_1.z.string(),
    name: zod_1.z.string(),
    city: zod_1.z.string().nullable(),
    district: zod_1.z.string().nullable(),
    // True when an ADMIN has hidden this company (Company.hiddenAt !== null) --
    // drives the Hide/Unhide toggle on the admin content-moderation page
    // (apps/web/src/app/admin/content). See AdminCompaniesService.search.
    hidden: zod_1.z.boolean(),
});
// One distinct worker-suggested employer name waiting in the "Pending
// Review Queue" — see EmploymentHistory.rawCompanyName / companyId(null)
// and CompanySuggestionDismissal.
exports.companySuggestionSchema = zod_1.z.object({
    nameKey: zod_1.z.string(),
    rawCompanyName: zod_1.z.string(),
    workerCount: zod_1.z.number().int().min(1),
});
// rawCompanyName only, not nameKey — the server derives the same normalized
// key from it (AdminCompaniesService.dismissSuggestion), so there's exactly
// one place that ever computes it.
exports.dismissCompanySuggestionInputSchema = zod_1.z.object({
    rawCompanyName: zod_1.z.string().min(1),
});
// "Merge Duplicates": duplicateId gets folded into masterId and deleted.
exports.mergeCompaniesInputSchema = zod_1.z
    .object({
    masterId: zod_1.z.string().uuid(),
    duplicateId: zod_1.z.string().uuid(),
})
    .refine((v) => v.masterId !== v.duplicateId, { message: "Pick two different companies to merge." });
exports.mergeCompaniesResultSchema = zod_1.z.object({
    mergedReviewCount: zod_1.z.number().int().min(0),
    droppedReviewCount: zod_1.z.number().int().min(0),
    droppedOwnerCount: zod_1.z.number().int().min(0),
});
// 1.0-5.0 average maps to a fixed label band shown on every company page and
// browse card. 2026-08-30 relabel: the top of the scale is now split at 4.5
// ("Highly Effective" 4.0-4.5, "Exemplary" 4.5-5.0) rather than reserving
// "Exemplary" for a literal perfect 5.0. The 2.0/3.0/4.0 cut points are
// unchanged. scoreBandLabel() is the single source of these strings — the
// browse card (WorkplaceBrowser.tsx) and owner dashboard already call it.
exports.scoreBands = [
    { min: 0, max: 2.0, label: "Unsatisfactory" },
    { min: 2.0, max: 3.0, label: "Developing" },
    { min: 3.0, max: 4.0, label: "Effective" },
    { min: 4.0, max: 4.5, label: "Highly Effective" },
    { min: 4.5, max: 5.01, label: "Exemplary" },
];
function scoreBandLabel(avg) {
    const band = exports.scoreBands.find((b) => avg >= b.min && avg < b.max);
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
exports.companyNarrativeSchema = zod_1.z.object({
    workplaceType: workplaceType_1.workplaceTypeSchema,
    reviewCount: zod_1.z.number().int().min(0),
    description: zod_1.z.string().max(600).nullable(),
});
exports.companyAggregateScoreSchema = zod_1.z.object({
    companyId: zod_1.z.string().uuid(),
    overallAvg: zod_1.z.number().min(0).max(5),
    corporateCultureAvg: zod_1.z.number().min(0).max(5),
    leadershipAvg: zod_1.z.number().min(0).max(5),
    infrastructureAvg: zod_1.z.number().min(0).max(5),
    workLifeBalanceAvg: zod_1.z.number().min(0).max(5),
    stabilityAvg: zod_1.z.number().min(0).max(5),
    reviewCount: zod_1.z.number().int().min(0),
});
exports.companyDetailSchema = zod_1.z.object({
    company: exports.companySchema,
    aggregate: exports.companyAggregateScoreSchema.nullable(),
});

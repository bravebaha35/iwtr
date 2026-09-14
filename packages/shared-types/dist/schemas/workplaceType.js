"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BANNER_URL_BY_WORKPLACE_TYPE = exports.companyWorkplaceTypesSchema = exports.workplaceTypeSchema = void 0;
exports.primaryWorkplaceType = primaryWorkplaceType;
exports.secondaryWorkplaceType = secondaryWorkplaceType;
exports.defaultBannerUrlForWorkplaceType = defaultBannerUrlForWorkplaceType;
const zod_1 = require("zod");
// A deliberately small, fixed classification of the *nature* of the work —
// distinct from `Company.category`, which is the specific business type
// (e.g. "Software", "Restaurant"). This is what drives the browse-page
// filter sidebar; `category` does not. Display labels live in apps/web
// (presentation concern), not here — see apps/web/src/lib/workplaceTypes.ts.
exports.workplaceTypeSchema = zod_1.z.enum(["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]);
// A company can genuinely span more than one kind of work (e.g. a hospital
// is SERVICE + OFFICE) but never more than 2 — a reviewer's own review still
// records a single workplaceType (see review.ts's createReviewInputSchema),
// picked from this set at rating time.
exports.companyWorkplaceTypesSchema = zod_1.z.array(exports.workplaceTypeSchema).min(1).max(2);
// The work-type list is capped at 1-2 above. By platform convention item 0
// is the company's PRIMARY work-type (required) and item 1, when present, the
// SECONDARY (optional) - the owner picks them as two separate dropdowns and
// every employee-facing surface renders the primary in bold, the secondary
// in a normal weight. Kept as one ordered array rather than two columns
// because the cap already encodes "one required + one optional"; these
// accessors are the single place that ordering is given meaning.
function primaryWorkplaceType(company) {
    return company.workplaceTypes[0];
}
function secondaryWorkplaceType(company) {
    return company.workplaceTypes[1] ?? null;
}
// System-assigned default banner, keyed SOLELY on the primary work-type -
// served by the company read endpoints as Company.defaultBannerUrl and
// rendered whenever a company has no custom bannerImageUrl. Paths are
// root-relative to the web app, which serves these files from its public/
// directory (committed alongside this repo).
exports.DEFAULT_BANNER_URL_BY_WORKPLACE_TYPE = {
    OFFICE: "/office-default-banner.webp",
    HYBRID_REMOTE: "/hybrid-remote-default-banner.webp",
    SERVICE: "/service-default-banner.webp",
    MANUAL_LABOUR: "/manual-labour-default-banner.webp",
};
function defaultBannerUrlForWorkplaceType(primary) {
    return exports.DEFAULT_BANNER_URL_BY_WORKPLACE_TYPE[primary];
}

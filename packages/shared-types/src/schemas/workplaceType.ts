import { z } from "zod";

// A deliberately small, fixed classification of the *nature* of the work —
// distinct from `Company.category`, which is the specific business type
// (e.g. "Software", "Restaurant"). This is what drives the browse-page
// filter sidebar; `category` does not. Display labels live in apps/web
// (presentation concern), not here — see apps/web/src/lib/workplaceTypes.ts.
export const workplaceTypeSchema = z.enum(["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]);
export type WorkplaceType = z.infer<typeof workplaceTypeSchema>;

// A company can genuinely span more than one kind of work (e.g. a hospital
// is SERVICE + OFFICE) but never more than 2 — a reviewer's own review still
// records a single workplaceType (see review.ts's createReviewInputSchema),
// picked from this set at rating time.
export const companyWorkplaceTypesSchema = z.array(workplaceTypeSchema).min(1).max(2);

// The work-type list is capped at 1-2 above. By platform convention item 0
// is the company's PRIMARY work-type (required) and item 1, when present, the
// SECONDARY (optional) - the owner picks them as two separate dropdowns and
// every employee-facing surface renders the primary in bold, the secondary
// in a normal weight. Kept as one ordered array rather than two columns
// because the cap already encodes "one required + one optional"; these
// accessors are the single place that ordering is given meaning.
export function primaryWorkplaceType(company: { workplaceTypes: WorkplaceType[] }): WorkplaceType {
  return company.workplaceTypes[0];
}
export function secondaryWorkplaceType(company: { workplaceTypes: WorkplaceType[] }): WorkplaceType | null {
  return company.workplaceTypes[1] ?? null;
}

// System-assigned default banner, keyed SOLELY on the primary work-type -
// served by the company read endpoints as Company.defaultBannerUrl and
// rendered whenever a company has no custom bannerImageUrl. Paths are
// root-relative to the web app, which serves these files from its public/
// directory (committed alongside this repo).
export const DEFAULT_BANNER_URL_BY_WORKPLACE_TYPE: Record<WorkplaceType, string> = {
  OFFICE: "/office-default-banner.webp",
  HYBRID_REMOTE: "/hybrid-remote-default-banner.webp",
  SERVICE: "/service-default-banner.webp",
  MANUAL_LABOUR: "/manual-labour-default-banner.webp",
};

export function defaultBannerUrlForWorkplaceType(primary: WorkplaceType): string {
  return DEFAULT_BANNER_URL_BY_WORKPLACE_TYPE[primary];
}

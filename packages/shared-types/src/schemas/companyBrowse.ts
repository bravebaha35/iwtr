import { z } from "zod";
import { companyListItemSchema, companySearchQuerySchema } from "./company";
import { publicJobPostingSchema } from "./jobPosting";
import { workplaceTypeSchema } from "./workplaceType";

// The homepage's workplace grid, one page at a time (GET /companies/browse).
// The server filters, sorts and pages, and sends back only the 20 cards on
// screen plus the counts the page needs - instead of the whole directory
// for the browser to sort through.

// Quick Select groups over Company.category. "FIRMS" is everything that
// isn't in one of the other groups.
export const categoryGroupSchema = z.enum([
  "FIRMS",
  "SUPERMARKET",
  "FRANCHISE",
  "LOGISTICS",
  "CLOTHING",
  "SERVICE_PROVIDERS",
  "OIL_ENERGY",
]);
export type CategoryGroup = z.infer<typeof categoryGroupSchema>;

export const CATEGORY_GROUP_CATEGORY: Record<Exclude<CategoryGroup, "FIRMS">, string> = {
  SUPERMARKET: "Supermarket",
  FRANCHISE: "Franchise",
  LOGISTICS: "Logistics",
  CLOTHING: "Clothing Retail",
  SERVICE_PROVIDERS: "Telecom",
  OIL_ENERGY: "Fuel & Energy",
};

export function matchesCategoryGroup(company: { category: string }, group: CategoryGroup | null): boolean {
  if (!group) return true;
  if (group === "FIRMS") return !Object.values(CATEGORY_GROUP_CATEGORY).includes(company.category);
  return company.category === CATEGORY_GROUP_CATEGORY[group];
}

// "ratingAsc"/"ratingDesc", "alphabetical"/"alphabeticalDesc" and
// "riskDesc"/"riskAsc" (the Jobs page RS button) are each two states of one button.
export const companySortSchema = z.enum([
  "default",
  "alphabetical",
  "alphabeticalDesc",
  "ratingAsc",
  "ratingDesc",
  "riskDesc",
  "riskAsc",
]);
export type CompanySort = z.infer<typeof companySortSchema>;

export const COMPANY_BROWSE_PAGE_SIZE = 20;
// The Jobs page is paged by job card, not by company: 4 across, 5 rows, so
// 20 cards a page - the same grid as the homepage. Page 1 also carries the
// Featured row (up to 8, i.e. up to 2 of those 5 rows), so it holds fewer
// standard cards: see jobsFirstPageSize.
export const JOBS_BROWSE_PAGE_SIZE = 20;
export const JOBS_GRID_COLUMNS = 4;

/** Standard cards on page 1 of Jobs: 20 minus the rows the Featured ads take (8 featured -> 12). */
export function jobsFirstPageSize(featuredCount: number): number {
  const featuredRows = Math.ceil(Math.max(0, featuredCount) / JOBS_GRID_COLUMNS);
  return Math.max(JOBS_GRID_COLUMNS, JOBS_BROWSE_PAGE_SIZE - featuredRows * JOBS_GRID_COLUMNS);
}

/** How many pages `total` standard job cards fill, given how many featured ads sit on page 1. */
export function jobsPageCount(total: number, featuredCount: number): number {
  const first = jobsFirstPageSize(featuredCount);
  return total <= first ? 1 : 1 + Math.ceil((total - first) / JOBS_BROWSE_PAGE_SIZE);
}

/** Where page `page` (1-based) starts in the list of standard job cards, and how many it holds. */
export function jobsPageRange(page: number, featuredCount: number): { start: number; size: number } {
  const first = jobsFirstPageSize(featuredCount);
  return page <= 1 ? { start: 0, size: first } : { start: first + (page - 2) * JOBS_BROWSE_PAGE_SIZE, size: JOBS_BROWSE_PAGE_SIZE };
}

export const companyBrowseQuerySchema = companySearchQuerySchema
  .omit({ includeJobTitles: true })
  .extend({
    categoryGroup: categoryGroupSchema.optional(),
    sort: companySortSchema.optional(),
    // "Near Me": the province nearest the visitor, worked out in their own
    // browser - only a province name ever reaches the server, never a position.
    nearCity: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).max(100000).optional(),
    // The Jobs page: hiring companies only, every one shown (no "reviewed
    // first" rule), paged by job card - each item is one card: a company
    // carrying the single posting (or inferred job title) that card shows.
    jobs: z.enum(["1"]).optional(),
    // The Jobs page's "Following" list narrows to one company.
    companyId: z.string().uuid().optional(),
    // Featured row only: the member's own Sector / kind of work, sent while
    // they haven't picked one in the sidebar (see pickFeatured).
    forSector: z.string().trim().max(100).optional(),
    forWorkType: workplaceTypeSchema.optional(),
  });
export type CompanyBrowseQuery = z.infer<typeof companyBrowseQuerySchema>;

export const companyBrowseResultSchema = z.object({
  items: z.array(companyListItemSchema),
  // Workplaces matching the filters and shown (all pages together). On the
  // Jobs page: standard job cards, all pages together.
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  // Jobs page only (its first page is shorter than the rest, so the page
  // count can't be worked out from total / pageSize).
  totalPages: z.number().int().min(1).optional(),
  // Unreviewed workplaces left out of the default view (A-Z, Quick Select or
  // a search brings them in).
  hiddenUnratedCount: z.number().int().min(0),
  // Jobs page, page 1 only: the boosted postings (at most FEATURED_JOBS_LIMIT)
  // shown above the standard cards, each with its company card. Empty on
  // every other page and on the homepage.
  featured: z
    .array(z.object({ company: companyListItemSchema, posting: publicJobPostingSchema }))
    .optional()
    .default([]),
});
export type CompanyBrowseResult = z.infer<typeof companyBrowseResultSchema>;

// GET /companies/employer-ad: the employer ad space beside the search bar on
// the Rating and Jobs pages. One company that bought the ad-space package
// (AD_SPACE_14), with the posting it's for - or null when none is running.
export const employerAdSchema = z
  .object({ company: companyListItemSchema, posting: publicJobPostingSchema })
  .nullable();
export type EmployerAd = z.infer<typeof employerAdSchema>;

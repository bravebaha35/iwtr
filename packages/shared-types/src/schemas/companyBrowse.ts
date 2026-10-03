import { z } from "zod";
import { companyListItemSchema, companySearchQuerySchema } from "./company";

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

// "ratingAsc"/"ratingDesc" and "alphabetical"/"alphabeticalDesc" are each two
// states of one button.
export const companySortSchema = z.enum(["default", "alphabetical", "alphabeticalDesc", "ratingAsc", "ratingDesc"]);
export type CompanySort = z.infer<typeof companySortSchema>;

export const COMPANY_BROWSE_PAGE_SIZE = 20;

export const companyBrowseQuerySchema = companySearchQuerySchema
  .omit({ includeJobTitles: true })
  .extend({
    categoryGroup: categoryGroupSchema.optional(),
    sort: companySortSchema.optional(),
    // "Near Me": the province nearest the visitor, worked out in their own
    // browser - only a province name ever reaches the server, never a position.
    nearCity: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).max(100000).optional(),
  });
export type CompanyBrowseQuery = z.infer<typeof companyBrowseQuerySchema>;

export const companyBrowseResultSchema = z.object({
  items: z.array(companyListItemSchema),
  // Workplaces matching the filters and shown (all pages together).
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  // Unreviewed workplaces left out of the default view (A-Z, Quick Select or
  // a search brings them in).
  hiddenUnratedCount: z.number().int().min(0),
});
export type CompanyBrowseResult = z.infer<typeof companyBrowseResultSchema>;

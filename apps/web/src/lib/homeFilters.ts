// sessionStorage key for the rating homepage's filters (WorkplaceBrowser).
export const HOME_FILTERS_STORAGE_KEY = "iwtr:homeFilters";

/**
 * The homepage keeps its filters only while the visitor is looking at a
 * company from it (a company page, then back). Any other page - Jobs,
 * Social, Messages, a profile page - means they've left, so the homepage
 * starts fresh next time.
 */
export function keepsHomeFilters(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/companies/");
}

import type { CompanyBrowseResult } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";

// The homepage grid's pages (GET /companies/browse), kept for a minute so
// going back to a page you just saw, or forward to one fetched ahead of
// time, shows instantly with no request. Small on purpose: at most 40 pages
// of 20 cards each.
const MAX_ENTRIES = 40;
const TTL_MS = 60_000;

const cache = new Map<string, { at: number; result: Promise<CompanyBrowseResult> }>();

const keyFor = (params: string, page: number) => (params ? `${params}&page=${page}` : `page=${page}`);

function fresh(key: string): Promise<CompanyBrowseResult> | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.result;
}

/** One page of the grid. `params` is the query string without a page number. */
export function fetchBrowsePage(params: string, page: number): Promise<CompanyBrowseResult> {
  const key = keyFor(params, page);
  const hit = fresh(key);
  if (hit) return hit;
  const result = apiGet<CompanyBrowseResult>(`/companies/browse?${key}`);
  cache.set(key, { at: Date.now(), result });
  // A failed request mustn't stay cached.
  result.catch(() => cache.delete(key));
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  return result;
}

/** Whether that page is already in hand (so showing it needs no wait at all). */
export function hasBrowsePage(params: string, page: number): boolean {
  return fresh(keyFor(params, page)) !== null;
}

/** Fetch a page ahead of time, quietly, so clicking to it is instant. */
export function prefetchBrowsePage(params: string, page: number): void {
  fetchBrowsePage(params, page).catch(() => {});
}

/** Test hook: start from an empty cache. */
export function clearBrowseCache(): void {
  cache.clear();
}

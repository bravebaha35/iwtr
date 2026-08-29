import type { WorkplaceType } from "@iwtr/shared-types";

// Placeholder job-title data for a browse-grid CompanyCard's "open roles"
// line. There is no job-postings/hiring-profile system yet — no Prisma
// model, no owner/admin UI to create one — so this is deliberately a
// presentational stand-in, not real listings, matching this repo's existing
// "Mode B, frontend-only" pattern (see PremiumFeaturesPanel.tsx, the Pricing
// popup) of shipping the visual/UX shape before the backend exists. Titles
// are picked deterministically from the company's own id so the same
// company always shows the same titles on every render/sort/re-fetch
// instead of jittering. The day a real job-postings table exists, only this
// file's internals need to change — every call site just reads
// sampleJobTitles(company) and renders whatever comes back.
const TITLE_POOL: Record<WorkplaceType, string[]> = {
  OFFICE: ["Assistant Manager", "Administrative Assistant", "Accountant", "HR Specialist"],
  HYBRID_REMOTE: ["Customer Service Agent", "Data Entry Specialist", "IT Support Specialist"],
  SERVICE: ["Salesman", "Customer Service Agent", "Cashier", "Waiter/Waitress"],
  MANUAL_LABOUR: ["Forklift Operator", "Warehouse Worker", "Machine Operator", "Construction Laborer"],
};

function seedFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash;
}

// Returns up to 2 titles: one per work-type when a company spans two (e.g.
// SERVICE + OFFICE gets one relevant title from each pool), or two distinct
// titles from the single pool otherwise.
export function sampleJobTitles(company: { id: string; workplaceTypes: WorkplaceType[] }): string[] {
  const seed = seedFromId(company.id);

  if (company.workplaceTypes.length >= 2) {
    return company.workplaceTypes.map((type, i) => {
      const pool = TITLE_POOL[type];
      return pool[(seed + i) % pool.length];
    });
  }

  const type = company.workplaceTypes[0];
  const pool = TITLE_POOL[type];
  if (pool.length < 2) return pool;
  const firstIndex = seed % pool.length;
  let secondIndex = (seed >> 3) % pool.length;
  if (secondIndex === firstIndex) secondIndex = (secondIndex + 1) % pool.length;
  return [pool[firstIndex], pool[secondIndex]];
}

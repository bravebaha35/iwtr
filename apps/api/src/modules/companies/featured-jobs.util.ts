import { findRegionByProvinceName, type WorkplaceType } from "@iwtr/shared-types";

// One boosted, live posting the Jobs page's featured row could show.
export interface FeaturedCandidate {
  id: string;
  companyId: string;
  city: string | null;
  district: string | null;
  // The company's sector (Company.category) - what a member's profile
  // Sector and the sidebar Sector filter both match on.
  category: string;
  workType: WorkplaceType | null;
}

export interface FeaturedPickOptions {
  // The sidebar's location filter (canonical province names, and
  // province+district pairs). Empty = anywhere.
  cities: string[];
  districts: { city: string; district: string }[];
  // The member's own field, sent only while they haven't picked a work type
  // or sector in the sidebar themselves: their profile Sector first, else
  // their kind of work.
  forSector?: string;
  forWorkType?: WorkplaceType;
  limit: number;
  // Fewer than this many in the chosen place: top up from the same region.
  minLocal: number;
  random?: () => number;
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Picks the Jobs page's featured row, in order:
 * 1. The member's field: their Sector's featured ads if any, else their
 *    kind of work's, else everyone's - so a member sees ads for their own
 *    line of work first rather than a random mix.
 * 2. The chosen place: ads in the chosen district, then the rest of the
 *    chosen city, and while that's still fewer than `minLocal`, ads from
 *    other provinces in the same region (İzmir -> Manisa, Aydın, ...).
 *    Never from outside the region once a place is chosen.
 * Each tier is shuffled, so when more ads are boosted than fit, every one
 * gets its turn. If the member's field has nothing in the chosen place,
 * the whole field is dropped rather than showing an empty row.
 */
export function pickFeatured<T extends FeaturedCandidate>(candidates: T[], opts: FeaturedPickOptions): T[] {
  const random = opts.random ?? Math.random;

  const fieldPools: T[][] = [];
  if (opts.forSector) fieldPools.push(candidates.filter((c) => c.category === opts.forSector));
  if (opts.forWorkType) fieldPools.push(candidates.filter((c) => c.workType === opts.forWorkType));
  fieldPools.push(candidates);

  for (const pool of fieldPools) {
    if (pool.length === 0) continue;
    const picked = byLocation(pool, opts, random);
    if (picked.length > 0) return picked;
  }
  return [];
}

function byLocation<T extends FeaturedCandidate>(pool: T[], opts: FeaturedPickOptions, random: () => number): T[] {
  if (opts.cities.length === 0 && opts.districts.length === 0) {
    return shuffled(pool, random).slice(0, opts.limit);
  }

  const chosenCities = new Set([...opts.cities, ...opts.districts.map((d) => d.city)]);
  const inDistrict = (c: T) => opts.districts.some((d) => d.city === c.city && d.district === c.district);
  const inCity = (c: T) => c.city !== null && chosenCities.has(c.city);
  const regions = new Set([...chosenCities].map((city) => findRegionByProvinceName(city)).filter(Boolean));
  const inRegion = (c: T) => regions.has(findRegionByProvinceName(c.city));

  // A whole-province pick counts as "local"; a district pick prefers that
  // district, then the rest of its province.
  const tiers =
    opts.districts.length > 0 && opts.cities.length === 0
      ? [pool.filter(inDistrict), pool.filter((c) => inCity(c) && !inDistrict(c))]
      : [pool.filter(inCity)];
  const regional = pool.filter((c) => !inCity(c) && inRegion(c));

  const picked: T[] = [];
  for (const tier of tiers) picked.push(...shuffled(tier, random));
  if (picked.length < opts.minLocal) picked.push(...shuffled(regional, random));
  return picked.slice(0, opts.limit);
}

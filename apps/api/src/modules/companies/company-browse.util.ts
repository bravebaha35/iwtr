import type { Prisma } from "@prisma/client";
import { CATEGORY_GROUP_CATEGORY, findProvinceByCityName, type CategoryGroup, type CompanySort } from "@iwtr/shared-types";

// Pure helpers behind CompaniesService.browse (the homepage grid).

/** Quick Select group as a WHERE clause; "Firms" is everything outside the other groups. */
export function categoryGroupWhere(group: CategoryGroup | undefined): Prisma.CompanyWhereInput {
  if (!group) return {};
  if (group === "FIRMS") return { category: { notIn: Object.values(CATEGORY_GROUP_CATEGORY) } };
  return { category: CATEGORY_GROUP_CATEGORY[group] };
}

export interface BrowseRow {
  id: string;
  name: string;
  city: string | null;
  overallAvg: number | null;
  reviewCount: number;
}

// Turkish-aware so Ç/Ş/İ/Ö/Ü/Ğ sort where Turkish readers expect them.
const collator = new Intl.Collator("tr", { sensitivity: "base" });

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Orders rows (which arrive name-ascending from the database) for one sort
 * button state. "default" keeps that order, or - when the visitor pressed
 * Near Me - goes nearest province first. Unrated workplaces sink to the
 * bottom of both rating orders.
 */
export function sortBrowseRows(rows: BrowseRow[], sort: CompanySort, nearCity?: string): BrowseRow[] {
  switch (sort) {
    case "alphabetical":
      return [...rows].sort((a, b) => collator.compare(a.name, b.name));
    case "alphabeticalDesc":
      return [...rows].sort((a, b) => collator.compare(b.name, a.name));
    case "ratingDesc":
      return [...rows].sort((a, b) => (b.overallAvg ?? -1) - (a.overallAvg ?? -1));
    case "ratingAsc":
      return [...rows].sort((a, b) => (a.overallAvg ?? Infinity) - (b.overallAvg ?? Infinity));
    default: {
      const origin = nearCity ? findProvinceByCityName(nearCity) : undefined;
      if (!origin) return rows;
      const distanceByCity = new Map<string, number>();
      const distanceOf = (city: string | null) => {
        const key = city ?? "";
        let d = distanceByCity.get(key);
        if (d === undefined) {
          const province = city ? findProvinceByCityName(city) : undefined;
          d = province ? distanceKm(origin.lat, origin.lng, province.lat, province.lng) : Infinity;
          distanceByCity.set(key, d);
        }
        return d;
      };
      return [...rows].sort((a, b) => distanceOf(a.city) - distanceOf(b.city));
    }
  }
}

/**
 * Which rows the grid shows. By default only reviewed workplaces; A-Z, a
 * Quick Select group or a search brings unreviewed ones in, always after
 * the reviewed ones.
 */
export function visibleBrowseRows(
  rows: BrowseRow[],
  opts: { sort: CompanySort; categoryGroup?: CategoryGroup; q?: string },
): { visible: BrowseRow[]; hiddenUnratedCount: number } {
  const showUnrated =
    opts.sort === "alphabetical" ||
    opts.sort === "alphabeticalDesc" ||
    opts.categoryGroup !== undefined ||
    (opts.q ?? "").trim() !== "";
  const rated = rows.filter((r) => r.reviewCount > 0);
  const unrated = rows.filter((r) => r.reviewCount === 0);
  return showUnrated
    ? { visible: [...rated, ...unrated], hiddenUnratedCount: 0 }
    : { visible: rated, hiddenUnratedCount: unrated.length };
}

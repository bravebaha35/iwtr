// Province/district data, normalization, and lookup now live in
// @iwtr/shared-types (packages/shared-types/src/geo/turkey.ts) so apps/api
// can validate an admin-entered Company.city/district against the exact
// same canonical list this picker uses — previously this table only existed
// here, so the server never checked a submitted city/district against
// anything real. Re-exported under the same names so nothing else in
// apps/web needs to change its imports.
export {
  TURKEY_PROVINCES,
  normalizeCityName,
  findProvinceByCityName,
  type TurkeyProvince,
} from "@iwtr/shared-types";

// Haversine distance in kilometers — kept here rather than moved to
// shared-types since it's pure client-side "how far is this from the
// visitor's browser geolocation" math, not something apps/api ever needs.
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

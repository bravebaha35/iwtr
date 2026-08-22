import { BadRequestException } from "@nestjs/common";
import { findDistrictInProvince, findProvinceByCityName } from "@iwtr/shared-types";

/**
 * Resolves free-typed city/district against the real province/district list
 * (packages/shared-types/src/geo/turkey.ts) rather than trusting them
 * verbatim, and returns the CANONICAL spelling — every stored value then
 * matches picker output byte-for-byte. Shared between admin company creation
 * (CompaniesService.createByAdmin) and owner self-service edits
 * (OwnerService.updateMyCompany) so both write paths enforce the same rule.
 */
export function resolveLocation(city?: string, district?: string): { city: string | null; district: string | null } {
  if (!city) {
    if (district) {
      throw new BadRequestException("A district can't be set without a city");
    }
    return { city: null, district: null };
  }

  const province = findProvinceByCityName(city);
  if (!province) {
    throw new BadRequestException(`"${city}" isn't a recognized Turkish province`);
  }

  if (!district) {
    return { city: province.name, district: null };
  }

  const canonicalDistrict = findDistrictInProvince(province, district);
  if (!canonicalDistrict) {
    throw new BadRequestException(`"${district}" isn't a district of ${province.name}`);
  }

  return { city: province.name, district: canonicalDistrict };
}

import {
  defaultBannerUrlForWorkplaceType,
  type Company,
  type StructureType,
  type TurkeyRegionKey,
  type WorkplaceType,
} from "@iwtr/shared-types";

// Extracted from CompaniesService (was a private method there) so
// SavedJobPostingsService can build the same public Company shape for its
// own list endpoint without duplicating this mapping — same "shared leaf
// util both import independently" pattern as job-postings.util.ts.
export interface PublicCompanyFields {
  id: string;
  slug: string;
  name: string;
  category: string;
  workplaceTypes: WorkplaceType[];
  mainPhotoUrl: string | null;
  description: string | null;
  website: string | null;
  city: string | null;
  district: string | null;
  structureType: StructureType;
  region: TurkeyRegionKey | null;
  isVerifiedBadge: boolean;
  badgeTier: Company["badgeTier"];
  taxNumber: string | null;
  isChainStore: boolean;
  isHiring: boolean;
  contactEmail: string | null;
  contactPhone: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  whatsappUrl: string | null;
  xUrl: string | null;
  linkedinUrl: string | null;
  youtubeUrl: string | null;
  glassdoorUrl: string | null;
  bannerImageUrl: string | null;
  featuredReviewId: string | null;
  riskScore: number;
}

export function toPublicCompany(c: PublicCompanyFields, hasApprovedOwner: boolean): Company {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    category: c.category,
    workplaceTypes: c.workplaceTypes,
    mainPhotoUrl: c.mainPhotoUrl,
    description: c.description,
    website: c.website,
    city: c.city,
    district: c.district,
    structureType: c.structureType,
    region: c.region,
    isVerifiedBadge: c.isVerifiedBadge,
    badgeTier: c.badgeTier,
    taxNumber: c.taxNumber,
    isChainStore: c.isChainStore,
    isHiring: c.isHiring,
    contactEmail: c.contactEmail,
    contactPhone: c.contactPhone,
    facebookUrl: c.facebookUrl,
    instagramUrl: c.instagramUrl,
    whatsappUrl: c.whatsappUrl,
    xUrl: c.xUrl,
    linkedinUrl: c.linkedinUrl,
    youtubeUrl: c.youtubeUrl,
    glassdoorUrl: c.glassdoorUrl,
    bannerImageUrl: c.bannerImageUrl,
    defaultBannerUrl: defaultBannerUrlForWorkplaceType(c.workplaceTypes[0]),
    featuredReviewId: c.featuredReviewId,
    riskScore: c.riskScore,
    hasApprovedOwner,
  };
}

import { savedJobPostingToggleResultSchema, savedJobPostingSchema } from "../savedJobPosting";

function company(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    slug: "acme",
    name: "Acme",
    category: "Software",
    workplaceTypes: ["OFFICE"],
    mainPhotoUrl: null,
    description: null,
    website: null,
    city: null,
    district: null,
    structureType: "SETTLED",
    region: null,
    isVerifiedBadge: false,
    taxNumber: null,
    isChainStore: false,
    isHiring: false,
    contactEmail: null,
    contactPhone: null,
    facebookUrl: null,
    instagramUrl: null,
    whatsappUrl: null,
    xUrl: null,
    linkedinUrl: null,
    youtubeUrl: null,
    glassdoorUrl: null,
    badgeTier: "FREE",
    bannerImageUrl: null,
    defaultBannerUrl: "/office-default-banner.webp",
    hasApprovedOwner: false,
    featuredReviewId: null,
    riskScore: 0,
    overallAvg: null,
    reviewCount: 0,
    jobTitles: [],
    jobPostings: [],
    ...overrides,
  };
}

function posting(overrides: Record<string, unknown> = {}) {
  return {
    id: "22222222-2222-2222-2222-222222222222",
    jobTitle: "t",
    description: "d",
    workType: null,
    ...overrides,
  };
}

describe("savedJobPosting schemas", () => {
  it("toggle result", () => {
    expect(savedJobPostingToggleResultSchema.safeParse({ jobPostingId: "x", saved: true }).success).toBe(true);
  });

  it("list item requires expired flag", () => {
    expect(savedJobPostingSchema.safeParse({ company: company(), posting: posting() }).success).toBe(false);
    expect(
      savedJobPostingSchema.safeParse({ company: company(), posting: posting(), expired: false }).success,
    ).toBe(true);
  });
});

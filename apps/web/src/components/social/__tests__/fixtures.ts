import type { PublicSocialPost } from "@iwtr/shared-types";

// A plain one-photo post, as the API sends it; tests override what they need.
export function makePost(overrides: Partial<PublicSocialPost> = {}): PublicSocialPost {
  return {
    id: "p1",
    companyId: "c1",
    companySlug: "acme",
    companyName: "Acme",
    companyLogoUrl: null,
    companyBadgeTier: "FREE",
    companyWorkplaceTypes: ["OFFICE"],
    kind: "PHOTO",
    imageUrls: ["/u/p1.webp"],
    imageAspectRatios: [1.5],
    caption: "hi",
    title: null,
    eventStartsAt: null,
    eventLocation: null,
    poll: null,
    job: null,
    createdAt: new Date().toISOString(),
    likeCount: 2,
    reactionCounts: { LIKE: 2, WELL_DONE: 0, CURIOUS: 0 },
    commentCount: 0,
    likedByMe: false,
    myReaction: null,
    savedByMe: false,
    pinned: false,
    edited: false,
    canManage: false,
    viewCount: null,
    ...overrides,
  };
}

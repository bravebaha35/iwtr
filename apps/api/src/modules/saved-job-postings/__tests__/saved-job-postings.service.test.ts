import { NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { SavedJobPostingsService } from "../saved-job-postings.service";

function makePrisma(overrides: Partial<Record<string, any>> = {}) {
  const base: Record<string, any> = {
    jobPosting: {
      // toggle() now gates on PUBLIC_COMPANY_WHERE via findFirst, not a
      // plain findUnique — see saved-job-postings.service.ts.
      findFirst: jest.fn().mockResolvedValue({ id: "jp1" }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    savedJobPosting: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  return { ...base, ...overrides };
}

describe("SavedJobPostingsService.toggle", () => {
  it("404s on an unknown job posting", async () => {
    const prisma = makePrisma({ jobPosting: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(new SavedJobPostingsService(prisma as any).toggle("u1", "ghost")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("saves when not already saved", async () => {
    const prisma = makePrisma();
    const result = await new SavedJobPostingsService(prisma as any).toggle("u1", "jp1");
    expect(result).toEqual({ jobPostingId: "jp1", saved: true });
    expect(prisma.savedJobPosting.create).toHaveBeenCalledWith({ data: { userId: "u1", jobPostingId: "jp1" } });
  });

  it("unsaves when already saved", async () => {
    const prisma = makePrisma({
      savedJobPosting: {
        findUnique: jest.fn().mockResolvedValue({ id: "s1" }),
        delete: jest.fn().mockResolvedValue({}),
      },
    });
    const result = await new SavedJobPostingsService(prisma as any).toggle("u1", "jp1");
    expect(result).toEqual({ jobPostingId: "jp1", saved: false });
    expect(prisma.savedJobPosting.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
  });

  it("a repeat save from a race doesn't throw (P2002 swallowed)", async () => {
    const prisma = makePrisma({
      savedJobPosting: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" })),
      },
    });
    const result = await new SavedJobPostingsService(prisma as any).toggle("u1", "jp1");
    expect(result).toEqual({ jobPostingId: "jp1", saved: true });
  });
});

describe("SavedJobPostingsService.list", () => {
  // Matches CompaniesService's own toPublicCompany input shape plus the
  // nested aggregate/owners the Prisma include in list() actually fetches.
  function makeCompany(overrides: Partial<Record<string, any>> = {}) {
    return {
      id: "c1",
      slug: "acme",
      name: "Acme",
      category: "Software",
      workplaceTypes: ["OFFICE"],
      mainPhotoUrl: null,
      description: null,
      website: null,
      city: "İzmir",
      district: "Buca",
      structureType: "SETTLED",
      region: null,
      isVerifiedBadge: false,
      taxNumber: null,
      isChainStore: false,
      isHiring: true,
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
      featuredReviewId: null,
      riskScore: 0,
      aggregate: { overallAvg: 4.2, reviewCount: 10 },
      owners: [],
      ...overrides,
    };
  }

  function savedRow(postingOverrides: Partial<Record<string, any>> = {}, companyOverrides: Partial<Record<string, any>> = {}) {
    return {
      jobPosting: {
        id: "jp1",
        companyId: "c1",
        jobTitle: "Cashier",
        description: "d",
        status: "PUBLISHED",
        createdAt: new Date(),
        lastResharedAt: null,
        filledAt: null,
        autoReshareEnabled: false,
        company: makeCompany(companyOverrides),
        ...postingOverrides,
      },
    };
  }

  it("marks a still-live posting as not expired and carries the full company shape", async () => {
    const prisma = makePrisma({ savedJobPosting: { findMany: jest.fn().mockResolvedValue([savedRow()]) } });
    const result = await new SavedJobPostingsService(prisma as any).list("u1");
    expect(result).toHaveLength(1);
    expect(result[0].expired).toBe(false);
    expect(result[0].posting).toEqual({ id: "jp1", jobTitle: "Cashier", description: "d" });
    expect(result[0].company).toMatchObject({
      id: "c1",
      slug: "acme",
      name: "Acme",
      riskScore: 0,
      overallAvg: 4.2,
      reviewCount: 10,
      hasApprovedOwner: false,
      jobTitles: [],
      jobPostings: [],
    });
  });

  it("reflects an approved owner as hasApprovedOwner: true", async () => {
    const row = savedRow({}, { owners: [{ id: "own1" }] });
    const prisma = makePrisma({ savedJobPosting: { findMany: jest.fn().mockResolvedValue([row]) } });
    const result = await new SavedJobPostingsService(prisma as any).list("u1");
    expect(result[0].company.hasApprovedOwner).toBe(true);
  });

  it("marks a FILLED posting as expired but still returns it within the grace window", async () => {
    const filled = savedRow({ status: "FILLED", filledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) });
    const prisma = makePrisma({ savedJobPosting: { findMany: jest.fn().mockResolvedValue([filled]) } });
    const result = await new SavedJobPostingsService(prisma as any).list("u1");
    expect(result[0].expired).toBe(true);
  });

  it("drops a posting past its 30-day grace window entirely", async () => {
    const longGone = savedRow({ status: "FILLED", filledAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) });
    const prisma = makePrisma({ savedJobPosting: { findMany: jest.fn().mockResolvedValue([longGone]) } });
    const result = await new SavedJobPostingsService(prisma as any).list("u1");
    expect(result).toEqual([]);
  });

  it("lazily reshares a stale posting that IS set to auto-reshare, keeping it not-expired", async () => {
    const staleAutoReshare = savedRow({
      autoReshareEnabled: true,
      createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      lastResharedAt: null,
    });
    // Batched write: one updateMany covering every stale id, not a
    // per-row update -- see CompaniesService.jobPostingsByCompanyId's own
    // precedent test for the identical pattern.
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = makePrisma({
      savedJobPosting: { findMany: jest.fn().mockResolvedValue([staleAutoReshare]) },
      jobPosting: { findFirst: jest.fn().mockResolvedValue({ id: "jp1" }), updateMany },
    });

    const result = await new SavedJobPostingsService(prisma as any).list("u1");

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["jp1"] } },
      data: { lastResharedAt: expect.any(Date) },
    });
    expect(result).toHaveLength(1);
    expect(result[0].expired).toBe(false);
  });
});

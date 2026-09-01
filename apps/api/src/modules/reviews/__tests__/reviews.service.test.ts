import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CreateReviewInput } from "@iwtr/shared-types";
import { ReviewsService } from "../reviews.service";
import { ModerationService } from "../../moderation/moderation.service";
import { getQuestionsFor } from "../survey-questions.data";

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code,
    clientVersion: "5.20.0",
  });
}

describe("ReviewsService.submitReview", () => {
  it("throws a friendly ConflictException when two concurrent submissions race past the duplicate-review check", async () => {
    const userId = "user-1";
    const companyId = "company-1";
    const employmentHistoryId = "emp-1";
    const questions = getQuestionsFor("OFFICE");
    const answers = questions.map((q) => ({ questionId: q.id, answer: q.correctAnswer }));

    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: userId,
          status: "ACTIVE",
          createdAt: new Date(),
        }),
      },
      employmentHistory: {
        findUnique: jest.fn().mockResolvedValue({
          id: employmentHistoryId,
          userId,
          companyId,
          company: { workplaceTypes: ["OFFICE"] },
        }),
      },
      review: {
        // Both concurrent requests observe "no existing review" before either write lands.
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockRejectedValue(prismaError("P2002")),
      },
    };
    const piiVault = { purgeTcKimlikNoIfPresent: jest.fn() };
    const service = new ReviewsService(prisma as any, new ModerationService(), piiVault as any);

    const input: CreateReviewInput = {
      companyId,
      employmentHistoryId,
      workplaceType: "OFFICE",
      answers,
      generalThoughts: "",
      isRandomizedIdentity: false,
    };

    await expect(service.submitReview(userId, input)).rejects.toThrow(
      new ConflictException("You have already reviewed this company"),
    );
    expect(piiVault.purgeTcKimlikNoIfPresent).not.toHaveBeenCalled();
  });

  it("sets isRandomizedIdentity strictly from the per-review checkbox, with no account-level override", async () => {
    const userId = "user-1";
    const companyId = "company-1";
    const employmentHistoryId = "emp-1";
    const questions = getQuestionsFor("OFFICE");
    const answers = questions.map((q) => ({ questionId: q.id, answer: q.correctAnswer }));

    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: userId,
          status: "ACTIVE",
          createdAt: new Date(),
        }),
      },
      employmentHistory: {
        findUnique: jest.fn().mockResolvedValue({
          id: employmentHistoryId,
          userId,
          companyId,
          company: { workplaceTypes: ["OFFICE"] },
        }),
      },
      review: {
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: "review-1" }),
      },
      moderationQueueItem: { create: jest.fn() },
      companyAggregateScore: { upsert: jest.fn() },
    };
    const piiVault = { purgeTcKimlikNoIfPresent: jest.fn() };
    const service = new ReviewsService(prisma as any, new ModerationService(), piiVault as any);

    const input: CreateReviewInput = {
      companyId,
      employmentHistoryId,
      workplaceType: "OFFICE",
      answers,
      generalThoughts: "",
      isRandomizedIdentity: false,
    };

    await service.submitReview(userId, input);

    expect(prisma.review.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isRandomizedIdentity: false }) }),
    );
  });
});

describe("ReviewsService.submitReview — non-SETTLED company location", () => {
  const userId = "user-1";
  const companyId = "company-1";
  const employmentHistoryId = "emp-1";
  const questions = getQuestionsFor("MANUAL_LABOUR");
  const answers = questions.map((q) => ({ questionId: q.id, answer: q.correctAnswer }));

  function makePrisma(company: Record<string, unknown>) {
    return {
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: userId, status: "ACTIVE", createdAt: new Date() }) },
      employmentHistory: {
        findUnique: jest.fn().mockResolvedValue({
          id: employmentHistoryId,
          userId,
          companyId,
          company: { workplaceTypes: ["MANUAL_LABOUR"], structureType: "SETTLED", city: null, region: null, ...company },
        }),
      },
      review: {
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: "review-1" }),
      },
      moderationQueueItem: { create: jest.fn() },
      companyAggregateScore: { upsert: jest.fn() },
    };
  }

  function makeService(prisma: ReturnType<typeof makePrisma>) {
    return new ReviewsService(prisma as any, new ModerationService(), { purgeTcKimlikNoIfPresent: jest.fn() } as any);
  }

  function baseInput(overrides: Partial<CreateReviewInput> = {}): CreateReviewInput {
    return {
      companyId,
      employmentHistoryId,
      workplaceType: "MANUAL_LABOUR",
      answers,
      generalThoughts: "",
      isRandomizedIdentity: false,
      ...overrides,
    };
  }

  it("rejects a city/district on a SETTLED company", async () => {
    const prisma = makePrisma({ structureType: "SETTLED" });
    await expect(makeService(prisma).submitReview(userId, baseInput({ district: "Kadıköy" }))).rejects.toThrow(
      "This company doesn't use per-location reviews.",
    );
  });

  it("requires a district for a CITY_BASED company", async () => {
    const prisma = makePrisma({ structureType: "CITY_BASED", city: "İstanbul" });
    await expect(makeService(prisma).submitReview(userId, baseInput())).rejects.toThrow(
      "Choose the district this review is about.",
    );
  });

  it("rejects a district that doesn't belong to the CITY_BASED company's own city", async () => {
    const prisma = makePrisma({ structureType: "CITY_BASED", city: "İstanbul" });
    await expect(makeService(prisma).submitReview(userId, baseInput({ district: "Çankaya" }))).rejects.toThrow(
      `"Çankaya" isn't a district of İstanbul.`,
    );
  });

  it("stores the canonicalized city/district for a valid CITY_BASED submission", async () => {
    const prisma = makePrisma({ structureType: "CITY_BASED", city: "istanbul" });
    await makeService(prisma).submitReview(userId, baseInput({ district: "kadikoy" }));
    expect(prisma.review.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ city: "İstanbul", district: "Kadıköy" }) }),
    );
  });

  it("requires a city for a REGION_BASED company", async () => {
    const prisma = makePrisma({ structureType: "REGION_BASED", region: "MARMARA" });
    await expect(makeService(prisma).submitReview(userId, baseInput())).rejects.toThrow(
      "Choose the city this review is about.",
    );
  });

  it("rejects a city outside the REGION_BASED company's own region", async () => {
    const prisma = makePrisma({ structureType: "REGION_BASED", region: "MARMARA" });
    await expect(makeService(prisma).submitReview(userId, baseInput({ city: "Van" }))).rejects.toThrow(
      `"Van" isn't a city in this company's region.`,
    );
  });

  it("stores the canonicalized city for a valid REGION_BASED submission, with no district", async () => {
    const prisma = makePrisma({ structureType: "REGION_BASED", region: "MARMARA" });
    await makeService(prisma).submitReview(userId, baseInput({ city: "bursa" }));
    expect(prisma.review.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ city: "Bursa", district: null }) }),
    );
  });
});

describe("ReviewsService.listForCompany — district/city k-anonymity", () => {
  function reviewRow(overrides: Record<string, unknown>) {
    return {
      id: "r", companyId: "company-1", userId: "author-1", workplaceType: "MANUAL_LABOUR",
      corporateCultureScore: 4, leadershipScore: 4, infrastructureScore: 4, workLifeBalanceScore: 4, stabilityScore: 4,
      generalThoughts: null, status: "PUBLISHED", publishedAt: new Date(), isRandomizedIdentity: false, displayUsername: null,
      city: null, district: null, votes: false,
      ...overrides,
    };
  }

  function makePrisma(reviews: ReturnType<typeof reviewRow>[], districtGroups: { district: string; _count: { _all: number } }[], cityGroups: { city: string; _count: { _all: number } }[]) {
    return {
      company: { findUnique: jest.fn().mockResolvedValue({ id: "company-1", slug: "acme" }) },
      review: {
        findMany: jest.fn().mockResolvedValue(reviews),
        groupBy: jest
          .fn()
          .mockResolvedValueOnce([]) // authorCompanyRows (contributor badge) — none for this test
          .mockResolvedValueOnce(districtGroups)
          .mockResolvedValueOnce(cityGroups),
      },
      reviewVote: { groupBy: jest.fn().mockResolvedValue([]) },
      companyReply: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
  }

  it("withholds a district shared by fewer than 3 published reviews, but surfaces one that meets the floor", async () => {
    const prisma = makePrisma(
      [
        reviewRow({ id: "r1", district: "Kadıköy" }), // below threshold (only 2 total)
        reviewRow({ id: "r2", district: "Kadıköy" }),
        reviewRow({ id: "r3", district: "Beşiktaş" }), // meets threshold (3 total)
        reviewRow({ id: "r4", district: "Beşiktaş" }),
        reviewRow({ id: "r5", district: "Beşiktaş" }),
      ],
      [
        { district: "Kadıköy", _count: { _all: 2 } },
        { district: "Beşiktaş", _count: { _all: 3 } },
      ],
      [],
    );
    const service = new ReviewsService(prisma as any, new ModerationService(), {} as any);

    const result = await service.listForCompany("acme");

    expect(result.find((r) => r.id === "r1")!.district).toBeNull();
    expect(result.find((r) => r.id === "r2")!.district).toBeNull();
    expect(result.find((r) => r.id === "r3")!.district).toBe("Beşiktaş");
    expect(result.find((r) => r.id === "r5")!.district).toBe("Beşiktaş");
  });

  it("applies the same k-anonymity floor to city (REGION_BASED companies)", async () => {
    const prisma = makePrisma(
      [reviewRow({ id: "r1", city: "Bursa" })],
      [],
      [{ city: "Bursa", _count: { _all: 1 } }],
    );
    const service = new ReviewsService(prisma as any, new ModerationService(), {} as any);

    const result = await service.listForCompany("acme");

    expect(result[0].city).toBeNull();
  });
});

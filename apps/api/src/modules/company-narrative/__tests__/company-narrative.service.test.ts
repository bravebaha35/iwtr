import { NotFoundException } from "@nestjs/common";
import { CompanyNarrativeService } from "../company-narrative.service";
import { PATTERN_ENGINE_VERSION } from "../numbers-line";

type PrismaMock = {
  company: { findUnique: jest.Mock };
  review: { findMany: jest.Mock; count: jest.Mock };
  companyNarrative: { findUnique: jest.Mock; upsert: jest.Mock };
  summaryPattern: { findMany: jest.Mock };
};

// getNarrative calls review.count() before (and instead of, on the fresh /
// low-N paths) review.findMany(). Keep the two consistent: count === the
// number of rows findMany resolves.
function reviewMock(rows: unknown[] = []) {
  return {
    findMany: jest.fn().mockResolvedValue(rows),
    count: jest.fn().mockResolvedValue(rows.length),
  };
}

function makePrisma(overrides: Partial<PrismaMock> = {}): PrismaMock {
  return {
    company: { findUnique: jest.fn().mockResolvedValue({ id: "c1", slug: "acme", workplaceTypes: ["OFFICE"] }) },
    review: reviewMock(),
    companyNarrative: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
    summaryPattern: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  };
}

// 5 published OFFICE reviews, all category scores = 4 -> overall 4.0.
function reviewRows(n: number) {
  return Array.from({ length: n }, () => ({
    surveyAnswers: {},
    corporateCultureScore: 4,
    leadershipScore: 4,
    infrastructureScore: 4,
    workLifeBalanceScore: 4,
    stabilityScore: 4,
  }));
}

const flagCalculatorStub = { computeVibeFlags: jest.fn().mockReturnValue([]) };
function patternGeneratorStub(result: string | null = "A pattern-assembled summary.") {
  return { generate: jest.fn().mockReturnValue(result) };
}

function makeService(prisma: PrismaMock, patternGenerator = patternGeneratorStub()) {
  return new CompanyNarrativeService(prisma as any, flagCalculatorStub as any, patternGenerator as any);
}

describe("CompanyNarrativeService.getNarrative", () => {
  it("throws NotFoundException for an unknown slug", async () => {
    const prisma = makePrisma({ company: { findUnique: jest.fn().mockResolvedValue(null) } });
    const svc = makeService(prisma);
    await expect(svc.getNarrative("nope")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns description null and does not call the pattern generator under 3 reviews", async () => {
    const prisma = makePrisma({ review: reviewMock(reviewRows(2)) });
    const gen = patternGeneratorStub();
    const svc = makeService(prisma, gen);
    const out = await svc.getNarrative("acme");
    expect(out).toEqual({ workplaceType: "OFFICE", reviewCount: 2, description: null });
    expect(gen.generate).not.toHaveBeenCalled();
  });

  it("with 3+ reviews and no stored row, assembles, upserts and returns the pattern-engine description", async () => {
    const prisma = makePrisma({ review: reviewMock(reviewRows(4)) });
    const gen = patternGeneratorStub("A specific summary.");
    const svc = makeService(prisma, gen);
    const out = await svc.getNarrative("acme");
    expect(gen.generate).toHaveBeenCalledTimes(1);
    expect(out.description).toBe("A specific summary.");
    expect(prisma.companyNarrative.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId_workplaceType: { companyId: "c1", workplaceType: "OFFICE" } },
        create: expect.objectContaining({
          description: "A specific summary.",
          reviewCountAtGen: 4,
          model: PATTERN_ENGINE_VERSION,
          promptVersion: 1,
        }),
      }),
    );
  });

  it("serves a fresh stored row without calling the pattern generator", async () => {
    const prisma = makePrisma({
      review: reviewMock(reviewRows(5)),
      companyNarrative: {
        findUnique: jest.fn().mockResolvedValue({
          description: "Stored copy.",
          reviewCountAtGen: 5,
          model: PATTERN_ENGINE_VERSION,
          promptVersion: 1,
          generatedAt: new Date(),
        }),
        upsert: jest.fn(),
      },
    });
    const gen = patternGeneratorStub();
    const svc = makeService(prisma, gen);
    const out = await svc.getNarrative("acme");
    expect(out.description).toBe("Stored copy.");
    expect(gen.generate).not.toHaveBeenCalled();
  });

  it("regenerates when the review count has moved by 3+ since the stored row", async () => {
    const prisma = makePrisma({
      review: reviewMock(reviewRows(9)),
      companyNarrative: {
        findUnique: jest.fn().mockResolvedValue({
          description: "Old.", reviewCountAtGen: 5, model: PATTERN_ENGINE_VERSION, promptVersion: 1, generatedAt: new Date(),
        }),
        upsert: jest.fn().mockResolvedValue({}),
      },
    });
    const gen = patternGeneratorStub("Fresh.");
    const svc = makeService(prisma, gen);
    const out = await svc.getNarrative("acme");
    expect(out.description).toBe("Fresh.");
    expect(gen.generate).toHaveBeenCalledTimes(1);
  });

  it("regenerates when the stored row is older than 30 days", async () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const prisma = makePrisma({
      review: reviewMock(reviewRows(5)),
      companyNarrative: {
        findUnique: jest.fn().mockResolvedValue({
          description: "Old.", reviewCountAtGen: 5, model: PATTERN_ENGINE_VERSION, promptVersion: 1, generatedAt: old,
        }),
        upsert: jest.fn().mockResolvedValue({}),
      },
    });
    const gen = patternGeneratorStub("Fresh.");
    const svc = makeService(prisma, gen);
    expect((await svc.getNarrative("acme")).description).toBe("Fresh.");
    expect(gen.generate).toHaveBeenCalledTimes(1);
  });

  it("regenerates when the stored promptVersion differs", async () => {
    const prisma = makePrisma({
      review: reviewMock(reviewRows(5)),
      companyNarrative: {
        findUnique: jest.fn().mockResolvedValue({
          description: "Old.", reviewCountAtGen: 5, model: PATTERN_ENGINE_VERSION, promptVersion: 0, generatedAt: new Date(),
        }),
        upsert: jest.fn().mockResolvedValue({}),
      },
    });
    const gen = patternGeneratorStub("Fresh.");
    const svc = makeService(prisma, gen);
    expect((await svc.getNarrative("acme")).description).toBe("Fresh.");
  });

  it("regenerates when the stored model differs from PATTERN_ENGINE_VERSION (e.g. a leftover Claude-generated row)", async () => {
    const prisma = makePrisma({
      review: reviewMock(reviewRows(5)),
      companyNarrative: {
        findUnique: jest.fn().mockResolvedValue({
          description: "Old.", reviewCountAtGen: 5, model: "claude-haiku-4-5", promptVersion: 1, generatedAt: new Date(),
        }),
        upsert: jest.fn().mockResolvedValue({}),
      },
    });
    const gen = patternGeneratorStub("Fresh.");
    const svc = makeService(prisma, gen);
    const out = await svc.getNarrative("acme");
    expect(out.description).toBe("Fresh.");
    expect(gen.generate).toHaveBeenCalledTimes(1);
  });

  it("falls back to the stored row when the pattern engine returns null (content gap), without upserting", async () => {
    const prisma = makePrisma({
      review: reviewMock(reviewRows(20)),
      companyNarrative: {
        findUnique: jest.fn().mockResolvedValue({
          description: "Stale but usable.", reviewCountAtGen: 5, model: PATTERN_ENGINE_VERSION, promptVersion: 1, generatedAt: new Date(),
        }),
        upsert: jest.fn(),
      },
    });
    const gen = patternGeneratorStub(null);
    const svc = makeService(prisma, gen);
    const out = await svc.getNarrative("acme");
    expect(out.description).toBe("Stale but usable.");
    expect(prisma.companyNarrative.upsert).not.toHaveBeenCalled();
  });

  it("falls back to the numbers line when the pattern engine returns null and there is no stored row", async () => {
    const prisma = makePrisma({ review: reviewMock(reviewRows(7)) });
    const gen = patternGeneratorStub(null);
    const svc = makeService(prisma, gen);
    const out = await svc.getNarrative("acme");
    expect(out.description).toContain("Across 7 reviews this workplace scores 4.0 out of 5");
  });

  it("passes the SummaryPattern rows scoped to this company's workplaceType into the generator", async () => {
    const prisma = makePrisma({
      review: reviewMock(reviewRows(4)),
      summaryPattern: { findMany: jest.fn().mockResolvedValue([{ id: "p1", category: "CONCLUSION", qnaKey: "OFFICE:CONCLUSION", flagKey: null, textBlock: "x" }]) },
    });
    const gen = patternGeneratorStub("Fresh.");
    const svc = makeService(prisma, gen);
    await svc.getNarrative("acme");
    expect(prisma.summaryPattern.findMany).toHaveBeenCalledWith({ where: { workplaceType: "OFFICE" } });
    expect(gen.generate).toHaveBeenCalledWith(
      expect.objectContaining({ patterns: [expect.objectContaining({ id: "p1", textBlock: "x" })] }),
    );
  });
});

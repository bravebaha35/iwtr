import { NotFoundException } from "@nestjs/common";
import { CompanyNarrativeService } from "../company-narrative.service";

type PrismaMock = {
  company: { findUnique: jest.Mock };
  review: { findMany: jest.Mock };
  companyNarrative: { findUnique: jest.Mock; upsert: jest.Mock };
};

function makePrisma(overrides: Partial<PrismaMock> = {}): PrismaMock {
  return {
    company: { findUnique: jest.fn().mockResolvedValue({ id: "c1", slug: "acme", workplaceTypes: ["OFFICE"] }) },
    review: { findMany: jest.fn().mockResolvedValue([]) },
    companyNarrative: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
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

const generatorOff = { available: false, generate: jest.fn() };
function generatorOn(text = "This workplace is steady but slow to fix problems.") {
  return { available: true, generate: jest.fn().mockResolvedValue(text) };
}

describe("CompanyNarrativeService.getNarrative", () => {
  it("throws NotFoundException for an unknown slug", async () => {
    const prisma = makePrisma({ company: { findUnique: jest.fn().mockResolvedValue(null) } });
    const svc = new CompanyNarrativeService(prisma as any, generatorOff as any);
    await expect(svc.getNarrative("nope")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns description null and does not call the generator under 3 reviews", async () => {
    const prisma = makePrisma({ review: { findMany: jest.fn().mockResolvedValue(reviewRows(2)) } });
    const gen = generatorOn();
    const svc = new CompanyNarrativeService(prisma as any, gen as any);
    const out = await svc.getNarrative("acme");
    expect(out).toEqual({ workplaceType: "OFFICE", reviewCount: 2, description: null });
    expect(gen.generate).not.toHaveBeenCalled();
  });

  it("with 3+ reviews and no generator, returns the numbers-only line and stores nothing", async () => {
    const prisma = makePrisma({ review: { findMany: jest.fn().mockResolvedValue(reviewRows(6)) } });
    const svc = new CompanyNarrativeService(prisma as any, generatorOff as any);
    const out = await svc.getNarrative("acme");
    expect(out.description).toBe(
      "Across 6 reviews this workplace scores 4.0 out of 5, with all five areas rating about the same.",
    );
    expect(prisma.companyNarrative.upsert).not.toHaveBeenCalled();
  });

  it("with 3+ reviews, a generator and no stored row, generates once, clamps, upserts and returns", async () => {
    const prisma = makePrisma({ review: { findMany: jest.fn().mockResolvedValue(reviewRows(4)) } });
    const gen = generatorOn("A specific summary.");
    const svc = new CompanyNarrativeService(prisma as any, gen as any);
    const out = await svc.getNarrative("acme");
    expect(gen.generate).toHaveBeenCalledTimes(1);
    expect(out.description).toBe("A specific summary.");
    expect(prisma.companyNarrative.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId_workplaceType: { companyId: "c1", workplaceType: "OFFICE" } },
        create: expect.objectContaining({ description: "A specific summary.", reviewCountAtGen: 4, promptVersion: 1 }),
      }),
    );
  });

  it("serves a fresh stored row without calling the generator", async () => {
    const prisma = makePrisma({
      review: { findMany: jest.fn().mockResolvedValue(reviewRows(5)) },
      companyNarrative: {
        findUnique: jest.fn().mockResolvedValue({
          description: "Stored copy.",
          reviewCountAtGen: 5,
          model: "claude-haiku-4-5-20251001",
          promptVersion: 1,
          generatedAt: new Date(),
        }),
        upsert: jest.fn(),
      },
    });
    const gen = generatorOn();
    const svc = new CompanyNarrativeService(prisma as any, gen as any);
    const out = await svc.getNarrative("acme");
    expect(out.description).toBe("Stored copy.");
    expect(gen.generate).not.toHaveBeenCalled();
  });

  it("regenerates when the review count has moved by 3+ since the stored row", async () => {
    const prisma = makePrisma({
      review: { findMany: jest.fn().mockResolvedValue(reviewRows(9)) },
      companyNarrative: {
        findUnique: jest.fn().mockResolvedValue({
          description: "Old.", reviewCountAtGen: 5, model: "claude-haiku-4-5-20251001", promptVersion: 1, generatedAt: new Date(),
        }),
        upsert: jest.fn().mockResolvedValue({}),
      },
    });
    const gen = generatorOn("Fresh.");
    const svc = new CompanyNarrativeService(prisma as any, gen as any);
    const out = await svc.getNarrative("acme");
    expect(out.description).toBe("Fresh.");
    expect(gen.generate).toHaveBeenCalledTimes(1);
  });

  it("regenerates when the stored row is older than 30 days", async () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const prisma = makePrisma({
      review: { findMany: jest.fn().mockResolvedValue(reviewRows(5)) },
      companyNarrative: {
        findUnique: jest.fn().mockResolvedValue({
          description: "Old.", reviewCountAtGen: 5, model: "claude-haiku-4-5-20251001", promptVersion: 1, generatedAt: old,
        }),
        upsert: jest.fn().mockResolvedValue({}),
      },
    });
    const gen = generatorOn("Fresh.");
    const svc = new CompanyNarrativeService(prisma as any, gen as any);
    expect((await svc.getNarrative("acme")).description).toBe("Fresh.");
    expect(gen.generate).toHaveBeenCalledTimes(1);
  });

  it("regenerates when the stored promptVersion differs", async () => {
    const prisma = makePrisma({
      review: { findMany: jest.fn().mockResolvedValue(reviewRows(5)) },
      companyNarrative: {
        findUnique: jest.fn().mockResolvedValue({
          description: "Old.", reviewCountAtGen: 5, model: "claude-haiku-4-5-20251001", promptVersion: 0, generatedAt: new Date(),
        }),
        upsert: jest.fn().mockResolvedValue({}),
      },
    });
    const gen = generatorOn("Fresh.");
    const svc = new CompanyNarrativeService(prisma as any, gen as any);
    expect((await svc.getNarrative("acme")).description).toBe("Fresh.");
  });

  it("falls back to the stored row when generation throws", async () => {
    const prisma = makePrisma({
      review: { findMany: jest.fn().mockResolvedValue(reviewRows(20)) },
      companyNarrative: {
        findUnique: jest.fn().mockResolvedValue({
          description: "Stale but usable.", reviewCountAtGen: 5, model: "claude-haiku-4-5-20251001", promptVersion: 1, generatedAt: new Date(),
        }),
        upsert: jest.fn(),
      },
    });
    const gen = { available: true, generate: jest.fn().mockRejectedValue(new Error("overloaded")) };
    const svc = new CompanyNarrativeService(prisma as any, gen as any);
    const out = await svc.getNarrative("acme");
    expect(out.description).toBe("Stale but usable.");
    expect(prisma.companyNarrative.upsert).not.toHaveBeenCalled();
  });

  it("falls back to the numbers line when generation throws and there is no stored row", async () => {
    const prisma = makePrisma({ review: { findMany: jest.fn().mockResolvedValue(reviewRows(7)) } });
    const gen = { available: true, generate: jest.fn().mockRejectedValue(new Error("overloaded")) };
    const svc = new CompanyNarrativeService(prisma as any, gen as any);
    const out = await svc.getNarrative("acme");
    expect(out.description).toContain("Across 7 reviews this workplace scores 4.0 out of 5");
  });

  it("clamps an over-long model response to 600 characters at a sentence boundary", async () => {
    const long = "First short sentence. " + "This second sentence is padded out. ".repeat(30);
    const prisma = makePrisma({ review: { findMany: jest.fn().mockResolvedValue(reviewRows(4)) } });
    const gen = generatorOn(long);
    const svc = new CompanyNarrativeService(prisma as any, gen as any);
    const out = await svc.getNarrative("acme");
    expect(out.description!.length).toBeLessThanOrEqual(600);
    expect(out.description!.endsWith(".")).toBe(true);
  });
});

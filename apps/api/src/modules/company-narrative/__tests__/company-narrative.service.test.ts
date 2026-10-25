import { NotFoundException } from "@nestjs/common";
import { CompanyNarrativeService, SUMMARY_TEXT_VERSION } from "../company-narrative.service";
import { SUMMARY_ENGINE_VERSION } from "../summary-composer";

function reviewRows(n: number, score = 4) {
  return Array.from({ length: n }, () => ({
    surveyAnswers: {},
    corporateCultureScore: score,
    leadershipScore: score,
    infrastructureScore: score,
    workLifeBalanceScore: score,
    stabilityScore: score,
  }));
}

function makePrisma(opts: { rows?: unknown[]; overall?: number | null; stored?: unknown } = {}) {
  const rows = opts.rows ?? [];
  return {
    company: { findUnique: jest.fn().mockResolvedValue({ id: "c1", slug: "acme", workplaceTypes: ["OFFICE"], hiddenAt: null }) },
    review: { findMany: jest.fn().mockResolvedValue(rows), count: jest.fn().mockResolvedValue(rows.length) },
    companyAggregateScore: {
      findUnique: jest.fn().mockResolvedValue(opts.overall === null || opts.overall === undefined ? null : { overallAvg: opts.overall }),
    },
    companyNarrative: { findUnique: jest.fn().mockResolvedValue(opts.stored ?? null), upsert: jest.fn().mockResolvedValue({}) },
  };
}

const storedFor = (band: number, reviewCountAtGen = 30) => ({
  reviewCountAtGen,
  description: "Stored English.",
  descriptionTr: "Kayıtlı Türkçe.",
  scoreBand: band,
  model: SUMMARY_ENGINE_VERSION,
  promptVersion: SUMMARY_TEXT_VERSION,
});

describe("CompanyNarrativeService.getNarrative", () => {
  it("404s for an unknown company", async () => {
    const prisma = makePrisma();
    prisma.company.findUnique.mockResolvedValue(null);
    await expect(new CompanyNarrativeService(prisma as any).getNarrative("nope")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("has no summary under 3 reviews, and reads nothing else", async () => {
    const prisma = makePrisma({ rows: reviewRows(2) });
    const r = await new CompanyNarrativeService(prisma as any).getNarrative("acme");
    expect(r).toEqual({ workplaceType: "OFFICE", reviewCount: 2, description: null, descriptionTr: null });
    expect(prisma.review.findMany).not.toHaveBeenCalled();
  });

  it("writes a summary in both languages and stores it with its band", async () => {
    const prisma = makePrisma({ rows: reviewRows(5), overall: 4.2 });
    const r = await new CompanyNarrativeService(prisma as any).getNarrative("acme");
    expect(r.description).toMatch(/^Reviewers paint a well-run office/);
    expect(r.descriptionTr).toMatch(/^Değerlendirenler, çoğunun tavsiye edeceği/);
    expect(prisma.companyNarrative.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ scoreBand: 4, model: SUMMARY_ENGINE_VERSION }) }),
    );
  });

  it("keeps the stored summary while the score stays in the same band (3.1 -> 3.9)", async () => {
    const prisma = makePrisma({ rows: reviewRows(40), overall: 3.9, stored: storedFor(3) });
    const r = await new CompanyNarrativeService(prisma as any).getNarrative("acme");
    expect(r.description).toBe("Stored English.");
    expect(r.descriptionTr).toBe("Kayıtlı Türkçe.");
    expect(prisma.review.findMany).not.toHaveBeenCalled();
    expect(prisma.companyNarrative.upsert).not.toHaveBeenCalled();
  });

  it("writes a new summary once the score crosses into another band (3.x -> 4.0)", async () => {
    const prisma = makePrisma({ rows: reviewRows(40), overall: 4.0, stored: storedFor(3) });
    const r = await new CompanyNarrativeService(prisma as any).getNarrative("acme");
    expect(r.description).not.toBe("Stored English.");
    expect(prisma.companyNarrative.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ scoreBand: 4 }) }));
  });

  it("writes a new summary once the number of reviews has doubled, even in the same band", async () => {
    const kept = makePrisma({ rows: reviewRows(11), overall: 3.4, stored: storedFor(3, 6) });
    await new CompanyNarrativeService(kept as any).getNarrative("acme");
    expect(kept.companyNarrative.upsert).not.toHaveBeenCalled();

    const doubled = makePrisma({ rows: reviewRows(12), overall: 3.4, stored: storedFor(3, 6) });
    await new CompanyNarrativeService(doubled as any).getNarrative("acme");
    expect(doubled.companyNarrative.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ reviewCountAtGen: 12 }) }),
    );
  });

  it("rewrites a summary left by the old pattern engine", async () => {
    const prisma = makePrisma({ rows: reviewRows(5), overall: 3.5, stored: { ...storedFor(3), model: "pattern-engine-v1", descriptionTr: null } });
    await new CompanyNarrativeService(prisma as any).getNarrative("acme");
    expect(prisma.companyNarrative.upsert).toHaveBeenCalled();
  });
});

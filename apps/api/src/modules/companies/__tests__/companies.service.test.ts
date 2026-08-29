import { CompaniesService } from "../companies.service";
import type { CompanySearchQuery } from "@iwtr/shared-types";

function makePrisma(overrides: Partial<Record<string, any>> = {}) {
  const base: Record<string, any> = {
    company: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    employmentHistory: {
      groupBy: jest.fn().mockResolvedValue([]),
    },
  };
  return { ...base, ...overrides };
}

function baseQuery(): CompanySearchQuery {
  return {};
}

describe("CompaniesService.search — job titles (/jobs page)", () => {
  it("never queries employmentHistory.groupBy for a plain homepage search (no includeJobTitles)", async () => {
    const prisma = makePrisma({
      company: {
        findMany: jest.fn().mockResolvedValue([
          { id: "c1", slug: "c1", name: "Co", category: "Software", workplaceTypes: ["OFFICE"], aggregate: null },
        ]),
      },
    });
    const service = new CompaniesService(prisma as any);

    const results = await service.search(baseQuery());

    expect(prisma.employmentHistory.groupBy).not.toHaveBeenCalled();
    expect(results[0].jobTitles).toEqual([]);
    // No isHiring filter leaked into the plain homepage query either.
    expect(prisma.company.findMany.mock.calls[0][0].where).not.toHaveProperty("isHiring");
  });

  it("scopes to isHiring companies and attaches only classified job titles, most-frequent first", async () => {
    const prisma = makePrisma({
      company: {
        findMany: jest.fn().mockResolvedValue([
          { id: "c1", slug: "c1", name: "Co", category: "Software", workplaceTypes: ["OFFICE"], aggregate: null },
        ]),
      },
      employmentHistory: {
        groupBy: jest.fn().mockResolvedValue([
          // "Avukat" is a real classifyWorkplace keyword (Legal) — classifies.
          { companyId: "c1", jobTitle: "Avukat", _count: { jobTitle: 2 } },
          // "Muhasebe" is a real keyword too (Finance) — classifies, and has
          // the highest count, so it should sort first.
          { companyId: "c1", jobTitle: "Muhasebe", _count: { jobTitle: 5 } },
          // Gibberish — classifyJobRole returns null, must be dropped.
          { companyId: "c1", jobTitle: "asdkfjqwer", _count: { jobTitle: 9 } },
        ]),
      },
    });
    const service = new CompaniesService(prisma as any);

    const results = await service.search({ ...baseQuery(), includeJobTitles: true });

    expect(prisma.company.findMany.mock.calls[0][0].where.isHiring).toBe(true);
    expect(results[0].jobTitles).toEqual(["Muhasebe", "Avukat"]);
  });

  it("caps job titles at 4 per company even when more classify", async () => {
    const prisma = makePrisma({
      company: {
        findMany: jest.fn().mockResolvedValue([
          { id: "c1", slug: "c1", name: "Co", category: "Software", workplaceTypes: ["OFFICE"], aggregate: null },
        ]),
      },
      employmentHistory: {
        groupBy: jest.fn().mockResolvedValue([
          { companyId: "c1", jobTitle: "CEO", _count: { jobTitle: 1 } },
          { companyId: "c1", jobTitle: "Avukat", _count: { jobTitle: 2 } },
          { companyId: "c1", jobTitle: "Muhasebe", _count: { jobTitle: 3 } },
          { companyId: "c1", jobTitle: "Finans", _count: { jobTitle: 4 } },
          { companyId: "c1", jobTitle: "Recruiter", _count: { jobTitle: 5 } },
        ]),
      },
    });
    const service = new CompaniesService(prisma as any);

    const results = await service.search({ ...baseQuery(), includeJobTitles: true });

    expect(results[0].jobTitles).toHaveLength(4);
    expect(results[0].jobTitles).not.toContain("CEO");
  });
});

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
    jobPosting: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    companyOwner: {
      findMany: jest.fn().mockResolvedValue([]),
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
    const service = new CompaniesService(prisma as any, {} as any);

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
    const service = new CompaniesService(prisma as any, {} as any);

    const results = await service.search({ ...baseQuery(), includeJobTitles: true });

    expect(prisma.company.findMany.mock.calls[0][0].where.isHiring).toBe(true);
    expect(results[0].jobTitles).toEqual([
      { title: "Muhasebe", workType: "OFFICE" },
      { title: "Avukat", workType: "OFFICE" },
    ]);
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
    const service = new CompaniesService(prisma as any, {} as any);

    const results = await service.search({ ...baseQuery(), includeJobTitles: true });

    expect(results[0].jobTitles).toHaveLength(4);
    expect(results[0].jobTitles.map((t) => t.title)).not.toContain("CEO");
  });
});

describe("CompaniesService.getBySlug — workplaceTypesLocked", () => {
  it("is true when the company's workplaceTypes are both already reviewed", async () => {
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: "c1",
          slug: "co",
          name: "Co",
          category: "Software",
          workplaceTypes: ["OFFICE", "SERVICE"],
          hiddenAt: null,
          aggregate: null,
          owners: [],
        }),
      },
    };
    const reviews = { areAllWorkplaceTypesReviewed: jest.fn().mockResolvedValue(true) };
    const service = new CompaniesService(prisma as any, reviews as any);

    const result = await service.getBySlug("co");

    expect(result.company.workplaceTypesLocked).toBe(true);
    expect(reviews.areAllWorkplaceTypesReviewed).toHaveBeenCalledWith("c1", ["OFFICE", "SERVICE"]);
  });

  it("is false when they aren't both reviewed yet", async () => {
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: "c1",
          slug: "co",
          name: "Co",
          category: "Software",
          workplaceTypes: ["OFFICE", "SERVICE"],
          hiddenAt: null,
          aggregate: null,
          owners: [],
        }),
      },
    };
    const reviews = { areAllWorkplaceTypesReviewed: jest.fn().mockResolvedValue(false) };
    const service = new CompaniesService(prisma as any, reviews as any);

    const result = await service.getBySlug("co");

    expect(result.company.workplaceTypesLocked).toBe(false);
  });
});

describe("CompaniesService — hidden companies stay out of public reads", () => {
  it("search filters to non-hidden companies", async () => {
    const prisma = makePrisma();
    const service = new CompaniesService(prisma as any, {} as any);

    await service.search(baseQuery());

    expect(prisma.company.findMany.mock.calls[0][0].where).toMatchObject({ hiddenAt: null });
  });

  it("the cities filter list is scoped to non-hidden companies", async () => {
    const prisma = makePrisma();
    const service = new CompaniesService(prisma as any, {} as any);

    await service.listFilters();

    expect(prisma.company.findMany.mock.calls[0][0].where).toMatchObject({ hiddenAt: null });
  });

  it("getBySlug 404s a hidden company exactly like a missing one", async () => {
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: "c1",
          slug: "co",
          name: "Co",
          category: "Software",
          workplaceTypes: ["OFFICE"],
          hiddenAt: new Date(),
          aggregate: null,
        }),
      },
    };
    const reviews = { areAllWorkplaceTypesReviewed: jest.fn() };
    const service = new CompaniesService(prisma as any, reviews as any);

    await expect(service.getBySlug("co")).rejects.toThrow("Company not found");
    expect(reviews.areAllWorkplaceTypesReviewed).not.toHaveBeenCalled();
  });

  it("the /jobs job-posting cards read is itself gated on a visible company", async () => {
    const prisma = makePrisma({
      company: {
        findMany: jest.fn().mockResolvedValue([
          { id: "c1", slug: "c1", name: "Co", category: "Software", workplaceTypes: ["OFFICE"], aggregate: null },
        ]),
      },
    });
    const service = new CompaniesService(prisma as any, {} as any);

    await service.search({ ...baseQuery(), includeJobTitles: true });

    expect(prisma.jobPosting.findMany.mock.calls[0][0].where).toMatchObject({
      company: { hiddenAt: null },
      status: "PUBLISHED",
    });
  });

  it("jobPostingsForSlug 404s a hidden company without reading any job data", async () => {
    const prisma = makePrisma({
      company: {
        findUnique: jest.fn().mockResolvedValue({ id: "c1", hiddenAt: new Date() }),
      },
    });
    const service = new CompaniesService(prisma as any, {} as any);

    await expect(service.jobPostingsForSlug("co")).rejects.toThrow("Company not found");
    expect(prisma.jobPosting.findMany).not.toHaveBeenCalled();
    expect(prisma.employmentHistory.groupBy).not.toHaveBeenCalled();
  });
});

describe("CompaniesService.jobPostingsForSlug — the company profile 'Job Postings' tab", () => {
  it("returns owner-authored PUBLISHED postings plus the classified job-title fallback", async () => {
    const prisma = makePrisma({
      company: {
        findUnique: jest.fn().mockResolvedValue({ id: "c1", hiddenAt: null }),
      },
      jobPosting: {
        findMany: jest.fn().mockResolvedValue([
          {
            companyId: "c1",
            jobTitle: "Forklift Operatörü",
            description: "Depo vardiyası",
            status: "PUBLISHED",
            createdAt: new Date(),
            lastResharedAt: null,
            filledAt: null,
            autoReshareEnabled: false,
            workType: "MANUAL_LABOUR",
          },
        ]),
      },
      employmentHistory: {
        groupBy: jest.fn().mockResolvedValue([
          { companyId: "c1", jobTitle: "Muhasebe", _count: { jobTitle: 3 } },
          { companyId: "c1", jobTitle: "asdkfjqwer", _count: { jobTitle: 9 } },
        ]),
      },
    });
    const service = new CompaniesService(prisma as any, {} as any);

    const result = await service.jobPostingsForSlug("co");

    expect(result.jobPostings).toEqual([
      { jobTitle: "Forklift Operatörü", description: "Depo vardiyası", workType: "MANUAL_LABOUR", positions: [] },
    ]);
    // Gibberish that classifyJobRole can't place is dropped, same as /jobs.
    expect(result.jobTitles).toEqual([{ title: "Muhasebe", workType: "OFFICE" }]);
    // The posting read itself is still visible-company-gated.
    expect(prisma.jobPosting.findMany.mock.calls[0][0].where).toMatchObject({
      company: { hiddenAt: null },
      status: "PUBLISHED",
    });
  });

  it("returns two empty arrays for a visible company with no job data", async () => {
    const prisma = makePrisma({
      company: {
        findUnique: jest.fn().mockResolvedValue({ id: "c1", hiddenAt: null }),
      },
    });
    const service = new CompaniesService(prisma as any, {} as any);

    await expect(service.jobPostingsForSlug("co")).resolves.toEqual({ jobPostings: [], jobTitles: [] });
  });
});

describe("CompaniesService — default banner keyed on the primary work-type", () => {
  it("getBySlug returns the default banner for the first (primary) work-type", async () => {
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: "c1",
          slug: "co",
          name: "Co",
          category: "Logistics",
          workplaceTypes: ["MANUAL_LABOUR", "OFFICE"],
          hiddenAt: null,
          aggregate: null,
          owners: [],
        }),
      },
    };
    const reviews = { areAllWorkplaceTypesReviewed: jest.fn().mockResolvedValue(false) };
    const service = new CompaniesService(prisma as any, reviews as any);

    const result = await service.getBySlug("co");

    // primary is MANUAL_LABOUR — the secondary (OFFICE) never affects the banner
    expect(result.company.defaultBannerUrl).toBe("/Labour%20Banner.webp");
  });

  it("search attaches a defaultBannerUrl to every row", async () => {
    const prisma = makePrisma({
      company: {
        findMany: jest.fn().mockResolvedValue([
          { id: "c1", slug: "c1", name: "A", category: "Software", workplaceTypes: ["OFFICE"], aggregate: null },
          { id: "c2", slug: "c2", name: "B", category: "Cafe", workplaceTypes: ["SERVICE"], aggregate: null },
        ]),
      },
    });
    const service = new CompaniesService(prisma as any, {} as any);

    const results = await service.search(baseQuery());

    expect(results[0].defaultBannerUrl).toBe("/Office%20Banner.webp");
    expect(results[1].defaultBannerUrl).toBe("/Service%20Banner.webp");
  });
});

describe("CompaniesService — hasApprovedOwner (claimed-company signal)", () => {
  it("getBySlug reports true when the company has an APPROVED owner", async () => {
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: "c1",
          slug: "co",
          name: "Co",
          category: "Software",
          workplaceTypes: ["OFFICE"],
          hiddenAt: null,
          aggregate: null,
          owners: [{ id: "own-1" }],
        }),
      },
    };
    const reviews = { areAllWorkplaceTypesReviewed: jest.fn().mockResolvedValue(false) };
    const service = new CompaniesService(prisma as any, reviews as any);

    const result = await service.getBySlug("co");

    expect(result.company.hasApprovedOwner).toBe(true);
    // Only APPROVED claims count.
    expect(prisma.company.findUnique.mock.calls[0][0].include.owners.where).toEqual({
      claimStatus: "APPROVED",
    });
  });

  it("getBySlug reports false for an unclaimed company", async () => {
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: "c1",
          slug: "co",
          name: "Co",
          category: "Software",
          workplaceTypes: ["OFFICE"],
          hiddenAt: null,
          aggregate: null,
          owners: [],
        }),
      },
    };
    const reviews = { areAllWorkplaceTypesReviewed: jest.fn().mockResolvedValue(false) };
    const service = new CompaniesService(prisma as any, reviews as any);

    expect((await service.getBySlug("co")).company.hasApprovedOwner).toBe(false);
  });

  it("search marks only the companies that have an approved owner", async () => {
    const prisma = makePrisma({
      company: {
        findMany: jest.fn().mockResolvedValue([
          { id: "c1", slug: "c1", name: "A", category: "Software", workplaceTypes: ["OFFICE"], aggregate: null },
          { id: "c2", slug: "c2", name: "B", category: "Cafe", workplaceTypes: ["SERVICE"], aggregate: null },
        ]),
      },
      companyOwner: {
        findMany: jest.fn().mockResolvedValue([{ companyId: "c2" }]),
      },
    });
    const service = new CompaniesService(prisma as any, {} as any);

    const results = await service.search(baseQuery());

    expect(results.find((r) => r.slug === "c1")!.hasApprovedOwner).toBe(false);
    expect(results.find((r) => r.slug === "c2")!.hasApprovedOwner).toBe(true);
    expect(prisma.companyOwner.findMany.mock.calls[0][0].where).toMatchObject({
      claimStatus: "APPROVED",
    });
  });
});

describe("CompaniesService — public job postings lifecycle", () => {
  it("includes id on each posting (needed for saving/bookmarking)", async () => {
    const prisma = makePrisma({
      company: {
        findMany: jest.fn().mockResolvedValue([
          { id: "c1", slug: "c1", name: "Co", category: "Software", workplaceTypes: ["OFFICE"], aggregate: null },
        ]),
      },
      jobPosting: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "jp1",
            companyId: "c1",
            jobTitle: "Cashier",
            description: "d",
            status: "PUBLISHED",
            createdAt: new Date(),
            lastResharedAt: null,
            filledAt: null,
            autoReshareEnabled: false,
          },
        ]),
      },
    });
    const service = new CompaniesService(prisma as any, {} as any);

    const results = await service.search({ includeJobTitles: true } as any);

    expect(results[0].jobPostings).toEqual([{ id: "jp1", jobTitle: "Cashier", description: "d", positions: [] }]);
  });

  it("drops a stale posting that isn't set to auto-reshare", async () => {
    const prisma = makePrisma({
      company: {
        findMany: jest.fn().mockResolvedValue([
          { id: "c1", slug: "c1", name: "Co", category: "Software", workplaceTypes: ["OFFICE"], aggregate: null },
        ]),
      },
      jobPosting: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "jp1",
            companyId: "c1",
            jobTitle: "Cashier",
            description: "d",
            status: "PUBLISHED",
            createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
            lastResharedAt: null,
            filledAt: null,
            autoReshareEnabled: false,
          },
        ]),
      },
    });
    const service = new CompaniesService(prisma as any, {} as any);

    const results = await service.search({ includeJobTitles: true } as any);

    expect(results[0].jobPostings).toEqual([]);
  });

  it("lazily reshares a stale posting that IS set to auto-reshare, and keeps it in the feed", async () => {
    const posting = {
      id: "jp1",
      companyId: "c1",
      jobTitle: "Cashier",
      description: "d",
      status: "PUBLISHED",
      createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      lastResharedAt: null,
      filledAt: null,
      autoReshareEnabled: true,
    };
    // Batched write: one updateMany covering every stale id in the page,
    // not a per-row update — see jobPostingsByCompanyId.
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = makePrisma({
      company: {
        findMany: jest.fn().mockResolvedValue([
          { id: "c1", slug: "c1", name: "Co", category: "Software", workplaceTypes: ["OFFICE"], aggregate: null },
        ]),
      },
      jobPosting: {
        findMany: jest.fn().mockResolvedValue([posting]),
        updateMany,
      },
    });
    const service = new CompaniesService(prisma as any, {} as any);

    const results = await service.search({ includeJobTitles: true } as any);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["jp1"] } },
      data: { lastResharedAt: expect.any(Date) },
    });
    expect(results[0].jobPostings).toEqual([{ id: "jp1", jobTitle: "Cashier", description: "d", positions: [] }]);
  });
});

describe("CompaniesService — riskScore exposure", () => {
  it("search() includes each company's riskScore", async () => {
    const prisma = makePrisma({
      company: {
        findMany: jest.fn().mockResolvedValue([
          { id: "c1", slug: "c1", name: "Co", category: "Software", workplaceTypes: ["OFFICE"], aggregate: null, riskScore: 2 },
        ]),
      },
    });
    const service = new CompaniesService(prisma as any, {} as any);
    const results = await service.search(baseQuery());
    expect(results[0].riskScore).toBe(2);
  });

  it("getBySlug() includes riskScore", async () => {
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: "c1",
          slug: "co",
          name: "Co",
          category: "Software",
          workplaceTypes: ["OFFICE"],
          hiddenAt: null,
          riskScore: 1,
          aggregate: null,
          owners: [],
        }),
      },
    };
    const reviews = { areAllWorkplaceTypesReviewed: jest.fn().mockResolvedValue(false) };
    const service = new CompaniesService(prisma as any, reviews as any);
    const detail = await service.getBySlug("co");
    expect(detail.company.riskScore).toBe(1);
  });
});

describe("CompaniesService.search — maxRiskScore filter", () => {
  it("filters to companies at or below the given Risk Score", async () => {
    const prisma = makePrisma();
    const service = new CompaniesService(prisma as any, {} as any);

    await service.search({ ...baseQuery(), maxRiskScore: 1 });

    expect(prisma.company.findMany.mock.calls[0][0].where.riskScore).toEqual({ lte: 1 });
  });

  it("applies no riskScore filter when maxRiskScore is omitted", async () => {
    const prisma = makePrisma();
    const service = new CompaniesService(prisma as any, {} as any);

    await service.search(baseQuery());

    expect(prisma.company.findMany.mock.calls[0][0].where).not.toHaveProperty("riskScore");
  });
});

describe("CompaniesService.listForSitemap", () => {
  it("lists only visible companies, with the date their score last changed", async () => {
    const findMany = jest.fn().mockResolvedValue([
      { slug: "acme", aggregate: { updatedAt: new Date("2026-09-20T00:00:00Z") } },
      { slug: "new-co", aggregate: null },
    ]);
    const service = new CompaniesService({ company: { findMany } } as any, {} as any);

    const rows = await service.listForSitemap();

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { hiddenAt: null } }));
    expect(rows).toEqual([
      { slug: "acme", lastModified: "2026-09-20T00:00:00.000Z" },
      { slug: "new-co", lastModified: null },
    ]);
  });
});

describe("CompaniesService.browse — featured (boosted) jobs", () => {
  const company = { id: "c1", slug: "c1", name: "Co", category: "Software", city: "İzmir", riskScore: 0, workplaceTypes: ["OFFICE"], aggregate: null };
  const livePosting = (id: string) => ({
    id,
    companyId: "c1",
    jobTitle: `Job ${id}`,
    description: "d",
    workType: "OFFICE",
    status: "PUBLISHED",
    createdAt: new Date(),
    lastResharedAt: null,
    filledAt: null,
    autoReshareEnabled: false,
    company: { city: "İzmir", district: null, category: "Software" },
  });

  function setup(boostedIds: string[]) {
    const postings = Array.from({ length: 10 }, (_, i) => livePosting(`jp${i}`));
    const jobPostingFindMany = jest.fn().mockImplementation(({ where }) =>
      Promise.resolve(where.boostExpiresAt ? postings.filter((p) => boostedIds.includes(p.id)) : postings),
    );
    const prisma = makePrisma({
      company: { findMany: jest.fn().mockResolvedValue([company]) },
      jobPosting: { findMany: jobPostingFindMany, updateMany: jest.fn() },
    });
    return { service: new CompaniesService(prisma as any, {} as any), jobPostingFindMany };
  }

  it("puts boosted postings in the featured row on page 1, at most 8", async () => {
    const boosted = Array.from({ length: 10 }, (_, i) => `jp${i}`);
    const { service } = setup(boosted);
    const result = await service.browse({ jobs: "1" } as any);
    expect(result.featured).toHaveLength(8);
    expect(new Set(result.featured.map((f) => f.posting.id)).size).toBe(8);
    expect(result.featured.every((f) => f.company.id === "c1")).toBe(true);
  });

  it("only counts boosts that are still running", async () => {
    const { service, jobPostingFindMany } = setup(["jp3"]);
    const result = await service.browse({ jobs: "1" } as any);
    expect(result.featured.map((f) => f.posting.id)).toEqual(["jp3"]);
    const boostQuery = jobPostingFindMany.mock.calls.find(([a]) => a.where.boostExpiresAt)[0];
    expect(boostQuery.where.boostExpiresAt.gt).toBeInstanceOf(Date);
    expect(boostQuery.where.status).toBe("PUBLISHED");
  });

  // The ad-space package buys the employer ad space only.
  it("leaves ad-space postings out of the featured row", async () => {
    const { service, jobPostingFindMany } = setup(["jp3"]);
    await service.browse({ jobs: "1" } as any);
    const boostQuery = jobPostingFindMany.mock.calls.find(([a]) => a.where.boostExpiresAt)[0];
    expect(boostQuery.where.boostAdSpace).toBe(false);
  });

  it("is empty on the homepage", async () => {
    const { service } = setup(["jp3"]);
    expect((await service.browse({} as any)).featured).toEqual([]);
  });
});

describe("CompaniesService.browse — the Jobs page is paged by job card", () => {
  const companyRow = (n: number) => ({
    id: `c${n}`,
    slug: `c${n}`,
    name: `Co ${String(n).padStart(2, "0")}`,
    category: "Software",
    city: "İzmir",
    riskScore: 0,
    workplaceTypes: ["OFFICE"],
    aggregate: null,
  });
  const posting = (id: string, companyId: string, extra: Record<string, unknown> = {}) => ({
    id,
    companyId,
    jobTitle: `Job ${id}`,
    description: "d",
    workType: "OFFICE",
    positions: ["SPECIALIST"],
    status: "PUBLISHED",
    createdAt: new Date(),
    lastResharedAt: null,
    filledAt: null,
    autoReshareEnabled: false,
    company: { city: "İzmir", district: null, category: "Software" },
    ...extra,
  });

  // 30 companies: the first has 3 open postings, every other one has 1.
  function setup(boostedIds: string[] = []) {
    const companies = Array.from({ length: 30 }, (_, i) => companyRow(i + 1));
    const postings = [
      posting("a1", "c1"),
      posting("a2", "c1"),
      posting("a3", "c1"),
      ...companies.slice(1).map((c) => posting(`p-${c.id}`, c.id)),
    ];
    const companyFindMany = jest.fn().mockImplementation(({ where }) =>
      Promise.resolve(where?.id?.in ? companies.filter((c) => where.id.in.includes(c.id)) : companies),
    );
    const jobPostingFindMany = jest.fn().mockImplementation(({ where }) => {
      if (where.boostExpiresAt) return Promise.resolve(postings.filter((p) => boostedIds.includes(p.id)));
      if (where.companyId?.in) return Promise.resolve(postings.filter((p) => where.companyId.in.includes(p.companyId)));
      return Promise.resolve(postings);
    });
    const prisma = makePrisma({
      company: { findMany: companyFindMany },
      jobPosting: { findMany: jobPostingFindMany, updateMany: jest.fn() },
    });
    return { service: new CompaniesService(prisma as any, {} as any), companyFindMany, jobPostingFindMany };
  }

  it("page 1 holds 20 cards when nothing is featured, one card per posting", async () => {
    const { service } = setup();
    const result = await service.browse({ jobs: "1" } as any);
    expect(result.total).toBe(32);
    expect(result.totalPages).toBe(2);
    expect(result.items).toHaveLength(20);
    // The three-posting company takes three places, one posting each.
    expect(result.items.slice(0, 3).map((i) => i.id)).toEqual(["c1", "c1", "c1"]);
    expect(result.items.every((i) => i.jobPostings.length === 1)).toBe(true);
    expect(new Set(result.items.map((i) => i.jobPostings[0].id)).size).toBe(20);
  });

  it("page 1 holds 12 standard cards under a full featured row, and later pages 20", async () => {
    const boosted = Array.from({ length: 8 }, (_, i) => `p-c${i + 2}`);
    const { service } = setup(boosted);
    const first = await service.browse({ jobs: "1" } as any);
    expect(first.featured).toHaveLength(8);
    expect(first.items).toHaveLength(12);
    expect(first.total).toBe(24);
    expect(first.totalPages).toBe(2);
    // No job is shown twice: a featured posting is not a standard card too.
    const featuredIds = new Set(first.featured.map((f) => f.posting.id));
    expect(first.items.some((i) => featuredIds.has(i.jobPostings[0].id))).toBe(false);

    const second = await service.browse({ jobs: "1", page: 2 } as any);
    expect(second.featured).toEqual([]);
    expect(second.items).toHaveLength(12);
    const seen = new Set(first.items.map((i) => i.jobPostings[0].id));
    expect(second.items.some((i) => seen.has(i.jobPostings[0].id) || featuredIds.has(i.jobPostings[0].id))).toBe(false);
  });

  it("builds the card list once per set of filters, not once per page", async () => {
    const { service, companyFindMany } = setup();
    await service.browse({ jobs: "1" } as any);
    await service.browse({ jobs: "1", page: 2 } as any);
    // One light list of every hiring company, then one full read per page.
    const lightReads = companyFindMany.mock.calls.filter(([a]) => !a.where?.id?.in);
    expect(lightReads).toHaveLength(1);
    await service.browse({ jobs: "1", q: "Co" } as any);
    expect(companyFindMany.mock.calls.filter(([a]) => !a.where?.id?.in)).toHaveLength(2);
  });

  it("a hiring company with no posting keeps its inferred job titles, one card each", async () => {
    const prisma = makePrisma({
      company: { findMany: jest.fn().mockResolvedValue([companyRow(1)]) },
      employmentHistory: {
        groupBy: jest.fn().mockResolvedValue([
          { companyId: "c1", jobTitle: "Avukat", _count: { jobTitle: 2 } },
          { companyId: "c1", jobTitle: "Muhasebe", _count: { jobTitle: 5 } },
        ]),
      },
    });
    const service = new CompaniesService(prisma as any, {} as any);
    const result = await service.browse({ jobs: "1" } as any);
    expect(result.items.map((i) => i.jobTitles.map((t) => t.title))).toEqual([["Muhasebe"], ["Avukat"]]);
    expect(result.items.every((i) => i.jobPostings.length === 0)).toBe(true);
  });

  it("the Position filter keeps only postings hiring for one of the ticked positions", async () => {
    const { service, companyFindMany, jobPostingFindMany } = setup();
    await service.browse({ jobs: "1", positions: "INTERN,SPECIALIST,NOT_A_POSITION" } as any);
    const light = jobPostingFindMany.mock.calls.find(([a]) => !a.where.boostExpiresAt && !a.where.companyId)[0];
    expect(light.where.positions).toEqual({ hasSome: ["INTERN", "SPECIALIST"] });
    const boost = jobPostingFindMany.mock.calls.find(([a]) => a.where.boostExpiresAt)[0];
    expect(boost.where.positions).toEqual({ hasSome: ["INTERN", "SPECIALIST"] });
    const companyQuery = companyFindMany.mock.calls.find(([a]) => !a.where?.id?.in)[0];
    expect(JSON.stringify(companyQuery.where)).toContain('"hasSome":["INTERN","SPECIALIST"]');
  });
});

describe("CompaniesService.search — several sectors at once", () => {
  it("matches a company in any one of the ticked sectors", async () => {
    const prisma = makePrisma();
    const service = new CompaniesService(prisma as any, {} as any);
    await service.search({ categories: "Software|Banking, Finance & Insurance" });
    expect(prisma.company.findMany.mock.calls[0][0].where.category).toEqual({
      in: ["Software", "Banking, Finance & Insurance"],
    });
  });

  it("still takes one exact sector", async () => {
    const prisma = makePrisma();
    const service = new CompaniesService(prisma as any, {} as any);
    await service.search({ category: "Software" });
    expect(prisma.company.findMany.mock.calls[0][0].where.category).toBe("Software");
  });
});

describe("CompaniesService.browse — the homepage list is kept for a minute", () => {
  it("lists and sorts the directory once per set of filters, then only loads each page's cards", async () => {
    const prisma = makePrisma();
    const service = new CompaniesService(prisma as any, {} as any);
    await service.browse({ page: 1 } as any);
    await service.browse({ page: 2 } as any);
    await service.browse({ page: 1 } as any);
    // The light "every match" read ran once; the other two answers reused it.
    const listReads = prisma.company.findMany.mock.calls.filter(([a]: any[]) => a.orderBy && a.select?.riskScore);
    expect(listReads).toHaveLength(1);

    // Different filters are a list of their own.
    await service.browse({ page: 1, q: "acme" } as any);
    expect(prisma.company.findMany.mock.calls.filter(([a]: any[]) => a.orderBy && a.select?.riskScore)).toHaveLength(2);
  });
});

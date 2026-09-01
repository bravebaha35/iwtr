import { NotFoundException } from "@nestjs/common";
import { AdminCompaniesService } from "../admin-companies.service";

function makePrisma(overrides: Partial<Record<string, any>> = {}) {
  const base: Record<string, any> = {
    company: {
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
    },
    review: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn(), deleteMany: jest.fn() },
    reviewVote: { deleteMany: jest.fn() },
    companyReply: { updateMany: jest.fn(), deleteMany: jest.fn() },
    moderationQueueItem: { deleteMany: jest.fn() },
    companyOwner: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn(), deleteMany: jest.fn() },
    employmentHistory: { updateMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    ownerContactMessage: { updateMany: jest.fn() },
    companyAggregateScore: { deleteMany: jest.fn() },
    companySuggestionDismissal: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };
  return { ...base, ...overrides };
}

describe("AdminCompaniesService.update — structureType/region/city consistency", () => {
  function makeExisting(overrides: Record<string, unknown>) {
    return { id: "c1", name: "Acme", city: null, district: null, structureType: "SETTLED", region: null, ...overrides };
  }

  it("rejects switching to REGION_BASED without a region", async () => {
    const prisma = makePrisma({ company: { findUnique: jest.fn().mockResolvedValue(makeExisting({})) } });
    const service = new AdminCompaniesService(prisma as any, {} as any);

    await expect(service.update("admin-1", "c1", { structureType: "REGION_BASED" })).rejects.toThrow(
      "A region-based company needs a region.",
    );
  });

  it("rejects setting a region on an existing SETTLED company without also changing structureType", async () => {
    const prisma = makePrisma({ company: { findUnique: jest.fn().mockResolvedValue(makeExisting({})) } });
    const service = new AdminCompaniesService(prisma as any, {} as any);

    await expect(service.update("admin-1", "c1", { region: "EGE" })).rejects.toThrow(
      "A settled company can't have a region.",
    );
  });

  it("rejects giving a city to an already REGION_BASED company", async () => {
    const prisma = makePrisma({
      company: { findUnique: jest.fn().mockResolvedValue(makeExisting({ structureType: "REGION_BASED", region: "MARMARA" })) },
    });
    const service = new AdminCompaniesService(prisma as any, {} as any);

    await expect(service.update("admin-1", "c1", { city: "İstanbul" })).rejects.toThrow(
      "A region-based company can't also have a city/district.",
    );
  });

  it("allows changing just the region on an already REGION_BASED company", async () => {
    const existing = makeExisting({ structureType: "REGION_BASED", region: "MARMARA" });
    const prisma = makePrisma({
      company: {
        findUnique: jest.fn().mockResolvedValue(existing),
        update: jest.fn().mockResolvedValue({ ...existing, region: "EGE" }),
      },
    });
    const service = new AdminCompaniesService(prisma as any, {} as any);

    await expect(service.update("admin-1", "c1", { region: "EGE" })).resolves.toBeDefined();
    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ region: "EGE" }) }),
    );
  });
});

describe("AdminCompaniesService.merge", () => {
  it("throws NotFoundException when either company doesn't exist", async () => {
    const prisma = makePrisma({
      company: { findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "d" }) },
    });
    const service = new AdminCompaniesService(prisma as any, {} as any);

    await expect(service.merge("admin-1", "master-id", "dup-id")).rejects.toThrow(NotFoundException);
  });

  it("moves a non-colliding review but drops one whose reviewer already reviewed the master", async () => {
    const master = { id: "master-id", name: "Master Co" };
    const duplicate = { id: "dup-id", name: "Duplicate Co" };
    const prisma = makePrisma({
      company: {
        findUnique: jest.fn().mockImplementation(({ where: { id } }: any) =>
          Promise.resolve(id === "master-id" ? master : duplicate),
        ),
        delete: jest.fn().mockResolvedValue({}),
      },
      review: {
        findMany: jest.fn().mockImplementation(({ where: { companyId } }: any) => {
          if (companyId === "master-id") return Promise.resolve([{ userId: "user-collide" }]);
          // Duplicate has one review that collides (same userId as master's)
          // and one that doesn't.
          return Promise.resolve([
            { id: "review-collide", userId: "user-collide" },
            { id: "review-move", userId: "user-fresh" },
          ]);
        }),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    });
    const reviews = { recomputeAggregate: jest.fn().mockResolvedValue(undefined) };
    const service = new AdminCompaniesService(prisma as any, reviews as any);

    const result = await service.merge("admin-1", "master-id", "dup-id");

    expect(result).toEqual({ mergedReviewCount: 1, droppedReviewCount: 1, droppedOwnerCount: 0 });
    expect(prisma.review.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["review-collide"] } } });
    expect(prisma.review.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["review-move"] } },
      data: { companyId: "master-id" },
    });
    expect(prisma.company.delete).toHaveBeenCalledWith({ where: { id: "dup-id" } });
    expect(reviews.recomputeAggregate).toHaveBeenCalledWith("master-id");
  });

  it("drops a colliding CompanyOwner row instead of silently merging two subscriptions", async () => {
    const prisma = makePrisma({
      company: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: "master-id" })
          .mockResolvedValueOnce({ id: "dup-id", name: "Duplicate Co" }),
        delete: jest.fn().mockResolvedValue({}),
      },
      companyOwner: {
        findMany: jest.fn().mockImplementation(({ where: { companyId } }: any) => {
          if (companyId === "master-id") return Promise.resolve([{ userId: "owner-collide" }]);
          return Promise.resolve([{ id: "owner-row-1", userId: "owner-collide" }]);
        }),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    });
    const reviews = { recomputeAggregate: jest.fn().mockResolvedValue(undefined) };
    const service = new AdminCompaniesService(prisma as any, reviews as any);

    const result = await service.merge("admin-1", "master-id", "dup-id");

    expect(result.droppedOwnerCount).toBe(1);
    expect(prisma.companyOwner.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["owner-row-1"] } } });
  });
});

describe("AdminCompaniesService.listSuggestions", () => {
  it("groups case-insensitively and excludes dismissed names", async () => {
    const prisma = makePrisma({
      employmentHistory: {
        findMany: jest.fn().mockResolvedValue([
          { rawCompanyName: "A101" },
          { rawCompanyName: "a101 " },
          { rawCompanyName: "Migros" },
        ]),
      },
      companySuggestionDismissal: { findMany: jest.fn().mockResolvedValue([{ nameKey: "migros" }]) },
    });
    const service = new AdminCompaniesService(prisma as any, {} as any);

    const result = await service.listSuggestions();

    expect(result).toEqual([{ nameKey: "a101", rawCompanyName: "A101", workerCount: 2 }]);
  });
});

describe("AdminCompaniesService.dismissSuggestion", () => {
  it("never deletes any EmploymentHistory row — it only upserts a dismissal", async () => {
    const prisma = makePrisma();
    const service = new AdminCompaniesService(prisma as any, {} as any);

    await service.dismissSuggestion("admin-1", "A101");

    expect(prisma.companySuggestionDismissal.upsert).toHaveBeenCalledWith({
      where: { nameKey: "a101" },
      create: { nameKey: "a101", dismissedByAdminId: "admin-1" },
      update: {},
    });
    expect(prisma.employmentHistory.updateMany).not.toHaveBeenCalled();
    expect(prisma.employmentHistory.findMany).not.toHaveBeenCalled();
  });
});

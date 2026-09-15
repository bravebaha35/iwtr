import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { JobPostingsService } from "../job-postings.service";

const moderationPass = { checkContent: jest.fn().mockReturnValue({ violates: false, violationTypes: [] }) } as never;

function makePrisma(overrides: Partial<Record<string, any>> = {}) {
  const base: Record<string, any> = {
    companyOwner: {
      findUnique: jest.fn().mockResolvedValue({ userId: "u1", companyId: "c1", claimStatus: "APPROVED", tier: "FREE" }),
    },
    company: {
      findUnique: jest.fn().mockResolvedValue({ workplaceTypes: ["SERVICE"], riskScore: 0 }),
      findMany: jest.fn().mockResolvedValue([]), // mentionsCompetitorName's scan
      update: jest.fn().mockResolvedValue({}),
    },
    jobPosting: {
      findFirst: jest.fn().mockResolvedValue(null), // no prior FILLED match by default
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "p1", createdAt: new Date(), ...data })),
      count: jest.fn().mockResolvedValue(0),
    },
  };
  return { ...base, ...overrides };
}

function service(prisma: Record<string, any>) {
  return new JobPostingsService(prisma as any, moderationPass, {} as any);
}

describe("JobPostingsService.create â€” workType validation", () => {
  it("rejects a workType the company doesn't have", async () => {
    const prisma = makePrisma();
    await expect(
      service(prisma).create("u1", "c1", {
        jobTitle: "Cashier",
        description: "d",
        workType: "MANUAL_LABOUR",
        autoReshareEnabled: false,
        boost: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("accepts a workType the company does have", async () => {
    const prisma = makePrisma();
    const result = await service(prisma).create("u1", "c1", {
      jobTitle: "Cashier",
      description: "d",
      workType: "SERVICE",
      autoReshareEnabled: false,
      boost: null,
    });
    expect(result.jobPosting.workType).toBe("SERVICE");
  });

  it("still enforces ownership before anything else", async () => {
    const prisma = makePrisma({ companyOwner: { findUnique: jest.fn().mockResolvedValue(null) } });
    await expect(
      service(prisma).create("u1", "c1", {
        jobTitle: "Cashier",
        description: "d",
        workType: "SERVICE",
        autoReshareEnabled: false,
        boost: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("JobPostingsService.create â€” Risk Score", () => {
  it("does not increment riskScore when there is no prior FILLED match", async () => {
    const prisma = makePrisma();
    await service(prisma).create("u1", "c1", {
      jobTitle: "Cashier",
      description: "d",
      workType: "SERVICE",
      autoReshareEnabled: false,
      boost: null,
    });
    expect(prisma.company.update).not.toHaveBeenCalled();
  });

  it("increments riskScore by 1 when a prior FILLED posting matches title+workType", async () => {
    const prisma = makePrisma({
      jobPosting: {
        findFirst: jest.fn().mockResolvedValue({ id: "old" }),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "p2", createdAt: new Date(), ...data })),
      },
    });
    await service(prisma).create("u1", "c1", {
      jobTitle: "Cashier",
      description: "d",
      workType: "SERVICE",
      autoReshareEnabled: false,
      boost: null,
    });
    expect(prisma.company.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { riskScore: 1 } });
    expect(prisma.jobPosting.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: "c1",
          workType: "SERVICE",
          status: "FILLED",
          jobTitle: { equals: "Cashier", mode: "insensitive" },
        }),
      }),
    );
  });

  it("caps riskScore at 3", async () => {
    const prisma = makePrisma({
      company: {
        findUnique: jest.fn().mockResolvedValue({ workplaceTypes: ["SERVICE"], riskScore: 3 }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      jobPosting: {
        findFirst: jest.fn().mockResolvedValue({ id: "old" }),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "p3", createdAt: new Date(), ...data })),
      },
    });
    await service(prisma).create("u1", "c1", {
      jobTitle: "Cashier",
      description: "d",
      workType: "SERVICE",
      autoReshareEnabled: false,
      boost: null,
    });
    expect(prisma.company.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { riskScore: 3 } });
  });
});


describe("JobPostingsService.markFilled", () => {
  function filledPrisma(overrides: Partial<Record<string, any>> = {}) {
    return makePrisma({
      jobPosting: {
        findUnique: jest.fn().mockResolvedValue({ id: "p1", companyId: "c1", status: "PUBLISHED" }),
        update: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "p1", companyId: "c1", createdAt: new Date(), ...data })),
      },
      ...overrides,
    });
  }

  it("sets status to FILLED and stamps filledAt", async () => {
    const prisma = filledPrisma();
    const result = await service(prisma).markFilled("u1", "c1", "p1");
    expect(result.status).toBe("FILLED");
    expect(prisma.jobPosting.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { status: "FILLED", filledAt: expect.any(Date) },
    });
  });

  it("404s when the posting doesn't belong to this company", async () => {
    const prisma = filledPrisma({
      jobPosting: {
        findUnique: jest.fn().mockResolvedValue({ id: "p1", companyId: "OTHER", status: "PUBLISHED" }),
        update: jest.fn(),
      },
    });
    await expect(service(prisma).markFilled("u1", "c1", "p1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("refuses to mark an already-non-PUBLISHED posting filled", async () => {
    const prisma = filledPrisma({
      jobPosting: {
        findUnique: jest.fn().mockResolvedValue({ id: "p1", companyId: "c1", status: "FILLED" }),
        update: jest.fn(),
      },
    });
    await expect(service(prisma).markFilled("u1", "c1", "p1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("requires approved ownership of the company", async () => {
    const prisma = filledPrisma({ companyOwner: { findUnique: jest.fn().mockResolvedValue(null) } });
    await expect(service(prisma).markFilled("u1", "c1", "p1")).rejects.toBeInstanceOf(ForbiddenException);
  });
});

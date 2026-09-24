import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { JobPostingsService } from "../job-postings.service";

const moderationPass = { checkContent: jest.fn().mockReturnValue({ violates: false, violationTypes: [] }) } as never;

function makePrisma(overrides: Partial<Record<string, any>> = {}) {
  const base: Record<string, any> = {
    companyOwner: {
      findUnique: jest.fn().mockResolvedValue({ userId: "u1", companyId: "c1", claimStatus: "APPROVED", tier: "FREE" }),
    },
    company: {
      // create() only selects workplaceTypes now — riskScore is no longer
      // read (the atomic updateMany below doesn't need the prior value).
      findUnique: jest.fn().mockResolvedValue({ workplaceTypes: ["SERVICE"] }),
      findMany: jest.fn().mockResolvedValue([]), // mentionsCompetitorName's scan
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    jobPosting: {
      findFirst: jest.fn().mockResolvedValue(null), // no prior FILLED match by default
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "p1", createdAt: new Date(), ...data })),
      count: jest.fn().mockResolvedValue(0),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
  // create() now runs its create + conditional increment + audit entry
  // inside prisma.$transaction — `tx` must be the SAME (possibly
  // test-overridden) mock object the rest of this helper returns, so a
  // test's jobPosting/company overrides are visible inside the callback too.
  const merged: Record<string, any> = { ...base, ...overrides };
  merged.$transaction = jest.fn().mockImplementation((cb: (tx: Record<string, any>) => unknown) => cb(merged));
  return merged;
}

function service(prisma: Record<string, any>) {
  return new JobPostingsService(prisma as any, moderationPass, {} as any);
}

describe("JobPostingsService.create — workType validation", () => {
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

describe("JobPostingsService.create — Risk Score", () => {
  it("does not increment riskScore when there is no prior FILLED match", async () => {
    const prisma = makePrisma();
    await service(prisma).create("u1", "c1", {
      jobTitle: "Cashier",
      description: "d",
      workType: "SERVICE",
      autoReshareEnabled: false,
      boost: null,
    });
    expect(prisma.company.updateMany).not.toHaveBeenCalled();
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
    expect(prisma.company.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", riskScore: { lt: 3 } },
      data: { riskScore: { increment: 1 } },
    });
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
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: "u1",
          action: "RISK_SCORE_INCREMENT",
          targetType: "Company",
          targetId: "c1",
        }),
      }),
    );
  });

  it("caps riskScore at 3", async () => {
    // The cap itself now lives in the DB (riskScore: { lt: 3 } in the WHERE
    // clause of the atomic updateMany — see job-postings.service.ts), not in
    // JS-side Math.min: a real DB no-ops this updateMany once riskScore hits
    // 3, since {lt: 3} then matches zero rows. This unit test can only prove
    // create() sends that guard; the actual cap-at-3 enforcement is verified
    // for real against Postgres by scripts/verify-risk-score.ts.
    const prisma = makePrisma({
      company: {
        findUnique: jest.fn().mockResolvedValue({ workplaceTypes: ["SERVICE"] }),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
    expect(prisma.company.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", riskScore: { lt: 3 } },
      data: { riskScore: { increment: 1 } },
    });
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

describe("JobPostingsService.listOwnerPostings", () => {
  function row(overrides: Partial<Record<string, any>> = {}) {
    return {
      id: "p1",
      companyId: "c1",
      jobTitle: "Cashier",
      description: "d",
      workType: "SERVICE",
      status: "PUBLISHED",
      boostDurationDays: null,
      boostExpiresAt: null,
      createdAt: new Date(),
      lastResharedAt: null,
      filledAt: null,
      autoReshareEnabled: false,
      ...overrides,
    };
  }

  it("includes daysRemaining on each row", async () => {
    const prisma = makePrisma({ jobPosting: { findMany: jest.fn().mockResolvedValue([row()]) } });
    const result = await service(prisma).listOwnerPostings("u1", "c1");
    expect(result[0].daysRemaining).toBeGreaterThan(0);
    expect(result[0].id).toBe("p1");
  });

  it("lazily reshares a stale PUBLISHED posting with autoReshareEnabled, instead of dropping it", async () => {
    const stale = row({
      createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      autoReshareEnabled: true,
    });
    // Batched updateMany, same pattern as CompaniesService.jobPostingsByCompanyId
    // and SavedJobPostingsService.list — not a per-row update().
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = makePrisma({ jobPosting: { findMany: jest.fn().mockResolvedValue([stale]), updateMany } });
    const result = await service(prisma).listOwnerPostings("u1", "c1");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["p1"] } },
      data: { lastResharedAt: expect.any(Date) },
    });
    expect(result[0].daysRemaining).toBe(30);
  });

  it("drops a posting past its 30-day grace window", async () => {
    const longGone = row({
      status: "FILLED",
      filledAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    });
    const prisma = makePrisma({ jobPosting: { findMany: jest.fn().mockResolvedValue([longGone]) } });
    const result = await service(prisma).listOwnerPostings("u1", "c1");
    expect(result).toEqual([]);
  });

  it("keeps a FILLED posting within its 30-day grace window", async () => {
    const recentlyFilled = row({ status: "FILLED", filledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) });
    const prisma = makePrisma({ jobPosting: { findMany: jest.fn().mockResolvedValue([recentlyFilled]) } });
    const result = await service(prisma).listOwnerPostings("u1", "c1");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("FILLED");
  });

  it("requires approved ownership", async () => {
    const prisma = makePrisma({ companyOwner: { findUnique: jest.fn().mockResolvedValue(null) } });
    await expect(service(prisma).listOwnerPostings("u1", "c1")).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("JobPostingsService.create — paid boost failure paths", () => {
  const billing = {
    buyerName: "Ayşe",
    buyerSurname: "Yılmaz",
    buyerIdentityNumber: "12345678901",
    buyerEmail: "a@example.com",
    billingAddress: { contactName: "Ayşe Yılmaz", city: "İstanbul", country: "Turkey", address: "Somewhere 1" },
  };

  function prismaWithUpdate() {
    const prisma = makePrisma();
    prisma.jobPosting.update = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "p1", ...data }));
    return prisma;
  }

  it("rejects a paid boost with no billing details BEFORE creating the posting", async () => {
    const prisma = prismaWithUpdate();
    await expect(
      service(prisma).create("u1", "c1", {
        jobTitle: "Cashier",
        description: "d",
        workType: "SERVICE",
        autoReshareEnabled: false,
        boost: { durationDays: 14 },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    // Nothing was created, so the owner can fix the form and resubmit
    // without leaving a duplicate posting behind.
    expect(prisma.jobPosting.create).not.toHaveBeenCalled();
  });

  it("keeps the posting but clears the boost and reports boostError when checkout can't start", async () => {
    const prisma = prismaWithUpdate();
    const payments = { createOneTimeCheckout: jest.fn().mockRejectedValue(new Error("iyzico not configured")) };
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const result = await new JobPostingsService(prisma as any, moderationPass, payments as any).create("u1", "c1", {
      jobTitle: "Cashier",
      description: "d",
      workType: "SERVICE",
      autoReshareEnabled: false,
      boost: { durationDays: 14, billing },
    });
    errorSpy.mockRestore();

    expect(result.status).toBe("PUBLISHED");
    expect(result.status !== "CHECKOUT_REQUIRED" && result.boostError).toEqual(expect.any(String));
    expect(result.jobPosting.boostDurationDays).toBeNull();
    // The PENDING marker written before the checkout attempt is rolled back,
    // so the posting isn't left stuck as "payment pending" forever.
    expect(prisma.jobPosting.update).toHaveBeenLastCalledWith({
      where: { id: "p1" },
      data: { boostDurationDays: null, boostPaymentStatus: null },
    });
  });
});

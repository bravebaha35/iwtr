import { NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { SavedJobPostingsService } from "../saved-job-postings.service";

function makePrisma(overrides: Partial<Record<string, any>> = {}) {
  const base: Record<string, any> = {
    jobPosting: {
      findUnique: jest.fn().mockResolvedValue({ id: "jp1" }),
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
    const prisma = makePrisma({ jobPosting: { findUnique: jest.fn().mockResolvedValue(null) } });
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
  function savedRow(postingOverrides: Partial<Record<string, any>> = {}) {
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
        ...postingOverrides,
      },
    };
  }

  it("marks a still-live posting as not expired", async () => {
    const prisma = makePrisma({ savedJobPosting: { findMany: jest.fn().mockResolvedValue([savedRow()]) } });
    const result = await new SavedJobPostingsService(prisma as any).list("u1");
    expect(result).toEqual([{ id: "jp1", companyId: "c1", jobTitle: "Cashier", description: "d", expired: false }]);
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
});

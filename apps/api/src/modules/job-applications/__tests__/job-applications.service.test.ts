import { unlink } from "fs/promises";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { JobApplicationsService } from "../job-applications.service";

// Keep every test hermetic — no real mkdir/writeFile/unlink against
// apps/api/uploads/job-applications/ — same approach social.service.test.ts
// uses for its own file-upload tests.
jest.mock("fs/promises", () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

const mockUnlink = unlink as jest.MockedFunction<typeof unlink>;

const PDF_BYTES = Buffer.concat([Buffer.from("%PDF-1.4\n", "ascii"), Buffer.alloc(64, 1)]);

function pdfFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: "file",
    originalname: "resume.pdf",
    encoding: "7bit",
    mimetype: "application/pdf",
    buffer: PDF_BYTES,
    size: PDF_BYTES.length,
    ...overrides,
  } as Express.Multer.File;
}

function makePrisma(overrides: Partial<Record<string, any>> = {}) {
  const base: Record<string, any> = {
    companyOwner: {
      findUnique: jest.fn().mockResolvedValue({ userId: "u1", companyId: "c1", claimStatus: "APPROVED" }),
    },
    jobPosting: {
      findUnique: jest.fn().mockResolvedValue({ id: "p1", companyId: "c1", status: "PUBLISHED", filledAt: null }),
    },
    jobApplication: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "app-1", createdAt: new Date(), ...data })),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "app-1", createdAt: new Date(), ...data })),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  return { ...base, ...overrides } as Record<string, any>;
}

function service(prisma: Record<string, any>) {
  return new JobApplicationsService(prisma as any);
}

beforeEach(() => {
  mockUnlink.mockClear();
});

describe("JobApplicationsService.apply", () => {
  it("rejects a COMPANY_OWNER caller with ForbiddenException, before ever looking up the posting", async () => {
    const prisma = makePrisma();
    await expect(service(prisma).apply("u1", "COMPANY_OWNER", "p1", pdfFile())).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.jobPosting.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a non-PDF mimetype with BadRequestException", async () => {
    const prisma = makePrisma();
    const file = pdfFile({ mimetype: "image/png" });
    await expect(service(prisma).apply("u1", "MEMBER", "p1", file)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.jobPosting.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a file whose buffer doesn't start with %PDF- even when mimetype claims application/pdf", async () => {
    const prisma = makePrisma();
    const file = pdfFile({ mimetype: "application/pdf", buffer: Buffer.from("this is not really a pdf", "ascii") });
    await expect(service(prisma).apply("u1", "MEMBER", "p1", file)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.jobPosting.findUnique).not.toHaveBeenCalled();
  });

  it("rejects with NotFoundException when the posting isn't PUBLISHED, and separately when it's already filled", async () => {
    const notPublished = makePrisma({
      jobPosting: { findUnique: jest.fn().mockResolvedValue({ id: "p1", companyId: "c1", status: "PENDING_ADMIN", filledAt: null }) },
    });
    await expect(service(notPublished).apply("u1", "MEMBER", "p1", pdfFile())).rejects.toBeInstanceOf(NotFoundException);

    const alreadyFilled = makePrisma({
      jobPosting: { findUnique: jest.fn().mockResolvedValue({ id: "p1", companyId: "c1", status: "PUBLISHED", filledAt: new Date() }) },
    });
    await expect(service(alreadyFilled).apply("u1", "MEMBER", "p1", pdfFile())).rejects.toBeInstanceOf(NotFoundException);
  });

  it("creates a new JobApplication row on first application", async () => {
    const prisma = makePrisma();
    const result = await service(prisma).apply("u1", "MEMBER", "p1", pdfFile());
    expect(prisma.jobApplication.create).toHaveBeenCalledWith({
      data: {
        jobPostingId: "p1",
        companyId: "c1",
        applicantUserId: "u1",
        pdfUrl: expect.stringContaining("/uploads/job-applications/"),
      },
    });
    expect(prisma.jobApplication.update).not.toHaveBeenCalled();
    expect(result.id).toBe("app-1");
  });

  it("updates (not duplicates) the existing row on a second application to the same posting by the same user", async () => {
    const prisma = makePrisma({
      jobApplication: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: "app-1", pdfUrl: "http://localhost:3001/uploads/job-applications/old-file.pdf" }),
        create: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "app-1", createdAt: new Date(), ...data })),
      },
    });

    await service(prisma).apply("u1", "MEMBER", "p1", pdfFile());

    expect(prisma.jobApplication.create).not.toHaveBeenCalled();
    expect(prisma.jobApplication.update).toHaveBeenCalledWith({
      where: { id: "app-1" },
      data: {
        pdfUrl: expect.stringContaining("/uploads/job-applications/"),
        createdAt: expect.any(Date),
        viewedAt: null,
      },
    });
    // The old file gets best-effort cleaned up so re-applying doesn't leak disk.
    expect(mockUnlink).toHaveBeenCalledWith(expect.stringContaining("old-file.pdf"));
  });
});

describe("JobApplicationsService.listForCompany", () => {
  it("throws ForbiddenException for a non-approved-owner caller", async () => {
    const prisma = makePrisma({ companyOwner: { findUnique: jest.fn().mockResolvedValue(null) } });
    await expect(service(prisma).listForCompany("u1", "c1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.companyOwner.findUnique).toHaveBeenCalledWith({
      where: { userId_companyId: { userId: "u1", companyId: "c1" } },
    });
    expect(prisma.jobApplication.findMany).not.toHaveBeenCalled();
  });

  it("rejects when the caller is an approved owner of a *different* company than the one requested", async () => {
    // companyOwner.findUnique only resolves an APPROVED row for "company-a-id" —
    // proves an approval for Company A can't be reused to read Company B's inbox.
    const prisma = makePrisma({
      companyOwner: {
        findUnique: jest.fn().mockImplementation(({ where }) =>
          where.userId_companyId.companyId === "company-a-id"
            ? Promise.resolve({ userId: "u1", companyId: "company-a-id", claimStatus: "APPROVED" })
            : Promise.resolve(null),
        ),
      },
    });
    await expect(service(prisma).listForCompany("u1", "company-b-id")).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.companyOwner.findUnique).toHaveBeenCalledWith({
      where: { userId_companyId: { userId: "u1", companyId: "company-b-id" } },
    });
    expect(prisma.jobApplication.findMany).not.toHaveBeenCalled();
  });

  it('maps a null applicant.displayName to "Anonymous applicant"', async () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const prisma = makePrisma({
      jobApplication: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "app-1",
            jobPostingId: "p1",
            jobPosting: { jobTitle: "Cashier" },
            applicant: { displayName: null },
            pdfUrl: "http://localhost:3001/uploads/job-applications/f1.pdf",
            createdAt,
            viewedAt: null,
          },
        ]),
      },
    });
    const result = await service(prisma).listForCompany("u1", "c1");
    expect(result).toHaveLength(1);
    expect(result[0].applicantDisplayName).toBe("Anonymous applicant");
    expect(result[0].jobTitle).toBe("Cashier");
    expect(result[0].createdAt).toBe(createdAt.toISOString());
  });
});

describe("JobApplicationsService.markViewed", () => {
  it("is a no-op (doesn't call prisma.jobApplication.update) when viewedAt is already set", async () => {
    const prisma = makePrisma({
      jobApplication: {
        findUnique: jest.fn().mockResolvedValue({ id: "app-1", companyId: "c1", viewedAt: new Date() }),
        update: jest.fn(),
      },
    });
    await service(prisma).markViewed("u1", "c1", "app-1");
    expect(prisma.jobApplication.update).not.toHaveBeenCalled();
  });

  it("sets viewedAt when it was previously null", async () => {
    const prisma = makePrisma({
      jobApplication: {
        findUnique: jest.fn().mockResolvedValue({ id: "app-1", companyId: "c1", viewedAt: null }),
        update: jest.fn().mockResolvedValue({}),
      },
    });
    await service(prisma).markViewed("u1", "c1", "app-1");
    expect(prisma.jobApplication.update).toHaveBeenCalledWith({ where: { id: "app-1" }, data: { viewedAt: expect.any(Date) } });
  });

  it("404s (and never updates) when the application belongs to a different company than the one in the call", async () => {
    // The caller is an approved owner of "c1" and the application row is
    // real, but it belongs to "OTHER_COMPANY" — proves an approved owner of
    // one company can't mark-viewed another company's application by id.
    const prisma = makePrisma({
      jobApplication: {
        findUnique: jest.fn().mockResolvedValue({ id: "app-1", companyId: "OTHER_COMPANY", viewedAt: null }),
        update: jest.fn(),
      },
    });
    await expect(service(prisma).markViewed("u1", "c1", "app-1")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.jobApplication.update).not.toHaveBeenCalled();
  });
});

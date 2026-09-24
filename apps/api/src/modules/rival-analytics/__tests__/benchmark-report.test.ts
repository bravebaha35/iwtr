import { ForbiddenException, HttpException, NotFoundException } from "@nestjs/common";
import { FlagCalculatorService } from "../../flags/flag-calculator.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { TurnoverPredictionService } from "../../turnover-risk/turnover-prediction.service";
import { BenchmarkReportService } from "../benchmark-report.service";
import { BenchmarkReportWorker, REPORT_TTL_MS } from "../benchmark-report.worker";
import * as pdfBuilder from "../pdf-report.builder";
import { SectorBenchmarkService } from "../sector-benchmark.service";

const USER = "user-1";
const COMPANY = "11111111-1111-4111-8111-111111111111";
const JOB = "22222222-2222-4222-8222-222222222222";

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    companyOwner: {
      findUnique: jest.fn().mockResolvedValue({ claimStatus: "APPROVED", tier: "ENTERPRISE" }),
    },
    company: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: COMPANY, name: "Şirket A.Ş.", category: "Supermarket", city: "İstanbul" }),
    },
    benchmarkReportJob: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(({ data }) => ({
        id: JOB,
        status: "QUEUED",
        sectorCategory: data.sectorCategory,
        city: data.city,
        createdAt: new Date("2026-09-24T10:00:00Z"),
        completedAt: null,
        expiresAt: null,
        errorMessage: null,
      })),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(),
    },
    ...overrides,
  } as Record<string, any>;
}

function sectorStub(eligible = true) {
  return {
    assertEligibleScope: jest.fn(async () => {
      if (!eligible) throw new ForbiddenException("Insufficient Data to Ensure Anonymity");
    }),
    buildReportData: jest.fn(),
  };
}

describe("BenchmarkReportService.request", () => {
  it("queues a job for the requester's own sector and city", async () => {
    const prisma = makePrisma();
    const job = await new BenchmarkReportService(prisma as never, sectorStub() as never).request(USER, COMPANY, {
      scope: "CITY",
    });
    expect(prisma.benchmarkReportJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { requestedByUserId: USER, companyId: COMPANY, sectorCategory: "Supermarket", city: "İstanbul" },
      }),
    );
    expect(job).toEqual(expect.objectContaining({ id: JOB, status: "QUEUED", city: "İstanbul" }));
    expect(job).not.toHaveProperty("pdf");
  });

  it("is Enterprise-only", async () => {
    const prisma = makePrisma({
      companyOwner: { findUnique: jest.fn().mockResolvedValue({ claimStatus: "APPROVED", tier: "BLUE_PLUS" }) },
    });
    await expect(
      new BenchmarkReportService(prisma as never, sectorStub() as never).request(USER, COMPANY, { scope: "TURKEY" }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.benchmarkReportJob.create).not.toHaveBeenCalled();
  });

  it("refuses a 4th request on the same UTC day with 429", async () => {
    const prisma = makePrisma();
    prisma.benchmarkReportJob.count.mockResolvedValue(3);
    const error = await new BenchmarkReportService(prisma as never, sectorStub() as never)
      .request(USER, COMPANY, { scope: "TURKEY" })
      .catch((e) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(429);
  });

  it("never queues a job for a sector that fails the anonymity lock", async () => {
    const prisma = makePrisma();
    await expect(
      new BenchmarkReportService(prisma as never, sectorStub(false) as never).request(USER, COMPANY, { scope: "TURKEY" }),
    ).rejects.toThrow("Insufficient Data to Ensure Anonymity");
    expect(prisma.benchmarkReportJob.create).not.toHaveBeenCalled();
  });
});

describe("BenchmarkReportService.download", () => {
  it("404s once the report has expired (the query only matches unexpired READY jobs)", async () => {
    const prisma = makePrisma();
    prisma.benchmarkReportJob.findFirst.mockResolvedValue(null);
    await expect(
      new BenchmarkReportService(prisma as never, sectorStub() as never).download(USER, COMPANY, JOB),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.benchmarkReportJob.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: JOB, companyId: COMPANY, status: "READY", expiresAt: { gt: expect.any(Date) } }),
      }),
    );
  });

  it("returns the PDF with a plain-ASCII filename", async () => {
    const prisma = makePrisma();
    prisma.benchmarkReportJob.findFirst.mockResolvedValue({
      pdf: Buffer.from("%PDF-1.3"),
      sectorCategory: "Süpermarket",
      city: "İstanbul",
      completedAt: new Date("2026-09-24T10:00:00Z"),
    });
    const { filename } = await new BenchmarkReportService(prisma as never, sectorStub() as never).download(
      USER,
      COMPANY,
      JOB,
    );
    expect(filename).toBe("sector-benchmark-supermarket-istanbul-2026-09-24.pdf");
  });
});

describe("BenchmarkReportWorker.processNext (async generation end-to-end)", () => {
  const queued = { id: JOB, companyId: COMPANY, sectorCategory: "Supermarket", city: null };

  // A real SectorBenchmarkService + real PDF builder, over a mocked
  // database that holds an eligible sector (6 people, 3 companies).
  function eligiblePrisma() {
    const prisma = makePrisma();
    prisma.benchmarkReportJob.findFirst.mockResolvedValue(queued);
    prisma.$queryRaw = jest
      .fn()
      .mockResolvedValueOnce([{ distinctUsers: 6, distinctCompanies: 3, reviewCount: 6 }])
      .mockResolvedValueOnce([{ salaryYear: 2026, distinctUsers: 6, distinctCompanies: 3, p25: 30000, p50: 35000, p75: 40000 }]);
    prisma.salarySubmission = { findMany: jest.fn().mockResolvedValue([]) };
    prisma.review = { findMany: jest.fn().mockResolvedValue([]) };
    return prisma;
  }

  function makeWorker(prisma: Record<string, any>) {
    const sector = new SectorBenchmarkService(
      prisma as never,
      new TurnoverPredictionService({} as never, new FlagCalculatorService()),
    );
    return new BenchmarkReportWorker(prisma as never, sector);
  }

  afterEach(() => jest.restoreAllMocks());

  it("claims a queued job, compiles the PDF with the risk explanation, stores it READY for 7 days, and it surfaces as a notification", async () => {
    const prisma = eligiblePrisma();
    const buildSpy = jest.spyOn(pdfBuilder, "buildSectorBenchmarkPdf");

    await expect(makeWorker(prisma).processNext()).resolves.toBe(true);

    expect(prisma.benchmarkReportJob.updateMany).toHaveBeenCalledWith({
      where: { id: JOB, status: "QUEUED" },
      data: { status: "RUNNING" },
    });
    const reportData = buildSpy.mock.calls[0][0];
    expect(reportData.turnover.explanation).toMatch(/risk of people leaving/);
    expect(reportData.salaryBands).toEqual([
      { salaryYear: 2026, bottom25: 30000, median: 35000, top75: 40000, respondentCount: 6 },
    ]);

    const { data } = prisma.benchmarkReportJob.update.mock.calls[0][0];
    expect(data.status).toBe("READY");
    expect(Buffer.from(data.pdf).subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(data.expiresAt.getTime() - data.completedAt.getTime()).toBe(REPORT_TTL_MS);

    // The UI notification is derived from exactly that READY row.
    const notifications = new NotificationsService({
      review: { findMany: jest.fn().mockResolvedValue([]) },
      reviewVote: { findMany: jest.fn().mockResolvedValue([]) },
      companyReply: { findMany: jest.fn().mockResolvedValue([]) },
      jobPosting: { findMany: jest.fn().mockResolvedValue([]) },
      companyFollow: { findMany: jest.fn().mockResolvedValue([]) },
      companyAggregateScore: { findMany: jest.fn().mockResolvedValue([]) },
      socialPost: { findMany: jest.fn().mockResolvedValue([]) },
      benchmarkReportJob: {
        findMany: jest.fn().mockResolvedValue([
          { id: JOB, companyId: COMPANY, completedAt: data.completedAt, company: { name: "Şirket A.Ş.", slug: "sirket" } },
        ]),
      },
    } as never);
    expect(await notifications.list(USER)).toEqual([
      expect.objectContaining({
        type: "BENCHMARK_REPORT_READY",
        href: `/api/proxy/my-companies/${COMPANY}/sector-benchmark/${JOB}/download`,
      }),
    ]);
  });

  it("marks the job FAILED with the anonymity message when the sector no longer qualifies", async () => {
    const prisma = makePrisma();
    prisma.benchmarkReportJob.findFirst.mockResolvedValue(queued);
    prisma.$queryRaw = jest.fn().mockResolvedValue([{ distinctUsers: 4, distinctCompanies: 2, reviewCount: 4 }]);

    await makeWorker(prisma).processNext();

    expect(prisma.benchmarkReportJob.update).toHaveBeenCalledWith({
      where: { id: JOB },
      data: expect.objectContaining({ status: "FAILED", errorMessage: "Insufficient Data to Ensure Anonymity" }),
    });
  });

  it("does nothing when another process already claimed the job", async () => {
    const prisma = makePrisma();
    prisma.benchmarkReportJob.findFirst.mockResolvedValue(queued);
    prisma.benchmarkReportJob.updateMany.mockResolvedValue({ count: 0 });
    await makeWorker(prisma).processNext();
    expect(prisma.company.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(prisma.benchmarkReportJob.update).not.toHaveBeenCalled();
  });

  it("reports an empty queue", async () => {
    const prisma = makePrisma();
    prisma.benchmarkReportJob.findFirst.mockResolvedValue(null);
    await expect(makeWorker(prisma).processNext()).resolves.toBe(false);
  });
});

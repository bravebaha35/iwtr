import { BadRequestException, ConflictException, ForbiddenException, HttpException, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { HrAnalyticsReportService } from "../hr-analytics-report.service";
import { HrAnalyticsReportWorker } from "../hr-analytics-report.worker";
import * as pdf from "../hr-analytics-report.pdf";
import { NOT_ENOUGH_REVIEWS } from "../hr-analytics-report.data";

const USER = "user-1";
const COMPANY = "11111111-1111-4111-8111-111111111111";
const JOB = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-10-03T10:00:00Z");

const billing = {
  buyerName: "Ayşe",
  buyerSurname: "Yılmaz",
  buyerIdentityNumber: "12345678901",
  buyerEmail: "ayse@example.com",
  billingAddress: { contactName: "Ayşe Yılmaz", city: "İstanbul", country: "Turkey", address: "Moda Cd. 1" },
};

function jobRow(data: Record<string, unknown>) {
  return {
    id: JOB,
    status: data.status ?? "QUEUED",
    access: data.access,
    createdAt: NOW,
    completedAt: null,
    expiresAt: null,
    errorMessage: null,
  };
}

function makePrisma(owner: Record<string, unknown> = { tier: "ENTERPRISE", planStatus: "ACTIVE" }) {
  return {
    companyOwner: { findUnique: jest.fn().mockResolvedValue({ claimStatus: "APPROVED", ...owner }) },
    hrAnalyticsReportJob: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve(jobRow(data))),
      delete: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  } as Record<string, any>;
}

function makeService(prisma: Record<string, any>, opts: { eligible?: boolean; checkoutFails?: boolean } = {}) {
  const eligible = opts.eligible ?? true;
  const data = {
    isEligible: jest.fn().mockResolvedValue(eligible),
    assertEligible: jest.fn(async () => {
      if (!eligible) throw new BadRequestException(NOT_ENOUGH_REVIEWS);
    }),
    build: jest.fn(),
  };
  const payments = {
    createOneTimeCheckout: jest.fn(async () => {
      if (opts.checkoutFails) throw new Error("iyzico is not configured yet");
      return { token: "tok", checkoutFormContent: "<script>iyzico</script>" };
    }),
    retrieveOneTimeCheckoutStatus: jest.fn(),
  };
  return { service: new HrAnalyticsReportService(prisma as never, data as never, payments as never), data, payments };
}

async function statusOf(promise: Promise<unknown>): Promise<number> {
  try {
    await promise;
    return 200;
  } catch (err) {
    return (err as HttpException).getStatus();
  }
}

describe("HrAnalyticsReportService.request", () => {
  it("queues an Enterprise report as part of the plan", async () => {
    const prisma = makePrisma();
    const { service } = makeService(prisma);
    const result = await service.request(USER, COMPANY, {}, NOW);
    expect(result.status).toBe("QUEUED");
    expect(prisma.hrAnalyticsReportJob.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { requestedByUserId: USER, companyId: COMPANY, access: "PLAN" } }),
    );
  });

  it("uses a Pro company's monthly report, keyed to this month", async () => {
    const prisma = makePrisma({ tier: "BLUE_PLUS", planStatus: "ACTIVE" });
    const { service } = makeService(prisma);
    await service.request(USER, COMPANY, {}, NOW);
    expect(prisma.hrAnalyticsReportJob.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ access: "MONTHLY_QUOTA", quotaMonth: "2026-10" }) }),
    );
  });

  it("refuses a Starter request without payment (402) and never builds or charges", async () => {
    const prisma = makePrisma({ tier: "BLUE", planStatus: "ACTIVE" });
    const { service, payments } = makeService(prisma);
    expect(await statusOf(service.request(USER, COMPANY, {}, NOW))).toBe(402);
    expect(prisma.hrAnalyticsReportJob.create).not.toHaveBeenCalled();
    expect(payments.createOneTimeCheckout).not.toHaveBeenCalled();
  });

  it("asks a Pro company to pay once this month's report is used", async () => {
    const prisma = makePrisma({ tier: "BLUE_PLUS", planStatus: "ACTIVE" });
    prisma.hrAnalyticsReportJob.findFirst.mockImplementation(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(where.quotaMonth === "2026-10" ? { id: "used" } : null),
    );
    const { service } = makeService(prisma);
    expect(await statusOf(service.request(USER, COMPANY, {}, NOW))).toBe(402);
  });

  it("opens a 199.99 TL checkout for a Free company with billing details; the report waits for payment", async () => {
    const prisma = makePrisma({ tier: "FREE", planStatus: "NONE" });
    const { service, payments } = makeService(prisma);
    const result = await service.request(USER, COMPANY, { billing }, NOW);
    expect(result.status).toBe("CHECKOUT_REQUIRED");
    expect(prisma.hrAnalyticsReportJob.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ access: "PAID", status: "AWAITING_PAYMENT" }) }),
    );
    expect(payments.createOneTimeCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: JOB, priceTry: "199.99", itemName: "HR Analytics Report" }),
    );
  });

  it("removes the placeholder and says nothing was charged when payment can't start", async () => {
    const prisma = makePrisma({ tier: "BLUE", planStatus: "ACTIVE" });
    const { service } = makeService(prisma, { checkoutFails: true });
    await expect(service.request(USER, COMPANY, { billing }, NOW)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.hrAnalyticsReportJob.delete).toHaveBeenCalledWith({ where: { id: JOB } });
  });

  it("rebuilds a failed paid report without charging again", async () => {
    const prisma = makePrisma({ tier: "BLUE", planStatus: "ACTIVE" });
    prisma.hrAnalyticsReportJob.findMany.mockImplementation(({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(where.status === "FAILED" ? [{ id: "failed-paid" }] : []),
    );
    const { service, payments } = makeService(prisma);
    const result = await service.request(USER, COMPANY, {}, NOW);
    expect(result.status).toBe("QUEUED");
    expect(prisma.hrAnalyticsReportJob.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ access: "PAID", retryOfJobId: "failed-paid" }) }),
    );
    expect(payments.createOneTimeCheckout).not.toHaveBeenCalled();
  });

  it("refuses anyone who isn't an approved owner", async () => {
    const prisma = makePrisma();
    prisma.companyOwner.findUnique.mockResolvedValue({ claimStatus: "PENDING", tier: "ENTERPRISE", planStatus: "ACTIVE" });
    const { service } = makeService(prisma);
    await expect(service.request(USER, COMPANY, {}, NOW)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("checks there are enough reviews before any charge", async () => {
    const prisma = makePrisma({ tier: "FREE", planStatus: "NONE" });
    const { service, payments } = makeService(prisma, { eligible: false });
    await expect(service.request(USER, COMPANY, { billing }, NOW)).rejects.toThrow(NOT_ENOUGH_REVIEWS);
    expect(payments.createOneTimeCheckout).not.toHaveBeenCalled();
  });

  it("allows only one report building at a time, and three a day", async () => {
    const building = makePrisma();
    building.hrAnalyticsReportJob.findFirst.mockResolvedValueOnce({ id: "busy" });
    await expect(makeService(building).service.request(USER, COMPANY, {}, NOW)).rejects.toBeInstanceOf(ConflictException);

    const capped = makePrisma();
    capped.hrAnalyticsReportJob.count.mockResolvedValue(3);
    expect(await statusOf(makeService(capped).service.request(USER, COMPANY, {}, NOW))).toBe(429);
  });

  it("lets only one of two simultaneous Pro clicks use the monthly report", async () => {
    const prisma = makePrisma({ tier: "BLUE_PLUS", planStatus: "ACTIVE" });
    prisma.hrAnalyticsReportJob.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "5" }),
    );
    await expect(makeService(prisma).service.request(USER, COMPANY, {}, NOW)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe("HrAnalyticsReportService.overview", () => {
  it("tells a Pro owner how many reports are left and when it refills, with no review counts", async () => {
    const prisma = makePrisma({ tier: "BLUE_PLUS", planStatus: "ACTIVE" });
    const { allowance } = await makeService(prisma).service.overview(USER, COMPANY, NOW);
    expect(allowance).toEqual({
      mode: "MONTHLY_QUOTA",
      quotaRemaining: 1,
      quotaResetsOn: "2026-11-01",
      priceTry: "199.99",
      eligible: true,
      ineligibleReason: null,
    });
    expect(JSON.stringify(allowance)).not.toMatch(/count|reviews":/i);
  });

  it("never lists a checkout that was opened but not paid", async () => {
    const prisma = makePrisma();
    await makeService(prisma).service.overview(USER, COMPANY, NOW);
    expect(prisma.hrAnalyticsReportJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY, status: { not: "AWAITING_PAYMENT" } } }),
    );
  });
});

describe("HrAnalyticsReportService.completeCheckout", () => {
  it("queues the report only once iyzico confirms payment", async () => {
    const prisma = makePrisma();
    prisma.hrAnalyticsReportJob.findUnique.mockResolvedValue({ companyId: COMPANY });
    const { service, payments } = makeService(prisma);

    payments.retrieveOneTimeCheckoutStatus.mockResolvedValue({ token: "t", paid: false, conversationId: JOB });
    await expect(service.completeCheckout("t")).resolves.toBe(COMPANY);
    expect(prisma.hrAnalyticsReportJob.updateMany).not.toHaveBeenCalled();

    payments.retrieveOneTimeCheckoutStatus.mockResolvedValue({ token: "t", paid: true, conversationId: JOB });
    await service.completeCheckout("t");
    expect(prisma.hrAnalyticsReportJob.updateMany).toHaveBeenCalledWith({
      where: { id: JOB, status: "AWAITING_PAYMENT" },
      data: { status: "QUEUED", paidAt: expect.any(Date) },
    });
  });
});

describe("HrAnalyticsReportWorker.processNext", () => {
  function makeWorker(prisma: Record<string, any>, build: jest.Mock) {
    return new HrAnalyticsReportWorker(prisma as never, { build } as never);
  }

  it("stores the finished PDF for 7 days", async () => {
    const prisma = makePrisma();
    prisma.hrAnalyticsReportJob.findFirst.mockResolvedValue({ id: JOB, companyId: COMPANY });
    jest.spyOn(pdf, "buildHrAnalyticsPdf").mockResolvedValue(Buffer.from("%PDF-"));
    await makeWorker(prisma, jest.fn().mockResolvedValue({})).processNext();
    expect(prisma.hrAnalyticsReportJob.update).toHaveBeenCalledWith({
      where: { id: JOB },
      data: expect.objectContaining({ status: "READY", pdf: Buffer.from("%PDF-"), expiresAt: expect.any(Date) }),
    });
  });

  it("hands the Pro monthly report back when a build fails", async () => {
    const prisma = makePrisma();
    prisma.hrAnalyticsReportJob.findFirst.mockResolvedValue({ id: JOB, companyId: COMPANY });
    await makeWorker(prisma, jest.fn().mockRejectedValue(new Error("boom"))).processNext();
    expect(prisma.hrAnalyticsReportJob.update).toHaveBeenCalledWith({
      where: { id: JOB },
      data: expect.objectContaining({ status: "FAILED", quotaMonth: null }),
    });
  });
});

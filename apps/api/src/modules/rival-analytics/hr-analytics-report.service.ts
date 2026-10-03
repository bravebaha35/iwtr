import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma, type CompanyOwner, type HrAnalyticsReportJob as HrReportJobRow } from "@prisma/client";
import {
  HR_REPORT_PRICE_LABEL,
  HR_REPORT_PRICE_TRY,
  type HrReportAllowance,
  type HrReportJob,
  type HrReportOverview,
  type HrReportRequest,
  type HrReportRequestResult,
} from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { PaymentsService } from "../payments/payments.service";
import { decideHrReportAccess, nextQuotaReset, quotaMonthKey } from "./hr-analytics-report.access";
import { HrAnalyticsReportDataService, NOT_ENOUGH_REVIEWS } from "./hr-analytics-report.data";

// Building a PDF is the expensive part, so a company can start at most this
// many per UTC day whatever its plan (on top of the per-account request
// throttle on the controller).
export const MAX_HR_REPORTS_PER_COMPANY_PER_DAY = 3;

const JOB_SUMMARY_SELECT = {
  id: true,
  status: true,
  access: true,
  createdAt: true,
  completedAt: true,
  expiresAt: true,
  errorMessage: true,
} as const;

type JobSummaryRow = Pick<HrReportJobRow, keyof typeof JOB_SUMMARY_SELECT>;

export function toPublicHrJob(job: JobSummaryRow): HrReportJob {
  return {
    id: job.id,
    status: job.status,
    access: job.access,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
    expiresAt: job.expiresAt?.toISOString() ?? null,
    errorMessage: job.errorMessage,
  };
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Request / list / download for HR Analytics Reports, and the payment
 * callback. Every request is checked here before anything is built or
 * charged: approved owner, enough reviews, nothing already building, the
 * daily cap, then who pays (decideHrReportAccess). Building happens later
 * in HrAnalyticsReportWorker.
 */
@Injectable()
export class HrAnalyticsReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly data: HrAnalyticsReportDataService,
    private readonly payments: PaymentsService,
  ) {}

  async overview(userId: string, companyId: string, now = new Date()): Promise<HrReportOverview> {
    const ownership = await this.requireApprovedOwnership(userId, companyId);
    const [allowance, jobs] = await Promise.all([
      this.allowance(ownership, companyId, now),
      this.prisma.hrAnalyticsReportJob.findMany({
        // A checkout that was opened but never paid isn't a report.
        where: { companyId, status: { not: "AWAITING_PAYMENT" } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: JOB_SUMMARY_SELECT,
      }),
    ]);
    return { allowance, jobs: jobs.map(toPublicHrJob) };
  }

  async request(userId: string, companyId: string, input: HrReportRequest = {}, now = new Date()): Promise<HrReportRequestResult> {
    const ownership = await this.requireApprovedOwnership(userId, companyId);
    // Checked before any charge: nobody pays for a report that can't be built.
    await this.data.assertEligible(companyId);

    const building = await this.prisma.hrAnalyticsReportJob.findFirst({
      where: { companyId, status: { in: ["QUEUED", "RUNNING"] } },
      select: { id: true },
    });
    if (building) throw new ConflictException("A report for this company is already being built. Please wait for it to finish.");

    const startedToday = await this.prisma.hrAnalyticsReportJob.count({
      where: { companyId, createdAt: { gte: startOfUtcDay(now) }, status: { in: ["QUEUED", "RUNNING", "READY"] } },
    });
    if (startedToday >= MAX_HR_REPORTS_PER_COMPANY_PER_DAY) {
      throw new HttpException(
        `You can create up to ${MAX_HR_REPORTS_PER_COMPANY_PER_DAY} HR Analytics Reports per day. Please try again tomorrow.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const credit = await this.paidCredit(companyId);
    const quotaMonth = quotaMonthKey(now);
    const mode = decideHrReportAccess({
      tier: ownership.tier,
      planStatus: ownership.planStatus,
      quotaUsedThisMonth: await this.quotaUsed(companyId, quotaMonth),
      hasPaidCredit: credit !== null,
    });
    const base = { requestedByUserId: userId, companyId };

    try {
      if (mode === "INCLUDED") {
        return { status: "QUEUED", job: await this.createJob({ ...base, access: "PLAN" }) };
      }
      if (mode === "PAID_CREDIT") {
        return { status: "QUEUED", job: await this.createJob({ ...base, access: "PAID", retryOfJobId: credit!, paidAt: now }) };
      }
      if (mode === "MONTHLY_QUOTA") {
        return { status: "QUEUED", job: await this.createJob({ ...base, access: "MONTHLY_QUOTA", quotaMonth }) };
      }
    } catch (err) {
      // Two clicks at once: the unique indexes let only one of them through.
      if (isUniqueViolation(err)) throw new ConflictException("That report was just started. Refresh to see it.");
      throw err;
    }

    if (!input.billing) {
      throw new HttpException(
        `This report costs ${HR_REPORT_PRICE_LABEL}. Add billing details to buy it.`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    const job = await this.createJob({ ...base, access: "PAID", status: "AWAITING_PAYMENT" });

    // Same "must be this API's own public address" rule as the other iyzico
    // checkouts (see PaymentsService.initiatePlusCheckout).
    const apiPublicUrl = process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3001}/v1`;
    try {
      const checkout = await this.payments.createOneTimeCheckout({
        conversationId: job.id,
        callbackUrl: `${apiPublicUrl.replace(/\/$/, "")}/hr-analytics-report/checkout-callback`,
        priceTry: HR_REPORT_PRICE_TRY,
        basketId: job.id,
        itemName: "HR Analytics Report",
        buyerName: input.billing.buyerName,
        buyerSurname: input.billing.buyerSurname,
        buyerIdentityNumber: input.billing.buyerIdentityNumber,
        buyerEmail: input.billing.buyerEmail,
        buyerGsmNumber: input.billing.buyerGsmNumber,
        billingAddress: input.billing.billingAddress,
      });
      return { status: "CHECKOUT_REQUIRED", job, checkoutFormContent: checkout.checkoutFormContent };
    } catch (err) {
      // iyzico not configured yet, or unreachable: nothing was charged, so
      // the placeholder row goes too.
      // eslint-disable-next-line no-console
      console.error(`[hr-analytics-report] checkout could not start for job=${job.id}:`, err);
      await this.prisma.hrAnalyticsReportJob.delete({ where: { id: job.id } });
      throw new ServiceUnavailableException("Online payment isn't available right now, so the report couldn't be bought. You weren't charged.");
    }
  }

  async download(userId: string, companyId: string, jobId: string): Promise<{ filename: string; pdf: Buffer }> {
    await this.requireApprovedOwnership(userId, companyId);
    const job = await this.prisma.hrAnalyticsReportJob.findFirst({
      where: { id: jobId, companyId, status: "READY", expiresAt: { gt: new Date() } },
      select: { pdf: true, completedAt: true, company: { select: { slug: true } } },
    });
    if (!job?.pdf) throw new NotFoundException("This report doesn't exist or its download link has expired.");
    const date = (job.completedAt ?? new Date()).toISOString().slice(0, 10);
    // Slugs are already plain ASCII, safe for a Content-Disposition header.
    return { filename: `hr-analytics-${job.company.slug}-${date}.pdf`, pdf: Buffer.from(job.pdf) };
  }

  /**
   * The iyzico callback for a bought report. Trusts nothing in the callback
   * itself: the status comes from asking iyzico with our own key. Idempotent
   * (only an AWAITING_PAYMENT job moves). Returns the company id so the
   * browser can land back on that company's dashboard.
   */
  async completeCheckout(token: string): Promise<string | null> {
    const status = await this.payments.retrieveOneTimeCheckoutStatus(token).catch((err) => {
      // eslint-disable-next-line no-console
      console.error(`[hr-analytics-report] retrieveOneTimeCheckoutStatus failed for token=${token}:`, err);
      return null;
    });
    if (!status?.conversationId) return null;
    const job = await this.prisma.hrAnalyticsReportJob.findUnique({
      where: { id: status.conversationId },
      select: { companyId: true },
    });
    if (!job) return null;
    if (status.paid) {
      await this.prisma.hrAnalyticsReportJob.updateMany({
        where: { id: status.conversationId, status: "AWAITING_PAYMENT" },
        data: { status: "QUEUED", paidAt: new Date() },
      });
    }
    return job.companyId;
  }

  private async allowance(ownership: CompanyOwner, companyId: string, now: Date): Promise<HrReportAllowance> {
    const quotaMonth = quotaMonthKey(now);
    const [quotaUsed, credit, eligible] = await Promise.all([
      this.quotaUsed(companyId, quotaMonth),
      this.paidCredit(companyId),
      this.data.isEligible(companyId),
    ]);
    const mode = decideHrReportAccess({
      tier: ownership.tier,
      planStatus: ownership.planStatus,
      quotaUsedThisMonth: quotaUsed,
      hasPaidCredit: credit !== null,
    });
    const isPro = ownership.tier === "BLUE_PLUS" && ownership.planStatus === "ACTIVE";
    return {
      mode,
      quotaRemaining: isPro ? (quotaUsed ? 0 : 1) : null,
      quotaResetsOn: isPro ? nextQuotaReset(now) : null,
      priceTry: HR_REPORT_PRICE_TRY,
      eligible,
      ineligibleReason: eligible ? null : NOT_ENOUGH_REVIEWS,
    };
  }

  private async quotaUsed(companyId: string, quotaMonth: string): Promise<boolean> {
    const row = await this.prisma.hrAnalyticsReportJob.findFirst({ where: { companyId, quotaMonth }, select: { id: true } });
    return row !== null;
  }

  /** A paid report that failed and hasn't been rebuilt yet, if any. */
  private async paidCredit(companyId: string): Promise<string | null> {
    const failed = await this.prisma.hrAnalyticsReportJob.findMany({
      where: { companyId, access: "PAID", status: "FAILED" },
      select: { id: true },
    });
    if (failed.length === 0) return null;
    const retried = await this.prisma.hrAnalyticsReportJob.findMany({
      where: { retryOfJobId: { in: failed.map((f) => f.id) } },
      select: { retryOfJobId: true },
    });
    const used = new Set(retried.map((r) => r.retryOfJobId));
    return failed.find((f) => !used.has(f.id))?.id ?? null;
  }

  private async createJob(data: Prisma.HrAnalyticsReportJobUncheckedCreateInput): Promise<HrReportJob> {
    return toPublicHrJob(await this.prisma.hrAnalyticsReportJob.create({ data, select: JOB_SUMMARY_SELECT }));
  }

  private async requireApprovedOwnership(userId: string, companyId: string): Promise<CompanyOwner> {
    const ownership = await this.prisma.companyOwner.findUnique({ where: { userId_companyId: { userId, companyId } } });
    if (!ownership || ownership.claimStatus !== "APPROVED") {
      throw new ForbiddenException("You are not an approved owner of this company");
    }
    return ownership;
  }
}

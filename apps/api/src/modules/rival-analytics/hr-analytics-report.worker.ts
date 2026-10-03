import { HttpException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { POLL_INTERVAL_MS, REPORT_TTL_MS } from "./benchmark-report.worker";
import { HrAnalyticsReportDataService } from "./hr-analytics-report.data";
import { buildHrAnalyticsPdf } from "./hr-analytics-report.pdf";

// A report that takes longer than this is given up on, so one stuck build
// can never hold the queue.
export const HR_REPORT_TIMEOUT_MS = 30_000;

class ReportTimeout extends Error {}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ReportTimeout()), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Builds queued HR Analytics Reports in the background, one at a time per
 * process — same DB-backed queue as BenchmarkReportWorker (a job is claimed
 * with a conditional QUEUED -> RUNNING update, so two processes never build
 * the same one). A failed build hands back what paid for it: the Pro
 * monthly allowance is released, and a paid report can be rebuilt free.
 *
 * Set BENCHMARK_WORKER_DISABLED=1 to keep a process from polling.
 */
@Injectable()
export class HrAnalyticsReportWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HrAnalyticsReportWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private busy = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly data: HrAnalyticsReportDataService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.BENCHMARK_WORKER_DISABLED === "1") return;
    await this.prisma.hrAnalyticsReportJob.updateMany({ where: { status: "RUNNING" }, data: { status: "QUEUED" } });
    this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      while (await this.processNext()) {
        // keep draining until the queue is empty
      }
    } catch (err) {
      this.logger.error("HR report polling failed", err as Error);
    } finally {
      this.busy = false;
    }
  }

  /** Builds the oldest queued report. Returns false when there was nothing to do. */
  async processNext(): Promise<boolean> {
    const next = await this.prisma.hrAnalyticsReportJob.findFirst({
      where: { status: "QUEUED" },
      orderBy: { createdAt: "asc" },
      select: { id: true, companyId: true },
    });
    if (!next) return false;

    const claimed = await this.prisma.hrAnalyticsReportJob.updateMany({
      where: { id: next.id, status: "QUEUED" },
      data: { status: "RUNNING" },
    });
    if (claimed.count === 0) return true;

    try {
      const pdf = await withTimeout(
        this.data.build(next.companyId).then(buildHrAnalyticsPdf),
        HR_REPORT_TIMEOUT_MS,
      );
      const completedAt = new Date();
      await this.prisma.hrAnalyticsReportJob.update({
        where: { id: next.id },
        data: { status: "READY", pdf, completedAt, expiresAt: new Date(completedAt.getTime() + REPORT_TTL_MS) },
      });
    } catch (err) {
      const errorMessage =
        err instanceof HttpException
          ? err.message
          : err instanceof ReportTimeout
            ? "This report took too long to build. You can try again; you haven't lost a report."
            : "Something went wrong while building this report. You can try again; you haven't lost a report.";
      if (!(err instanceof HttpException)) this.logger.error(`HR report ${next.id} failed`, err as Error);
      await this.prisma.hrAnalyticsReportJob.update({
        where: { id: next.id },
        data: { status: "FAILED", errorMessage, completedAt: new Date(), quotaMonth: null },
      });
    }
    return true;
  }
}

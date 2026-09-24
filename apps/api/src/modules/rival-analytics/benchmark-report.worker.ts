import { HttpException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { buildSectorBenchmarkPdf } from "./pdf-report.builder";
import { SectorBenchmarkService } from "./sector-benchmark.service";

export const POLL_INTERVAL_MS = 3_000;
export const REPORT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Drains the BenchmarkReportJob table in the background — a small,
 * DB-backed queue instead of Redis/BullMQ, since the API already has
 * Postgres and nothing else. One job at a time per process; a job is
 * claimed with a conditional update (QUEUED -> RUNNING), so two API
 * processes can never build the same report twice.
 *
 * Set BENCHMARK_WORKER_DISABLED=1 to keep a process from polling.
 */
@Injectable()
export class BenchmarkReportWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BenchmarkReportWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private busy = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sectorBenchmark: SectorBenchmarkService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.BENCHMARK_WORKER_DISABLED === "1") return;
    // A job left RUNNING means the process building it died mid-way.
    await this.prisma.benchmarkReportJob.updateMany({ where: { status: "RUNNING" }, data: { status: "QUEUED" } });
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
      this.logger.error("Benchmark report polling failed", err as Error);
    } finally {
      this.busy = false;
    }
  }

  /** Builds the oldest queued report. Returns false when there was nothing to do. */
  async processNext(): Promise<boolean> {
    const next = await this.prisma.benchmarkReportJob.findFirst({
      where: { status: "QUEUED" },
      orderBy: { createdAt: "asc" },
      select: { id: true, companyId: true, sectorCategory: true, city: true },
    });
    if (!next) return false;

    const claimed = await this.prisma.benchmarkReportJob.updateMany({
      where: { id: next.id, status: "QUEUED" },
      data: { status: "RUNNING" },
    });
    if (claimed.count === 0) return true; // another process took it; look again

    try {
      const company = await this.prisma.company.findUniqueOrThrow({
        where: { id: next.companyId },
        select: { name: true },
      });
      const data = await this.sectorBenchmark.buildReportData(
        { sectorCategory: next.sectorCategory, city: next.city },
        company.name,
      );
      const pdf = await buildSectorBenchmarkPdf(data);
      const completedAt = new Date();
      await this.prisma.benchmarkReportJob.update({
        where: { id: next.id },
        data: { status: "READY", pdf, completedAt, expiresAt: new Date(completedAt.getTime() + REPORT_TTL_MS) },
      });
    } catch (err) {
      // An HttpException here is a user-facing reason (e.g. the anonymity
      // lock, if data changed after the request); anything else is ours.
      const errorMessage =
        err instanceof HttpException ? err.message : "Something went wrong while building this report. Please try again.";
      if (!(err instanceof HttpException)) this.logger.error(`Benchmark report ${next.id} failed`, err as Error);
      await this.prisma.benchmarkReportJob.update({
        where: { id: next.id },
        data: { status: "FAILED", errorMessage, completedAt: new Date() },
      });
    }
    return true;
  }
}

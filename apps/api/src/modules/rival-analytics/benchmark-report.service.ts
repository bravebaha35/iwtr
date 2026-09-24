import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { BenchmarkReportJob as BenchmarkReportJobRow } from "@prisma/client";
import type { BenchmarkReportJob, SectorBenchmarkRequest } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { SectorBenchmarkService } from "./sector-benchmark.service";

export const MAX_REPORTS_PER_COMPANY_PER_DAY = 3;

// Every column except the PDF bytes — list/request responses never carry
// the file itself.
const JOB_SUMMARY_SELECT = {
  id: true,
  status: true,
  sectorCategory: true,
  city: true,
  createdAt: true,
  completedAt: true,
  expiresAt: true,
  errorMessage: true,
} as const;

type JobSummaryRow = Pick<BenchmarkReportJobRow, keyof typeof JOB_SUMMARY_SELECT>;

export function toPublicJob(job: JobSummaryRow): BenchmarkReportJob {
  return {
    id: job.id,
    status: job.status,
    sectorCategory: job.sectorCategory,
    city: job.city,
    createdAt: job.createdAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
    expiresAt: job.expiresAt?.toISOString() ?? null,
    errorMessage: job.errorMessage,
  };
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Request / list / download for Sector Benchmark Reports. Requesting only
 * queues a job — BenchmarkReportWorker builds the PDF in the background.
 * Sector = the requester's own Company.category; scope CITY narrows it to
 * the requester's own Company.city.
 */
@Injectable()
export class BenchmarkReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sectorBenchmark: SectorBenchmarkService,
  ) {}

  async request(userId: string, companyId: string, input: SectorBenchmarkRequest): Promise<BenchmarkReportJob> {
    const ownership = await this.requireApprovedOwnership(userId, companyId);
    if (ownership.tier !== "ENTERPRISE") {
      throw new ForbiddenException("Sector Benchmark Reports are part of the Enterprise plan.");
    }

    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const city = input.scope === "CITY" ? company.city : null;
    if (input.scope === "CITY" && !city) {
      throw new BadRequestException("Your company has no city on file, so only an all-Turkey report is possible.");
    }

    const requestedToday = await this.prisma.benchmarkReportJob.count({
      where: { companyId, createdAt: { gte: startOfUtcDay(new Date()) } },
    });
    if (requestedToday >= MAX_REPORTS_PER_COMPANY_PER_DAY) {
      throw new HttpException(
        `You can request up to ${MAX_REPORTS_PER_COMPANY_PER_DAY} Sector Benchmark Reports per day. Please try again tomorrow.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Fail fast with the anonymity 403 instead of queuing a job that can
    // only fail. The worker checks again, since data can change meanwhile.
    const scope = { sectorCategory: company.category, city };
    await this.sectorBenchmark.assertEligibleScope(scope);

    const job = await this.prisma.benchmarkReportJob.create({
      data: { requestedByUserId: userId, companyId, ...scope },
      select: JOB_SUMMARY_SELECT,
    });
    return toPublicJob(job);
  }

  async list(userId: string, companyId: string): Promise<BenchmarkReportJob[]> {
    await this.requireApprovedOwnership(userId, companyId);
    const jobs = await this.prisma.benchmarkReportJob.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: JOB_SUMMARY_SELECT,
    });
    return jobs.map(toPublicJob);
  }

  async download(userId: string, companyId: string, jobId: string): Promise<{ filename: string; pdf: Buffer }> {
    await this.requireApprovedOwnership(userId, companyId);
    const job = await this.prisma.benchmarkReportJob.findFirst({
      where: { id: jobId, companyId, status: "READY", expiresAt: { gt: new Date() } },
      select: { pdf: true, sectorCategory: true, city: true, completedAt: true },
    });
    if (!job?.pdf) {
      throw new NotFoundException("This report doesn't exist or its download link has expired.");
    }
    const date = (job.completedAt ?? new Date()).toISOString().slice(0, 10);
    return {
      filename: `sector-benchmark-${asciiSlug(job.sectorCategory)}-${asciiSlug(job.city ?? "turkey")}-${date}.pdf`,
      pdf: Buffer.from(job.pdf),
    };
  }

  private async requireApprovedOwnership(userId: string, companyId: string) {
    const ownership = await this.prisma.companyOwner.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!ownership || ownership.claimStatus !== "APPROVED") {
      throw new ForbiddenException("You are not an approved owner of this company");
    }
    return ownership;
  }
}

// Download filenames go into a Content-Disposition header, which must stay
// plain ASCII: Turkish letters are folded to their base letter first
// (dotless i and dotted capital I explicitly, since NFKD leaves them alone).
function asciiSlug(value: string): string {
  return value
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

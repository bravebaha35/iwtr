import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  COMPANY_REPORT_REASONS,
  type AdminCompanyReport,
  type CompanyReportReason,
  type ReportCompanyInput,
} from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * The Report button on a company page, and the admin queue that reads it.
 * Reports only ever reach admins, grouped per company with a count per
 * reason - the reporter is never shown to anyone.
 */
@Injectable()
export class CompanyReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** One open report per member per company; reporting again updates the reason and reopens a dismissed one. */
  async report(userId: string, companyId: string, input: ReportCompanyInput): Promise<{ reported: true }> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) throw new NotFoundException("Company not found");
    const ownership = await this.prisma.companyOwner.findUnique({
      where: { userId_companyId: { userId, companyId } },
      select: { claimStatus: true },
    });
    if (ownership?.claimStatus === "APPROVED") {
      throw new ForbiddenException("You can't report your own company.");
    }

    await this.prisma.companyReport.upsert({
      where: { companyId_reporterId: { companyId, reporterId: userId } },
      create: { companyId, reporterId: userId, reason: input.reason },
      update: { reason: input.reason, createdAt: new Date(), dismissedAt: null },
    });
    return { reported: true };
  }

  /** Every company with at least one open report, most-reported first. */
  async listOpen(): Promise<AdminCompanyReport[]> {
    const rows = await this.prisma.companyReport.findMany({
      where: { dismissedAt: null },
      select: { reason: true, createdAt: true, company: { select: { id: true, name: true, slug: true } } },
    });
    const byCompany = new Map<string, AdminCompanyReport>();
    for (const row of rows) {
      let entry = byCompany.get(row.company.id);
      if (!entry) {
        entry = {
          companyId: row.company.id,
          companyName: row.company.name,
          companySlug: row.company.slug,
          reportCount: 0,
          reasonCounts: {},
          lastReportedAt: row.createdAt.toISOString(),
        };
        byCompany.set(row.company.id, entry);
      }
      entry.reportCount += 1;
      if (COMPANY_REPORT_REASONS.includes(row.reason as CompanyReportReason)) {
        const reason = row.reason as CompanyReportReason;
        entry.reasonCounts[reason] = (entry.reasonCounts[reason] ?? 0) + 1;
      }
      if (row.createdAt.toISOString() > entry.lastReportedAt) entry.lastReportedAt = row.createdAt.toISOString();
    }
    return [...byCompany.values()].sort(
      (a, b) => b.reportCount - a.reportCount || b.lastReportedAt.localeCompare(a.lastReportedAt),
    );
  }

  /** "Reviewed, nothing to do" - closes every open report on the company. */
  async dismiss(companyId: string): Promise<{ dismissed: number }> {
    const result = await this.prisma.companyReport.updateMany({
      where: { companyId, dismissedAt: null },
      data: { dismissedAt: new Date() },
    });
    return { dismissed: result.count };
  }
}

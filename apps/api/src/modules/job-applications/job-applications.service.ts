import { randomUUID } from "crypto";
import { join } from "path";
import { mkdir, unlink, writeFile } from "fs/promises";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { JobApplicationListItem, SubmitJobApplicationResponse } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";

const UPLOADS_DIR = join(process.cwd(), "uploads", "job-applications");
const MAX_PDF_SIZE_BYTES = 8 * 1024 * 1024;
const PDF_MAGIC_BYTES = Buffer.from("%PDF-", "ascii");

function isRealPdf(file: Express.Multer.File): boolean {
  if (file.mimetype !== "application/pdf") return false;
  if (file.buffer.length > MAX_PDF_SIZE_BYTES) return false;
  return file.buffer.subarray(0, 5).equals(PDF_MAGIC_BYTES);
}

@Injectable()
export class JobApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Duplicated from JobPostingsService.requireApprovedOwnership on purpose —
  // matches this codebase's existing module-per-feature convention (see the
  // identical comment on JobPostingsService's own copy).
  private async requireApprovedOwnership(userId: string, companyId: string) {
    const ownership = await this.prisma.companyOwner.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!ownership || ownership.claimStatus !== "APPROVED") {
      throw new ForbiddenException("You are not an approved owner of this company");
    }
    return ownership;
  }

  async apply(
    userId: string,
    userRole: string,
    jobPostingId: string,
    file: Express.Multer.File | undefined,
  ): Promise<SubmitJobApplicationResponse> {
    if (userRole === "COMPANY_OWNER") {
      throw new ForbiddenException("Company owners can't apply to job postings.");
    }
    if (!file) {
      throw new BadRequestException("No file uploaded.");
    }
    if (!isRealPdf(file)) {
      throw new BadRequestException("Uploaded file must be a valid PDF under 8MB.");
    }

    const posting = await this.prisma.jobPosting.findUnique({ where: { id: jobPostingId } });
    if (!posting || posting.status !== "PUBLISHED" || posting.filledAt !== null) {
      throw new NotFoundException("This job posting is no longer accepting applications.");
    }

    const existing = await this.prisma.jobApplication.findUnique({
      where: { jobPostingId_applicantUserId: { jobPostingId, applicantUserId: userId } },
    });

    await mkdir(UPLOADS_DIR, { recursive: true });
    const filename = `${randomUUID()}.pdf`;
    await writeFile(join(UPLOADS_DIR, filename), file.buffer);
    const origin = process.env.API_PUBLIC_ORIGIN ?? `http://localhost:${process.env.PORT ?? 3001}`;
    const pdfUrl = `${origin}/uploads/job-applications/${filename}`;

    if (existing) {
      // Re-applying replaces the previous submission rather than piling up
      // duplicates in the owner's inbox (see @@unique on the Prisma model).
      const oldPath = existing.pdfUrl.split("/uploads/job-applications/")[1];
      if (oldPath) {
        await unlink(join(UPLOADS_DIR, oldPath)).catch(() => {
          // Best-effort cleanup — an orphaned old file is harmless disk usage,
          // never worth failing the new application over.
        });
      }
      const updated = await this.prisma.jobApplication.update({
        where: { id: existing.id },
        data: { pdfUrl, createdAt: new Date(), viewedAt: null },
      });
      return { id: updated.id, createdAt: updated.createdAt.toISOString() };
    }

    const created = await this.prisma.jobApplication.create({
      data: { jobPostingId, companyId: posting.companyId, applicantUserId: userId, pdfUrl },
    });
    return { id: created.id, createdAt: created.createdAt.toISOString() };
  }

  async listForCompany(userId: string, companyId: string): Promise<JobApplicationListItem[]> {
    await this.requireApprovedOwnership(userId, companyId);
    const rows = await this.prisma.jobApplication.findMany({
      where: { companyId },
      include: { jobPosting: { select: { jobTitle: true } }, applicant: { select: { displayName: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      jobPostingId: r.jobPostingId,
      jobTitle: r.jobPosting.jobTitle,
      applicantDisplayName: r.applicant.displayName ?? "Anonymous applicant",
      pdfUrl: r.pdfUrl,
      createdAt: r.createdAt.toISOString(),
      viewedAt: r.viewedAt ? r.viewedAt.toISOString() : null,
    }));
  }

  async markViewed(userId: string, companyId: string, id: string): Promise<void> {
    await this.requireApprovedOwnership(userId, companyId);
    const application = await this.prisma.jobApplication.findUnique({ where: { id } });
    if (!application || application.companyId !== companyId) {
      throw new NotFoundException("Application not found.");
    }
    if (application.viewedAt === null) {
      await this.prisma.jobApplication.update({ where: { id }, data: { viewedAt: new Date() } });
    }
  }
}

import { randomUUID } from "crypto";
import { join } from "path";
import { mkdir, unlink, writeFile } from "fs/promises";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { JobApplicationListItem, SubmitJobApplicationResponse } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { daysRemaining, shouldLazyReshare } from "../job-postings/job-postings.util";

// Deliberately OUTSIDE the "uploads/" tree main.ts serves publicly via
// `app.useStaticAssets(join(process.cwd(), "uploads"), { prefix: "/uploads/" })`
// — that mount covers every subdirectory of uploads/ with zero auth, so a
// PDF written under uploads/job-applications/ would still be directly
// fetchable by anyone who had or guessed its filename, regardless of what
// URL the API tells callers. Applicant PDFs contain name/email/phone/
// employment history, so they must never live under a path any static
// mount covers — the only way to read one is through the authenticated,
// ownership-checked GET my-companies/:companyId/job-applications/:id/pdf
// route below (see getPdfFilePath), which reads directly from this
// directory via fs, not through Express's static file serving.
const UPLOADS_DIR = join(process.cwd(), "uploads-private", "job-applications");
// Exported so JobApplicationsController can pass the same ceiling to
// FileInterceptor's `limits.fileSize` — rejecting an oversized upload at the
// multipart-parsing layer, before it's ever fully buffered into memory,
// rather than only after isRealPdf inspects the buffer below.
export const MAX_PDF_SIZE_BYTES = 8 * 1024 * 1024;
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
    // Mirrors companies.service.ts's public-visibility check: a PUBLISHED,
    // not-yet-filled posting can still have run out its 30-day live window.
    // shouldLazyReshare is checked first because a reshare-eligible posting
    // is treated as live again everywhere else that reads postings — a
    // stricter check here would reject applications to a posting the
    // company page is still showing as open.
    if (!shouldLazyReshare(posting) && daysRemaining(posting) === 0) {
      throw new NotFoundException("This job posting is no longer accepting applications.");
    }

    const existing = await this.prisma.jobApplication.findUnique({
      where: { jobPostingId_applicantUserId: { jobPostingId, applicantUserId: userId } },
    });

    await mkdir(UPLOADS_DIR, { recursive: true });
    const filename = `${randomUUID()}.pdf`;
    await writeFile(join(UPLOADS_DIR, filename), file.buffer);
    // Stored as just the on-disk filename, never a public URL — the file
    // lives under UPLOADS_DIR (outside any static mount, see its comment
    // above) and is only ever reachable through the authenticated,
    // ownership-checked GET my-companies/:companyId/job-applications/:id/pdf
    // route (see JobApplicationsController.downloadPdf / getPdfFilePath
    // below).
    const pdfUrl = filename;

    if (existing) {
      // Re-applying replaces the previous submission rather than piling up
      // duplicates in the owner's inbox (see @@unique on the Prisma model).
      const oldFilename = existing.pdfUrl;
      if (oldFilename) {
        await unlink(join(UPLOADS_DIR, oldFilename)).catch(() => {
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
      // Not a directly-downloadable URL — a relative, authenticated API path
      // the frontend must fetch (through its proxy, so the Bearer token gets
      // attached) rather than link to as a bare <a href>. See getPdfFilePath.
      pdfUrl: `/my-companies/${companyId}/job-applications/${r.id}/pdf`,
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

  // Backs GET my-companies/:companyId/job-applications/:id/pdf. Same
  // ownership + companyId-match pattern as markViewed, so an approved owner
  // of one company can never read another company's applicant PDF by id.
  // Returns an absolute on-disk path for the controller to stream back with
  // res.sendFile — this is the only place outside apply() that ever turns
  // the stored filename back into a real filesystem path.
  async getPdfFilePath(userId: string, companyId: string, id: string): Promise<string> {
    await this.requireApprovedOwnership(userId, companyId);
    const application = await this.prisma.jobApplication.findUnique({ where: { id } });
    if (!application || application.companyId !== companyId) {
      throw new NotFoundException("Application not found.");
    }
    return join(UPLOADS_DIR, application.pdfUrl);
  }
}

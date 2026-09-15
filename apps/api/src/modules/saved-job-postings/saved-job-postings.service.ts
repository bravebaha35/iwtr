import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { SavedJobPosting, SavedJobPostingToggleResult } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { shouldLazyReshare, isWithinSavedGraceWindow, daysRemaining } from "../job-postings/job-postings.util";

@Injectable()
export class SavedJobPostingsService {
  constructor(private readonly prisma: PrismaService) {}

  // Same race-safe toggle shape as SocialService.toggleSave (see
  // saved-posts.controller.ts's precedent) — a private bookmark, no public
  // save count.
  async toggle(userId: string, jobPostingId: string): Promise<SavedJobPostingToggleResult> {
    const posting = await this.prisma.jobPosting.findUnique({ where: { id: jobPostingId } });
    if (!posting) {
      throw new NotFoundException("Job posting not found");
    }

    const existing = await this.prisma.savedJobPosting.findUnique({
      where: { userId_jobPostingId: { userId, jobPostingId } },
    });
    if (existing) {
      try {
        await this.prisma.savedJobPosting.delete({ where: { id: existing.id } });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")) {
          throw err;
        }
      }
      return { jobPostingId, saved: false };
    }

    try {
      await this.prisma.savedJobPosting.create({ data: { userId, jobPostingId } });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
        throw err;
      }
    }
    return { jobPostingId, saved: true };
  }

  // The caller's own saved postings, most-recently-saved first. Applies the
  // same lazy-reshare pass the public feed and owner list use, then the
  // same 30-day grace window — a saved posting that's dropped out of the
  // grace window simply stops appearing here (its SavedJobPosting row is
  // never deleted; if it ever becomes relevant again there's nothing to
  // restore since the underlying JobPosting row is untouched either).
  async list(userId: string): Promise<SavedJobPosting[]> {
    const rows = await this.prisma.savedJobPosting.findMany({
      where: { userId },
      include: { jobPosting: true },
      orderBy: { createdAt: "desc" },
    });

    const result: SavedJobPosting[] = [];
    for (const row of rows) {
      let posting = row.jobPosting;
      if (shouldLazyReshare(posting)) {
        posting = await this.prisma.jobPosting.update({
          where: { id: posting.id },
          data: { lastResharedAt: new Date() },
        });
      }
      if (!isWithinSavedGraceWindow(posting)) continue;
      result.push({
        id: posting.id,
        companyId: posting.companyId,
        jobTitle: posting.jobTitle,
        description: posting.description,
        expired: posting.status !== "PUBLISHED" || daysRemaining(posting) === 0,
      });
    }
    return result;
  }
}

import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { SavedJobPosting, SavedJobPostingToggleResult } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { shouldLazyReshare, isWithinSavedGraceWindow, daysRemaining } from "../job-postings/job-postings.util";
import { PUBLIC_COMPANY_WHERE } from "../companies/company-visibility";
import { toPublicCompany } from "../companies/company-public.util";

@Injectable()
export class SavedJobPostingsService {
  constructor(private readonly prisma: PrismaService) {}

  // Same race-safe toggle shape as SocialService.toggleSave (see
  // saved-posts.controller.ts's precedent) — a private bookmark, no public
  // save count.
  async toggle(userId: string, jobPostingId: string): Promise<SavedJobPostingToggleResult> {
    // Gated the same way jobPostingsByCompanyId gates the public feed — a
    // hidden company's postings must not be saveable (or stay saved) either.
    const posting = await this.prisma.jobPosting.findFirst({
      where: { id: jobPostingId, company: PUBLIC_COMPANY_WHERE },
    });
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
  // Carries the full public Company shape per row (via the same
  // toPublicCompany CompaniesService itself uses) so the frontend can render
  // this list with the exact same JobCard component used everywhere else —
  // a bare companyId isn't enough to render a card or even link out to the
  // company page.
  async list(userId: string): Promise<SavedJobPosting[]> {
    const rows = await this.prisma.savedJobPosting.findMany({
      where: { userId, jobPosting: { company: PUBLIC_COMPANY_WHERE } },
      include: {
        jobPosting: {
          include: {
            company: { include: { aggregate: true, owners: { where: { claimStatus: "APPROVED" }, select: { id: true }, take: 1 } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Same batched lazy-reshare pattern as CompaniesService.jobPostingsByCompanyId
    // — evaluate each row against what it will look like immediately after a
    // reshare, without an await per row; the actual write is one updateMany
    // after this loop.
    const now = new Date();
    const staleIds: string[] = [];
    const result: SavedJobPosting[] = [];
    for (const row of rows) {
      const posting = row.jobPosting;
      const reshareEligible = shouldLazyReshare(posting);
      const effective = reshareEligible ? { ...posting, lastResharedAt: now } : posting;
      if (reshareEligible) staleIds.push(posting.id);
      if (!isWithinSavedGraceWindow(effective)) continue;
      result.push({
        company: {
          ...toPublicCompany(posting.company, posting.company.owners.length > 0),
          overallAvg: posting.company.aggregate?.overallAvg ?? null,
          reviewCount: posting.company.aggregate?.reviewCount ?? 0,
          // Unused by JobCard's own rendering on this path (see the schema
          // comment on savedJobPostingSchema) - always empty here rather
          // than a second query this list never needs.
          jobTitles: [],
          jobPostings: [],
        },
        posting: { id: posting.id, jobTitle: posting.jobTitle, description: posting.description },
        expired: posting.status !== "PUBLISHED" || daysRemaining(effective) === 0,
      });
    }
    if (staleIds.length > 0) {
      await this.prisma.jobPosting.updateMany({ where: { id: { in: staleIds } }, data: { lastResharedAt: now } });
    }
    return result;
  }
}

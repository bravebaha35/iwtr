import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CompanyFollowToggleResult, CompanyFollowerCount, FollowedCompanySummary, UserFollowToggleResult } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { PUBLIC_COMPANY_WHERE, assertCompanyVisibleOrThrow } from "../companies/company-visibility";

@Injectable()
export class FollowsService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Company follows. Role isolation ("owners cannot act as employee
  // followers") is enforced by FollowsController's @Roles("MEMBER") guard —
  // the only mechanism this codebase uses for role gating (RolesGuard),
  // consistent with every other ADMIN/COMPANY_OWNER-gated route. A hidden or
  // nonexistent company can't be followed (assertCompanyVisibleOrThrow).
  async toggleCompanyFollow(userId: string, companyId: string): Promise<CompanyFollowToggleResult> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, hiddenAt: true },
    });
    assertCompanyVisibleOrThrow(company);

    const existing = await this.prisma.companyFollow.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (existing) {
      try {
        await this.prisma.companyFollow.delete({ where: { id: existing.id } });
      } catch (err) {
        // Parallel unfollow (double-click) already removed the row -> P2025.
        // Idempotent "now not following" rather than a 500.
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")) {
          throw err;
        }
      }
    } else {
      try {
        await this.prisma.companyFollow.create({ data: { userId, companyId } });
      } catch (err) {
        // Concurrent double-follow: a parallel request won the create and
        // this one hit @@unique([userId, companyId]). Row exists either
        // way -> idempotent "now following" instead of a 500.
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
          throw err;
        }
      }
    }
    return { companyId, following: !existing };
  }

  // The caller's own list — never anyone else's. Excludes companies that
  // have since been hidden, same visibility rule as every other public
  // company surface.
  async listFollowedCompanies(userId: string): Promise<FollowedCompanySummary[]> {
    const rows = await this.prisma.companyFollow.findMany({
      where: { userId, company: PUBLIC_COMPANY_WHERE },
      orderBy: { createdAt: "desc" },
      select: {
        company: { select: { id: true, name: true, slug: true, mainPhotoUrl: true, badgeTier: true } },
      },
    });
    return rows.map((r) => ({
      companyId: r.company.id,
      companyName: r.company.name,
      companySlug: r.company.slug,
      mainPhotoUrl: r.company.mainPhotoUrl,
      badgeTier: r.company.badgeTier as FollowedCompanySummary["badgeTier"],
    }));
  }

  // SECURITY (see REVIEW.md): the ONLY shape a company may ever receive for
  // its own followers is this bare integer — no code path here (or anywhere
  // else) may select CompanyFollow.userId for a company-facing response.
  // Ownership-gated the same way SocialService.requireApprovedOwnership
  // gates post creation — a MEMBER (no CompanyOwner row for this company)
  // or an owner of a DIFFERENT company both get 403, not a count.
  async companyFollowerCount(ownerUserId: string, companyId: string): Promise<CompanyFollowerCount> {
    const ownership = await this.prisma.companyOwner.findUnique({
      where: { userId_companyId: { userId: ownerUserId, companyId } },
    });
    if (!ownership || ownership.claimStatus !== "APPROVED") {
      throw new ForbiddenException("You are not an approved owner of this company.");
    }
    const count = await this.prisma.companyFollow.count({ where: { companyId } });
    return { count };
  }

  // --- User follows (employee -> employee, both pseudonymous). Both ends
  // must be role MEMBER — this is strictly an employee<->employee graph, not
  // a way to follow an owner/admin account. Self-follow is rejected as a
  // 400 (not silently ignored), matching this codebase's general rule of
  // surfacing a client mistake rather than swallowing it.
  async toggleUserFollow(followerId: string, followingId: string): Promise<UserFollowToggleResult> {
    if (followerId === followingId) {
      throw new BadRequestException("You cannot follow yourself.");
    }
    const target = await this.prisma.user.findUnique({
      where: { id: followingId },
      select: { id: true, role: true },
    });
    if (!target || target.role !== "MEMBER") {
      throw new NotFoundException("User not found.");
    }

    const existing = await this.prisma.userFollow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    if (existing) {
      try {
        await this.prisma.userFollow.delete({ where: { id: existing.id } });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")) {
          throw err;
        }
      }
    } else {
      try {
        await this.prisma.userFollow.create({ data: { followerId, followingId } });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
          throw err;
        }
      }
    }
    return { userId: followingId, following: !existing };
  }
}

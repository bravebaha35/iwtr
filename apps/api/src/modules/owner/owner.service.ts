import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AdminOwnerClaim,
  ClaimCompanyInput,
  ContactAdminInput,
  MyCompanyClaim,
  OwnedCompany,
  OwnerClaimStatus,
  OwnerContactMessage,
  UpdateCompanyFreeTierInput,
} from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class OwnerService {
  constructor(private readonly prisma: PrismaService) {}

  async claimCompany(userId: string, companySlug: string, input: ClaimCompanyInput): Promise<MyCompanyClaim> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.status !== "ACTIVE") {
      throw new ForbiddenException("Complete onboarding before claiming a company");
    }

    const company = await this.prisma.company.findUnique({ where: { slug: companySlug } });
    if (!company) throw new NotFoundException("Company not found");

    const existing = await this.prisma.companyOwner.findUnique({
      where: { userId_companyId: { userId, companyId: company.id } },
    });

    // Already approved — re-submitting a claim must never demote an existing
    // owner back to PENDING, so this is a no-op rather than an upsert.
    const row =
      existing?.claimStatus === "APPROVED"
        ? existing
        : await this.prisma.companyOwner.upsert({
            where: { userId_companyId: { userId, companyId: company.id } },
            create: { userId, companyId: company.id, claimMessage: input.message, claimStatus: "PENDING" },
            update: { claimMessage: input.message, claimStatus: "PENDING", resolvedAt: null },
          });

    return this.toMyClaim(row, company);
  }

  async myClaims(userId: string): Promise<MyCompanyClaim[]> {
    const rows = await this.prisma.companyOwner.findMany({
      where: { userId },
      include: { company: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => this.toMyClaim(r, r.company));
  }

  async myOwnedCompanies(userId: string): Promise<OwnedCompany[]> {
    const rows = await this.prisma.companyOwner.findMany({
      where: { userId, claimStatus: "APPROVED" },
      include: { company: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      companyId: r.companyId,
      companyName: r.company.name,
      companySlug: r.company.slug,
      tier: r.tier,
      planStatus: r.planStatus,
    }));
  }

  async updateMyCompany(userId: string, companyId: string, input: UpdateCompanyFreeTierInput): Promise<void> {
    // The input schema itself is already scoped to the Free-tier field
    // allowlist (name/category/mainPhotoUrl) — Plus tier (Phase 5) will add
    // fields to that schema and branch on ownership.tier here, not before.
    await this.requireApprovedOwnership(userId, companyId);

    if (input.name) {
      const existingByName = await this.prisma.company.findFirst({
        where: { name: { equals: input.name, mode: "insensitive" }, id: { not: companyId } },
      });
      if (existingByName) {
        throw new ConflictException(`A company named "${existingByName.name}" already exists.`);
      }
    }

    // Slug intentionally stays stable across a rename — it's the durable
    // identifier used in bookmarked/shared URLs and in review lookups.
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        name: input.name,
        category: input.category,
        mainPhotoUrl: input.mainPhotoUrl,
      },
    });
  }

  async contactAdmin(userId: string, companyId: string, input: ContactAdminInput): Promise<void> {
    await this.requireApprovedOwnership(userId, companyId);
    await this.prisma.ownerContactMessage.create({
      data: { companyId, ownerId: userId, message: input.message },
    });
  }

  async listClaims(status: OwnerClaimStatus = "PENDING"): Promise<AdminOwnerClaim[]> {
    const rows = await this.prisma.companyOwner.findMany({
      where: { claimStatus: status },
      include: { company: true, user: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      companyName: r.company.name,
      claimantUserId: r.userId,
      claimantEmail: r.user.email,
      claimMessage: r.claimMessage,
      claimStatus: r.claimStatus,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async approveClaim(id: string): Promise<void> {
    const claim = await this.getPendingClaimOrThrow(id);

    await this.prisma.$transaction([
      this.prisma.companyOwner.update({
        where: { id },
        data: { claimStatus: "APPROVED", resolvedAt: new Date() },
      }),
      // A member who becomes an owner gains the COMPANY_OWNER role; never
      // downgrade an existing ADMIN just for claiming a company.
      this.prisma.user.updateMany({
        where: { id: claim.userId, role: "MEMBER" },
        data: { role: "COMPANY_OWNER" },
      }),
    ]);
  }

  async rejectClaim(id: string): Promise<void> {
    await this.getPendingClaimOrThrow(id);
    await this.prisma.companyOwner.update({
      where: { id },
      data: { claimStatus: "REJECTED", resolvedAt: new Date() },
    });
  }

  async listContactMessages(onlyUnresolved = true): Promise<OwnerContactMessage[]> {
    const rows = await this.prisma.ownerContactMessage.findMany({
      where: onlyUnresolved ? { resolvedAt: null } : undefined,
      include: { company: true, owner: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      companyName: r.company.name,
      ownerEmail: r.owner.email,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
    }));
  }

  async resolveContactMessage(id: string): Promise<void> {
    const row = await this.prisma.ownerContactMessage.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Message not found");
    await this.prisma.ownerContactMessage.update({ where: { id }, data: { resolvedAt: new Date() } });
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

  private async getPendingClaimOrThrow(id: string) {
    const claim = await this.prisma.companyOwner.findUnique({ where: { id } });
    if (!claim) throw new NotFoundException("Claim not found");
    if (claim.claimStatus !== "PENDING") {
      throw new ConflictException("This claim has already been resolved");
    }
    return claim;
  }

  private toMyClaim(
    row: { id: string; companyId: string; tier: "FREE" | "PLUS"; claimStatus: OwnerClaimStatus; createdAt: Date; resolvedAt: Date | null },
    company: { name: string; slug: string },
  ): MyCompanyClaim {
    return {
      id: row.id,
      companyId: row.companyId,
      companyName: company.name,
      companySlug: company.slug,
      tier: row.tier,
      claimStatus: row.claimStatus,
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
    };
  }
}

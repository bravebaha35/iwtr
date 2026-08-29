import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { ConflictException, ForbiddenException, Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { imageSize } from "image-size";
import { validateLogoFile, type LogoUploadResult } from "@iwtr/shared-types";
import type {
  AdminOwnerClaim,
  ClaimCompanyInput,
  ContactAdminInput,
  MyCompanyClaim,
  OwnedCompany,
  OwnerClaimStatus,
  OwnerContactMessage,
  UpdateCompanyInput,
} from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { resolveLocation } from "../companies/resolve-location.util";

const UPLOADS_DIR = join(process.cwd(), "uploads", "company-logos");

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
      isVerifiedBadge: r.company.isVerifiedBadge,
    }));
  }

  async updateMyCompany(userId: string, companyId: string, input: UpdateCompanyInput): Promise<void> {
    const ownership = await this.requireApprovedOwnership(userId, companyId);

    // Server-enforced field allowlist: description/website are Plus-only.
    // The schema accepts them from anyone (so the same endpoint serves both
    // tiers), but a Free-tier (or lapsed Plus) owner gets a clear rejection
    // here rather than the fields silently being dropped.
    const wantsPlusOnlyFields = input.description !== undefined || input.website !== undefined;
    if (wantsPlusOnlyFields && !(ownership.tier === "PLUS" && ownership.planStatus === "ACTIVE")) {
      throw new ForbiddenException("Upgrade to the Plus tier to edit description and website.");
    }

    if (input.name) {
      const existingByName = await this.prisma.company.findFirst({
        where: { name: { equals: input.name, mode: "insensitive" }, id: { not: companyId } },
      });
      if (existingByName) {
        throw new ConflictException(`A company named "${existingByName.name}" already exists.`);
      }
    }

    // Same rule as admin creation: a district can't be set without a city,
    // and both are validated/canonicalized against the real province list.
    // Only runs when the client actually sent a city — leaves the existing
    // stored city/district untouched otherwise (undefined fields are a
    // Prisma no-op, same as every other field here).
    const location = input.city !== undefined ? resolveLocation(input.city, input.district) : undefined;

    // Slug intentionally stays stable across a rename — it's the durable
    // identifier used in bookmarked/shared URLs and in review lookups.
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        name: input.name,
        category: input.category,
        workplaceTypes: input.workplaceTypes,
        mainPhotoUrl: input.mainPhotoUrl,
        description: input.description,
        website: input.website,
        city: location?.city,
        district: location?.district,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        facebookUrl: input.facebookUrl,
        instagramUrl: input.instagramUrl,
        whatsappUrl: input.whatsappUrl,
        xUrl: input.xUrl,
        isHiring: input.isHiring,
      },
    });
  }

  // Local disk, dev-safe default — see main.ts's useStaticAssets comment.
  // Dimensions are read from the uploaded buffer (never trusted from the
  // client) via `image-size`, then checked against the exact same
  // validateLogoFile rule the client runs for instant feedback — this call
  // is the one that's actually authoritative.
  async uploadLogo(userId: string, companyId: string, file: Express.Multer.File | undefined): Promise<LogoUploadResult> {
    await this.requireApprovedOwnership(userId, companyId);
    if (!file) {
      throw new BadRequestException("No file uploaded.");
    }

    const { width, height } = imageSize(file.buffer);
    const check = validateLogoFile({
      mimeType: file.mimetype,
      sizeBytes: file.buffer.length,
      width: width ?? 0,
      height: height ?? 0,
    });
    if (!check.valid) {
      throw new BadRequestException(check.error);
    }

    await mkdir(UPLOADS_DIR, { recursive: true });
    const filename = `${randomUUID()}.png`;
    await writeFile(join(UPLOADS_DIR, filename), file.buffer);

    const origin = process.env.API_PUBLIC_ORIGIN ?? `http://localhost:${process.env.PORT ?? 3001}`;
    return { url: `${origin}/uploads/company-logos/${filename}` };
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
    row: {
      id: string;
      companyId: string;
      tier: "FREE" | "PLUS";
      planStatus: "NONE" | "ACTIVE" | "PAST_DUE" | "CANCELED";
      claimStatus: OwnerClaimStatus;
      createdAt: Date;
      resolvedAt: Date | null;
      rivalAnalyticsTier: "STARTER" | "PRO" | "ENTERPRISE" | null;
      rivalAnalyticsFreeRequestUsed: boolean;
    },
    company: { name: string; slug: string; isVerifiedBadge: boolean },
  ): MyCompanyClaim {
    return {
      id: row.id,
      companyId: row.companyId,
      companyName: company.name,
      companySlug: company.slug,
      tier: row.tier,
      planStatus: row.planStatus,
      isVerifiedBadge: company.isVerifiedBadge,
      claimStatus: row.claimStatus,
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      rivalAnalyticsTier: row.rivalAnalyticsTier,
      rivalAnalyticsFreeRequestUsed: row.rivalAnalyticsFreeRequestUsed,
    };
  }
}

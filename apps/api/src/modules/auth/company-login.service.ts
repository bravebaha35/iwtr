import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import type { CompanyLoginSetupInput, CompanyLoginView } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";

const PASSWORD_SALT_ROUNDS = 12;

/**
 * The owner's side of a company's shared login (CompanyLogin): see it, set
 * or replace its email and password, or remove it. Only the company's
 * approved owner, signed in with their own account, can do any of this -
 * the routes are not opened to company-login sessions, so staff can't
 * change the login they were given. Changing or removing it signs every
 * staff session out.
 */
@Injectable()
export class CompanyLoginService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireApprovedOwnership(userId: string, companyId: string) {
    const ownership = await this.prisma.companyOwner.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!ownership || ownership.claimStatus !== "APPROVED") {
      throw new ForbiddenException("You are not an approved owner of this company");
    }
  }

  async get(userId: string, companyId: string): Promise<CompanyLoginView> {
    await this.requireApprovedOwnership(userId, companyId);
    const login = await this.prisma.companyLogin.findUnique({ where: { companyId } });
    return { email: login?.email ?? null, updatedAt: login ? login.updatedAt.toISOString() : null };
  }

  async set(userId: string, companyId: string, input: CompanyLoginSetupInput): Promise<CompanyLoginView> {
    await this.requireApprovedOwnership(userId, companyId);
    const passwordHash = await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS);
    const now = new Date();
    try {
      const login = await this.prisma.$transaction(async (tx) => {
        const saved = await tx.companyLogin.upsert({
          where: { companyId },
          create: { companyId, ownerUserId: userId, email: input.email, passwordHash, passwordChangedAt: now },
          update: { ownerUserId: userId, email: input.email, passwordHash, passwordChangedAt: now },
        });
        // New password: every session opened with the old one ends now.
        await tx.refreshToken.updateMany({
          where: { companyLoginId: saved.id, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.auditLog.create({
          data: { actorUserId: userId, action: "COMPANY_LOGIN_SET", targetType: "Company", targetId: companyId },
        });
        return saved;
      });
      return { email: login.email, updatedAt: login.updatedAt.toISOString() };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("That email is already used by another company's login. Pick a different one.");
      }
      throw err;
    }
  }

  async remove(userId: string, companyId: string): Promise<CompanyLoginView> {
    await this.requireApprovedOwnership(userId, companyId);
    // Refresh tokens cascade with the row; access tokens die on their next
    // request (JwtAuthGuard re-checks the login exists).
    await this.prisma.$transaction([
      this.prisma.companyLogin.deleteMany({ where: { companyId } }),
      this.prisma.auditLog.create({
        data: { actorUserId: userId, action: "COMPANY_LOGIN_REMOVED", targetType: "Company", targetId: companyId },
      }),
    ]);
    return { email: null, updatedAt: null };
  }
}

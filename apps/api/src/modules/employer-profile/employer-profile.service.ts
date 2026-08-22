import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { AdminEmployerProfile, EmployerProfileInput, EmployerProfileView } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import {
  decryptField,
  encryptField,
  generateDek,
  hashTcKimlikNo,
  unwrapDek,
  wrapDek,
} from "./crypto.util";

// Fields that must all be present for EmployerProfileView.isComplete to be
// true — kept as one list so the self-view and admin-view compute it
// identically. profilePictureUrl is deliberately excluded: a logo/photo is
// a nice-to-have, not part of the legal-compliance record this gates.
const REQUIRED_FIELDS = ["firstName", "lastName", "phoneNumber", "address", "workAddress", "tcKimlikNo"] as const;

type DecryptedFields = {
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  address: string | null;
  workAddress: string | null;
  tcKimlikNo: string | null;
};

/**
 * The verified-employer legal-contact profile — a real, permanent, admin-
 * visible identity for a CompanyOwner whose claim has been APPROVED, entirely
 * separate from the anonymous review-facing avatarKey/reviewUsername on User
 * (see EmployerProfile's schema.prisma comment for why those are never
 * touched here). Only reachable once a claim is approved; nothing here ever
 * strips or overwrites a user's own anonymous reviewer identity.
 */
@Injectable()
export class EmployerProfileService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireVerifiedEmployer(userId: string): Promise<void> {
    const approvedClaim = await this.prisma.companyOwner.findFirst({
      where: { userId, claimStatus: "APPROVED" },
      select: { id: true },
    });
    if (!approvedClaim) {
      throw new ForbiddenException("Only verified (approved) company owners have an employer profile");
    }
  }

  private decryptRow(row: {
    encFirstName: Buffer | null;
    encLastName: Buffer | null;
    encPhoneNumber: Buffer | null;
    encAddress: Buffer | null;
    encWorkAddress: Buffer | null;
    encTcKimlikNo: Buffer | null;
    dekWrapped: Buffer;
  }): DecryptedFields {
    const dek = unwrapDek(row.dekWrapped);
    const dec = (v: Buffer | null) => (v ? decryptField(v, dek) : null);
    return {
      firstName: dec(row.encFirstName),
      lastName: dec(row.encLastName),
      phoneNumber: dec(row.encPhoneNumber),
      address: dec(row.encAddress),
      workAddress: dec(row.encWorkAddress),
      tcKimlikNo: dec(row.encTcKimlikNo),
    };
  }

  private isComplete(fields: DecryptedFields): boolean {
    return REQUIRED_FIELDS.every((key) => fields[key] !== null);
  }

  async getMyProfile(userId: string): Promise<EmployerProfileView> {
    await this.requireVerifiedEmployer(userId);

    const row = await this.prisma.employerProfile.findUnique({ where: { userId } });
    if (!row) {
      return {
        firstName: null,
        lastName: null,
        phoneNumber: null,
        address: null,
        workAddress: null,
        tcKimlikNo: null,
        profilePictureUrl: null,
        isComplete: false,
      };
    }

    const fields = this.decryptRow(row);
    return { ...fields, profilePictureUrl: row.profilePictureUrl, isComplete: this.isComplete(fields) };
  }

  async updateMyProfile(userId: string, input: EmployerProfileInput): Promise<EmployerProfileView> {
    await this.requireVerifiedEmployer(userId);

    const existing = await this.prisma.employerProfile.findUnique({ where: { userId } });

    // Re-use the existing DEK on an update (same pattern as
    // PiiVaultService.updateBirthDate) so fields not touched by this call
    // keep decrypting correctly; only a brand-new row gets a fresh DEK.
    const dek = existing ? unwrapDek(existing.dekWrapped) : generateDek();
    const dekWrapped = existing ? existing.dekWrapped : wrapDek(dek);

    if (input.tcKimlikNo !== undefined) {
      const tcKimlikNoHash = hashTcKimlikNo(input.tcKimlikNo);
      const collision = await this.prisma.employerProfile.findFirst({
        where: { tcKimlikNoHash, userId: { not: userId } },
        select: { userId: true },
      });
      if (collision) {
        throw new BadRequestException("That T.C. Kimlik No is already on file for a different account");
      }
    }

    const row = await this.prisma.employerProfile.upsert({
      where: { userId },
      create: {
        userId,
        dekWrapped,
        ...(input.firstName !== undefined ? { encFirstName: encryptField(input.firstName, dek) } : {}),
        ...(input.lastName !== undefined ? { encLastName: encryptField(input.lastName, dek) } : {}),
        ...(input.phoneNumber !== undefined ? { encPhoneNumber: encryptField(input.phoneNumber, dek) } : {}),
        ...(input.address !== undefined ? { encAddress: encryptField(input.address, dek) } : {}),
        ...(input.workAddress !== undefined ? { encWorkAddress: encryptField(input.workAddress, dek) } : {}),
        ...(input.tcKimlikNo !== undefined
          ? { encTcKimlikNo: encryptField(input.tcKimlikNo, dek), tcKimlikNoHash: hashTcKimlikNo(input.tcKimlikNo) }
          : {}),
        ...(input.profilePictureUrl !== undefined ? { profilePictureUrl: input.profilePictureUrl } : {}),
      },
      update: {
        ...(input.firstName !== undefined ? { encFirstName: encryptField(input.firstName, dek) } : {}),
        ...(input.lastName !== undefined ? { encLastName: encryptField(input.lastName, dek) } : {}),
        ...(input.phoneNumber !== undefined ? { encPhoneNumber: encryptField(input.phoneNumber, dek) } : {}),
        ...(input.address !== undefined ? { encAddress: encryptField(input.address, dek) } : {}),
        ...(input.workAddress !== undefined ? { encWorkAddress: encryptField(input.workAddress, dek) } : {}),
        ...(input.tcKimlikNo !== undefined
          ? { encTcKimlikNo: encryptField(input.tcKimlikNo, dek), tcKimlikNoHash: hashTcKimlikNo(input.tcKimlikNo) }
          : {}),
        ...(input.profilePictureUrl !== undefined ? { profilePictureUrl: input.profilePictureUrl } : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: { actorUserId: userId, action: "EMPLOYER_PROFILE_WRITE", targetType: "EmployerProfile", targetId: userId },
    });

    const fields = this.decryptRow(row);
    return { ...fields, profilePictureUrl: row.profilePictureUrl, isComplete: this.isComplete(fields) };
  }

  // Admin-only — "100% visible to admins for legal compliance" per the
  // product requirement. Every row, always decrypted; there is no partial-
  // redaction mode, since the entire point of this table (unlike PiiVault)
  // is that admins can see it in full.
  async adminListProfiles(): Promise<AdminEmployerProfile[]> {
    const rows = await this.prisma.employerProfile.findMany({
      include: { user: { select: { email: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((row) => {
      const fields = this.decryptRow(row);
      return {
        userId: row.userId,
        email: row.user.email,
        ...fields,
        profilePictureUrl: row.profilePictureUrl,
        isComplete: this.isComplete(fields),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }

  async adminGetProfile(userId: string): Promise<AdminEmployerProfile> {
    const row = await this.prisma.employerProfile.findUnique({
      where: { userId },
      include: { user: { select: { email: true } } },
    });
    if (!row) throw new NotFoundException("No employer profile on file for this user");

    const fields = this.decryptRow(row);
    return {
      userId: row.userId,
      email: row.user.email,
      ...fields,
      profilePictureUrl: row.profilePictureUrl,
      isComplete: this.isComplete(fields),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

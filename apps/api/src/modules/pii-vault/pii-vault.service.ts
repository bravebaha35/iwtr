import { ConflictException, Injectable } from "@nestjs/common";
import type { PiiOnboardingInput } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { encryptField, generateDek, hashTcKimlikNo, wrapDek } from "./crypto.util";

/**
 * The only module in this codebase allowed to touch the `PiiVault` Prisma
 * model. Every other module must go through this service. Nothing here ever
 * returns decrypted PII to a caller — there is currently no legitimate reason
 * to read it back, so no decrypt path exists (see purge policy below).
 */
@Injectable()
export class PiiVaultService {
  constructor(private readonly prisma: PrismaService) {}

  async submitPii(userId: string, input: PiiOnboardingInput): Promise<void> {
    const tcKimlikNoHash = hashTcKimlikNo(input.tcKimlikNo);

    const duplicate = await this.prisma.piiVault.findUnique({ where: { tcKimlikNoHash } });
    if (duplicate && duplicate.userId !== userId) {
      throw new ConflictException(
        "An account already exists for this T.C. Kimlik No",
      );
    }

    const dek = generateDek();
    const dekWrapped = wrapDek(dek);

    await this.prisma.piiVault.upsert({
      where: { userId },
      create: {
        userId,
        encFirstName: encryptField(input.firstName, dek),
        encLastName: encryptField(input.lastName, dek),
        encTcKimlikNo: encryptField(input.tcKimlikNo, dek),
        tcKimlikNoHash,
        encBirthDate: encryptField(input.birthDate, dek),
        encPhoneNumber: encryptField(input.phoneNumber, dek),
        dekWrapped,
      },
      update: {
        encFirstName: encryptField(input.firstName, dek),
        encLastName: encryptField(input.lastName, dek),
        encTcKimlikNo: encryptField(input.tcKimlikNo, dek),
        tcKimlikNoHash,
        encBirthDate: encryptField(input.birthDate, dek),
        encPhoneNumber: encryptField(input.phoneNumber, dek),
        dekWrapped,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: "PII_VAULT_WRITE",
        targetType: "PiiVault",
        targetId: userId,
      },
    });
  }

  async hasCompletedPii(userId: string): Promise<boolean> {
    const row = await this.prisma.piiVault.findUnique({ where: { userId } });
    return row !== null;
  }

  /**
   * Retention policy: once a user's identity is considered verified (their
   * first Review reaches PUBLISHED), the raw T.C. Kimlik No is no longer
   * needed and is purged. tcKimlikNoHash is kept forever (non-reversible) so
   * we can still block duplicate accounts on the same national ID.
   */
  async purgeTcKimlikNoIfPresent(userId: string): Promise<void> {
    const row = await this.prisma.piiVault.findUnique({ where: { userId } });
    if (!row || row.encTcKimlikNo === null) return;

    await this.prisma.piiVault.update({
      where: { userId },
      data: { encTcKimlikNo: null, tcknPurgedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: null,
        action: "PII_TCKN_PURGED",
        targetType: "PiiVault",
        targetId: userId,
        metadata: { reason: "first_review_published" },
      },
    });
  }
}

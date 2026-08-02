import { Injectable } from "@nestjs/common";
import type { PiiOnboardingInput } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { decryptField, encryptField, generateDek, unwrapDek, wrapDek } from "./crypto.util";

/**
 * The only module in this codebase allowed to touch the `PiiVault` Prisma
 * model. Every other module must go through this service. Nothing here ever
 * returns decrypted PII to a caller except the self-view method below — see
 * its own doc comment.
 */
@Injectable()
export class PiiVaultService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * T.C. Kimlik No is NOT collected here (2026-08-02 decision — deferred to a
   * dedicated verification flow on the account-settings page, once that's
   * built). tcKimlikNoHash/encTcKimlikNo are simply left null for now; the
   * dedup-collision logic that used to live here (see REVIEW.md for why a
   * live 409 on a hash collision would be a deanonymization oracle) comes
   * back with that future flow, not before.
   */
  async submitPii(userId: string, input: PiiOnboardingInput): Promise<void> {
    const dek = generateDek();
    const dekWrapped = wrapDek(dek);

    await this.prisma.piiVault.upsert({
      where: { userId },
      create: {
        userId,
        encFirstName: encryptField(input.firstName, dek),
        encLastName: encryptField(input.lastName, dek),
        encBirthDate: encryptField(input.birthDate, dek),
        encPhoneNumber: encryptField(input.phoneNumber, dek),
        dekWrapped,
      },
      update: {
        encFirstName: encryptField(input.firstName, dek),
        encLastName: encryptField(input.lastName, dek),
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
   * Self-view only — the account-settings page showing a user their own
   * previously-submitted name/birth date back to them. Never call this for
   * anyone other than the authenticated caller's own userId; there is no
   * "look up another user" variant of this method on purpose. T.C. Kimlik No
   * is deliberately excluded — it's either already purged, or on its way to
   * being purged, and is never surfaced here regardless.
   *
   * Decrypt failures are swallowed to null rather than thrown: a handful of
   * rows written before the PII_MASTER_KEY derivation was hardened to scrypt
   * (see AuditLog history) have DEKs that can never be unwrapped again under
   * the current derivation, since this method is the first thing that ever
   * attempted to read them back. That's a lost-data situation for those
   * specific rows, not a bug to crash the whole profile page over every time
   * it's viewed — the rest of "/me" should still load normally.
   */
  async getMyIdentity(userId: string): Promise<{ firstName: string; lastName: string; birthDate: string } | null> {
    const row = await this.prisma.piiVault.findUnique({ where: { userId } });
    if (!row) return null;
    try {
      const dek = unwrapDek(row.dekWrapped);
      return {
        firstName: decryptField(row.encFirstName, dek),
        lastName: decryptField(row.encLastName, dek),
        birthDate: decryptField(row.encBirthDate, dek),
      };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[pii-vault] Failed to decrypt identity for userId=${userId}:`, err);
      return null;
    }
  }

  /**
   * Retention policy: once a user's identity is considered verified (their
   * first Review reaches PUBLISHED), the raw T.C. Kimlik No is no longer
   * needed and is purged. tcKimlikNoHash is kept forever (non-reversible) so
   * we can still block duplicate accounts on the same national ID. No-op for
   * now since TCKN isn't collected at registration — becomes live again once
   * the account-settings verification flow exists.
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

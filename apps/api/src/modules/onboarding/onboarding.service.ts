import { BadRequestException, Injectable } from "@nestjs/common";
import type {
  AvatarSelection,
  HistorySubmission,
  OnboardingStatus,
  PiiOnboardingInput,
} from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { PiiVaultService } from "../pii-vault/pii-vault.service";

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly piiVault: PiiVaultService,
  ) {}

  async getStatus(userId: string): Promise<OnboardingStatus> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      status: user.status,
      city: user.city,
      district: user.district,
      avatarKey: user.avatarKey,
    };
  }

  async submitPii(userId: string, input: PiiOnboardingInput): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.status !== "PENDING_PII") {
      throw new BadRequestException("PII has already been submitted for this account");
    }

    // The vault write is an idempotent upsert, so it's safe to run before the
    // status transition even if two concurrent requests both reach here.
    await this.piiVault.submitPii(userId, input);

    // Conditional write (not a plain update) so that of two concurrent
    // requests, only one actually advances the status — the loser's write
    // matches zero rows and is a harmless no-op rather than a double-advance.
    await this.prisma.user.updateMany({
      where: { id: userId, status: "PENDING_PII" },
      data: { status: "PENDING_HISTORY", city: input.city, district: input.district },
    });
  }

  async submitHistory(userId: string, input: HistorySubmission): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Claim the transition first, inside the transaction: Postgres holds a
      // row lock on `userId` for the statement's duration, so a concurrent
      // duplicate submission blocks here and then sees status already moved
      // (matching zero rows) once this transaction commits — instead of both
      // requests racing past a separate read-then-check and each creating
      // their own copies of the education/employment rows below.
      const claimed = await tx.user.updateMany({
        where: { id: userId, status: "PENDING_HISTORY" },
        data: { status: "PENDING_AVATAR" },
      });
      if (claimed.count === 0) {
        throw new BadRequestException("History has already been submitted for this account");
      }

      for (const entry of input.education) {
        await tx.educationHistory.create({
          data: {
            userId,
            level: entry.level,
            institutionName: entry.institutionName,
            graduationYear: entry.graduationYear ?? null,
          },
        });
      }

      for (const entry of input.employment) {
        // First-pass matching: exact, case-insensitive name match against
        // admin-seeded companies. Fuzzy (pg_trgm) backfill matching for
        // near-miss spellings is a later hardening step, not needed to
        // unblock the core review-eligibility flow.
        const matchedCompany = await tx.company.findFirst({
          where: { name: { equals: entry.rawCompanyName, mode: "insensitive" } },
          orderBy: { createdAt: "asc" },
        });

        await tx.employmentHistory.create({
          data: {
            userId,
            rawCompanyName: entry.rawCompanyName,
            companyId: matchedCompany?.id ?? null,
            startDate: entry.startDate ? new Date(entry.startDate) : null,
            endDate: entry.endDate ? new Date(entry.endDate) : null,
          },
        });
      }
    });
  }

  async submitAvatar(userId: string, input: AvatarSelection): Promise<void> {
    const claimed = await this.prisma.user.updateMany({
      where: { id: userId, status: "PENDING_AVATAR" },
      data: { avatarKey: input.avatarKey, status: "ACTIVE" },
    });
    if (claimed.count === 0) {
      throw new BadRequestException("Avatar has already been set for this account");
    }
  }
}

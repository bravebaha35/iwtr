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

    await this.piiVault.submitPii(userId, input);

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: "PENDING_HISTORY", city: input.city, district: input.district },
    });
  }

  async submitHistory(userId: string, input: HistorySubmission): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.status !== "PENDING_HISTORY") {
      throw new BadRequestException("History has already been submitted for this account");
    }

    await this.prisma.$transaction(async (tx) => {
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

      await tx.user.update({ where: { id: userId }, data: { status: "PENDING_AVATAR" } });
    });
  }

  async submitAvatar(userId: string, input: AvatarSelection): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.status !== "PENDING_AVATAR") {
      throw new BadRequestException("Avatar has already been set for this account");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarKey: input.avatarKey, status: "ACTIVE" },
    });
  }
}

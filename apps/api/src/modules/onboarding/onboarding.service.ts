import { BadRequestException, Injectable } from "@nestjs/common";
import type {
  AvatarSelection,
  HistorySubmission,
  OnboardingStatus,
  PiiOnboardingInput,
  RequestPhoneOtpInput,
  VerifyPhoneOtpInput,
} from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { PiiVaultService } from "../pii-vault/pii-vault.service";
import { PhoneVerificationService } from "../phone-verification/phone-verification.service";
import { pickRandomDisplayUsername, workTypeFromAvatarKey } from "../reviews/randomized-identity.util";

@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly piiVault: PiiVaultService,
    private readonly phoneVerification: PhoneVerificationService,
  ) {}

  async getStatus(userId: string): Promise<OnboardingStatus> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      status: user.status,
      country: user.country,
      city: user.city,
      district: user.district,
      avatarKey: user.avatarKey,
      avatarGradient: user.avatarGradient,
      reviewUsername: user.reviewUsername,
    };
  }

  async requestPhoneOtp(userId: string, input: RequestPhoneOtpInput): Promise<{ devCode?: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.status !== "PENDING_PHONE") {
      throw new BadRequestException("Phone number has already been verified for this account");
    }
    return this.phoneVerification.requestOtp(userId, input.phoneNumber);
  }

  async verifyPhoneOtp(userId: string, input: VerifyPhoneOtpInput): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.status !== "PENDING_PHONE") {
      throw new BadRequestException("Phone number has already been verified for this account");
    }

    await this.phoneVerification.verifyOtp(userId, input.code);

    // Conditional write, same pattern as every other onboarding step: only one
    // of two concurrent requests actually advances the status.
    await this.prisma.user.updateMany({
      where: { id: userId, status: "PENDING_PHONE" },
      data: { status: "PENDING_PII" },
    });
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
      data: {
        status: "PENDING_HISTORY",
        country: input.country,
        city: input.city,
        district: input.district ?? null,
      },
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

      // Batched into one createMany instead of one create-per-entry — the
      // return values are never used, so there's no reason to pay for N
      // round trips instead of 1.
      if (input.education.length > 0) {
        await tx.educationHistory.createMany({
          data: input.education.map((entry) => ({
            userId,
            level: entry.level,
            institutionName: entry.institutionName,
            graduationYear: entry.graduationYear ?? null,
            faculty: entry.faculty ?? null,
            department: entry.department ?? null,
          })),
        });
      }

      // The per-entry company-name lookup can't be batched away (each entry
      // matches independently, and Prisma interactive-transaction queries
      // must run sequentially on the tx client, not via Promise.all) — but
      // the writes that follow can: collect every resolved row and insert
      // them in one createMany instead of one create per entry.
      const employmentRows: {
        userId: string;
        rawCompanyName: string;
        companyId: string | null;
        jobTitle: string | null;
        startDate: Date | null;
        endDate: Date | null;
      }[] = [];
      for (const entry of input.employment) {
        // First-pass matching: exact, case-insensitive name match against
        // admin-seeded companies. Fuzzy (pg_trgm) backfill matching for
        // near-miss spellings is a later hardening step, not needed to
        // unblock the core review-eligibility flow.
        const matchedCompany = await tx.company.findFirst({
          where: { name: { equals: entry.rawCompanyName, mode: "insensitive" } },
          orderBy: { createdAt: "asc" },
        });

        employmentRows.push({
          userId,
          rawCompanyName: entry.rawCompanyName,
          companyId: matchedCompany?.id ?? null,
          jobTitle: entry.jobTitle ?? null,
          startDate: entry.startDate ? new Date(entry.startDate) : null,
          endDate: entry.endDate ? new Date(entry.endDate) : null,
        });
      }
      if (employmentRows.length > 0) {
        await tx.employmentHistory.createMany({ data: employmentRows });
      }
    });
  }

  async submitAvatar(userId: string, input: AvatarSelection): Promise<void> {
    // Auto-assigns a starting reviewUsername from the same work-type
    // category as the avatar just picked — the user can change it later
    // from the account-settings "Customize" page, but shouldn't land on
    // ACTIVE with no name at all for their first review.
    const reviewUsername = pickRandomDisplayUsername(workTypeFromAvatarKey(input.avatarKey));
    const claimed = await this.prisma.user.updateMany({
      where: { id: userId, status: "PENDING_AVATAR" },
      data: { avatarKey: input.avatarKey, avatarGradient: input.avatarGradient, reviewUsername, status: "ACTIVE" },
    });
    if (claimed.count === 0) {
      throw new BadRequestException("Avatar has already been set for this account");
    }
  }
}

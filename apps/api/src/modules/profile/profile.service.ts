import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import bcrypt from "bcryptjs";
import {
  eduLevelSchema,
  type ChangePasswordInput,
  type EducationHistoryEntry,
  type EducationHistoryInput,
  type MyProfile,
  type UpdateEducationHistoryInput,
  type UpdateProfileInput,
} from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ModerationService } from "../moderation/moderation.service";
import { PiiVaultService } from "../pii-vault/pii-vault.service";
import { PhoneVerificationService } from "../phone-verification/phone-verification.service";
import { ReviewsService } from "../reviews/reviews.service";

const DISPLAY_NAME_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
const PASSWORD_SALT_ROUNDS = 12;

// Elementary -> High School -> College, always — regardless of the order
// entries were actually added in (someone might add College first, then go
// back and fill in Elementary School). eduLevelSchema.options is the single
// source of truth for that order (it's declared ELEMENTARY, HIGH_SCHOOL,
// COLLEGE), so this reads off it rather than hardcoding a second copy.
const EDU_LEVEL_RANK: Record<string, number> = Object.fromEntries(
  eduLevelSchema.options.map((level, i) => [level, i]),
);
function byEduLevel<T extends { level: string }>(a: T, b: T): number {
  return EDU_LEVEL_RANK[a.level] - EDU_LEVEL_RANK[b.level];
}

/**
 * Post-onboarding account settings ("/me" page): avatar, self-chosen display
 * name, city/district, education history, and a self-view of the
 * name/birth date/phone number submitted once during onboarding (decrypted
 * via PiiVaultService/PhoneVerificationService's self-view-only methods —
 * see their doc comments). T.C. Kimlik No is never included here at all.
 *
 * Of that identity data, only birthDate (typo-correctable via
 * updateBirthDate) and phone number (re-verifiable via
 * requestPhoneChangeOtp/verifyPhoneChangeOtp, going through the same OTP
 * challenge as onboarding) can ever change post-registration. firstName/
 * lastName have no update path anywhere in this service, deliberately — see
 * updateIdentityInputSchema's doc comment.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
    private readonly piiVault: PiiVaultService,
    private readonly phoneVerification: PhoneVerificationService,
    private readonly reviews: ReviewsService,
  ) {}

  private async requireActiveUser(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.status !== "ACTIVE") {
      throw new ForbiddenException("Complete onboarding before editing your profile");
    }
    return user;
  }

  async getMyProfile(userId: string): Promise<MyProfile> {
    const user = await this.requireActiveUser(userId);
    const [educationRaw, identity, phoneNumber] = await Promise.all([
      this.prisma.educationHistory.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      this.piiVault.getMyIdentity(userId),
      this.phoneVerification.getMyPhoneNumber(userId),
    ]);
    const education = [...educationRaw].sort(byEduLevel);

    return {
      displayName: user.displayName,
      displayNameChangedAt: user.displayNameChangedAt?.toISOString() ?? null,
      memberNumber: user.memberNumber,
      avatarKey: user.avatarKey,
      avatarGradient: user.avatarGradient,
      country: user.country,
      city: user.city,
      district: user.district,
      education: education.map((e) => ({
        id: e.id,
        level: e.level,
        institutionName: e.institutionName,
        graduationYear: e.graduationYear,
        faculty: e.faculty,
        department: e.department,
      })),
      firstName: identity?.firstName ?? null,
      lastName: identity?.lastName ?? null,
      birthDate: identity?.birthDate ?? null,
      phoneNumber,
      email: user.email,
    };
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<void> {
    const user = await this.requireActiveUser(userId);

    // Only an actual value change consumes the cooldown / needs re-checking
    // against the user's real name — a save that touches avatar/location but
    // leaves displayName as-is (the common case: the field just round-trips
    // through the form unchanged) must not trip either.
    const nextDisplayName = input.displayName !== undefined ? input.displayName || null : undefined;
    const displayNameChanged = nextDisplayName !== undefined && nextDisplayName !== user.displayName;

    if (displayNameChanged) {
      if (user.displayNameChangedAt) {
        const elapsedMs = Date.now() - user.displayNameChangedAt.getTime();
        if (elapsedMs < DISPLAY_NAME_COOLDOWN_MS) {
          const daysLeft = Math.ceil((DISPLAY_NAME_COOLDOWN_MS - elapsedMs) / (24 * 60 * 60 * 1000));
          throw new BadRequestException(
            `You can change your display name again in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
          );
        }
      }

      if (nextDisplayName) {
        const identity = await this.piiVault.getMyIdentity(userId);
        if (this.moderation.checkDisplayName(nextDisplayName, identity)) {
          throw new BadRequestException("That display name isn't allowed — try something else.");
        }
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        // Empty string means "clear it back to the default" for a field
        // that's allowed to be blank (displayName); the others are non-empty
        // per their zod min(1), so no such ambiguity there.
        ...(input.displayName !== undefined ? { displayName: input.displayName || null } : {}),
        ...(displayNameChanged ? { displayNameChangedAt: new Date() } : {}),
        ...(input.avatarKey !== undefined ? { avatarKey: input.avatarKey } : {}),
        ...(input.avatarGradient !== undefined ? { avatarGradient: input.avatarGradient } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.district !== undefined ? { district: input.district } : {}),
      },
    });
  }

  async addEducationHistory(userId: string, input: EducationHistoryInput): Promise<EducationHistoryEntry> {
    await this.requireActiveUser(userId);
    const created = await this.prisma.educationHistory.create({
      data: {
        userId,
        level: input.level,
        institutionName: input.institutionName,
        graduationYear: input.graduationYear ?? null,
        faculty: input.faculty ?? null,
        department: input.department ?? null,
      },
    });
    return {
      id: created.id,
      level: created.level,
      institutionName: created.institutionName,
      graduationYear: created.graduationYear,
      faculty: created.faculty,
      department: created.department,
    };
  }

  async updateEducationHistory(
    userId: string,
    entryId: string,
    input: UpdateEducationHistoryInput,
  ): Promise<EducationHistoryEntry> {
    await this.requireActiveUser(userId);
    const existing = await this.prisma.educationHistory.findUnique({ where: { id: entryId } });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException("Education history entry not found");
    }

    const updated = await this.prisma.educationHistory.update({
      where: { id: entryId },
      data: {
        ...(input.level !== undefined ? { level: input.level } : {}),
        ...(input.institutionName !== undefined ? { institutionName: input.institutionName } : {}),
        ...(input.graduationYear !== undefined ? { graduationYear: input.graduationYear } : {}),
        ...(input.faculty !== undefined ? { faculty: input.faculty } : {}),
        ...(input.department !== undefined ? { department: input.department } : {}),
      },
    });

    return {
      id: updated.id,
      level: updated.level,
      institutionName: updated.institutionName,
      graduationYear: updated.graduationYear,
      faculty: updated.faculty,
      department: updated.department,
    };
  }

  async deleteEducationHistory(userId: string, entryId: string): Promise<void> {
    await this.requireActiveUser(userId);
    const existing = await this.prisma.educationHistory.findUnique({ where: { id: entryId } });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException("Education history entry not found");
    }
    await this.prisma.educationHistory.delete({ where: { id: entryId } });
  }

  async updateBirthDate(userId: string, birthDate: string): Promise<void> {
    await this.requireActiveUser(userId);
    await this.piiVault.updateBirthDate(userId, birthDate);
  }

  // Reuses the exact same OTP challenge/response as onboarding
  // (PhoneVerificationService doesn't know or care about User.status — see
  // its own doc comment) — a successful verify overwrites the previously
  // verified number the same way onboarding's first verification set it.
  async requestPhoneChangeOtp(userId: string, phoneNumber: string): Promise<{ devCode?: string }> {
    await this.requireActiveUser(userId);
    return this.phoneVerification.requestOtp(userId, phoneNumber);
  }

  async verifyPhoneChangeOtp(userId: string, code: string): Promise<void> {
    await this.requireActiveUser(userId);
    await this.phoneVerification.verifyOtp(userId, code);
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.requireActiveUser(userId);
    if (!user.passwordHash) {
      throw new BadRequestException("This account doesn't sign in with a password");
    }
    const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!valid) {
      throw new BadRequestException("Current password is incorrect");
    }
    const passwordHash = await bcrypt.hash(input.newPassword, PASSWORD_SALT_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  // Self-service freeze — logging back in (AuthService.loginWithEmail) is
  // the only reactivation path, deliberately, rather than a separate
  // unfreeze endpoint. Revokes every live refresh token so the silent-
  // refresh cycle (apps/web/src/lib/server-auth.ts) can't keep a frozen
  // session alive — without this, the freeze would only take effect once
  // the current 15-minute access token happened to expire.
  async freezeAccount(userId: string): Promise<void> {
    await this.requireActiveUser(userId);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } }),
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.auditLog.create({
        data: { actorUserId: userId, action: "ACCOUNT_FROZEN", targetType: "User", targetId: userId },
      }),
    ]);
  }

  // Hard deletes the account and everything that would otherwise block the
  // FK constraints on User (none of those relations declare onDelete —
  // see schema.prisma) — reviews included, per the account-options copy
  // promising reviews are lost. AuditLog rows are nullified rather than
  // deleted (an audit trail should outlive the account it's about), and
  // PiiVault (separate schema, no FK to User by design) is cleaned up
  // explicitly in the same transaction since nothing would cascade into it.
  async deleteAccount(userId: string): Promise<void> {
    await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const publishedCompanyIds = await this.prisma.$transaction(async (tx) => {
      const reviews = await tx.review.findMany({
        where: { userId },
        select: { id: true, companyId: true, status: true },
      });
      const reviewIds = reviews.map((r) => r.id);

      await tx.reviewVote.deleteMany({ where: { OR: [{ userId }, { reviewId: { in: reviewIds } }] } });
      await tx.moderationQueueItem.deleteMany({ where: { reviewId: { in: reviewIds } } });
      await tx.review.deleteMany({ where: { userId } });
      await tx.employmentHistory.deleteMany({ where: { userId } });
      await tx.educationHistory.deleteMany({ where: { userId } });
      await tx.phoneOtpChallenge.deleteMany({ where: { userId } });
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.ownerContactMessage.deleteMany({ where: { ownerId: userId } });
      await tx.companyOwner.deleteMany({ where: { userId } });
      await tx.auditLog.updateMany({ where: { actorUserId: userId }, data: { actorUserId: null } });
      await tx.auditLog.create({
        data: { actorUserId: null, action: "ACCOUNT_DELETED", targetType: "User", targetId: userId },
      });
      await tx.piiVault.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });

      return [...new Set(reviews.filter((r) => r.status === "PUBLISHED").map((r) => r.companyId))];
    });

    // Outside the transaction — recomputeAggregate does its own read+write
    // per company and doesn't need to be atomic with the deletion above; a
    // company's score being briefly stale for a moment after this commits
    // is harmless, and this can't run inside the transaction anyway since
    // it needs a Review row that's already gone.
    for (const companyId of publishedCompanyIds) {
      await this.reviews.recomputeAggregate(companyId);
    }
  }
}

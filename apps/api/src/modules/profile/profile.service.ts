import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  EducationHistoryEntry,
  EducationHistoryInput,
  MyProfile,
  UpdateEducationHistoryInput,
  UpdateProfileInput,
} from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ModerationService } from "../moderation/moderation.service";
import { PiiVaultService } from "../pii-vault/pii-vault.service";
import { PhoneVerificationService } from "../phone-verification/phone-verification.service";

/**
 * Post-onboarding account settings ("/me" page): avatar, self-chosen display
 * name, city/district, education history, and a read-only self-view of the
 * name/birth date/phone number submitted once during onboarding (decrypted
 * via PiiVaultService/PhoneVerificationService's self-view-only methods —
 * see their doc comments). T.C. Kimlik No is never included here at all.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
    private readonly piiVault: PiiVaultService,
    private readonly phoneVerification: PhoneVerificationService,
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
    const [education, identity, phoneNumber] = await Promise.all([
      this.prisma.educationHistory.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
      this.piiVault.getMyIdentity(userId),
      this.phoneVerification.getMyPhoneNumber(userId),
    ]);

    return {
      displayName: user.displayName,
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
      })),
      firstName: identity?.firstName ?? null,
      lastName: identity?.lastName ?? null,
      birthDate: identity?.birthDate ?? null,
      phoneNumber,
    };
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<void> {
    await this.requireActiveUser(userId);

    if (input.displayName && this.moderation.checkDisplayName(input.displayName)) {
      throw new BadRequestException("That display name isn't allowed — try something else.");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        // Empty string means "clear it back to the default" for a field
        // that's allowed to be blank (displayName); the others are non-empty
        // per their zod min(1), so no such ambiguity there.
        ...(input.displayName !== undefined ? { displayName: input.displayName || null } : {}),
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
      },
    });
    return {
      id: created.id,
      level: created.level,
      institutionName: created.institutionName,
      graduationYear: created.graduationYear,
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
      },
    });

    return {
      id: updated.id,
      level: updated.level,
      institutionName: updated.institutionName,
      graduationYear: updated.graduationYear,
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
}

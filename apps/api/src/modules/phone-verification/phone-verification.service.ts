import { BadRequestException, HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SMS_PROVIDER, type ISmsProvider } from "./sms-provider.interface";
import {
  collisionPhoneHash,
  decryptPhoneNumber,
  encryptPhoneNumber,
  generateOtpCode,
  hashOtpCode,
  hashPhoneNumber,
  hashesMatch,
} from "./crypto.util";

const RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/**
 * OTP challenge/response for the phone-verification onboarding step. Deliberately
 * doesn't know about User.status — same boundary as PiiVaultService: the
 * onboarding module owns the state-machine transition, this module only owns
 * "does this user control this phone number."
 */
@Injectable()
export class PhoneVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: ISmsProvider,
  ) {}

  async requestOtp(userId: string, phoneE164: string): Promise<{ devCode?: string }> {
    const existingChallenge = await this.prisma.phoneOtpChallenge.findUnique({ where: { userId } });
    if (existingChallenge && Date.now() - existingChallenge.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
      throw new HttpException("Please wait before requesting another code", HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = generateOtpCode();
    // Send first — only persist a challenge (and start the resend cooldown)
    // once we know delivery didn't immediately fail, so a bad number doesn't
    // lock the user out of retrying right away.
    await this.smsProvider.sendOtp(phoneE164, code);

    const phoneNumberHash = hashPhoneNumber(phoneE164);
    const encPhoneNumber = encryptPhoneNumber(phoneE164);
    const codeHash = hashOtpCode(code, userId);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.prisma.phoneOtpChallenge.upsert({
      where: { userId },
      create: { userId, phoneNumberHash, encPhoneNumber, codeHash, expiresAt, attempts: 0, lastSentAt: new Date() },
      update: { phoneNumberHash, encPhoneNumber, codeHash, expiresAt, attempts: 0, lastSentAt: new Date() },
    });

    // Outside production, also hand the code back in the response — without
    // this, anyone testing through just the browser (no server console
    // access) is stuck the moment no real SMS provider is configured, since
    // ConsoleSmsProvider only logs it server-side. Never happens once
    // NODE_ENV=production (matches ConsoleSmsProvider's own refusal to run there).
    return process.env.NODE_ENV === "production" ? {} : { devCode: code };
  }

  /**
   * A phone-hash collision with a different account must never be observable
   * to the submitter — same reasoning as the T.C. Kimlik No fix in
   * PiiVaultService (REVIEW.md): this always completes identically whether or
   * not the number is already claimed. A suspected duplicate is only ever
   * flagged via AuditLog for manual admin review.
   */
  async verifyOtp(userId: string, code: string): Promise<void> {
    const challenge = await this.prisma.phoneOtpChallenge.findUnique({ where: { userId } });
    if (!challenge) {
      throw new BadRequestException("Request a verification code first");
    }
    if (challenge.expiresAt < new Date()) {
      await this.prisma.phoneOtpChallenge.delete({ where: { userId } });
      throw new BadRequestException("Code expired — request a new one");
    }
    if (challenge.attempts >= MAX_ATTEMPTS) {
      await this.prisma.phoneOtpChallenge.delete({ where: { userId } });
      throw new BadRequestException("Too many incorrect attempts — request a new code");
    }

    if (!hashesMatch(hashOtpCode(code, userId), challenge.codeHash)) {
      await this.prisma.phoneOtpChallenge.update({ where: { userId }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException("Incorrect code");
    }

    const canonicalHash = challenge.phoneNumberHash;
    const existingOwner = await this.prisma.user.findUnique({ where: { phoneNumberHash: canonicalHash } });
    let collision = existingOwner !== null && existingOwner.id !== userId;

    try {
      await this.markVerified(userId, collision ? collisionPhoneHash(canonicalHash, userId) : canonicalHash, challenge.encPhoneNumber);
    } catch (err) {
      // Narrow race: another request can claim the canonical hash between the
      // read above and this write. Retry once under the collision-safe hash
      // rather than letting the P2002 surface as a distinguishable conflict.
      if (!collision && err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        collision = true;
        await this.markVerified(userId, collisionPhoneHash(canonicalHash, userId), challenge.encPhoneNumber);
      } else {
        throw err;
      }
    }

    await this.prisma.phoneOtpChallenge.delete({ where: { userId } });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: collision ? "PHONE_COLLISION_SUSPECTED" : "PHONE_VERIFIED",
        targetType: "User",
        targetId: userId,
      },
    });
  }

  private async markVerified(userId: string, phoneNumberHash: string, encPhoneNumber: Buffer): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { phoneNumberHash, encPhoneNumber, phoneVerifiedAt: new Date() },
    });
  }

  /**
   * Self-view only, same rule as PiiVaultService.getMyIdentity — never call
   * this for anyone but the authenticated caller's own userId. Same
   * decrypt-failure-to-null handling as that method too, for the same reason:
   * this should never be able to crash the profile page it's shown on.
   */
  async getMyPhoneNumber(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.encPhoneNumber) return null;
    try {
      return decryptPhoneNumber(user.encPhoneNumber);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[phone-verification] Failed to decrypt phone number for userId=${userId}:`, err);
      return null;
    }
  }
}

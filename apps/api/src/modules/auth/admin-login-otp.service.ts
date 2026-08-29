import { HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ADMIN_OTP_NOTIFIER, type IAdminOtpNotifier } from "./admin-otp-notifier.interface";
import { adminOtpHashesMatch, generateAdminOtpCode, hashAdminOtpCode } from "./admin-otp.util";

const RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/**
 * Second-factor challenge/response for logging in as the ADMIN role —
 * structurally the same as PhoneVerificationService (cooldown/TTL/max
 * attempts, hash-only storage) but for AdminLoginOtpChallenge instead of
 * PhoneOtpChallenge: a fresh row per login attempt rather than one upserted
 * row per user, since there's no "resend to the same number" concept here.
 */
@Injectable()
export class AdminLoginOtpService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ADMIN_OTP_NOTIFIER) private readonly notifier: IAdminOtpNotifier,
  ) {}

  async issueChallenge(userId: string, email: string): Promise<void> {
    const recent = await this.prisma.adminLoginOtpChallenge.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      throw new HttpException("Please wait before requesting another code", HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = generateAdminOtpCode();
    // Send first, same reasoning as PhoneVerificationService.requestOtp: a
    // delivery failure shouldn't leave a challenge row an attacker could
    // still try to brute-force with no code having ever gone out.
    await this.notifier.sendOtp(email, code);

    const codeHash = hashAdminOtpCode(code, userId);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    // Any earlier challenge for this user is superseded — otherwise an
    // abandoned first attempt's row (and its separate attempt counter)
    // would linger alongside the new one.
    await this.prisma.$transaction([
      this.prisma.adminLoginOtpChallenge.deleteMany({ where: { userId } }),
      this.prisma.adminLoginOtpChallenge.create({ data: { userId, codeHash, expiresAt } }),
    ]);
  }

  async verifyChallenge(userId: string, code: string): Promise<void> {
    const challenge = await this.prisma.adminLoginOtpChallenge.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    if (!challenge) {
      throw new UnauthorizedException("Request a login code first");
    }
    if (challenge.expiresAt < new Date()) {
      await this.prisma.adminLoginOtpChallenge.delete({ where: { id: challenge.id } });
      throw new UnauthorizedException("Code expired — log in again to request a new one");
    }
    if (challenge.attempts >= MAX_ATTEMPTS) {
      await this.prisma.adminLoginOtpChallenge.delete({ where: { id: challenge.id } });
      throw new UnauthorizedException("Too many incorrect attempts — log in again to request a new code");
    }

    if (!adminOtpHashesMatch(hashAdminOtpCode(code, userId), challenge.codeHash)) {
      await this.prisma.adminLoginOtpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException("Incorrect code");
    }

    await this.prisma.adminLoginOtpChallenge.delete({ where: { id: challenge.id } });
    // Every completed admin login is worth a durable trail, independent of
    // whatever the admin goes on to do — this is the platform's single
    // most sensitive account.
    await this.prisma.auditLog.create({
      data: { actorUserId: userId, action: "ADMIN_LOGIN", targetType: "User", targetId: userId },
    });
  }
}

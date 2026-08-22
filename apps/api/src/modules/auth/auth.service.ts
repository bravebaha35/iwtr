import {
  ConflictException,
  Injectable,
  NotImplementedException,
  UnauthorizedException,
} from "@nestjs/common";
import bcrypt from "bcryptjs";
import type { AuthTokensResponse, LoginEmailInput, RegisterEmailInput } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { TokenService } from "./token.service";

const PASSWORD_SALT_ROUNDS = 12;

// A precomputed bcrypt hash of a value nobody will ever type, compared
// against on the "no such account" path purely to burn the same ~bcrypt-12
// wall-clock time a real password compare would take — see loginWithEmail.
// The hash itself is never meant to match anything; only its cost matters.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("iwtr-dummy-hash-never-matches-anything", PASSWORD_SALT_ROUNDS);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async registerWithEmail(input: RegisterEmailInput, deviceLabel?: string): Promise<AuthTokensResponse> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS);
    // reviewUsername isn't assigned here — it needs a work-type category,
    // which isn't known until the avatar-selection onboarding step (see
    // OnboardingService.submitAvatar, which auto-assigns one then).
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        authProvider: "EMAIL",
        passwordHash,
      },
    });

    return this.issueTokenPair(user.id, user.role, user.status, deviceLabel);
  }

  async loginWithEmail(input: LoginEmailInput, deviceLabel?: string): Promise<AuthTokensResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });

    // Always run a bcrypt compare, even when there's no account (or no
    // password hash — an OAuth-only account) to compare against — comparing
    // input.password against a fixed dummy hash instead of short-circuiting
    // keeps this path's timing indistinguishable from a real wrong-password
    // attempt, so response time can't be used to enumerate registered emails.
    const valid = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !user.passwordHash || !valid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    // Logging back in is the reactivation path for a self-frozen account
    // (ProfileService.freezeAccount) — "you can reactivate any time" just
    // means "log in again", not a separate unfreeze flow.
    let status = user.status;
    if (status === "SUSPENDED") {
      const reactivated = await this.prisma.user.update({ where: { id: user.id }, data: { status: "ACTIVE" } });
      status = reactivated.status;
    }

    return this.issueTokenPair(user.id, user.role, status, deviceLabel);
  }

  async refresh(refreshToken: string): Promise<AuthTokensResponse> {
    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    // Look up by hash alone (not scoped to revokedAt: null) so a replay of an
    // already-rotated token is distinguishable from a token that never existed.
    const stored = await this.prisma.refreshToken.findFirst({ where: { tokenHash } });

    if (!stored) {
      throw new UnauthorizedException("Refresh token is invalid or expired");
    }

    if (stored.revokedAt) {
      // Reuse of a token that was already rotated out means either a stolen
      // token is being replayed, or a client bug double-fired a refresh.
      // Either way, the whole rotation chain is no longer trustworthy — kill
      // every live session for this user rather than silently continuing.
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("Refresh token is invalid or expired");
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token is invalid or expired");
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) {
      throw new UnauthorizedException("Refresh token is invalid or expired");
    }

    // Rotate: revoke the used token, issue a new pair.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(user.id, user.role, user.status, stored.deviceLabel ?? undefined);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // Wired up once GOOGLE_CLIENT_ID is provided (see apps/api/.env.example).
  async loginWithGoogle(_idToken: string): Promise<AuthTokensResponse> {
    throw new NotImplementedException(
      "Google sign-in is not configured yet. Set GOOGLE_CLIENT_ID once you have it.",
    );
  }

  // Wired up once Apple Services ID / Team ID / Key ID / private key are provided.
  async loginWithApple(_identityToken: string): Promise<AuthTokensResponse> {
    throw new NotImplementedException(
      "Apple sign-in is not configured yet. Set APPLE_* env vars once you have them.",
    );
  }

  private async issueTokenPair(
    userId: string,
    role: "MEMBER" | "ADMIN" | "COMPANY_OWNER",
    status: "PENDING_PHONE" | "PENDING_PII" | "PENDING_HISTORY" | "PENDING_AVATAR" | "ACTIVE" | "SUSPENDED",
    deviceLabel?: string,
  ): Promise<AuthTokensResponse> {
    const access = this.tokens.signAccessToken({ sub: userId, role, status });
    const refresh = this.tokens.generateRefreshToken();

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: refresh.hash,
        deviceLabel,
        expiresAt: refresh.expiresAt,
      },
    });

    return {
      accessToken: access.token,
      refreshToken: refresh.raw,
      expiresInSeconds: access.expiresInSeconds,
    };
  }
}

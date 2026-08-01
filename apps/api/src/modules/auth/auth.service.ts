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
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    return this.issueTokenPair(user.id, user.role, user.status, deviceLabel);
  }

  async refresh(refreshToken: string): Promise<AuthTokensResponse> {
    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null },
    });

    if (!stored || stored.expiresAt < new Date()) {
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
    status: "PENDING_PII" | "PENDING_HISTORY" | "PENDING_AVATAR" | "ACTIVE" | "SUSPENDED",
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

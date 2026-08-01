import { randomBytes, createHash } from "crypto";
import { Injectable } from "@nestjs/common";
import jwt from "jsonwebtoken";
import type { AccessTokenClaims } from "./auth.types";
import { requireSecret } from "../../config/env";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class TokenService {
  private readonly accessSecret = requireSecret("JWT_ACCESS_SECRET", "dev-only-change-me");

  signAccessToken(claims: AccessTokenClaims): { token: string; expiresInSeconds: number } {
    const token = jwt.sign(claims, this.accessSecret, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
    return { token, expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS };
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    return jwt.verify(token, this.accessSecret) as AccessTokenClaims;
  }

  generateRefreshToken(): { raw: string; hash: string; expiresAt: Date } {
    const raw = randomBytes(48).toString("hex");
    const hash = this.hashRefreshToken(raw);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    return { raw, hash, expiresAt };
  }

  hashRefreshToken(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }
}

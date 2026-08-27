import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { hashApiKey } from "./api-key.util";

// Same swappable-boundary shape as JwtAuthGuard, but keyed by a static
// X-API-Key header (no user session — an investor subscriber is not a
// User/MEMBER at all) against InvestorApiKey.keyHash. Never compares the
// raw key to anything stored — only its hash is ever looked up.
@Injectable()
export class InvestorApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const rawKey = request.headers["x-api-key"];
    if (!rawKey || Array.isArray(rawKey)) {
      throw new UnauthorizedException("Missing X-API-Key header");
    }

    const record = await this.prisma.investorApiKey.findUnique({ where: { keyHash: hashApiKey(rawKey) } });
    if (!record || !record.active || record.revokedAt) {
      throw new UnauthorizedException("Invalid or revoked API key");
    }

    return true;
  }
}

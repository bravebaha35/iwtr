import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { TokenService } from "../../modules/auth/token.service";
import type { AuthenticatedUser } from "../../modules/auth/auth.types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    try {
      const claims = this.tokens.verifyAccessToken(header.slice("Bearer ".length));
      request.user = { id: claims.sub, role: claims.role, status: claims.status };
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }
  }
}

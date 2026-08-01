import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { TokenService } from "../../modules/auth/token.service";
import type { AuthenticatedUser } from "../../modules/auth/auth.types";

// Like JwtAuthGuard, but for endpoints that are public and only need to know
// *who* the caller is when a valid token happens to be present (e.g. to
// decorate a public list with the caller's own vote). Never rejects the
// request for a missing or invalid token.
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = request.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      try {
        const claims = this.tokens.verifyAccessToken(header.slice("Bearer ".length));
        request.user = { id: claims.sub, role: claims.role, status: claims.status };
      } catch {
        // Ignore invalid/expired tokens on this optional-auth path.
      }
    }
    return true;
  }
}

import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { TokenService } from "../../modules/auth/token.service";
import type { AccessTokenClaims, AuthenticatedUser } from "../../modules/auth/auth.types";
import { PrismaService } from "../../prisma/prisma.service";
import { assertCompanyLoginStillValid, assertSameCompany, isCompanyAccountAllowed } from "./company-scope";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    let claims: AccessTokenClaims;
    try {
      claims = this.tokens.verifyAccessToken(header.slice("Bearer ".length));
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }

    if (claims.cl && claims.cid) {
      // A company's shared login: default-deny. Only routes opened with
      // @CompanyAccountAllowed() are reachable, only for its own company.
      if (!isCompanyAccountAllowed(this.reflector, context)) {
        throw new ForbiddenException("This isn't available when signed in with a company login");
      }
      assertSameCompany(request, claims.cid);
      await assertCompanyLoginStillValid(this.prisma, claims);
      request.user = {
        id: claims.sub,
        role: claims.role,
        status: claims.status,
        companyScope: { companyId: claims.cid, loginId: claims.cl },
      };
      return true;
    }

    request.user = { id: claims.sub, role: claims.role, status: claims.status };
    return true;
  }
}

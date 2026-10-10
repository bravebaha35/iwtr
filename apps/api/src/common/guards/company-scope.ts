import { ForbiddenException, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { PrismaService } from "../../prisma/prisma.service";
import type { AccessTokenClaims } from "../../modules/auth/auth.types";
import { COMPANY_ACCOUNT_ALLOWED } from "../decorators/company-account-allowed.decorator";

/** Whether this route has been opened to company-login sessions. */
export function isCompanyAccountAllowed(reflector: Reflector, context: ExecutionContext): boolean {
  return !!reflector.getAllAndOverride<boolean>(COMPANY_ACCOUNT_ALLOWED, [context.getHandler(), context.getClass()]);
}

/**
 * Re-checks a company-login token against the database on every request:
 * the login must still exist for that company, belong to the same owner,
 * not have had its password changed since the token was issued, and that
 * owner must still be the company's approved owner. Any change ends the
 * session at once rather than when the 15-minute token runs out.
 */
export async function assertCompanyLoginStillValid(prisma: PrismaService, claims: AccessTokenClaims): Promise<void> {
  const login = await prisma.companyLogin.findUnique({
    where: { id: claims.cl! },
    select: { companyId: true, ownerUserId: true, passwordChangedAt: true },
  });
  const issuedAtMs = (claims.iat ?? 0) * 1000;
  // jwt iat is whole seconds; allow the same second the password was set.
  if (
    !login ||
    login.companyId !== claims.cid ||
    login.ownerUserId !== claims.sub ||
    issuedAtMs < Math.floor(login.passwordChangedAt.getTime() / 1000) * 1000
  ) {
    throw new UnauthorizedException("This company login is no longer valid");
  }
  const owner = await prisma.companyOwner.findFirst({
    where: { userId: claims.sub, companyId: login.companyId, claimStatus: "APPROVED" },
    select: { id: true },
  });
  if (!owner) throw new UnauthorizedException("This company login is no longer valid");
}

/** A :companyId in the URL must be the session's own company. */
export function assertSameCompany(request: Request, companyId: string): void {
  const param = request.params?.companyId;
  if (param !== undefined && param !== companyId) {
    throw new ForbiddenException("This company login only works for its own company");
  }
}

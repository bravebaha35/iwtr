import type { UserRole, UserStatus } from "@iwtr/shared-types";

export interface AccessTokenClaims {
  sub: string;
  role: UserRole;
  status: UserStatus;
  // Only on a token from a company's shared login (CompanyLogin): its id and
  // the one company the session is limited to. sub is then the owner who set
  // the login up. See JwtAuthGuard.
  cl?: string;
  cid?: string;
  iat?: number;
}

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  status: UserStatus;
  // Present only for a company-login session: the company it may act for.
  // Such a request only ever reaches routes marked @CompanyAccountAllowed().
  companyScope?: { companyId: string; loginId: string };
}

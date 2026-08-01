import type { UserRole, UserStatus } from "@iwtr/shared-types";

export interface AccessTokenClaims {
  sub: string;
  role: UserRole;
  status: UserStatus;
}

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  status: UserStatus;
}

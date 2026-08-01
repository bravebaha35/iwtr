import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { UserRole } from "@iwtr/shared-types";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { AuthenticatedUser } from "../../modules/auth/auth.types";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    if (!request.user || !required.includes(request.user.role)) {
      throw new ForbiddenException("You do not have permission to perform this action");
    }
    return true;
  }
}

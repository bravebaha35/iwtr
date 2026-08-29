import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "../roles.guard";

function contextWithUser(user?: { role: string }): ExecutionContext {
  return {
    getHandler: () => ({}) as any,
    getClass: () => ({}) as any,
    switchToHttp: () => ({ getRequest: () => ({ user }) }) as any,
  } as unknown as ExecutionContext;
}

// This guard is the actual enforcement mechanism behind every `@Roles("ADMIN")`
// route — including every route on AdminCompaniesController, the whole
// "Anonymity Vault Isolation"/RBAC shield for the admin company-management
// endpoints. A frontend redirect is a UX nicety on top of this; this test is
// what actually proves a non-admin can't reach an admin-only route's handler.
describe("RolesGuard", () => {
  it("blocks a MEMBER (non-admin) from a route decorated with @Roles(\"ADMIN\")", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["ADMIN"]) };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(() => guard.canActivate(contextWithUser({ role: "MEMBER" }))).toThrow(ForbiddenException);
  });

  it("blocks an unauthenticated request (no user on the request at all)", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["ADMIN"]) };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(ForbiddenException);
  });

  it("allows an ADMIN through a route decorated with @Roles(\"ADMIN\")", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["ADMIN"]) };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(contextWithUser({ role: "ADMIN" }))).toBe(true);
  });

  it("lets any authenticated role through a route with no @Roles() at all", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(contextWithUser({ role: "MEMBER" }))).toBe(true);
  });
});

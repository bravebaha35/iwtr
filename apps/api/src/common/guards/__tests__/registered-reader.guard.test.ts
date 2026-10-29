import { UnauthorizedException } from "@nestjs/common";
import { RegisteredReaderGuard } from "../registered-reader.guard";

function contextFor(authorization?: string) {
  const request: { headers: Record<string, string | undefined>; user?: unknown } = { headers: { authorization } };
  return {
    request,
    context: { switchToHttp: () => ({ getRequest: () => request }) } as never,
  };
}

describe("RegisteredReaderGuard", () => {
  const verifyAccessToken = jest.fn();
  const guard = new RegisteredReaderGuard({ verifyAccessToken } as never);

  beforeEach(() => verifyAccessToken.mockReset());

  it("refuses a logged-out request", () => {
    const { context } = contextFor(undefined);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("refuses an invalid or expired token (so the web proxy refreshes and retries)", () => {
    verifyAccessToken.mockImplementation(() => {
      throw new Error("jwt expired");
    });
    const { context } = contextFor("Bearer old");
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("lets a member read and knows who they are", () => {
    verifyAccessToken.mockReturnValue({ sub: "u1", role: "MEMBER", status: "ACTIVE" });
    const { context, request } = contextFor("Bearer ok");
    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toEqual({ id: "u1", role: "MEMBER", status: "ACTIVE" });
  });

  it("lets a company login read, but never as the owner", () => {
    verifyAccessToken.mockReturnValue({ sub: "owner1", role: "MEMBER", status: "ACTIVE", cl: "login1", cid: "c1" });
    const { context, request } = contextFor("Bearer company");
    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toBeUndefined();
  });
});

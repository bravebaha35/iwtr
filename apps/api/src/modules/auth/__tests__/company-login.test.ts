import "reflect-metadata";
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import bcrypt from "bcryptjs";
import { AuthService } from "../auth.service";
import { TokenService } from "../token.service";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../../common/guards/optional-jwt-auth.guard";
import { COMPANY_ACCOUNT_ALLOWED } from "../../../common/decorators/company-account-allowed.decorator";

const tokens = new TokenService();

const login = {
  id: "login-1",
  companyId: "company-1",
  ownerUserId: "owner-1",
  email: "hr@acme.com.tr",
  passwordChangedAt: new Date(Date.now() - 60_000),
};

function companyToken(over: Record<string, unknown> = {}) {
  return tokens.signAccessToken({
    sub: "owner-1",
    role: "COMPANY_OWNER",
    status: "ACTIVE",
    cl: "login-1",
    cid: "company-1",
    ...over,
  } as never).token;
}

function guardPrisma(opts: { login?: typeof login | null; approved?: boolean } = {}) {
  return {
    companyLogin: { findUnique: jest.fn().mockResolvedValue(opts.login === undefined ? login : opts.login) },
    companyOwner: { findFirst: jest.fn().mockResolvedValue(opts.approved === false ? null : { id: "co-1" }) },
  };
}

// A fake route: allowed = marked @CompanyAccountAllowed().
function context(token: string, opts: { allowed: boolean; params?: Record<string, string> }) {
  const handler = () => undefined;
  if (opts.allowed) Reflect.defineMetadata(COMPANY_ACCOUNT_ALLOWED, true, handler);
  const request: Record<string, unknown> = { headers: { authorization: `Bearer ${token}` }, params: opts.params ?? {} };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => class {},
  } as unknown as ExecutionContext;
  return { ctx, request };
}

describe("JwtAuthGuard - company login sessions", () => {
  const guard = (prisma = guardPrisma()) => new JwtAuthGuard(tokens, new Reflector(), prisma as never);

  it("refuses every route that isn't opened to company logins (the owner's personal pages)", async () => {
    const { ctx } = context(companyToken(), { allowed: false });
    await expect(guard().canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("lets an opened route through, scoped to the company", async () => {
    const { ctx, request } = context(companyToken(), { allowed: true, params: { companyId: "company-1" } });
    await expect(guard().canActivate(ctx)).resolves.toBe(true);
    expect(request.user).toEqual({
      id: "owner-1",
      role: "COMPANY_OWNER",
      status: "ACTIVE",
      companyScope: { companyId: "company-1", loginId: "login-1" },
    });
  });

  it("refuses another company's id in the URL", async () => {
    const { ctx } = context(companyToken(), { allowed: true, params: { companyId: "company-2" } });
    await expect(guard().canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("ends the session once the login is removed", async () => {
    const { ctx } = context(companyToken(), { allowed: true });
    await expect(guard(guardPrisma({ login: null })).canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("ends sessions opened before the password was changed", async () => {
    const changed = { ...login, passwordChangedAt: new Date(Date.now() + 5_000) };
    const { ctx } = context(companyToken(), { allowed: true });
    await expect(guard(guardPrisma({ login: changed })).canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("ends the session once the owner no longer owns the company", async () => {
    const { ctx } = context(companyToken(), { allowed: true });
    await expect(guard(guardPrisma({ approved: false })).canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("leaves a normal owner session alone on any route", async () => {
    const prisma = guardPrisma();
    const own = tokens.signAccessToken({ sub: "owner-1", role: "COMPANY_OWNER", status: "ACTIVE" }).token;
    const { ctx, request } = context(own, { allowed: false, params: { companyId: "company-2" } });
    await expect(guard(prisma).canActivate(ctx)).resolves.toBe(true);
    expect(request.user).toEqual({ id: "owner-1", role: "COMPANY_OWNER", status: "ACTIVE" });
    expect(prisma.companyLogin.findUnique).not.toHaveBeenCalled();
  });
});

describe("OptionalJwtAuthGuard - company login sessions", () => {
  it("treats a company login as a logged-out visitor on public reads", () => {
    const { ctx, request } = context(companyToken(), { allowed: false });
    expect(new OptionalJwtAuthGuard(tokens).canActivate(ctx)).toBe(true);
    expect(request.user).toBeUndefined();
  });
});

describe("AuthService.loginWithCompanyLogin", () => {
  async function setup(opts: { approved?: boolean; exists?: boolean } = {}) {
    const row = { ...login, passwordHash: await bcrypt.hash("Correct-Horse-1", 4) };
    const prisma = {
      companyLogin: { findUnique: jest.fn().mockResolvedValue(opts.exists === false ? null : row) },
      companyOwner: { findFirst: jest.fn().mockResolvedValue(opts.approved === false ? null : { id: "co-1" }) },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
    };
    return { prisma, service: new AuthService(prisma as never, tokens, {} as never) };
  }

  it("issues a session limited to the company, acting for the owner", async () => {
    const { service, prisma } = await setup();
    const result = await service.loginWithCompanyLogin({ email: "hr@acme.com.tr", password: "Correct-Horse-1" });
    const claims = tokens.verifyAccessToken(result.accessToken);
    expect(claims).toMatchObject({ sub: "owner-1", role: "COMPANY_OWNER", cl: "login-1", cid: "company-1" });
    expect(prisma.refreshToken.create.mock.calls[0][0].data.companyLoginId).toBe("login-1");
  });

  it("gives the same answer for a wrong password, an unknown email and a lapsed owner", async () => {
    const wrong = await setup();
    await expect(
      wrong.service.loginWithCompanyLogin({ email: "hr@acme.com.tr", password: "nope" }),
    ).rejects.toThrow(new UnauthorizedException("Invalid email or password"));
    const unknown = await setup({ exists: false });
    await expect(
      unknown.service.loginWithCompanyLogin({ email: "x@y.com", password: "Correct-Horse-1" }),
    ).rejects.toThrow(new UnauthorizedException("Invalid email or password"));
    const lapsed = await setup({ approved: false });
    await expect(
      lapsed.service.loginWithCompanyLogin({ email: "hr@acme.com.tr", password: "Correct-Horse-1" }),
    ).rejects.toThrow(new UnauthorizedException("Invalid email or password"));
  });
});

describe("AuthService.refresh - company login sessions", () => {
  function setup(opts: { loginExists?: boolean } = {}) {
    const raw = "r".repeat(96);
    const prisma = {
      refreshToken: {
        findFirst: jest.fn().mockResolvedValue({
          id: "rt-1",
          userId: "owner-1",
          tokenHash: tokens.hashRefreshToken(raw),
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          deviceLabel: "web",
          companyLoginId: "login-1",
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ id: "owner-1", role: "COMPANY_OWNER", status: "ACTIVE" }) },
      companyLogin: { findUnique: jest.fn().mockResolvedValue(opts.loginExists === false ? null : login) },
      companyOwner: { findFirst: jest.fn().mockResolvedValue({ id: "co-1" }) },
    };
    return { raw, prisma, service: new AuthService(prisma as never, tokens, {} as never) };
  }

  it("keeps the session limited to the company after a refresh", async () => {
    const { raw, service, prisma } = setup();
    const result = await service.refresh(raw);
    expect(tokens.verifyAccessToken(result.accessToken)).toMatchObject({ cl: "login-1", cid: "company-1" });
    expect(prisma.refreshToken.create.mock.calls[0][0].data.companyLoginId).toBe("login-1");
  });

  it("refuses to refresh once the login is gone", async () => {
    const { raw, service } = setup({ loginExists: false });
    await expect(service.refresh(raw)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

// Every route a company login can reach, written out. A new route opened to
// it (or one removed) must be a deliberate change to this list - that's the
// whole safety of the default-deny design.
describe("routes opened to company logins", () => {
  it("are exactly the company-dashboard ones", async () => {
    const { readdirSync, statSync } = await import("fs");
    const { join } = await import("path");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (name.endsWith(".controller.ts")) files.push(full);
      }
    };
    walk(join(__dirname, "..", ".."));
    const reflector = new Reflector();
    const opened: string[] = [];
    for (const file of files) {
      const mod = (await import(file)) as Record<string, unknown>;
      for (const exported of Object.values(mod)) {
        if (typeof exported !== "function" || Reflect.getMetadata("path", exported) === undefined) continue;
        const base = Reflect.getMetadata("path", exported) as string;
        const proto = (exported as { prototype: Record<string, unknown> }).prototype;
        for (const name of Object.getOwnPropertyNames(proto)) {
          const handler = proto[name];
          if (name === "constructor" || typeof handler !== "function") continue;
          if (!reflector.get(COMPANY_ACCOUNT_ALLOWED, handler)) continue;
          const path = Reflect.getMetadata("path", handler) as string;
          const method = ["GET", "POST", "PUT", "DELETE", "PATCH"][Reflect.getMetadata("method", handler) as number];
          opened.push(`${method} ${[base, path].filter((p) => p && p !== "/").join("/")}`);
        }
      }
    }
    expect(opened.sort()).toEqual(
      [
        "GET onboarding/status",
        "GET me/company-claims",
        "GET me/owned-companies",
        "PATCH my-companies/:companyId",
        "POST my-companies/:companyId/logo",
        "POST my-companies/:companyId/banner",
        "POST my-companies/:companyId/contact-admin",
        "GET my-companies/:companyId/job-postings/boost-status",
        "POST my-companies/:companyId/job-postings",
        "PATCH my-companies/:companyId/job-postings/:jobPostingId",
        "POST my-companies/:companyId/job-postings/:jobPostingId/mark-filled",
        "GET my-companies/:companyId/job-postings",
        "GET my-companies/:companyId/job-applications",
        "POST my-companies/:companyId/job-applications/:id/mark-viewed",
        "GET my-companies/:companyId/job-applications/:id/pdf",
        "POST my-companies/:companyId/sector-benchmark",
        "GET my-companies/:companyId/sector-benchmark",
        "GET my-companies/:companyId/sector-benchmark/:jobId/download",
        "GET my-companies/:companyId/hr-analytics-report",
        "POST my-companies/:companyId/hr-analytics-report",
        "GET my-companies/:companyId/hr-analytics-report/:jobId/download",
        "GET my-companies/:companyId/turnover-risk",
        "GET my-companies/:companyId/follower-count",
        "GET owner/conversations",
        "GET owner/companies/:companyId/conversations",
        "GET conversations/:id",
        "POST conversations/:id/messages",
        "POST conversations/:id/end",
        "POST conversations/:id/read",
        "GET my-companies/:companyId/reply-allowance",
        "POST reviews/:id/reply",
        "PATCH reviews/:id/reply",
        // Read-only views of the company's IWT Social side (decided 2026-10-15:
        // the company login sees everything about the company except the
        // owner's own profile). Answering, scheduling and posting stay owner-only.
        "GET social/company-insights/:companyId",
        "GET social/company-scheduled/:companyId",
        "GET social/company-questions/:companyId/counts",
        "GET social/company-questions/:companyId",
      ].sort(),
    );
  }, 60_000);
});

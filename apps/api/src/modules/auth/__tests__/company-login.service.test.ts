import { ConflictException, ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CompanyLoginService } from "../company-login.service";
import { MessagingService } from "../../messaging/messaging.service";

function makePrisma(opts: { approved?: boolean; upsertError?: Error } = {}) {
  const prisma: Record<string, any> = {
    companyOwner: {
      findUnique: jest.fn().mockResolvedValue(opts.approved === false ? null : { claimStatus: "APPROVED" }),
    },
    companyLogin: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: opts.upsertError
        ? jest.fn().mockRejectedValue(opts.upsertError)
        : jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: "login-1", ...create, updatedAt: new Date() })),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  prisma.$transaction = jest.fn().mockImplementation((arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: unknown) => unknown)(prisma) : Promise.all(arg as unknown[]),
  );
  return prisma;
}

describe("CompanyLoginService", () => {
  it("only the company's approved owner can set it up", async () => {
    const service = new CompanyLoginService(makePrisma({ approved: false }) as never);
    await expect(service.set("u1", "c1", { email: "hr@acme.com", password: "Str0ng-pass" })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("stores a hash (never the password) and signs every staff session out", async () => {
    const prisma = makePrisma();
    const view = await new CompanyLoginService(prisma as never).set("u1", "c1", { email: "hr@acme.com", password: "Str0ng-pass" });
    const saved = prisma.companyLogin.upsert.mock.calls[0][0].create;
    expect(saved.passwordHash).not.toBe("Str0ng-pass");
    expect(await bcrypt.compare("Str0ng-pass", saved.passwordHash)).toBe(true);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { companyLoginId: "login-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(view).toEqual({ email: "hr@acme.com", updatedAt: expect.any(String) });
  });

  it("explains when another company already uses that email", async () => {
    const taken = new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "5.22.0" });
    const service = new CompanyLoginService(makePrisma({ upsertError: taken }) as never);
    await expect(service.set("u1", "c1", { email: "hr@acme.com", password: "Str0ng-pass" })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("removing it deletes the login", async () => {
    const prisma = makePrisma();
    expect(await new CompanyLoginService(prisma as never).remove("u1", "c1")).toEqual({ email: null, updatedAt: null });
    expect(prisma.companyLogin.deleteMany).toHaveBeenCalledWith({ where: { companyId: "c1" } });
  });
});

describe("MessagingService.assertInCompanyScope", () => {
  const service = (companyId: string | null) =>
    new (MessagingService as any)({
      reviewConversation: { findUnique: jest.fn().mockResolvedValue(companyId ? { companyId } : null) },
    });

  it("lets a company login open its own company's conversations", async () => {
    await expect(service("c1").assertInCompanyScope("conv-1", { companyId: "c1" })).resolves.toBeUndefined();
  });

  it("404s any other conversation - e.g. the owner's own as a reviewer", async () => {
    await expect(service("c2").assertInCompanyScope("conv-1", { companyId: "c1" })).rejects.toThrow("Conversation not found");
  });
});

import { ConflictException, UnauthorizedException } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { AuthService } from "../auth.service";

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code,
    clientVersion: "5.20.0",
  });
}

describe("AuthService.registerWithEmail", () => {
  it("throws a friendly ConflictException when two concurrent registrations race past the existing-email check", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockRejectedValue(prismaError("P2002")),
      },
    };
    const service = new AuthService(prisma as any, {} as any, {} as any);

    await expect(
      service.registerWithEmail({ email: "real@gmail.com", password: "Password123!" }),
    ).rejects.toThrow(new ConflictException("An account with this email already exists"));
  });
});

describe("AuthService.loginWithEmail — admin OTP gate", () => {
  async function adminUser() {
    return {
      id: "admin-1",
      email: "info@iworkedthere.com",
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash: await bcrypt.hash("correct-horse-battery-staple", 4),
    };
  }

  it("never issues tokens for an ADMIN account on password alone — it returns OTP_REQUIRED instead", async () => {
    const user = await adminUser();
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(user) } };
    const adminLoginOtp = { issueChallenge: jest.fn().mockResolvedValue(undefined) };
    const tokens = { signAccessToken: jest.fn(), generateRefreshToken: jest.fn() };
    const service = new AuthService(prisma as any, tokens as any, adminLoginOtp as any);

    const result = await service.loginWithEmail({ email: user.email, password: "correct-horse-battery-staple" });

    expect(result).toEqual({ status: "OTP_REQUIRED", email: user.email });
    expect(adminLoginOtp.issueChallenge).toHaveBeenCalledWith(user.id, user.email);
    // The whole point of the gate: a correct password must never be enough
    // on its own to mint a session for this role.
    expect(tokens.signAccessToken).not.toHaveBeenCalled();
    expect(tokens.generateRefreshToken).not.toHaveBeenCalled();
  });

  it("still issues tokens immediately for a non-admin account (no OTP gate)", async () => {
    const user = {
      id: "member-1",
      email: "member@gmail.com",
      role: "MEMBER",
      status: "ACTIVE",
      passwordHash: await bcrypt.hash("hunter2hunter2", 4),
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
    };
    const adminLoginOtp = { issueChallenge: jest.fn() };
    const tokens = {
      signAccessToken: jest.fn().mockReturnValue({ token: "access", expiresInSeconds: 900 }),
      generateRefreshToken: jest.fn().mockReturnValue({ raw: "refresh", hash: "hash", expiresAt: new Date() }),
    };
    const service = new AuthService(prisma as any, tokens as any, adminLoginOtp as any);

    const result = await service.loginWithEmail({ email: user.email, password: "hunter2hunter2" });

    expect(result).toEqual({ status: "OK", accessToken: "access", refreshToken: "refresh", expiresInSeconds: 900 });
    expect(adminLoginOtp.issueChallenge).not.toHaveBeenCalled();
  });
});

describe("AuthService.verifyAdminLoginOtp", () => {
  it("rejects a non-admin (or nonexistent) email without ever touching the OTP challenge table", async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } };
    const adminLoginOtp = { verifyChallenge: jest.fn() };
    const service = new AuthService(prisma as any, {} as any, adminLoginOtp as any);

    await expect(
      service.verifyAdminLoginOtp({ email: "nobody@gmail.com", code: "123456" }),
    ).rejects.toThrow(UnauthorizedException);
    expect(adminLoginOtp.verifyChallenge).not.toHaveBeenCalled();
  });

  it("issues real tokens once the OTP challenge verifies", async () => {
    const user = { id: "admin-1", email: "info@iworkedthere.com", role: "ADMIN", status: "ACTIVE" };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      refreshToken: { create: jest.fn().mockResolvedValue({}) },
    };
    const adminLoginOtp = { verifyChallenge: jest.fn().mockResolvedValue(undefined) };
    const tokens = {
      signAccessToken: jest.fn().mockReturnValue({ token: "access", expiresInSeconds: 900 }),
      generateRefreshToken: jest.fn().mockReturnValue({ raw: "refresh", hash: "hash", expiresAt: new Date() }),
    };
    const service = new AuthService(prisma as any, tokens as any, adminLoginOtp as any);

    const result = await service.verifyAdminLoginOtp({ email: user.email, code: "654321" });

    expect(adminLoginOtp.verifyChallenge).toHaveBeenCalledWith(user.id, "654321");
    expect(result).toEqual({ accessToken: "access", refreshToken: "refresh", expiresInSeconds: 900 });
  });

  it("propagates the underlying rejection (wrong/expired/exhausted code) without issuing tokens", async () => {
    const user = { id: "admin-1", email: "info@iworkedthere.com", role: "ADMIN", status: "ACTIVE" };
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(user) } };
    const adminLoginOtp = {
      verifyChallenge: jest.fn().mockRejectedValue(new UnauthorizedException("Incorrect code")),
    };
    const tokens = { signAccessToken: jest.fn(), generateRefreshToken: jest.fn() };
    const service = new AuthService(prisma as any, tokens as any, adminLoginOtp as any);

    await expect(service.verifyAdminLoginOtp({ email: user.email, code: "000000" })).rejects.toThrow(
      "Incorrect code",
    );
    expect(tokens.signAccessToken).not.toHaveBeenCalled();
  });
});

import { HttpException, UnauthorizedException } from "@nestjs/common";
import { AdminLoginOtpService } from "../admin-login-otp.service";

function makePrisma(challengeOverrides: Partial<Record<string, any>> = {}) {
  return {
    adminLoginOtpChallenge: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      ...challengeOverrides,
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };
}

describe("AdminLoginOtpService.issueChallenge", () => {
  it("sends a code and persists only its hash, never the raw code", async () => {
    const prisma = makePrisma();
    const notifier = { sendOtp: jest.fn().mockResolvedValue(undefined) };
    const service = new AdminLoginOtpService(prisma as any, notifier as any);

    await service.issueChallenge("user-1", "info@iworkedthere.com");

    expect(notifier.sendOtp).toHaveBeenCalledWith("info@iworkedthere.com", expect.stringMatching(/^\d{6}$/));
    const [sentCode] = notifier.sendOtp.mock.calls[0].slice(1);
    const createCall = prisma.adminLoginOtpChallenge.create.mock.calls[0][0];
    expect(createCall.data.userId).toBe("user-1");
    expect(createCall.data.codeHash).not.toBe(sentCode);
    expect(typeof createCall.data.codeHash).toBe("string");
  });

  it("refuses a second request inside the resend cooldown", async () => {
    const prisma = makePrisma({ findFirst: jest.fn().mockResolvedValue({ createdAt: new Date() }) });
    const notifier = { sendOtp: jest.fn() };
    const service = new AdminLoginOtpService(prisma as any, notifier as any);

    await expect(service.issueChallenge("user-1", "info@iworkedthere.com")).rejects.toThrow(HttpException);
    expect(notifier.sendOtp).not.toHaveBeenCalled();
  });
});

describe("AdminLoginOtpService.verifyChallenge", () => {
  it("rejects when no challenge exists", async () => {
    const prisma = makePrisma();
    const service = new AdminLoginOtpService(prisma as any, {} as any);
    await expect(service.verifyChallenge("user-1", "123456")).rejects.toThrow(UnauthorizedException);
  });

  it("rejects and deletes an expired challenge", async () => {
    const challenge = { id: "c1", codeHash: "x", attempts: 0, expiresAt: new Date(Date.now() - 1000) };
    const prisma = makePrisma({ findFirst: jest.fn().mockResolvedValue(challenge) });
    const service = new AdminLoginOtpService(prisma as any, {} as any);

    await expect(service.verifyChallenge("user-1", "123456")).rejects.toThrow(/expired/i);
    expect(prisma.adminLoginOtpChallenge.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
  });

  it("rejects and deletes a challenge that already exhausted its attempts", async () => {
    const challenge = { id: "c1", codeHash: "x", attempts: 5, expiresAt: new Date(Date.now() + 60_000) };
    const prisma = makePrisma({ findFirst: jest.fn().mockResolvedValue(challenge) });
    const service = new AdminLoginOtpService(prisma as any, {} as any);

    await expect(service.verifyChallenge("user-1", "123456")).rejects.toThrow(/too many/i);
    expect(prisma.adminLoginOtpChallenge.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
  });

  it("increments attempts on a wrong code without deleting the challenge", async () => {
    const challenge = { id: "c1", codeHash: "does-not-match", attempts: 0, expiresAt: new Date(Date.now() + 60_000) };
    const prisma = makePrisma({ findFirst: jest.fn().mockResolvedValue(challenge) });
    const service = new AdminLoginOtpService(prisma as any, {} as any);

    await expect(service.verifyChallenge("user-1", "000000")).rejects.toThrow(/incorrect/i);
    expect(prisma.adminLoginOtpChallenge.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { attempts: { increment: 1 } },
    });
    expect(prisma.adminLoginOtpChallenge.delete).not.toHaveBeenCalled();
  });

  it("accepts the correct code, consumes the challenge, and writes an AuditLog entry", async () => {
    const notifier = { sendOtp: jest.fn().mockResolvedValue(undefined) };
    const prisma = makePrisma();
    const service = new AdminLoginOtpService(prisma as any, notifier as any);

    await service.issueChallenge("user-1", "info@iworkedthere.com");
    const sentCode = notifier.sendOtp.mock.calls[0][1];
    const createdRow = prisma.adminLoginOtpChallenge.create.mock.calls[0][0].data;

    // Second mock generation: verifyChallenge looks the row back up via
    // findFirst — wire it to return exactly what issueChallenge persisted.
    prisma.adminLoginOtpChallenge.findFirst.mockResolvedValue({ id: "c1", ...createdRow });

    await service.verifyChallenge("user-1", sentCode);

    expect(prisma.adminLoginOtpChallenge.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: { actorUserId: "user-1", action: "ADMIN_LOGIN", targetType: "User", targetId: "user-1" },
    });
  });
});

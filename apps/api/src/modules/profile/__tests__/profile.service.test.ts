import bcrypt from "bcryptjs";
import { BadRequestException } from "@nestjs/common";
import { ProfileService } from "../profile.service";

describe("ProfileService.changePassword", () => {
  const userId = "user-1";
  const currentPassword = "OldPass123!";
  const passwordHash = bcrypt.hashSync(currentPassword, 12);

  function makePrisma() {
    return {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: userId, status: "ACTIVE", passwordHash }),
        update: jest.fn().mockResolvedValue({}),
      },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    };
  }

  it("rejects the wrong current password without touching sessions", async () => {
    const prisma = makePrisma();
    const service = new ProfileService(prisma as any, {} as any, {} as any, {} as any);

    await expect(
      service.changePassword(userId, { currentPassword: "wrong", newPassword: "NewPass456!" }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("revokes every live refresh token when the password is changed", async () => {
    const prisma = makePrisma();
    const service = new ProfileService(prisma as any, {} as any, {} as any, {} as any);

    await service.changePassword(userId, { currentPassword, newPassword: "NewPass456!" });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { passwordHash: expect.any(String) },
    });
  });
});

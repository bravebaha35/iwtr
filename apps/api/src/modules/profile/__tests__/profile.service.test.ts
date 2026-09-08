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

describe("ProfileService.deleteAccount", () => {
  // deleteAccount clears every Restrict-FK child row inside a
  // $transaction(async (tx) => ...) callback (not the array form
  // changePassword uses), then deletes the user row last.
  function makeDeleteAccountPrisma() {
    const tx = {
      review: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      reviewVote: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      moderationQueueItem: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      employmentHistory: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      educationHistory: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      phoneOtpChallenge: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      ownerContactMessage: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      companyOwner: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      socialPostLike: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      socialComment: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      socialPost: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      auditLog: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
      },
      piiVault: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      user: { delete: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "user-1" }) },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
    };
    return { prisma, tx };
  }

  it("clears the user's IWT Social posts, comments and likes before deleting the user", async () => {
    const { prisma, tx } = makeDeleteAccountPrisma();
    const service = new ProfileService(prisma as any, {} as any, {} as any, {} as any);

    await service.deleteAccount("user-1");

    expect(tx.socialPostLike.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(tx.socialComment.deleteMany).toHaveBeenCalledWith({ where: { authorUserId: "user-1" } });
    expect(tx.socialPost.deleteMany).toHaveBeenCalledWith({ where: { authorUserId: "user-1" } });

    // All three are Restrict FKs on User (SocialPost/SocialComment.authorUserId,
    // SocialPostLike.userId) - a user.delete before any of them is the P2003 500
    // this regression test exists to catch.
    const order = (m: jest.Mock) => m.mock.invocationCallOrder[0];
    expect(order(tx.socialPostLike.deleteMany)).toBeLessThan(order(tx.user.delete));
    expect(order(tx.socialComment.deleteMany)).toBeLessThan(order(tx.user.delete));
    expect(order(tx.socialPost.deleteMany)).toBeLessThan(order(tx.user.delete));
  });
});

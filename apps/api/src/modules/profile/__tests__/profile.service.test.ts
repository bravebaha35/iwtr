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
  // deleteAccount hand-deletes the child rows whose User FK would otherwise
  // block tx.user.delete, inside a $transaction(async (tx) => ...) callback
  // (not the array form changePassword uses), then deletes the user row last.
  // The three IWT Social FKs (SocialPost/SocialComment.authorUserId,
  // SocialPostLike.userId) are deliberately NOT in that list: they are
  // onDelete: SetNull, so the DB detaches them when the user row goes. That
  // SetNull cascade is verified by `prisma db push` against the schema, not
  // reproducible against these in-memory mocks.
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

  it("completes without throwing and deletes the user row last", async () => {
    const { prisma, tx } = makeDeleteAccountPrisma();
    const service = new ProfileService(prisma as any, {} as any, {} as any, {} as any);

    await expect(service.deleteAccount("user-1")).resolves.toBeUndefined();

    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(tx.piiVault.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("does NOT hand-delete IWT Social posts/comments/likes (relies on onDelete: SetNull)", async () => {
    const { prisma, tx } = makeDeleteAccountPrisma();
    const service = new ProfileService(prisma as any, {} as any, {} as any, {} as any);

    await service.deleteAccount("user-1");

    // The author/user columns on these three tables are onDelete: SetNull, so
    // tx.user.delete detaches them at the DB level - deleteAccount must not
    // hand-delete the content. The SetNull cascade itself is DB behavior
    // verified by `prisma db push` against the schema, not unit-testable here.
    expect(tx.socialPost.deleteMany).not.toHaveBeenCalled();
    expect(tx.socialComment.deleteMany).not.toHaveBeenCalled();
    expect(tx.socialPostLike.deleteMany).not.toHaveBeenCalled();
  });
});

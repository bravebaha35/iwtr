import bcrypt from "bcryptjs";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
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
      user: { delete: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "user-1" }) },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
    };
    // deleteAccount routes the PiiVault cleanup through PiiVaultService (the
    // only module allowed to touch that Prisma model) rather than tx.piiVault
    // directly — see PiiVaultService.deleteForUser.
    const piiVault = { deleteForUser: jest.fn().mockResolvedValue(undefined) };
    return { prisma, tx, piiVault };
  }

  it("completes without throwing and deletes the user row last", async () => {
    const { prisma, tx, piiVault } = makeDeleteAccountPrisma();
    const service = new ProfileService(prisma as any, piiVault as any, {} as any, {} as any);

    await expect(service.deleteAccount("user-1")).resolves.toBeUndefined();

    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(piiVault.deleteForUser).toHaveBeenCalledWith(tx, "user-1");
  });

  it("does NOT hand-delete IWT Social posts/comments/likes (relies on onDelete: SetNull)", async () => {
    const { prisma, tx, piiVault } = makeDeleteAccountPrisma();
    const service = new ProfileService(prisma as any, piiVault as any, {} as any, {} as any);

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

describe("ProfileService.updateProfile - company owners (2026-09-11)", () => {
  it("rejects a COMPANY_OWNER trying to change their reviewUsername", async () => {
    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "owner-1", status: "ACTIVE", role: "COMPANY_OWNER" }),
        update: jest.fn(),
      },
    };
    const service = new ProfileService(prisma as any, {} as any, {} as any, {} as any);

    await expect(
      service.updateProfile("owner-1", { reviewUsername: "Chief Happiness Officer" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("still lets a COMPANY_OWNER change just their avatar (no reviewUsername in the request)", async () => {
    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "owner-1", status: "ACTIVE", role: "COMPANY_OWNER" }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new ProfileService(prisma as any, {} as any, {} as any, {} as any);

    await service.updateProfile("owner-1", { avatarKey: "office_1", avatarGradient: "dawn" });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "owner-1" },
      data: { avatarKey: "office_1", avatarGradient: "dawn" },
    });
  });

  it("a plain MEMBER can still change their reviewUsername", async () => {
    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "u1", status: "ACTIVE", role: "MEMBER" }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new ProfileService(prisma as any, {} as any, {} as any, {} as any);

    await service.updateProfile("u1", { reviewUsername: "Chief Happiness Officer" });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { reviewUsername: "Chief Happiness Officer" },
    });
  });
});

describe("CV profile fields", () => {
  const userId = "u1";

  function makePrisma() {
    return {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: userId, status: "ACTIVE", role: "MEMBER" }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
  }

  it("strips HTML tags from customExperienceText before saving", async () => {
    const prisma = makePrisma();
    const service = new ProfileService(prisma as any, {} as any, {} as any, {} as any);

    await service.updateProfile(userId, { customExperienceText: "<script>alert(1)</script>Worked at a bakery" });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { customExperienceText: "Worked at a bakery" },
    });
  });

  it("clears customExperienceText when given an empty string", async () => {
    const prisma = makePrisma();
    const service = new ProfileService(prisma as any, {} as any, {} as any, {} as any);

    await service.updateProfile(userId, { customExperienceText: "" });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { customExperienceText: null },
    });
  });

  it("clears displayName when given an empty string", async () => {
    const prisma = makePrisma();
    const service = new ProfileService(prisma as any, {} as any, {} as any, {} as any);

    await service.updateProfile(userId, { displayName: "" });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { displayName: null },
    });
  });

  it("persists isPublicEmployee as given", async () => {
    const prisma = makePrisma();
    const service = new ProfileService(prisma as any, {} as any, {} as any, {} as any);

    await service.updateProfile(userId, { isPublicEmployee: true });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { isPublicEmployee: true },
    });
  });

  it("getMyProfile returns the three new fields", async () => {
    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: userId,
          status: "ACTIVE",
          role: "MEMBER",
          reviewUsername: "Chief Happiness Officer",
          avatarKey: "office_1",
          avatarGradient: "dawn",
          country: "Turkey",
          city: "Istanbul",
          district: null,
          email: "ada@example.com",
          displayName: "Ada",
          isPublicEmployee: true,
          customExperienceText: "Freelance work",
          workType: null,
          sectorId: null,
        }),
      },
      educationHistory: { findMany: jest.fn().mockResolvedValue([]) },
      userSkill: { findMany: jest.fn().mockResolvedValue([]) },
      sector: { findUnique: jest.fn() },
    };
    const piiVault = { getMyIdentity: jest.fn().mockResolvedValue(null) };
    const phoneVerification = { getMyPhoneNumber: jest.fn().mockResolvedValue(null) };
    const service = new ProfileService(prisma as any, piiVault as any, phoneVerification as any, {} as any);

    const result = await service.getMyProfile(userId);

    expect(result.displayName).toBe("Ada");
    expect(result.isPublicEmployee).toBe(true);
    expect(result.customExperienceText).toBe("Freelance work");
  });
});

describe("ProfileService.updateProfile — skills/sector/workType", () => {
  const userId = "u1";

  it("rejects a skillId that doesn't exist in the Skill table", async () => {
    const prisma = {
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: userId, role: "MEMBER", status: "ACTIVE", workType: "OFFICE" }) },
      skill: { findMany: jest.fn().mockResolvedValue([{ id: "real-1" }]) },
    };
    const service = new ProfileService(prisma as any, {} as any, {} as any, {} as any);

    await expect(
      service.updateProfile(userId, { skillIds: ["real-1", "does-not-exist"] }),
    ).rejects.toThrow("One or more selected skills no longer exist.");
  });

  it("rejects a sectorId whose workplaceTypes doesn't include the effective workType", async () => {
    const prisma = {
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: userId, role: "MEMBER", status: "ACTIVE", workType: "MANUAL_LABOUR", avatarKey: null }) },
      sector: { findUnique: jest.fn().mockResolvedValue({ id: "sec-1", workplaceTypes: ["OFFICE"] }) },
    };
    const service = new ProfileService(prisma as any, {} as any, {} as any, {} as any);

    await expect(service.updateProfile(userId, { sectorId: "sec-1" })).rejects.toThrow(
      "That sector doesn't apply to your selected work type.",
    );
  });

  it("accepts a sectorId that matches the work type submitted in the SAME request", async () => {
    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: userId, role: "MEMBER", status: "ACTIVE", workType: null, avatarKey: null }),
        update: jest.fn().mockResolvedValue({}),
      },
      sector: { findUnique: jest.fn().mockResolvedValue({ id: "sec-1", workplaceTypes: ["MANUAL_LABOUR"] }) },
    };
    const service = new ProfileService(prisma as any, {} as any, {} as any, {} as any);

    await service.updateProfile(userId, { workType: "MANUAL_LABOUR", sectorId: "sec-1" });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { workType: "MANUAL_LABOUR", sectorId: "sec-1" },
    });
  });

  it("rejects clearing faculty on an existing COLLEGE row via updateEducationHistory", async () => {
    const prisma = {
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: userId, status: "ACTIVE" }) },
      educationHistory: {
        findUnique: jest.fn().mockResolvedValue({ id: "e1", userId, level: "COLLEGE", faculty: "Engineering" }),
      },
    };
    const service = new ProfileService(prisma as any, {} as any, {} as any, {} as any);

    await expect(service.updateEducationHistory(userId, "e1", { faculty: null })).rejects.toThrow(
      "Faculty is required for a College entry.",
    );
  });

  it("does NOT require faculty when a PATCH omits it and the existing COLLEGE row already has one", async () => {
    // Companion to the "rejects clearing faculty" test above: here `faculty`
    // is simply absent from the request (not explicitly nulled), so
    // effectiveFaculty should fall back to the existing row's value and the
    // update should go through untouched.
    const prisma = {
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: userId, status: "ACTIVE" }) },
      educationHistory: {
        findUnique: jest.fn().mockResolvedValue({ id: "e1", userId, level: "COLLEGE", faculty: "Engineering" }),
        update: jest.fn().mockResolvedValue({
          id: "e1",
          level: "COLLEGE",
          institutionName: "Boğaziçi",
          graduationYear: 2021,
          faculty: "Engineering",
          department: null,
        }),
      },
    };
    const service = new ProfileService(prisma as any, {} as any, {} as any, {} as any);

    await expect(service.updateEducationHistory(userId, "e1", { graduationYear: 2021 })).resolves.toMatchObject({
      graduationYear: 2021,
    });
    expect(prisma.educationHistory.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { graduationYear: 2021 },
    });
  });

  // Level 3 of the effectiveWorkType fallback chain in updateProfile:
  // input.workType absent AND user.workType null/absent, but user.avatarKey
  // set — should derive via workTypeFromAvatarKey(user.avatarKey). Levels 1
  // (input.workType present) and 2 (user.workType present) are already
  // covered by the two tests above; this is the only level not yet exercised.
  it("derives effective work type from avatarKey when neither input.workType nor user.workType is set", async () => {
    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: userId,
          role: "MEMBER",
          status: "ACTIVE",
          workType: null,
          avatarKey: "manual_3", // workTypeFromAvatarKey("manual_3") -> "MANUAL_LABOUR"
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      sector: { findUnique: jest.fn().mockResolvedValue({ id: "sec-1", workplaceTypes: ["MANUAL_LABOUR"] }) },
    };
    const service = new ProfileService(prisma as any, {} as any, {} as any, {} as any);

    await service.updateProfile(userId, { sectorId: "sec-1" });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { sectorId: "sec-1" },
    });
  });

  it("rejects via the avatarKey-derived work type when the sector doesn't match it", async () => {
    // Negative companion to the avatarKey-fallback test above: same
    // avatarKey-only setup, but the sector's workplaceTypes doesn't include
    // the derived MANUAL_LABOUR, so it should still be rejected.
    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: userId,
          role: "MEMBER",
          status: "ACTIVE",
          workType: null,
          avatarKey: "manual_3",
        }),
      },
      sector: { findUnique: jest.fn().mockResolvedValue({ id: "sec-1", workplaceTypes: ["OFFICE"] }) },
    };
    const service = new ProfileService(prisma as any, {} as any, {} as any, {} as any);

    await expect(service.updateProfile(userId, { sectorId: "sec-1" })).rejects.toThrow(
      "That sector doesn't apply to your selected work type.",
    );
  });

  it("accepts a skillIds array containing a duplicate valid id, deduplicating in the create array", async () => {
    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: userId, role: "MEMBER", status: "ACTIVE" }),
        update: jest.fn().mockResolvedValue({}),
      },
      skill: { findMany: jest.fn().mockResolvedValue([{ id: "real-1" }]) },
    };
    const service = new ProfileService(prisma as any, {} as any, {} as any, {} as any);

    await service.updateProfile(userId, { skillIds: ["real-1", "real-1"] });

    // The duplicate in the input array should be removed before the nested
    // create, so the create array contains only one entry, avoiding a Prisma
    // unique-constraint violation on UserSkill(userId, skillId).
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { skills: { deleteMany: {}, create: [{ skillId: "real-1" }] } },
    });
  });
});

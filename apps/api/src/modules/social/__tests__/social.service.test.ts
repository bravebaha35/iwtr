import { join } from "path";
import { unlink } from "fs/promises";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { SocialService } from "../social.service";
import { ModerationService } from "../../moderation/moderation.service";

jest.mock("../social-image.util", () => ({
  processSocialImage: jest.fn().mockResolvedValue(Buffer.alloc(64, 9)),
  SOCIAL_IMAGE_OUTPUT_MAX_WIDTH_PX: 1080,
}));

// Keep the "happy path" test hermetic - no real mkdir/writeFile into
// apps/api/uploads/social/ (Ruling C). The other three cases reject before
// the write is ever reached. `unlink` is here for the admin-moderation
// suite below (post/feed removal unlinks each WebP file best-effort).
jest.mock("fs/promises", () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

const mockUnlink = unlink as jest.MockedFunction<typeof unlink>;

const moderationPass = {
  checkContent: jest.fn().mockReturnValue({ violates: false, violationTypes: [], confidence: 0.95 }),
} as never;

const jpegFile = { buffer: Buffer.alloc(1024, 1), mimetype: "image/jpeg", size: 1024 } as Express.Multer.File;
const CID = "11111111-1111-1111-1111-111111111111";

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    companyOwner: { findUnique: jest.fn() },
    socialPost: { create: jest.fn().mockResolvedValue({ id: "post-1" }) },
    ...overrides,
  } as never;
}

describe("SocialService.createPost", () => {
  it("rejects a caller who is not an approved owner", async () => {
    const prisma = makePrisma();
    (prisma as any).companyOwner.findUnique.mockResolvedValue(null);
    await expect(new SocialService(prisma, moderationPass).createPost("u1", { companyId: CID }, jpegFile)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("rejects a caption that fails moderation with 400", async () => {
    const prisma = makePrisma();
    (prisma as any).companyOwner.findUnique.mockResolvedValue({ claimStatus: "APPROVED" });
    const moderationFail = {
      checkContent: jest.fn().mockReturnValue({ violates: true, violationTypes: ["NAME_OR_SURNAME"], confidence: 0.5 }),
    } as never;
    await expect(
      new SocialService(prisma, moderationFail).createPost("u1", { companyId: CID, caption: "call Ahmet Yilmaz" }, jpegFile),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects when no file is attached", async () => {
    const prisma = makePrisma();
    (prisma as any).companyOwner.findUnique.mockResolvedValue({ claimStatus: "APPROVED" });
    await expect(new SocialService(prisma, moderationPass).createPost("u1", { companyId: CID }, undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("creates a post for an approved owner with a clean caption", async () => {
    const prisma = makePrisma();
    (prisma as any).companyOwner.findUnique.mockResolvedValue({ claimStatus: "APPROVED" });
    const result = await new SocialService(prisma, moderationPass).createPost("u1", { companyId: CID, caption: "new office" }, jpegFile);
    expect(result).toEqual({ id: "post-1" });
    expect((prisma as any).socialPost.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ companyId: CID, authorUserId: "u1", caption: "new office" }) }),
    );
  });

  it("stores a whitespace-only caption as null", async () => {
    const prisma = makePrisma();
    (prisma as any).companyOwner.findUnique.mockResolvedValue({ claimStatus: "APPROVED" });
    await new SocialService(prisma, moderationPass).createPost("u1", { companyId: CID, caption: "" }, jpegFile);
    expect((prisma as any).socialPost.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ caption: null }) }),
    );
  });

  it("runs the caption through moderation with the name, job-title and shouting checks skipped", async () => {
    const prisma = makePrisma();
    (prisma as any).companyOwner.findUnique.mockResolvedValue({ claimStatus: "APPROVED" });
    const checkContent = jest.fn().mockReturnValue({ violates: false, violationTypes: [], confidence: 0.95 });

    await new SocialService(prisma, { checkContent } as never).createPost(
      "u1",
      { companyId: CID, caption: "Welcome our new Warehouse Manager Jane Doe" },
      jpegFile,
    );

    expect(checkContent).toHaveBeenCalledWith(
      ["Welcome our new Warehouse Manager Jane Doe"],
      { skipViolationTypes: ["NAME_OR_SURNAME", "JOB_TITLE", "ABUSE_OR_INSULT"] },
    );
  });

  it("with the real ModerationService: accepts a caption naming staff + a role + all-caps, still rejects profanity", async () => {
    const prisma = makePrisma();
    (prisma as any).companyOwner.findUnique.mockResolvedValue({ claimStatus: "APPROVED" });
    const moderation = new ModerationService() as never;

    const ok = await new SocialService(prisma, moderation).createPost(
      "u1",
      { companyId: CID, caption: "Welcome our new Warehouse Manager Jane Doe" },
      jpegFile,
    );
    expect(ok).toEqual({ id: "post-1" });

    const caps = await new SocialService(prisma, moderation).createPost(
      "u1",
      { companyId: CID, caption: "GRAND OPENING THIS SATURDAY COME AND SEE US" },
      jpegFile,
    );
    expect(caps).toEqual({ id: "post-1" });

    await expect(
      new SocialService(prisma, moderation).createPost(
        "u1",
        { companyId: CID, caption: "this new place is shit" },
        jpegFile,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("SocialService.feed", () => {
  const now = Date.now();
  const rows = [
    { id: "p2", companyId: "c1", imageUrl: "/u/2.webp", caption: null, createdAt: new Date(now - 1000),
      company: { slug: "acme", name: "Acme", mainPhotoUrl: null, badgeTier: "FREE" } },
    { id: "p1", companyId: "c1", imageUrl: "/u/1.webp", caption: "hi", createdAt: new Date(now - 2000),
      company: { slug: "acme", name: "Acme", mainPhotoUrl: null, badgeTier: "FREE" } },
  ];

  function feedPrisma() {
    return {
      socialPost: { findMany: jest.fn().mockResolvedValue(rows) },
      socialComment: { groupBy: jest.fn().mockResolvedValue([{ postId: "p1", _count: { _all: 3 } }]) },
      socialPostLike: {
        groupBy: jest.fn().mockResolvedValue([{ postId: "p1", _count: { _all: 5 } }]),
        findMany: jest.fn().mockResolvedValue([]),
      },
      savedPost: { findMany: jest.fn().mockResolvedValue([]) },
    } as never;
  }

  it("returns posts newest-first with counts, nextCursor null on a short page, likedByMe null when anonymous", async () => {
    const page = await new SocialService(feedPrisma(), moderationPass).feed(undefined, {});
    expect(page.posts.map((p) => p.id)).toEqual(["p2", "p1"]);
    expect(page.posts.find((p) => p.id === "p1")?.likeCount).toBe(5);
    expect(page.posts.find((p) => p.id === "p1")?.commentCount).toBe(3);
    expect(page.posts[0].likedByMe).toBeNull();
    expect(page.nextCursor).toBeNull();
  });

  it("sets likedByMe boolean for an authenticated viewer", async () => {
    const prisma = feedPrisma();
    (prisma as any).socialPostLike.findMany.mockResolvedValue([{ postId: "p1" }]);
    const page = await new SocialService(prisma, moderationPass).feed("viewer-1", {});
    expect(page.posts.find((p) => p.id === "p1")?.likedByMe).toBe(true);
    expect(page.posts.find((p) => p.id === "p2")?.likedByMe).toBe(false);
  });

  it("companyFeed resolves the slug then returns that company's posts", async () => {
    const prisma = feedPrisma();
    (prisma as any).company = { findUnique: jest.fn().mockResolvedValue({ id: "c1", hiddenAt: null }) };
    const page = await new SocialService(prisma, moderationPass).companyFeed(undefined, "acme", {});
    expect((prisma as any).company.findUnique).toHaveBeenCalledWith({
      where: { slug: "acme" },
      select: { id: true, hiddenAt: true },
    });
    expect(page.posts.map((p) => p.id)).toEqual(["p2", "p1"]);
  });

  it("companyFeed 404s on an unknown slug", async () => {
    const prisma = feedPrisma();
    (prisma as any).company = { findUnique: jest.fn().mockResolvedValue(null) };
    await expect(
      new SocialService(prisma, moderationPass).companyFeed(undefined, "ghost", {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("excludes a hidden company's posts from the global feed", async () => {
    const prisma = feedPrisma();
    await new SocialService(prisma, moderationPass).feed(undefined, {});
    expect((prisma as any).socialPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ company: expect.objectContaining({ hiddenAt: null }) }),
      }),
    );
  });

  it("companyFeed 404s for a hidden company", async () => {
    const prisma = feedPrisma();
    (prisma as any).company = { findUnique: jest.fn().mockResolvedValue({ id: "c1", hiddenAt: new Date() }) };
    await expect(
      new SocialService(prisma, moderationPass).companyFeed(undefined, "hidden-co", {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("sets nextCursor and trims to PAGE_SIZE when a full-plus-one page comes back", async () => {
    const overflow = Array.from({ length: 11 }, (_, i) => ({
      id: `x${i}`, companyId: "c1", imageUrl: `/u/${i}.webp`, caption: null, createdAt: new Date(now - i * 1000),
      company: { slug: "acme", name: "Acme", mainPhotoUrl: null, badgeTier: "FREE" },
    }));
    const prisma = feedPrisma();
    (prisma as any).socialPost.findMany.mockResolvedValue(overflow);
    const page = await new SocialService(prisma, moderationPass).feed(undefined, {});
    expect(page.posts).toHaveLength(10);
    expect(page.nextCursor).toBe("x9");
  });
});

describe("SocialService comments + likes", () => {
  it("hard-rejects a comment that fails moderation (400, not queued)", async () => {
    const prisma = { socialPost: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) } } as never;
    const moderationFail = {
      checkContent: jest.fn().mockReturnValue({ violates: true, violationTypes: ["PROFANITY"], confidence: 0.95 }),
    } as never;
    await expect(
      new SocialService(prisma, moderationFail).addComment("u1", "p1", { body: "this place is shit" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("serializes a comment with the author's anonymous handle, never their userId", async () => {
    const created = { id: "cm1", postId: "p1", body: "nice", createdAt: new Date(), authorUserId: "u1" };
    const prisma = {
      socialPost: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) },
      socialComment: { create: jest.fn().mockResolvedValue(created) },
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: "u1", avatarKey: "office_1", avatarGradient: "dawn", reviewUsername: "Spreadsheet Spelunker" },
        ]),
      },
    } as never;
    const out = await new SocialService(prisma, moderationPass).addComment("u1", "p1", { body: "nice" });
    expect(out).toMatchObject({
      id: "cm1", body: "nice", displayUsername: "Spreadsheet Spelunker", avatarKey: "office_1", mine: true,
    });
    expect(out).not.toHaveProperty("authorUserId");
    expect(out).not.toHaveProperty("userId");
  });

  it("deleteComment refuses a non-author", async () => {
    const prisma = { socialComment: { findUnique: jest.fn().mockResolvedValue({ id: "cm1", authorUserId: "other" }) } } as never;
    await expect(new SocialService(prisma, moderationPass).deleteComment("u1", "cm1")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("deleteComment 404s on an unknown id", async () => {
    const prisma = { socialComment: { findUnique: jest.fn().mockResolvedValue(null) } } as never;
    await expect(new SocialService(prisma, moderationPass).deleteComment("u1", "nope")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("deleteComment deletes the caller's own comment and returns { success: true }", async () => {
    const del = jest.fn().mockResolvedValue(undefined);
    const prisma = { socialComment: { findUnique: jest.fn().mockResolvedValue({ id: "cm1", authorUserId: "u1" }), delete: del } } as never;
    const result = await new SocialService(prisma, moderationPass).deleteComment("u1", "cm1");
    expect(del).toHaveBeenCalledWith({ where: { id: "cm1" } });
    expect(result).toEqual({ success: true });
  });

  it("listComments returns oldest-first, mine:false for an anonymous viewer, no userId", async () => {
    const rows = [
      { id: "cm1", postId: "p1", body: "first", createdAt: new Date(1), authorUserId: "u1" },
      { id: "cm2", postId: "p1", body: "second", createdAt: new Date(2), authorUserId: "u2" },
    ];
    const prisma = {
      socialPost: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) },
      socialComment: { findMany: jest.fn().mockResolvedValue(rows) },
      user: { findMany: jest.fn().mockResolvedValue([
        { id: "u1", avatarKey: "a1", avatarGradient: "g1", reviewUsername: "One" },
        { id: "u2", avatarKey: "a2", avatarGradient: "g2", reviewUsername: "Two" },
      ]) },
    } as never;
    const out = await new SocialService(prisma, moderationPass).listComments(undefined, "p1");
    expect(out.map((c) => c.id)).toEqual(["cm1", "cm2"]);
    expect(out.every((c) => c.mine === false)).toBe(true);
    expect(out.every((c) => !("authorUserId" in c) && !("userId" in c))).toBe(true);
  });

  it("serializes a deleted author's comment with a null identity and never a userId key", async () => {
    const rows = [
      { id: "cm1", postId: "p1", body: "kept", createdAt: new Date(1), authorUserId: null },
      { id: "cm2", postId: "p1", body: "mine", createdAt: new Date(2), authorUserId: "viewer-1" },
    ];
    const prisma = {
      socialPost: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) },
      socialComment: { findMany: jest.fn().mockResolvedValue(rows) },
      user: { findMany: jest.fn().mockResolvedValue([
        { id: "viewer-1", avatarKey: "a2", avatarGradient: "g2", reviewUsername: "Viewer" },
      ]) },
    } as never;
    const out = await new SocialService(prisma, moderationPass).listComments("viewer-1", "p1");

    // null authorUserIds are filtered out before the user lookup, not passed as `null`.
    expect((prisma as any).user.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["viewer-1"] } },
      select: { id: true, avatarKey: true, avatarGradient: true, reviewUsername: true },
    });
    const orphan = out.find((c) => c.id === "cm1") as any;
    expect(orphan).toMatchObject({
      body: "kept",
      displayUsername: null,
      avatarKey: null,
      avatarGradient: null,
      mine: false,
    });
    expect(orphan).not.toHaveProperty("authorUserId");
    expect(orphan).not.toHaveProperty("userId");
    expect((out.find((c) => c.id === "cm2") as any).mine).toBe(true);
  });

  it("toggleLike adds then removes", async () => {
    const like = { findUnique: jest.fn(), delete: jest.fn(), create: jest.fn(), count: jest.fn() };
    const prisma = { socialPost: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) }, socialPostLike: like } as never;

    like.findUnique.mockResolvedValueOnce(null);
    like.count.mockResolvedValue(1);
    const r1 = await new SocialService(prisma, moderationPass).toggleLike("u1", "p1");
    expect(r1).toEqual({ postId: "p1", likeCount: 1, likedByMe: true });
    expect(like.create).toHaveBeenCalled();

    like.findUnique.mockResolvedValueOnce({ id: "like-1" });
    like.count.mockResolvedValue(0);
    const r2 = await new SocialService(prisma, moderationPass).toggleLike("u1", "p1");
    expect(r2).toEqual({ postId: "p1", likeCount: 0, likedByMe: false });
    expect(like.delete).toHaveBeenCalled();
  });

  it("toggleLike swallows a concurrent-create P2002 and reports now-liked", async () => {
    const like = {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" }),
      ),
      count: jest.fn().mockResolvedValue(1),
      delete: jest.fn(),
    };
    const prisma = { socialPost: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) }, socialPostLike: like } as never;
    const r = await new SocialService(prisma, moderationPass).toggleLike("u1", "p1");
    expect(r).toEqual({ postId: "p1", likeCount: 1, likedByMe: true });
  });

  it("toggleLike rethrows a non-P2002 create error", async () => {
    const like = {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("fk", { code: "P2003", clientVersion: "x" }),
      ),
      count: jest.fn(),
      delete: jest.fn(),
    };
    const prisma = { socialPost: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) }, socialPostLike: like } as never;
    await expect(new SocialService(prisma, moderationPass).toggleLike("u1", "p1")).rejects.toThrow();
  });
});

describe("SocialService.toggleSave", () => {
  it("saves then unsaves (toggle)", async () => {
    const save = { findUnique: jest.fn(), delete: jest.fn(), create: jest.fn() };
    const prisma = { socialPost: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) }, savedPost: save } as never;

    save.findUnique.mockResolvedValueOnce(null);
    const r1 = await new SocialService(prisma, moderationPass).toggleSave("u1", "p1");
    expect(r1).toEqual({ postId: "p1", saved: true });
    expect(save.create).toHaveBeenCalledWith({ data: { userId: "u1", postId: "p1" } });

    save.findUnique.mockResolvedValueOnce({ id: "save-1" });
    const r2 = await new SocialService(prisma, moderationPass).toggleSave("u1", "p1");
    expect(r2).toEqual({ postId: "p1", saved: false });
    expect(save.delete).toHaveBeenCalled();
  });

  it("404s on an unknown post", async () => {
    const prisma = { socialPost: { findUnique: jest.fn().mockResolvedValue(null) } } as never;
    await expect(new SocialService(prisma, moderationPass).toggleSave("u1", "ghost")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("swallows a concurrent-save P2002 and reports now-saved", async () => {
    const save = {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" }),
      ),
      delete: jest.fn(),
    };
    const prisma = { socialPost: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) }, savedPost: save } as never;
    const r = await new SocialService(prisma, moderationPass).toggleSave("u1", "p1");
    expect(r).toEqual({ postId: "p1", saved: true });
  });
});

describe("SocialService.feed filters", () => {
  it("passes workplaceTypes as a hasSome filter on the company", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      socialPost: { findMany },
      socialPostLike: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
      socialComment: { groupBy: jest.fn().mockResolvedValue([]) },
      savedPost: { findMany: jest.fn().mockResolvedValue([]) },
    } as never;
    await new SocialService(prisma, moderationPass).feed(undefined, { workplaceTypes: ["OFFICE", "SERVICE"] });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          company: expect.objectContaining({ workplaceTypes: { hasSome: ["OFFICE", "SERVICE"] } }),
        }),
      }),
    );
  });

  it("passes categories as an exact-match `in` filter on the company", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      socialPost: { findMany },
      socialPostLike: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
      socialComment: { groupBy: jest.fn().mockResolvedValue([]) },
      savedPost: { findMany: jest.fn().mockResolvedValue([]) },
    } as never;
    await new SocialService(prisma, moderationPass).feed(undefined, { categories: ["Supermarket", "Logistics"] });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          company: expect.objectContaining({ category: { in: ["Supermarket", "Logistics"] } }),
        }),
      }),
    );
  });

  it("omits both filter keys entirely when no filters are given", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      socialPost: { findMany },
      socialPostLike: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
      socialComment: { groupBy: jest.fn().mockResolvedValue([]) },
      savedPost: { findMany: jest.fn().mockResolvedValue([]) },
    } as never;
    await new SocialService(prisma, moderationPass).feed(undefined, {});
    const call = findMany.mock.calls[0][0];
    expect(call.where.company).not.toHaveProperty("workplaceTypes");
    expect(call.where.company).not.toHaveProperty("category");
  });
});

describe("SocialService.listSavedPosts", () => {
  it("orders by SavedPost.createdAt (not the post's own createdAt) and excludes hidden companies", async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: "save-1",
        post: {
          id: "p1", companyId: "c1", imageUrl: "/u/1.webp", caption: null, createdAt: new Date("2020-01-01"),
          company: { slug: "acme", name: "Acme", mainPhotoUrl: null, badgeTier: "FREE" },
        },
      },
    ]);
    const prisma = {
      savedPost: { findMany },
      socialPostLike: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
      socialComment: { groupBy: jest.fn().mockResolvedValue([]) },
    } as never;

    const page = await new SocialService(prisma, moderationPass).listSavedPosts("u1", undefined);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1", post: { company: expect.objectContaining({ hiddenAt: null }) } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
    expect(page.posts.map((p) => p.id)).toEqual(["p1"]);
  });
});

describe("SocialService admin moderation", () => {
  const socialDir = join(process.cwd(), "uploads", "social");

  beforeEach(() => {
    mockUnlink.mockClear();
  });

  it("adminRemovePost deletes the post, unlinks its WebP file, writes a SOCIAL_POST_REMOVED audit log", async () => {
    const prisma = {
      socialPost: {
        findUnique: jest.fn().mockResolvedValue({
          id: "post-1",
          companyId: "c1",
          imageUrl: "http://localhost:3011/uploads/social/abc-123.webp",
        }),
        delete: jest.fn().mockResolvedValue({}),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    } as never;

    const result = await new SocialService(prisma, moderationPass).adminRemovePost("admin-1", "post-1");

    expect(result).toEqual({ success: true });
    expect((prisma as any).socialPost.delete).toHaveBeenCalledWith({ where: { id: "post-1" } });
    expect(mockUnlink).toHaveBeenCalledWith(join(socialDir, "abc-123.webp"));
    expect((prisma as any).auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: "admin-1",
          action: "SOCIAL_POST_REMOVED",
          targetType: "SocialPost",
          targetId: "post-1",
        }),
      }),
    );
  });

  it("adminRemovePost 404s a missing post and never deletes or unlinks", async () => {
    const prisma = {
      socialPost: { findUnique: jest.fn().mockResolvedValue(null), delete: jest.fn() },
      auditLog: { create: jest.fn() },
    } as never;

    await expect(
      new SocialService(prisma, moderationPass).adminRemovePost("admin-1", "ghost"),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect((prisma as any).socialPost.delete).not.toHaveBeenCalled();
    expect(mockUnlink).not.toHaveBeenCalled();
  });

  it("adminRemovePost still resolves when the file is already gone (unlink rejects)", async () => {
    mockUnlink.mockRejectedValueOnce(new Error("ENOENT"));
    const prisma = {
      socialPost: {
        findUnique: jest.fn().mockResolvedValue({ id: "p1", companyId: "c1", imageUrl: "x/uploads/social/gone.webp" }),
        delete: jest.fn().mockResolvedValue({}),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    } as never;

    await expect(new SocialService(prisma, moderationPass).adminRemovePost("admin-1", "p1")).resolves.toEqual({
      success: true,
    });
  });

  it("adminWipeCompanyFeed deletes every post for the company, unlinks each file, returns the count", async () => {
    const prisma = {
      socialPost: {
        findMany: jest.fn().mockResolvedValue([
          { id: "p1", imageUrl: "http://localhost:3011/uploads/social/one.webp" },
          { id: "p2", imageUrl: "http://localhost:3011/uploads/social/two.webp" },
        ]),
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    } as never;

    const result = await new SocialService(prisma, moderationPass).adminWipeCompanyFeed("admin-1", "c1");

    expect(result).toEqual({ deletedCount: 2 });
    expect((prisma as any).socialPost.deleteMany).toHaveBeenCalledWith({ where: { companyId: "c1" } });
    expect(mockUnlink).toHaveBeenCalledTimes(2);
    expect(mockUnlink).toHaveBeenCalledWith(join(socialDir, "one.webp"));
    expect(mockUnlink).toHaveBeenCalledWith(join(socialDir, "two.webp"));
    expect((prisma as any).auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: "admin-1",
          action: "SOCIAL_FEED_WIPED",
          targetType: "Company",
          targetId: "c1",
        }),
      }),
    );
  });

  it("adminWipeCompanyFeed on an empty feed returns { deletedCount: 0 } without unlinking, still calls deleteMany", async () => {
    const prisma = {
      socialPost: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    } as never;

    const result = await new SocialService(prisma, moderationPass).adminWipeCompanyFeed("admin-1", "c1");

    expect(result).toEqual({ deletedCount: 0 });
    expect((prisma as any).socialPost.deleteMany).toHaveBeenCalledWith({ where: { companyId: "c1" } });
    expect(mockUnlink).not.toHaveBeenCalled();
  });
});

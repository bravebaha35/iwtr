import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { SocialService } from "../social.service";

jest.mock("../social-image.util", () => ({
  processSocialImage: jest.fn().mockResolvedValue(Buffer.alloc(64, 9)),
  SOCIAL_IMAGE_OUTPUT_MAX_WIDTH_PX: 1080,
}));

// Keep the "happy path" test hermetic - no real mkdir/writeFile into
// apps/api/uploads/social/ (Ruling C). The other three cases reject before
// the write is ever reached.
jest.mock("fs/promises", () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

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
    (prisma as any).company = { findUnique: jest.fn().mockResolvedValue({ id: "c1" }) };
    const page = await new SocialService(prisma, moderationPass).companyFeed(undefined, "acme", {});
    expect((prisma as any).company.findUnique).toHaveBeenCalledWith({ where: { slug: "acme" }, select: { id: true } });
    expect(page.posts.map((p) => p.id)).toEqual(["p2", "p1"]);
  });

  it("companyFeed 404s on an unknown slug", async () => {
    const prisma = feedPrisma();
    (prisma as any).company = { findUnique: jest.fn().mockResolvedValue(null) };
    await expect(
      new SocialService(prisma, moderationPass).companyFeed(undefined, "ghost", {}),
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
});

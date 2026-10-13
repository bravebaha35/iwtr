import { join } from "path";
import { unlink } from "fs/promises";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { SocialService } from "../social.service";
import { ModerationService } from "../../moderation/moderation.service";
import { encryptField, generateDek, wrapDek } from "../../employer-profile/crypto.util";

jest.mock("../social-image.util", () => ({
  processSocialImage: jest.fn().mockResolvedValue({ webp: Buffer.alloc(64, 9), aspectRatio: 1.5 }),
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
    await expect(new SocialService(prisma, moderationPass).createPost("u1", { companyId: CID }, [jpegFile])).rejects.toBeInstanceOf(
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
      new SocialService(prisma, moderationFail).createPost("u1", { companyId: CID, caption: "call Ahmet Yilmaz" }, [jpegFile]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects when no files are attached", async () => {
    const prisma = makePrisma();
    (prisma as any).companyOwner.findUnique.mockResolvedValue({ claimStatus: "APPROVED" });
    await expect(new SocialService(prisma, moderationPass).createPost("u1", { companyId: CID }, undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(new SocialService(prisma, moderationPass).createPost("u1", { companyId: CID }, [])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("creates a post for an approved owner with a clean caption", async () => {
    const prisma = makePrisma();
    (prisma as any).companyOwner.findUnique.mockResolvedValue({ claimStatus: "APPROVED" });
    const result = await new SocialService(prisma, moderationPass).createPost("u1", { companyId: CID, caption: "new office" }, [jpegFile]);
    expect(result).toEqual({ id: "post-1" });
    expect((prisma as any).socialPost.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ companyId: CID, authorUserId: "u1", caption: "new office" }) }),
    );
  });

  it("builds imageUrls with one entry per uploaded file, in order", async () => {
    const prisma = makePrisma();
    (prisma as any).companyOwner.findUnique.mockResolvedValue({ claimStatus: "APPROVED" });
    await new SocialService(prisma, moderationPass).createPost("u1", { companyId: CID }, [jpegFile, jpegFile, jpegFile]);
    const data = (prisma as any).socialPost.create.mock.calls[0][0].data;
    expect(data.imageUrls).toHaveLength(3);
    expect(data.imageUrls.every((u: string) => typeof u === "string" && u.length > 0)).toBe(true);
  });

  it("stores a whitespace-only caption as null", async () => {
    const prisma = makePrisma();
    (prisma as any).companyOwner.findUnique.mockResolvedValue({ claimStatus: "APPROVED" });
    await new SocialService(prisma, moderationPass).createPost("u1", { companyId: CID, caption: "" }, [jpegFile]);
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
      [jpegFile],
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
      [jpegFile],
    );
    expect(ok).toEqual({ id: "post-1" });

    const caps = await new SocialService(prisma, moderation).createPost(
      "u1",
      { companyId: CID, caption: "GRAND OPENING THIS SATURDAY COME AND SEE US" },
      [jpegFile],
    );
    expect(caps).toEqual({ id: "post-1" });

    await expect(
      new SocialService(prisma, moderation).createPost(
        "u1",
        { companyId: CID, caption: "this new place is shit" },
        [jpegFile],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("SocialService.feed", () => {
  const now = Date.now();
  const rows = [
    { id: "p2", companyId: "c1", imageUrls: ["/u/2.webp"], caption: null, createdAt: new Date(now - 1000),
      company: { slug: "acme", name: "Acme", mainPhotoUrl: null, badgeTier: "FREE" } },
    { id: "p1", companyId: "c1", imageUrls: ["/u/1.webp"], caption: "hi", createdAt: new Date(now - 2000),
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
      companyOwner: { findMany: jest.fn().mockResolvedValue([]) },
    } as never;
  }

  it("marks a post manageable only for an approved owner of its company, and never for an anonymous viewer", async () => {
    const prisma = feedPrisma();
    (prisma as any).companyOwner.findMany.mockResolvedValue([{ companyId: "c1" }]);
    const asOwner = await new SocialService(prisma, moderationPass).feed("owner-1", {});
    expect(asOwner.posts.every((p) => p.canManage)).toBe(true);
    expect((prisma as any).companyOwner.findMany).toHaveBeenCalledWith({
      where: { userId: "owner-1", companyId: { in: ["c1"] }, claimStatus: "APPROVED" },
      select: { companyId: true },
    });

    const anonymous = await new SocialService(feedPrisma(), moderationPass).feed(undefined, {});
    expect(anonymous.posts.some((p) => p.canManage)).toBe(false);
  });

  it("sends a post's view count to an owner of its company and to nobody else", async () => {
    const withViews = rows.map((r, i) => ({ ...r, viewCount: 40 + i }));
    const owned = feedPrisma();
    (owned as any).socialPost.findMany.mockResolvedValue(withViews);
    (owned as any).companyOwner.findMany.mockResolvedValue([{ companyId: "c1" }]);
    const asOwner = await new SocialService(owned, moderationPass).feed("owner-1", {});
    expect(asOwner.posts.map((p) => p.viewCount)).toEqual([40, 41]);

    const other = feedPrisma();
    (other as any).socialPost.findMany.mockResolvedValue(withViews);
    const asMember = await new SocialService(other, moderationPass).feed("member-1", {});
    expect(asMember.posts.map((p) => p.viewCount)).toEqual([null, null]);
    const anonymous = await new SocialService(other, moderationPass).feed(undefined, {});
    expect(anonymous.posts.map((p) => p.viewCount)).toEqual([null, null]);
  });

  it("the Following tab keeps only companies the caller follows, and is empty for a logged-out caller", async () => {
    const prisma = feedPrisma();
    await new SocialService(prisma, moderationPass).feed("viewer-1", { following: true });
    expect((prisma as any).socialPost.findMany.mock.calls[0][0].where.company.followers).toEqual({ some: { userId: "viewer-1" } });

    const anonPrisma = feedPrisma();
    const page = await new SocialService(anonPrisma, moderationPass).feed(undefined, { following: true });
    expect(page).toEqual({ posts: [], nextCursor: null });
    expect((anonPrisma as any).socialPost.findMany).not.toHaveBeenCalled();
  });

  it("returns posts newest-first with counts, nextCursor null on a short page, likedByMe null when anonymous", async () => {
    const page = await new SocialService(feedPrisma(), moderationPass).feed(undefined, {});
    expect(page.posts.map((p) => p.id)).toEqual(["p2", "p1"]);
    expect(page.posts.find((p) => p.id === "p1")?.likeCount).toBe(5);
    expect(page.posts.find((p) => p.id === "p1")?.commentCount).toBe(3);
    expect(page.posts[0].likedByMe).toBeNull();
    expect(page.posts[0].imageUrls).toEqual(["/u/2.webp"]);
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
      id: `x${i}`, companyId: "c1", imageUrls: [`/u/${i}.webp`], caption: null, createdAt: new Date(now - i * 1000),
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

  it("serializes a comment with the author's anonymous handle, never their userId, with zero votes", async () => {
    const created = {
      id: "cm1", postId: "p1", body: "nice", createdAt: new Date(), authorUserId: "u1",
      identityMode: "PERSONAL_CHOSEN", randomUsername: null,
    };
    const prisma = {
      socialPost: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) },
      socialComment: { create: jest.fn().mockResolvedValue(created), groupBy: jest.fn().mockResolvedValue([]) },
      socialCommentVote: {
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
      },
      socialCommentIdentityLock: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ role: "MEMBER" }),
        findMany: jest.fn().mockResolvedValue([
          { id: "u1", avatarKey: "office_1", avatarGradient: "dawn", reviewUsername: "Spreadsheet Spelunker" },
        ]),
      },
    } as never;
    const out = await new SocialService(prisma, moderationPass).addComment("u1", "p1", { body: "nice" });
    expect(out).toMatchObject({
      id: "cm1", body: "nice", displayUsername: "Spreadsheet Spelunker", avatarKey: "office_1", mine: true,
      helpfulCount: 0, notHelpfulCount: 0, myVote: null,
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

  it("listComments returns oldest-first, mine:false for an anonymous viewer, no userId, myVote null", async () => {
    const rows = [
      { id: "cm1", postId: "p1", body: "first", createdAt: new Date(1), authorUserId: "u1" },
      { id: "cm2", postId: "p1", body: "second", createdAt: new Date(2), authorUserId: "u2" },
    ];
    const prisma = {
      socialPost: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) },
      socialComment: { findMany: jest.fn().mockResolvedValue(rows), groupBy: jest.fn().mockResolvedValue([]) },
      socialCommentVote: {
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: { findMany: jest.fn().mockResolvedValue([
        { id: "u1", avatarKey: "a1", avatarGradient: "g1", reviewUsername: "One" },
        { id: "u2", avatarKey: "a2", avatarGradient: "g2", reviewUsername: "Two" },
      ]) },
    } as never;
    const out = await new SocialService(prisma, moderationPass).listComments(undefined, "p1");
    expect(out.map((c) => c.id)).toEqual(["cm1", "cm2"]);
    expect(out.every((c) => c.mine === false)).toBe(true);
    expect(out.every((c) => c.myVote === null)).toBe(true);
    expect(out.every((c) => !("authorUserId" in c) && !("userId" in c))).toBe(true);
  });

  it("listComments tallies helpful/not-helpful counts and the viewer's own vote per comment", async () => {
    const rows = [
      { id: "cm1", postId: "p1", body: "first", createdAt: new Date(1), authorUserId: "u1" },
      { id: "cm2", postId: "p1", body: "second", createdAt: new Date(2), authorUserId: "u2" },
    ];
    const prisma = {
      socialPost: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) },
      socialComment: { findMany: jest.fn().mockResolvedValue(rows), groupBy: jest.fn().mockResolvedValue([]) },
      socialCommentVote: {
        groupBy: jest.fn().mockImplementation(({ where }: any) => {
          if (where.value === 1) return Promise.resolve([{ commentId: "cm1", _count: { _all: 4 } }]);
          return Promise.resolve([{ commentId: "cm2", _count: { _all: 2 } }]);
        }),
        findMany: jest.fn().mockResolvedValue([{ commentId: "cm1", value: 1 }]),
      },
      user: { findMany: jest.fn().mockResolvedValue([
        { id: "u1", avatarKey: "a1", avatarGradient: "g1", reviewUsername: "One" },
        { id: "u2", avatarKey: "a2", avatarGradient: "g2", reviewUsername: "Two" },
      ]) },
    } as never;
    const out = await new SocialService(prisma, moderationPass).listComments("viewer-1", "p1");
    const cm1 = out.find((c) => c.id === "cm1")!;
    const cm2 = out.find((c) => c.id === "cm2")!;
    expect(cm1).toMatchObject({ helpfulCount: 4, notHelpfulCount: 0, myVote: 1 });
    expect(cm2).toMatchObject({ helpfulCount: 0, notHelpfulCount: 2, myVote: null });
  });

  it("serializes a deleted author's comment with a null identity and never a userId key", async () => {
    const rows = [
      { id: "cm1", postId: "p1", body: "kept", createdAt: new Date(1), authorUserId: null },
      { id: "cm2", postId: "p1", body: "mine", createdAt: new Date(2), authorUserId: "viewer-1" },
    ];
    const prisma = {
      socialPost: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) },
      socialComment: { findMany: jest.fn().mockResolvedValue(rows), groupBy: jest.fn().mockResolvedValue([]) },
      socialCommentVote: {
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
      },
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

  const likePrisma = (like: Record<string, jest.Mock>) =>
    ({ socialPost: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) }, socialPostLike: like }) as never;

  it("toggleLike adds a plain like, then the same click takes it off", async () => {
    const like = { findUnique: jest.fn(), delete: jest.fn(), create: jest.fn(), update: jest.fn(), groupBy: jest.fn() };

    like.findUnique.mockResolvedValueOnce(null);
    like.groupBy.mockResolvedValue([{ reaction: "LIKE", _count: { _all: 1 } }]);
    const r1 = await new SocialService(likePrisma(like), moderationPass).toggleLike("u1", "p1");
    expect(r1).toEqual({
      postId: "p1", likeCount: 1, likedByMe: true, myReaction: "LIKE", reactionCounts: { LIKE: 1, WELL_DONE: 0, CURIOUS: 0 },
    });
    expect(like.create).toHaveBeenCalledWith({ data: { postId: "p1", userId: "u1", reaction: "LIKE" } });

    like.findUnique.mockResolvedValueOnce({ id: "like-1", reaction: "LIKE" });
    like.groupBy.mockResolvedValue([]);
    const r2 = await new SocialService(likePrisma(like), moderationPass).toggleLike("u1", "p1");
    expect(r2).toMatchObject({ likeCount: 0, likedByMe: false, myReaction: null });
    expect(like.delete).toHaveBeenCalledWith({ where: { id: "like-1" } });
  });

  it("a different reaction replaces the one already left - still one per member", async () => {
    const like = {
      findUnique: jest.fn().mockResolvedValue({ id: "like-1", reaction: "LIKE" }),
      delete: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([
        { reaction: "WELL_DONE", _count: { _all: 1 } },
        { reaction: "CURIOUS", _count: { _all: 2 } },
      ]),
    };
    const r = await new SocialService(likePrisma(like), moderationPass).toggleLike("u1", "p1", "WELL_DONE");
    expect(like.update).toHaveBeenCalledWith({ where: { id: "like-1" }, data: { reaction: "WELL_DONE" } });
    expect(like.create).not.toHaveBeenCalled();
    expect(like.delete).not.toHaveBeenCalled();
    expect(r).toMatchObject({ likeCount: 3, myReaction: "WELL_DONE", reactionCounts: { LIKE: 0, WELL_DONE: 1, CURIOUS: 2 } });
  });

  it("toggleLike swallows a concurrent-create P2002 and reports now-liked", async () => {
    const like = {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" }),
      ),
      groupBy: jest.fn().mockResolvedValue([{ reaction: "LIKE", _count: { _all: 1 } }]),
      delete: jest.fn(),
    };
    const r = await new SocialService(likePrisma(like), moderationPass).toggleLike("u1", "p1");
    expect(r).toMatchObject({ postId: "p1", likeCount: 1, likedByMe: true });
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

describe("SocialService.voteComment", () => {
  it("casts Helpful, then casting Helpful again removes it", async () => {
    const vote = { findUnique: jest.fn(), delete: jest.fn(), update: jest.fn(), create: jest.fn() };
    const prisma = {
      socialComment: { findUnique: jest.fn().mockResolvedValue({ id: "cm1" }) },
      socialCommentVote: {
        ...vote,
        count: jest.fn(),
      },
    } as never;

    (prisma as any).socialCommentVote.findUnique.mockResolvedValueOnce(null);
    (prisma as any).socialCommentVote.count.mockImplementation(({ where }: any) =>
      Promise.resolve(where.value === 1 ? 1 : 0),
    );
    const r1 = await new SocialService(prisma, moderationPass).voteComment("u1", "cm1", 1);
    expect(r1).toEqual({ commentId: "cm1", helpfulCount: 1, notHelpfulCount: 0, myVote: 1 });
    expect((prisma as any).socialCommentVote.create).toHaveBeenCalledWith({ data: { commentId: "cm1", userId: "u1", value: 1 } });

    (prisma as any).socialCommentVote.findUnique.mockResolvedValueOnce({ id: "v1", value: 1 });
    (prisma as any).socialCommentVote.count.mockResolvedValue(0);
    const r2 = await new SocialService(prisma, moderationPass).voteComment("u1", "cm1", 1);
    expect(r2).toEqual({ commentId: "cm1", helpfulCount: 0, notHelpfulCount: 0, myVote: null });
    expect((prisma as any).socialCommentVote.delete).toHaveBeenCalledWith({ where: { id: "v1" } });
  });

  it("switching from Helpful to Not Helpful updates the existing row's value", async () => {
    const prisma = {
      socialComment: { findUnique: jest.fn().mockResolvedValue({ id: "cm1" }) },
      socialCommentVote: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: "v1", value: 1 })
          .mockResolvedValueOnce({ id: "v1", value: -1 }),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(where.value === -1 ? 1 : 0)),
      },
    } as never;
    const r = await new SocialService(prisma, moderationPass).voteComment("u1", "cm1", -1);
    expect((prisma as any).socialCommentVote.update).toHaveBeenCalledWith({ where: { id: "v1" }, data: { value: -1 } });
    expect(r).toEqual({ commentId: "cm1", helpfulCount: 0, notHelpfulCount: 1, myVote: -1 });
  });

  it("404s on an unknown comment", async () => {
    const prisma = { socialComment: { findUnique: jest.fn().mockResolvedValue(null) } } as never;
    await expect(new SocialService(prisma, moderationPass).voteComment("u1", "ghost", 1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("swallows a concurrent-create P2002 and still returns fresh counts", async () => {
    const prisma = {
      socialComment: { findUnique: jest.fn().mockResolvedValue({ id: "cm1" }) },
      socialCommentVote: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" }),
        ),
        count: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(where.value === 1 ? 1 : 0)),
      },
    } as never;
    const r = await new SocialService(prisma, moderationPass).voteComment("u1", "cm1", 1);
    expect(r).toEqual({ commentId: "cm1", helpfulCount: 1, notHelpfulCount: 0, myVote: null });
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

  it("passes a narrow categoryGroup as an exact-match category filter on the company", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      socialPost: { findMany },
      socialPostLike: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
      socialComment: { groupBy: jest.fn().mockResolvedValue([]) },
      savedPost: { findMany: jest.fn().mockResolvedValue([]) },
    } as never;
    await new SocialService(prisma, moderationPass).feed(undefined, { categoryGroup: "SUPERMARKET" });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          company: expect.objectContaining({ category: "Supermarket" }),
        }),
      }),
    );
  });

  it("passes the FIRMS categoryGroup as a notIn filter excluding every narrow bucket", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      socialPost: { findMany },
      socialPostLike: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
      socialComment: { groupBy: jest.fn().mockResolvedValue([]) },
      savedPost: { findMany: jest.fn().mockResolvedValue([]) },
    } as never;
    await new SocialService(prisma, moderationPass).feed(undefined, { categoryGroup: "FIRMS" });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          company: expect.objectContaining({
            category: { notIn: ["Supermarket", "Franchise", "Logistics", "Clothing Retail", "Telecom", "Fuel & Energy"] },
          }),
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
          id: "p1", companyId: "c1", imageUrls: ["/u/1.webp"], caption: null, createdAt: new Date("2020-01-01"),
          company: { slug: "acme", name: "Acme", mainPhotoUrl: null, badgeTier: "FREE" },
        },
      },
    ]);
    const prisma = {
      savedPost: { findMany },
      socialPostLike: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
      socialComment: { groupBy: jest.fn().mockResolvedValue([]) },
      companyOwner: { findMany: jest.fn().mockResolvedValue([]) },
    } as never;

    const page = await new SocialService(prisma, moderationPass).listSavedPosts("u1", undefined);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1", post: { company: expect.objectContaining({ hiddenAt: null }) } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
    expect(page.posts.map((p) => p.id)).toEqual(["p1"]);
    expect(page.posts[0].imageUrls).toEqual(["/u/1.webp"]);
  });
});

describe("SocialService admin moderation", () => {
  const socialDir = join(process.cwd(), "uploads", "social");

  beforeEach(() => {
    mockUnlink.mockClear();
  });

  it("adminRemovePost deletes the post, unlinks every WebP file, writes a SOCIAL_POST_REMOVED audit log", async () => {
    const prisma = {
      socialPost: {
        findUnique: jest.fn().mockResolvedValue({
          id: "post-1",
          companyId: "c1",
          imageUrls: [
            "http://localhost:3011/uploads/social/abc-123.webp",
            "http://localhost:3011/uploads/social/def-456.webp",
          ],
        }),
        delete: jest.fn().mockResolvedValue({}),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    } as never;

    const result = await new SocialService(prisma, moderationPass).adminRemovePost("admin-1", "post-1");

    expect(result).toEqual({ success: true });
    expect((prisma as any).socialPost.delete).toHaveBeenCalledWith({ where: { id: "post-1" } });
    expect(mockUnlink).toHaveBeenCalledWith(join(socialDir, "abc-123.webp"));
    expect(mockUnlink).toHaveBeenCalledWith(join(socialDir, "def-456.webp"));
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

  it("adminRemovePost still resolves when a file is already gone (unlink rejects)", async () => {
    mockUnlink.mockRejectedValueOnce(new Error("ENOENT"));
    const prisma = {
      socialPost: {
        findUnique: jest.fn().mockResolvedValue({ id: "p1", companyId: "c1", imageUrls: ["x/uploads/social/gone.webp"] }),
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
          { id: "p1", imageUrls: ["http://localhost:3011/uploads/social/one.webp"] },
          { id: "p2", imageUrls: ["http://localhost:3011/uploads/social/two.webp", "http://localhost:3011/uploads/social/three.webp"] },
        ]),
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    } as never;

    const result = await new SocialService(prisma, moderationPass).adminWipeCompanyFeed("admin-1", "c1");

    expect(result).toEqual({ deletedCount: 2 });
    expect((prisma as any).socialPost.deleteMany).toHaveBeenCalledWith({ where: { companyId: "c1" } });
    expect(mockUnlink).toHaveBeenCalledTimes(3);
    expect(mockUnlink).toHaveBeenCalledWith(join(socialDir, "one.webp"));
    expect(mockUnlink).toHaveBeenCalledWith(join(socialDir, "two.webp"));
    expect(mockUnlink).toHaveBeenCalledWith(join(socialDir, "three.webp"));
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

describe("SocialService comment identity (2026-09-11)", () => {
  const commentBase = { id: "cm1", postId: "p1", body: "nice", createdAt: new Date() };

  it("a COMPANY_OWNER always posts as OWNER_REAL_NAME regardless of what the client requests", async () => {
    const created = { ...commentBase, authorUserId: "owner-1", identityMode: "OWNER_REAL_NAME", randomUsername: null };
    const dek = generateDek();
    const prisma = {
      socialPost: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) },
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ role: "COMPANY_OWNER" }), findMany: jest.fn().mockResolvedValue([]) },
      employerProfile: {
        findUnique: jest.fn().mockResolvedValue({
          encFirstName: encryptField("Ahmet", dek),
          encLastName: encryptField("Yilmaz", dek),
          profilePictureUrl: null,
          dekWrapped: wrapDek(dek),
        }),
        findMany: jest.fn().mockResolvedValue([{ userId: "owner-1", encFirstName: encryptField("Ahmet", dek), encLastName: encryptField("Yilmaz", dek), profilePictureUrl: null, dekWrapped: wrapDek(dek) }]),
      },
      socialComment: { create: jest.fn().mockResolvedValue(created), groupBy: jest.fn().mockResolvedValue([]) },
      socialCommentVote: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
    } as never;
    const out = await new SocialService(prisma, moderationPass).addComment("owner-1", "p1", {
      body: "nice",
      identityMode: "PERSONAL_RANDOM",
    });
    expect((prisma as any).socialComment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ identityMode: "OWNER_REAL_NAME", randomUsername: null }) }),
    );
    expect(out.identityMode).toBe("OWNER_REAL_NAME");
    expect(out.displayUsername).toBe("Ahmet Yilmaz");
  });

  it("blocks a COMPANY_OWNER from commenting until their employer profile name is filled in", async () => {
    const prisma = {
      socialPost: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) },
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ role: "COMPANY_OWNER" }), findMany: jest.fn().mockResolvedValue([]) },
      employerProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    } as never;
    await expect(
      new SocialService(prisma, moderationPass).addComment("owner-1", "p1", { body: "nice" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("a MEMBER's first comment on a post locks their identity for that post", async () => {
    const created = { ...commentBase, authorUserId: "u1", identityMode: "PERSONAL_CHOSEN", randomUsername: null };
    const lockCreate = jest.fn().mockResolvedValue({});
    const prisma = {
      socialPost: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) },
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ role: "MEMBER" }),
        findMany: jest.fn().mockResolvedValue([{ id: "u1", avatarKey: "a", avatarGradient: "g", reviewUsername: "Spreadsheet Spelunker" }]),
      },
      socialCommentIdentityLock: { findUnique: jest.fn().mockResolvedValue(null), create: lockCreate },
      socialComment: { create: jest.fn().mockResolvedValue(created), groupBy: jest.fn().mockResolvedValue([]) },
      socialCommentVote: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
    } as never;
    await new SocialService(prisma, moderationPass).addComment("u1", "p1", { body: "nice", identityMode: "PERSONAL_CHOSEN" });
    expect(lockCreate).toHaveBeenCalledWith({ data: { postId: "p1", userId: "u1", identityMode: "PERSONAL_CHOSEN" } });
  });

  it("a second comment requesting a DIFFERENT identity than the post's existing lock is rejected", async () => {
    const prisma = {
      socialPost: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) },
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ role: "MEMBER" }) },
      socialCommentIdentityLock: {
        findUnique: jest.fn().mockResolvedValue({ identityMode: "PERSONAL_CHOSEN", randomUsername: null }),
      },
    } as never;
    await expect(
      new SocialService(prisma, moderationPass).addComment("u1", "p1", { body: "nice", identityMode: "PERSONAL_RANDOM" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("a second comment matching the post's existing lock succeeds and reuses the locked random identity", async () => {
    const created = { ...commentBase, authorUserId: "u1", identityMode: "PERSONAL_RANDOM", randomUsername: "Coffee Machine Whisperer" };
    const prisma = {
      socialPost: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) },
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ role: "MEMBER" }), findMany: jest.fn().mockResolvedValue([]) },
      socialCommentIdentityLock: {
        findUnique: jest.fn().mockResolvedValue({ identityMode: "PERSONAL_RANDOM", randomUsername: "Coffee Machine Whisperer" }),
      },
      socialComment: { create: jest.fn().mockResolvedValue(created), groupBy: jest.fn().mockResolvedValue([]) },
      socialCommentVote: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
    } as never;
    const out = await new SocialService(prisma, moderationPass).addComment("u1", "p1", { body: "nice", identityMode: "PERSONAL_RANDOM" });
    expect((prisma as any).socialComment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ identityMode: "PERSONAL_RANDOM", randomUsername: "Coffee Machine Whisperer" }),
      }),
    );
    expect(out.displayUsername).toBe("Coffee Machine Whisperer");
    expect(out.avatarKey).toBe("randomized_identity");
  });

  it("a MEMBER can never request OWNER_REAL_NAME", async () => {
    const prisma = {
      socialPost: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) },
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ role: "MEMBER" }) },
    } as never;
    await expect(
      new SocialService(prisma, moderationPass).addComment("u1", "p1", { body: "nice", identityMode: "OWNER_REAL_NAME" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("SocialService.registerReport (2026-09-11)", () => {
  it("refuses to let the author report their own comment", async () => {
    const prisma = { socialComment: { findUnique: jest.fn().mockResolvedValue({ id: "cm1", authorUserId: "u1", body: "x", flaggedForReview: false }) } } as never;
    await expect(
      new SocialService(prisma, moderationPass).registerReport("u1", "cm1", { reason: "CURSE_WORDS" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("404s on an unknown comment", async () => {
    const prisma = { socialComment: { findUnique: jest.fn().mockResolvedValue(null) } } as never;
    await expect(
      new SocialService(prisma, moderationPass).registerReport("u1", "ghost", { reason: "CURSE_WORDS" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("below the 3-report threshold: counts the report, never runs the content check", async () => {
    const checkContent = jest.fn();
    const prisma = {
      socialComment: {
        findUnique: jest.fn().mockResolvedValue({ id: "cm1", authorUserId: "other", body: "HR could be better", flaggedForReview: false }),
        update: jest.fn(),
      },
      socialCommentReport: { create: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(2) },
    } as never;
    const result = await new SocialService(prisma, { checkContent } as never).registerReport("u1", "cm1", { reason: "CURSE_WORDS" });
    expect(result).toEqual({ commentId: "cm1", reportCount: 2 });
    expect(checkContent).not.toHaveBeenCalled();
    expect((prisma as any).socialComment.update).not.toHaveBeenCalled();
  });

  it("crossing 3 reports with a real violation flags the comment for admin review (never auto-deletes)", async () => {
    const del = jest.fn();
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      socialComment: {
        findUnique: jest.fn().mockResolvedValue({ id: "cm1", authorUserId: "other", body: "CEO Ahmet Yilmaz is terrible", flaggedForReview: false }),
        update,
        delete: del,
      },
      socialCommentReport: { create: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(3) },
    } as never;
    const moderation = new ModerationService() as never;
    const result = await new SocialService(prisma, moderation).registerReport("u1", "cm1", { reason: "THREAT_ABUSE" });
    expect(result).toEqual({ commentId: "cm1", reportCount: 3 });
    expect(update).toHaveBeenCalledWith({
      where: { id: "cm1" },
      data: expect.objectContaining({ flaggedForReview: true }),
    });
    expect(del).not.toHaveBeenCalled();
  });

  it("crossing 3 reports with clean content does not flag anything", async () => {
    const update = jest.fn();
    const prisma = {
      socialComment: {
        findUnique: jest.fn().mockResolvedValue({ id: "cm1", authorUserId: "other", body: "great place to work", flaggedForReview: false }),
        update,
      },
      socialCommentReport: { create: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(4) },
    } as never;
    const moderation = new ModerationService() as never;
    await new SocialService(prisma, moderation).registerReport("u1", "cm1", { reason: "CURSE_WORDS" });
    expect(update).not.toHaveBeenCalled();
  });

  it("already-flagged comments don't get re-checked on further reports", async () => {
    const checkContent = jest.fn();
    const prisma = {
      socialComment: {
        findUnique: jest.fn().mockResolvedValue({ id: "cm1", authorUserId: "other", body: "x", flaggedForReview: true }),
        update: jest.fn(),
      },
      socialCommentReport: { create: jest.fn().mockResolvedValue({}), count: jest.fn().mockResolvedValue(5) },
    } as never;
    await new SocialService(prisma, { checkContent } as never).registerReport("u1", "cm1", { reason: "DISREGARD_ANONYMITY" });
    expect(checkContent).not.toHaveBeenCalled();
  });

  it("a repeat report from the same user doesn't double-count (P2002 swallowed)", async () => {
    const prisma = {
      socialComment: {
        findUnique: jest.fn().mockResolvedValue({ id: "cm1", authorUserId: "other", body: "x", flaggedForReview: false }),
      },
      socialCommentReport: {
        create: jest.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" })),
        count: jest.fn().mockResolvedValue(1),
      },
    } as never;
    const result = await new SocialService(prisma, moderationPass).registerReport("u1", "cm1", { reason: "CURSE_WORDS" });
    expect(result).toEqual({ commentId: "cm1", reportCount: 1 });
  });
});

describe("SocialService admin report handling (2026-09-11)", () => {
  it("listReportedComments returns reported comments, flagged-first, without author identity", async () => {
    const rows = [
      { id: "cm1", postId: "p1", body: "a", createdAt: new Date(1), flaggedForReview: false, flaggedReviewReason: null, _count: { reports: 2 } },
      { id: "cm2", postId: "p1", body: "b", createdAt: new Date(2), flaggedForReview: true, flaggedReviewReason: "JOB_TITLE", _count: { reports: 3 } },
    ];
    const findMany = jest.fn().mockResolvedValue(rows);
    const groupBy = jest.fn().mockResolvedValue([
      { commentId: "cm1", reason: "CURSE_WORDS", _count: { _all: 2 } },
      { commentId: "cm2", reason: "THREAT_ABUSE", _count: { _all: 2 } },
      { commentId: "cm2", reason: null, _count: { _all: 1 } },
    ]);
    const prisma = { socialComment: { findMany }, socialCommentReport: { groupBy } } as never;
    const out = await new SocialService(prisma, moderationPass).listReportedComments();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ flaggedForReview: "desc" }, { createdAt: "desc" }] }),
    );
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ by: ["commentId", "reason"], where: { commentId: { in: ["cm1", "cm2"] } } }),
    );
    expect(out).toEqual([
      {
        id: "cm1",
        postId: "p1",
        body: "a",
        createdAt: rows[0].createdAt.toISOString(),
        reportCount: 2,
        reportReasonCounts: { CURSE_WORDS: 2 },
        flaggedForReview: false,
        flaggedReviewReason: null,
      },
      {
        id: "cm2",
        postId: "p1",
        body: "b",
        createdAt: rows[1].createdAt.toISOString(),
        reportCount: 3,
        reportReasonCounts: { THREAT_ABUSE: 2, UNSPECIFIED: 1 },
        flaggedForReview: true,
        flaggedReviewReason: "JOB_TITLE",
      },
    ]);
    expect(out.every((c) => !("authorUserId" in c))).toBe(true);
  });

  it("listReportedComments skips the groupBy query when there are no reported comments", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const groupBy = jest.fn();
    const prisma = { socialComment: { findMany }, socialCommentReport: { groupBy } } as never;
    const out = await new SocialService(prisma, moderationPass).listReportedComments();
    expect(out).toEqual([]);
    expect(groupBy).not.toHaveBeenCalled();
  });

  it("adminDismissReport clears the flag without deleting the comment", async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = { socialComment: { findUnique: jest.fn().mockResolvedValue({ id: "cm1" }), update } } as never;
    const result = await new SocialService(prisma, moderationPass).adminDismissReport("cm1");
    expect(update).toHaveBeenCalledWith({ where: { id: "cm1" }, data: { flaggedForReview: false, flaggedReviewReason: null } });
    expect(result).toEqual({ success: true });
  });

  it("adminDismissReport 404s on an unknown comment", async () => {
    const prisma = { socialComment: { findUnique: jest.fn().mockResolvedValue(null) } } as never;
    await expect(new SocialService(prisma, moderationPass).adminDismissReport("ghost")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("adminRemoveComment deletes the comment and writes a SOCIAL_COMMENT_REMOVED audit log", async () => {
    const del = jest.fn().mockResolvedValue({});
    const auditCreate = jest.fn().mockResolvedValue({});
    const prisma = {
      socialComment: { findUnique: jest.fn().mockResolvedValue({ id: "cm1", postId: "p1" }), delete: del },
      auditLog: { create: auditCreate },
    } as never;
    const result = await new SocialService(prisma, moderationPass).adminRemoveComment("admin-1", "cm1");
    expect(del).toHaveBeenCalledWith({ where: { id: "cm1" } });
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actorUserId: "admin-1", action: "SOCIAL_COMMENT_REMOVED", targetType: "SocialComment", targetId: "cm1" }),
      }),
    );
    expect(result).toEqual({ success: true });
  });

  it("adminRemoveComment 404s on an unknown comment", async () => {
    const prisma = { socialComment: { findUnique: jest.fn().mockResolvedValue(null) } } as never;
    await expect(new SocialService(prisma, moderationPass).adminRemoveComment("admin-1", "ghost")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("SocialService.addReply / listReplies (2026-09-11)", () => {
  it("addReply 404s on an unknown parent comment", async () => {
    const prisma = { socialComment: { findUnique: jest.fn().mockResolvedValue(null) } } as never;
    await expect(
      new SocialService(prisma, moderationPass).addReply("u1", "ghost", { body: "nice" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("addReply refuses to reply to a reply (capped at one level)", async () => {
    const prisma = {
      socialComment: {
        findUnique: jest.fn().mockResolvedValue({ id: "reply-1", postId: "p1", parentCommentId: "cm1" }),
      },
    } as never;
    await expect(
      new SocialService(prisma, moderationPass).addReply("u1", "reply-1", { body: "nice" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("addReply on a real top-level comment creates a reply row with parentCommentId set", async () => {
    const createdReply = {
      id: "reply-1", postId: "p1", parentCommentId: "cm1", body: "totally agree", createdAt: new Date(),
      authorUserId: "u1", identityMode: "PERSONAL_CHOSEN", randomUsername: null,
    };
    const prisma = {
      socialComment: {
        findUnique: jest.fn().mockResolvedValue({ id: "cm1", postId: "p1", parentCommentId: null }),
        create: jest.fn().mockResolvedValue(createdReply),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ role: "MEMBER" }), findMany: jest.fn().mockResolvedValue([]) },
      socialCommentIdentityLock: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      socialCommentVote: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
    } as never;
    const out = await new SocialService(prisma, moderationPass).addReply("u1", "cm1", { body: "totally agree" });
    expect((prisma as any).socialComment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ postId: "p1", parentCommentId: "cm1" }) }),
    );
    expect(out.id).toBe("reply-1");
  });

  it("addReply runs the same moderation gate as a top-level comment", async () => {
    const prisma = {
      socialComment: { findUnique: jest.fn().mockResolvedValue({ id: "cm1", postId: "p1", parentCommentId: null }) },
    } as never;
    const moderationFail = {
      checkContent: jest.fn().mockReturnValue({ violates: true, violationTypes: ["PROFANITY"], confidence: 0.95 }),
    } as never;
    await expect(
      new SocialService(prisma, moderationFail).addReply("u1", "cm1", { body: "this is shit" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("listReplies returns a comment's replies oldest-first", async () => {
    const rows = [
      { id: "r1", postId: "p1", parentCommentId: "cm1", body: "first reply", createdAt: new Date(1), authorUserId: "u1" },
      { id: "r2", postId: "p1", parentCommentId: "cm1", body: "second reply", createdAt: new Date(2), authorUserId: "u2" },
    ];
    const findMany = jest.fn().mockResolvedValue(rows);
    const prisma = {
      socialComment: { findMany, groupBy: jest.fn().mockResolvedValue([]) },
      socialCommentVote: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([
        { id: "u1", avatarKey: "a1", avatarGradient: "g1", reviewUsername: "One" },
        { id: "u2", avatarKey: "a2", avatarGradient: "g2", reviewUsername: "Two" },
      ]) },
    } as never;
    const out = await new SocialService(prisma, moderationPass).listReplies(undefined, "cm1");
    expect(findMany).toHaveBeenCalledWith({
      where: { parentCommentId: "cm1" },
      orderBy: { createdAt: "asc" },
      take: 5000,
    });
    expect(out.map((c) => c.id)).toEqual(["r1", "r2"]);
  });

  it("listComments only fetches top-level comments (parentCommentId: null)", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      socialPost: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) },
      socialComment: { findMany, groupBy: jest.fn().mockResolvedValue([]) },
      socialCommentVote: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    } as never;
    await new SocialService(prisma, moderationPass).listComments(undefined, "p1");
    expect(findMany).toHaveBeenCalledWith({
      where: { postId: "p1", parentCommentId: null },
      orderBy: { createdAt: "asc" },
      take: 5000,
    });
  });

  it("a top-level comment's replyCount reflects how many replies it has; a reply's own replyCount is 0", async () => {
    const rows = [{ id: "cm1", postId: "p1", body: "parent", createdAt: new Date(), authorUserId: "u1" }];
    const prisma = {
      socialPost: { findUnique: jest.fn().mockResolvedValue({ id: "p1" }) },
      socialComment: {
        findMany: jest.fn().mockResolvedValue(rows),
        groupBy: jest.fn().mockResolvedValue([{ parentCommentId: "cm1", _count: { _all: 3 } }]),
      },
      socialCommentVote: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: "u1", avatarKey: "a", avatarGradient: "g", reviewUsername: "One" }]) },
    } as never;
    const out = await new SocialService(prisma, moderationPass).listComments(undefined, "p1");
    expect(out[0].replyCount).toBe(3);
  });
});

describe("SocialService.companyFeed sort", () => {
  function makeFeedPrisma(overrides: Record<string, unknown> = {}) {
    return makePrisma({
      company: { findUnique: jest.fn().mockResolvedValue({ id: "c1", hiddenAt: null }) },
      socialPost: { findMany: jest.fn().mockResolvedValue([]) },
      socialPostLike: { groupBy: jest.fn().mockResolvedValue([]) },
      socialComment: { groupBy: jest.fn().mockResolvedValue([]) },
      savedPost: { findMany: jest.fn().mockResolvedValue([]) },
      ...overrides,
    });
  }

  it("orders by likes count desc when sort is mostLiked", async () => {
    const prisma = makeFeedPrisma();
    await new SocialService(prisma, moderationPass).companyFeed(undefined, "some-slug", { sort: "mostLiked" });
    expect((prisma as any).socialPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ likes: { _count: "desc" } }, { id: "desc" }] }),
    );
  });

  it("orders by comments count desc when sort is mostCommented", async () => {
    const prisma = makeFeedPrisma();
    await new SocialService(prisma, moderationPass).companyFeed(undefined, "some-slug", { sort: "mostCommented" });
    expect((prisma as any).socialPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ comments: { _count: "desc" } }, { id: "desc" }] }),
    );
  });

  it("orders oldest-first when sort is oldest", async () => {
    const prisma = makeFeedPrisma();
    await new SocialService(prisma, moderationPass).companyFeed(undefined, "some-slug", { sort: "oldest" });
    expect((prisma as any).socialPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    );
  });

  it("defaults to newest-first when sort is omitted, with the pinned post leading", async () => {
    const prisma = makeFeedPrisma();
    await new SocialService(prisma, moderationPass).companyFeed(undefined, "some-slug", {});
    expect((prisma as any).socialPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ pinnedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { id: "desc" }],
      }),
    );
  });
});

describe("SocialService owner post tools (edit / delete / pin)", () => {
  const owned = { id: "p1", companyId: "c1", imageUrls: ["http://x/uploads/social/a.webp"], pinnedAt: null };
  const updatedRow = {
    id: "p1", companyId: "c1", imageUrls: ["/u/1.webp"], caption: "new", createdAt: new Date(), pinnedAt: null, editedAt: new Date(),
    company: { slug: "acme", name: "Acme", mainPhotoUrl: null, badgeTier: "FREE", workplaceTypes: ["OFFICE"] },
  };

  function toolsPrisma(post: Record<string, unknown> | null = owned, ownership: unknown = { claimStatus: "APPROVED" }) {
    const prisma = {
      companyOwner: { findUnique: jest.fn().mockResolvedValue(ownership), findMany: jest.fn().mockResolvedValue([{ companyId: "c1" }]) },
      socialPost: {
        findUnique: jest.fn().mockResolvedValue(post),
        update: jest.fn().mockResolvedValue(updatedRow),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        delete: jest.fn().mockResolvedValue({}),
      },
      socialPostLike: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
      socialComment: { groupBy: jest.fn().mockResolvedValue([]) },
      savedPost: { findMany: jest.fn().mockResolvedValue([]) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    return prisma;
  }

  it("refuses all three to someone who isn't an approved owner of the post's company", async () => {
    for (const ownership of [null, { claimStatus: "PENDING" }]) {
      const prisma = toolsPrisma(owned, ownership);
      const service = new SocialService(prisma as never, moderationPass);
      await expect(service.updatePost("u2", "p1", { caption: "x" })).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.deletePost("u2", "p1")).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.togglePin("u2", "p1")).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.socialPost.update).not.toHaveBeenCalled();
      expect(prisma.socialPost.delete).not.toHaveBeenCalled();
      expect(prisma.companyOwner.findUnique).toHaveBeenCalledWith({ where: { userId_companyId: { userId: "u2", companyId: "c1" } } });
    }
  });

  it("404s on a post that doesn't exist", async () => {
    const service = new SocialService(toolsPrisma(null) as never, moderationPass);
    await expect(service.deletePost("u1", "ghost")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("edits the caption only, marks the post edited, and returns the fresh post", async () => {
    const prisma = toolsPrisma();
    const post = await new SocialService(prisma as never, moderationPass).updatePost("u1", "p1", { caption: "new" });
    const call = prisma.socialPost.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: "p1" });
    expect(Object.keys(call.data as object).sort()).toEqual(["caption", "editedAt"]);
    expect(call.data.caption).toBe("new");
    expect(call.data.editedAt).toBeInstanceOf(Date);
    expect(post).toMatchObject({ id: "p1", caption: "new", edited: true, canManage: true });
  });

  it("an empty caption removes it; a caption that breaks the rules is refused and nothing is saved", async () => {
    const prisma = toolsPrisma();
    await new SocialService(prisma as never, moderationPass).updatePost("u1", "p1", { caption: "" });
    expect(prisma.socialPost.update.mock.calls[0][0].data.caption).toBeNull();

    const blocked = toolsPrisma();
    const moderationFail = { checkContent: jest.fn().mockReturnValue({ violates: true, violationTypes: ["PROFANITY"] }) } as never;
    await expect(new SocialService(blocked as never, moderationFail).updatePost("u1", "p1", { caption: "bad" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(blocked.socialPost.update).not.toHaveBeenCalled();
  });

  it("deletes the post, unlinks its photos and writes an audit entry", async () => {
    mockUnlink.mockClear();
    const prisma = toolsPrisma();
    await expect(new SocialService(prisma as never, moderationPass).deletePost("u1", "p1")).resolves.toEqual({ success: true });
    expect(prisma.socialPost.delete).toHaveBeenCalledWith({ where: { id: "p1" } });
    expect(mockUnlink).toHaveBeenCalledWith(join(process.cwd(), "uploads", "social", "a.webp"));
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorUserId: "u1", action: "SOCIAL_POST_DELETED_BY_OWNER", targetId: "p1" }),
    });
  });

  it("pinning takes the pin off the company's other post in the same transaction", async () => {
    const prisma = toolsPrisma();
    await expect(new SocialService(prisma as never, moderationPass).togglePin("u1", "p1")).resolves.toEqual({ postId: "p1", pinned: true });
    expect(prisma.socialPost.updateMany).toHaveBeenCalledWith({ where: { companyId: "c1", pinnedAt: { not: null } }, data: { pinnedAt: null } });
    expect(prisma.socialPost.update.mock.calls[0][0].data.pinnedAt).toBeInstanceOf(Date);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("a second press on the pinned post unpins it", async () => {
    const prisma = toolsPrisma({ ...owned, pinnedAt: new Date() });
    await expect(new SocialService(prisma as never, moderationPass).togglePin("u1", "p1")).resolves.toEqual({ postId: "p1", pinned: false });
    expect(prisma.socialPost.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { pinnedAt: null } });
    expect(prisma.socialPost.updateMany).not.toHaveBeenCalled();
  });
});

describe("SocialService.getPost / rail / companySummary", () => {
  it("getPost only finds a post whose company is public, and 404s otherwise", async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = { socialPost: { findFirst } } as never;
    await expect(new SocialService(prisma, moderationPass).getPost(undefined, "p1")).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst.mock.calls[0][0].where).toEqual({ id: "p1", company: expect.objectContaining({ hiddenAt: null }) });
    expect(findFirst.mock.calls[0][0].select.authorUserId).toBeUndefined();
  });

  it("rail: trending posts, companies the viewer doesn't follow yet, one fresh job ad per company - shared lists cached", async () => {
    const companyFindMany = jest.fn().mockResolvedValue([
      { id: "c1", slug: "acme", name: "Acme", mainPhotoUrl: null, badgeTier: "PRO", workplaceTypes: ["OFFICE"] },
    ]);
    const job = (id: string, companyId: string) => ({
      id, jobTitle: `Job ${id}`, companyId, company: { slug: companyId, name: companyId.toUpperCase(), mainPhotoUrl: null },
    });
    const jobFindMany = jest.fn().mockResolvedValue([job("j1", "c1"), job("j2", "c1"), job("j3", "c2")]);
    const trendingPost = (id: string, likes: number, comments: number, imageUrls: string[] = []) => ({
      id, caption: `post ${id}`, title: null, imageUrls, company: { name: "Acme", mainPhotoUrl: null }, _count: { likes, comments },
    });
    // The same busy post tops both lists; a post nobody touched fills a slot.
    const postFindMany = jest
      .fn()
      .mockResolvedValueOnce([trendingPost("busy", 3, 1, ["/u/busy.webp"]), trendingPost("liked", 2, 0), trendingPost("quiet", 0, 0)])
      .mockResolvedValueOnce([trendingPost("talked", 0, 5), trendingPost("busy", 3, 1, ["/u/busy.webp"])]);
    const prisma = {
      company: { findMany: companyFindMany },
      jobPosting: { findMany: jobFindMany },
      socialPost: { findMany: postFindMany },
      socialQuestion: {
        findMany: jest.fn().mockResolvedValue([{ id: "q1", body: "Is overtime paid?", workType: null, company: { name: "Acme" } }]),
      },
    } as never;

    const service = new SocialService(prisma, moderationPass);
    const rail = await service.rail("viewer-1");
    // Waiting for an answer: only questions nobody has answered.
    expect(rail.openQuestions).toEqual([{ questionId: "q1", body: "Is overtime paid?", companyName: "Acme", workType: null }]);
    expect((prisma as any).socialQuestion.findMany.mock.calls[0][0].where.answers).toEqual({ none: {} });

    // Trending: each post once, busiest first, untouched posts left out.
    expect(rail.trending.map((p) => p.postId)).toEqual(["talked", "busy", "liked"]);
    expect(rail.trending[1]).toEqual({
      postId: "busy", companyName: "Acme", companyLogoUrl: null, thumbUrl: "/u/busy.webp", caption: "post busy", likeCount: 3, commentCount: 1,
    });
    expect(rail.trending[0].thumbUrl).toBeNull();
    expect(Date.now() - postFindMany.mock.calls[0][0].where.createdAt.gte.getTime()).toBeGreaterThan(6.9 * 86_400_000);

    // The shared lists are reused for the next visitor; only "companies to follow" is asked again.
    const again = await service.rail("viewer-2");
    expect(again.trending).toEqual(rail.trending);
    expect(postFindMany).toHaveBeenCalledTimes(2);
    expect(jobFindMany).toHaveBeenCalledTimes(1);
    expect(companyFindMany).toHaveBeenCalledTimes(2);

    const where = companyFindMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ hiddenAt: null, socialPosts: { some: {} }, followers: { none: { userId: "viewer-1" } } });
    expect(rail.suggestedCompanies).toEqual([
      { companyId: "c1", companySlug: "acme", companyName: "Acme", companyLogoUrl: null, companyBadgeTier: "PRO", companyWorkplaceTypes: ["OFFICE"] },
    ]);
    const jobWhere = jobFindMany.mock.calls[0][0].where;
    expect(jobWhere.status).toBe("PUBLISHED");
    expect(Date.now() - jobWhere.createdAt.gte.getTime()).toBeGreaterThan(6.9 * 86_400_000);
    expect(rail.hiringNow.map((j) => j.jobPostingId)).toEqual(["j1", "j3"]);
  });

  it("companySummary returns bare counts and 404s for a hidden company", async () => {
    const prisma = {
      company: { findUnique: jest.fn().mockResolvedValue({ id: "c1", hiddenAt: null }) },
      companyFollow: { count: jest.fn().mockResolvedValue(12) },
      socialPost: { count: jest.fn().mockResolvedValue(4) },
    };
    await expect(new SocialService(prisma as never, moderationPass).companySummary("acme")).resolves.toEqual({ followerCount: 12, postCount: 4 });
    expect(prisma.companyFollow.count).toHaveBeenCalledWith({ where: { companyId: "c1" } });

    prisma.company.findUnique.mockResolvedValue({ id: "c1", hiddenAt: new Date() });
    await expect(new SocialService(prisma as never, moderationPass).companySummary("acme")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("SocialService times (members see the hour, admins the exact moment)", () => {
  const exact = new Date("2026-09-27T14:37:52.123Z");
  const hour = "2026-09-27T14:00:00.000Z";

  function prismaWith() {
    return {
      company: { findUnique: jest.fn().mockResolvedValue({ id: "c1" }) },
      socialPost: {
        findUnique: jest.fn().mockResolvedValue({ id: "p1" }),
        findMany: jest.fn().mockResolvedValue([
          { id: "p1", companyId: "c1", imageUrls: [], caption: "hi", createdAt: exact,
            company: { slug: "acme", name: "Acme", mainPhotoUrl: null, badgeTier: "FREE", workplaceTypes: [] } },
        ]),
      },
      socialComment: {
        findMany: jest.fn().mockResolvedValue([
          { id: "cm1", postId: "p1", body: "first", createdAt: exact, authorUserId: "u1", parentCommentId: null, identityMode: "PERSONAL_CHOSEN" },
          { id: "cm2", postId: "p1", body: "reply", createdAt: exact, authorUserId: "u1", parentCommentId: "cm1", identityMode: "PERSONAL_CHOSEN" },
        ]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      socialCommentVote: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
      socialPostLike: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
      savedPost: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: "u1", avatarKey: null, avatarGradient: null, reviewUsername: "One" }]) },
    } as never;
  }

  it("rounds a post's time down to the hour on the public feed", async () => {
    const page = await new SocialService(prismaWith(), moderationPass).feed(undefined, {});
    expect(page.posts[0].createdAt).toBe(hour);
  });

  it("rounds a comment's time down to the hour", async () => {
    const out = await new SocialService(prismaWith(), moderationPass).listComments(undefined, "p1");
    expect(out.map((c) => c.createdAt)).toEqual([hour, hour]);
  });

  it("gives the admin the exact time of posts and of every comment and reply", async () => {
    const service = new SocialService(prismaWith(), moderationPass);
    const feed = await service.adminCompanyFeed("c1", {});
    expect(feed.posts[0].createdAt).toBe(exact.toISOString());
    const comments = await service.adminPostComments("p1");
    expect(comments).toEqual([
      expect.objectContaining({ id: "cm1", createdAt: exact.toISOString(), isReply: false, displayUsername: "One" }),
      expect.objectContaining({ id: "cm2", createdAt: exact.toISOString(), isReply: true }),
    ]);
    expect(comments.every((c) => !("authorUserId" in c))).toBe(true);
  });
});

describe("SocialService post kinds (2026-10-13)", () => {
  const liveJob = {
    id: "22222222-2222-2222-2222-222222222222", companyId: CID, status: "PUBLISHED", createdAt: new Date(),
    lastResharedAt: null, filledAt: null, autoReshareEnabled: false,
  };

  function kindPrisma(job: unknown = liveJob) {
    return {
      companyOwner: { findUnique: jest.fn().mockResolvedValue({ claimStatus: "APPROVED" }) },
      socialPost: { create: jest.fn().mockResolvedValue({ id: "post-1" }) },
      jobPosting: { findUnique: jest.fn().mockResolvedValue(job) },
    };
  }
  const created = (prisma: ReturnType<typeof kindPrisma>) => prisma.socialPost.create.mock.calls[0][0].data;

  it("a post with no photos is a text UPDATE and needs some text; with photos it is a PHOTO and keeps their proportions", async () => {
    const text = kindPrisma();
    await new SocialService(text as never, moderationPass).createPost("u1", { companyId: CID, caption: "We moved offices." }, []);
    expect(created(text)).toMatchObject({ kind: "UPDATE", imageUrls: [], imageAspectRatios: [], caption: "We moved offices." });

    await expect(new SocialService(kindPrisma() as never, moderationPass).createPost("u1", { companyId: CID, kind: "UPDATE" }, [])).rejects.toBeInstanceOf(
      BadRequestException,
    );

    const photo = kindPrisma();
    await new SocialService(photo as never, moderationPass).createPost("u1", { companyId: CID, kind: "UPDATE" }, [jpegFile, jpegFile]);
    expect(created(photo)).toMatchObject({ kind: "PHOTO", imageAspectRatios: [1.5, 1.5] });
  });

  it("a poll stores its answers in order and closes after the chosen number of days; it can't carry photos", async () => {
    const prisma = kindPrisma();
    await new SocialService(prisma as never, moderationPass).createPost(
      "u1",
      { companyId: CID, kind: "POLL", caption: "Which shift do you prefer?", pollOptions: ["Morning", "Evening", "Night"], pollDays: 3 },
      [],
    );
    const data = created(prisma);
    expect(data.kind).toBe("POLL");
    expect(data.pollOptions).toEqual({
      create: [{ text: "Morning", position: 0 }, { text: "Evening", position: 1 }, { text: "Night", position: 2 }],
    });
    const days = (data.pollEndsAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(2.9);
    expect(days).toBeLessThan(3.1);

    await expect(
      new SocialService(kindPrisma() as never, moderationPass).createPost(
        "u1",
        { companyId: CID, kind: "POLL", caption: "Q?", pollOptions: ["A", "B"], pollDays: 1 },
        [jpegFile],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("a post written for later is checked against the moment it goes out, and written only when published", async () => {
    const prisma = kindPrisma();
    const service = new SocialService(prisma as never, moderationPass);
    const inDays = (n: number) => new Date(Date.now() + n * 86_400_000);

    // An event announced after it has started is refused.
    await expect(
      service.prepareNewPost("u1", { companyId: CID, kind: "EVENT", title: "Open day", eventStartsAt: inDays(2).toISOString() }, [], inDays(3)),
    ).rejects.toThrow(/has to start after/);

    const prepared = await service.prepareNewPost(
      "u1",
      { companyId: CID, kind: "POLL", caption: "Best shift?", pollOptions: ["Morning", "Night"], pollDays: 7 },
      [],
      inDays(3),
    );
    expect(prepared).toMatchObject({ kind: "POLL", pollOptions: ["Morning", "Night"], pollDays: 7 });
    // Preparing writes no post.
    expect(prisma.socialPost.create).not.toHaveBeenCalled();

    // The poll's clock starts when it is published, not when it was written.
    await service.publishPrepared(prepared, null);
    const data = created(prisma);
    const days = (data.pollEndsAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
    expect(data.authorUserId).toBeNull();
  });

  it("runs every piece of the company's text through the content rules - a bad poll answer stops the post", async () => {
    const checkContent = jest.fn((texts: string[]) => ({ violates: texts[0] === "rude answer", violationTypes: [] }));
    const prisma = kindPrisma();
    await expect(
      new SocialService(prisma as never, { checkContent } as never).createPost(
        "u1",
        { companyId: CID, kind: "POLL", caption: "Fine question?", pollOptions: ["ok", "rude answer"], pollDays: 1 },
        [],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.socialPost.create).not.toHaveBeenCalled();
  });

  it("an event keeps its title, time and place, and its time has to be ahead", async () => {
    const startsAt = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const prisma = kindPrisma();
    await new SocialService(prisma as never, moderationPass).createPost(
      "u1",
      { companyId: CID, kind: "EVENT", title: "Open day", eventStartsAt: startsAt, eventLocation: "Manisa plant" },
      [],
    );
    expect(created(prisma)).toMatchObject({ kind: "EVENT", title: "Open day", eventLocation: "Manisa plant", eventStartsAt: new Date(startsAt) });

    await expect(
      new SocialService(kindPrisma() as never, moderationPass).createPost(
        "u1",
        { companyId: CID, kind: "EVENT", title: "Yesterday", eventStartsAt: new Date(Date.now() - 86_400_000).toISOString() },
        [],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("a hiring post only takes this company's own job ad, and only while it is live", async () => {
    const input = { companyId: CID, kind: "HIRING" as const, jobPostingId: liveJob.id };
    const ok = kindPrisma();
    await new SocialService(ok as never, moderationPass).createPost("u1", input, []);
    expect(created(ok)).toMatchObject({ kind: "HIRING", jobPostingId: liveJob.id });

    for (const job of [null, { ...liveJob, companyId: "another-company" }, { ...liveJob, status: "FILLED", filledAt: new Date() }]) {
      const prisma = kindPrisma(job);
      await expect(new SocialService(prisma as never, moderationPass).createPost("u1", input, [])).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.socialPost.create).not.toHaveBeenCalled();
    }
  });
});

describe("SocialService polls", () => {
  const future = new Date(Date.now() + 86_400_000);
  const pollRow = (overrides: Record<string, unknown> = {}) => ({
    id: "p1", companyId: "c1", kind: "POLL", imageUrls: [], imageAspectRatios: [], caption: "Which shift?", createdAt: new Date(),
    pinnedAt: null, editedAt: null, title: null, eventStartsAt: null, eventLocation: null, pollEndsAt: future, jobPosting: null,
    pollOptions: [{ id: "o1", text: "Morning" }, { id: "o2", text: "Night" }],
    company: { slug: "acme", name: "Acme", mainPhotoUrl: null, badgeTier: "FREE", workplaceTypes: ["OFFICE"] },
    ...overrides,
  });

  function pollPrisma(row: ReturnType<typeof pollRow>, opts: { myVote?: string; owner?: boolean } = {}) {
    return {
      socialPost: { findFirst: jest.fn().mockResolvedValue(row) },
      socialPostLike: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
      socialComment: { groupBy: jest.fn().mockResolvedValue([]) },
      savedPost: { findMany: jest.fn().mockResolvedValue([]) },
      companyOwner: { findMany: jest.fn().mockResolvedValue(opts.owner ? [{ companyId: "c1" }] : []) },
      socialPollVote: {
        groupBy: jest.fn().mockResolvedValue([{ optionId: "o1", _count: { _all: 3 } }, { optionId: "o2", _count: { _all: 1 } }]),
        findMany: jest.fn().mockResolvedValue(opts.myVote ? [{ postId: "p1", optionId: opts.myVote }] : []),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
  }
  const poll = async (prisma: ReturnType<typeof pollPrisma>, viewer: string | undefined) =>
    (await new SocialService(prisma as never, moderationPass).getPost(viewer, "p1")).poll!;

  it("hides the split until the viewer has voted, the poll has closed, or the viewer owns the company", async () => {
    const hidden = await poll(pollPrisma(pollRow()), "member-1");
    expect(hidden).toMatchObject({ closed: false, totalVotes: 4, myOptionId: null });
    expect(hidden.options).toEqual([{ id: "o1", text: "Morning", votes: null }, { id: "o2", text: "Night", votes: null }]);

    const voted = await poll(pollPrisma(pollRow(), { myVote: "o2" }), "member-1");
    expect(voted.myOptionId).toBe("o2");
    expect(voted.options.map((o) => o.votes)).toEqual([3, 1]);

    const closed = await poll(pollPrisma(pollRow({ pollEndsAt: new Date(Date.now() - 1000) })), undefined);
    expect(closed.closed).toBe(true);
    expect(closed.options.map((o) => o.votes)).toEqual([3, 1]);

    const owner = await poll(pollPrisma(pollRow(), { owner: true }), "owner-1");
    expect(owner.options.map((o) => o.votes)).toEqual([3, 1]);
  });

  it("only ever counts votes: the vote queries never select a voter", async () => {
    const prisma = pollPrisma(pollRow(), { myVote: "o1" });
    await poll(prisma, "member-1");
    expect(prisma.socialPollVote.groupBy).toHaveBeenCalledWith({ by: ["optionId"], where: { postId: { in: ["p1"] } }, _count: { _all: true } });
    expect(prisma.socialPollVote.findMany).toHaveBeenCalledWith({
      where: { postId: { in: ["p1"] }, userId: "member-1" },
      select: { postId: true, optionId: true },
    });
  });

  it("votePoll records one vote per member (a second pick moves it) and returns the post with the result open", async () => {
    const prisma = pollPrisma(pollRow(), { myVote: "o2" });
    const post = await new SocialService(prisma as never, moderationPass).votePoll("member-1", "p1", "o2");
    expect(prisma.socialPollVote.upsert).toHaveBeenCalledWith({
      where: { postId_userId: { postId: "p1", userId: "member-1" } },
      create: { postId: "p1", optionId: "o2", userId: "member-1" },
      update: { optionId: "o2" },
    });
    expect(post.poll!.options.map((o) => o.votes)).toEqual([3, 1]);
  });

  it("votePoll refuses a closed poll, an answer from another poll, and a post that isn't a poll", async () => {
    const closed = pollPrisma(pollRow({ pollEndsAt: new Date(Date.now() - 1000) }));
    await expect(new SocialService(closed as never, moderationPass).votePoll("m", "p1", "o1")).rejects.toBeInstanceOf(BadRequestException);

    const open = pollPrisma(pollRow());
    await expect(new SocialService(open as never, moderationPass).votePoll("m", "p1", "not-an-option")).rejects.toBeInstanceOf(BadRequestException);
    expect(open.socialPollVote.upsert).not.toHaveBeenCalled();

    const missing = pollPrisma(pollRow());
    missing.socialPost.findFirst.mockResolvedValue(null);
    await expect(new SocialService(missing as never, moderationPass).votePoll("m", "p1", "o1")).rejects.toBeInstanceOf(NotFoundException);
    expect(missing.socialPost.findFirst.mock.calls[0][0].where).toMatchObject({ id: "p1", kind: "POLL" });
  });

  it("a poll can't be reworded once posted", async () => {
    const prisma = {
      socialPost: { findUnique: jest.fn().mockResolvedValue({ id: "p1", companyId: "c1", imageUrls: [], pinnedAt: null, kind: "POLL" }), update: jest.fn() },
      companyOwner: { findUnique: jest.fn().mockResolvedValue({ claimStatus: "APPROVED" }) },
    };
    await expect(new SocialService(prisma as never, moderationPass).updatePost("u1", "p1", { caption: "New question?" })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.socialPost.update).not.toHaveBeenCalled();
  });
});

describe("SocialService hiring posts", () => {
  it("shows the job ad, and says it is no longer live once it is filled or gone", async () => {
    const row = (jobPosting: unknown) => ({
      id: "p1", companyId: "c1", kind: "HIRING", imageUrls: [], imageAspectRatios: [], caption: null, createdAt: new Date(),
      pinnedAt: null, editedAt: null, title: null, eventStartsAt: null, eventLocation: null, pollEndsAt: null, pollOptions: [], jobPosting,
      company: { slug: "acme", name: "Acme", mainPhotoUrl: null, badgeTier: "FREE", workplaceTypes: ["OFFICE"] },
    });
    const job = {
      id: "j1", jobTitle: "Forklift Operator", workType: "MANUAL_LABOUR", positions: ["BLUE_COLLAR"], status: "PUBLISHED",
      createdAt: new Date(), lastResharedAt: null, filledAt: null, autoReshareEnabled: false,
    };
    const get = (jobPosting: unknown) => {
      const prisma = {
        socialPost: { findFirst: jest.fn().mockResolvedValue(row(jobPosting)) },
        socialPostLike: { groupBy: jest.fn().mockResolvedValue([]) },
        socialComment: { groupBy: jest.fn().mockResolvedValue([]) },
      };
      return new SocialService(prisma as never, moderationPass).getPost(undefined, "p1");
    };

    expect((await get(job)).job).toEqual({
      jobPostingId: "j1", jobTitle: "Forklift Operator", workType: "MANUAL_LABOUR", positions: ["BLUE_COLLAR"], live: true,
    });
    expect((await get({ ...job, status: "FILLED", filledAt: new Date() })).job).toMatchObject({ live: false });
    expect((await get(null)).job).toMatchObject({ jobPostingId: null, live: false });
  });
});

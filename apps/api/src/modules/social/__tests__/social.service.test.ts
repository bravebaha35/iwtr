import { BadRequestException, ForbiddenException } from "@nestjs/common";
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

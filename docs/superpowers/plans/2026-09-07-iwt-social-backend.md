# IWT Social - Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the server side of IWT Social - a company-authored photo/update feed with anonymous employee comments and post likes - as a self-contained `social/` NestJS module plus three new Prisma models, without touching reviews, jobs, or the rating feed.

**Architecture:** New `apps/api/src/modules/social/` module (controller + service + `social-image.util.ts`), following the exact shape of the existing `job-postings/` module. Three new `public`-schema Prisma models: `SocialPost`, `SocialComment`, `SocialPostLike`. Employer identity for posting reuses the approved-ownership check; commenter/liker anonymity reuses `User.reviewUsername` + the review serialization pattern (explicit `select`, never `include: { user: true }`); text moderation reuses `ModerationService.checkContent` as a pass/fail gate (fail = 400, no admin queue). Image uploads are decoded (HEIC via `heic-convert`, everything else natively), then re-encoded to compressed WebP with `sharp` before hitting disk.

**Tech Stack:** NestJS 10, Prisma 5 (multiSchema), `@nestjs/platform-express` `FileInterceptor` (multer memory storage), `sharp` (shared with the owner-dashboard banner pipeline), `heic-convert` (new dep), zod via `@iwtr/shared-types`.

**Spec:** `docs/superpowers/specs/2026-09-07-iwt-social-backend.md` (read it alongside this plan - the plan argues from it).

## Prerequisites (do these before Task 1)

1. **The owner-dashboard branch must be merged into `main` first.** It adds `sharp` to `apps/api/package.json` and rewrites `OwnerService.uploadBanner` to use it; this plan depends on `sharp` already being present, and the frontend plan modifies files owner-dashboard also changed. Build this plan on a branch cut from `main` *after* that merge. If the user decides not to merge owner-dashboard, cut this branch from `owner-dashboard` instead and drop the "sharp already added" assumption in Task 3 (add it there).
2. Work in an isolated worktree - create it with the `superpowers:using-git-worktrees` skill at execution start.
3. Both dev servers stopped before any `prisma generate` / `prisma db push` (Windows EPERM on the query-engine DLL if `apps/api` is running - see CLAUDE.md).

## Global Constraints

Copied verbatim from the spec - every task implicitly includes these:

- **Do not modify** the "Hiring" page backend (`apps/api/src/modules/job-postings/**`, `JobsBrowser` data paths) or the "Home" rating feed (`CompaniesService.search`, `WorkplaceBrowser` data). Reading shared helpers is fine; changing their behavior is not.
- **Dual-Mode Isolation:** this is the backend half. No `apps/web/**` file is touched by this plan. The frontend plan (`docs/superpowers/plans/2026-09-07-iwt-social-frontend.md`) starts only after this one is reviewed and applied.
- **Anonymity (REVIEW.md-adjacent):** `SocialComment` is read/joined/serialized under the same rule as `Review`. Never `include: { user: true }` on a `prisma.socialComment.*` / `prisma.socialPost.*` query; never put `authorUserId` (or any FK to `User`) on a public response shape; source the commenter's avatar/handle with an explicit `prisma.user.findMany({ select: { id, avatarKey, avatarGradient, reviewUsername } })` exactly as `ReviewsService.listForCompany` does. Add `apps/api/src/modules/social/**` to REVIEW.md's file list in the last task.
- **Comment likes are out of scope.** Likes apply to posts only. No `CommentLike` model.
- **Failed moderation = hard 400**, not an admin queue. Same for post captions and comment bodies.
- **`prisma migrate dev` does not work in this environment** - use `prisma db push` (see CLAUDE.md).
- **`packages/shared-types` ships compiled JS** - after editing `packages/shared-types/src/**`, rebuild with `cd packages/shared-types && pnpm exec tsc` or `apps/api` picks up stale types.
- All new models carry `@@schema("public")`. Postgres does not auto-index FK columns - every FK column gets an explicit `@@index`.

---

### Task 1: Prisma models - SocialPost, SocialComment, SocialPostLike

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (add 3 models near the end of the `public` models, before `model TrafficLog`; add relation fields to `model User` and `model Company`)
- Test: `apps/api/src/modules/social/__tests__/social-schema.test.ts` (Create)

**Interfaces:**
- Produces: Prisma Client delegates `socialPost`, `socialComment`, `socialPostLike`. Later tasks rely on: `SocialPost { id, companyId, authorUserId, imageUrl, caption (nullable), createdAt }`, `SocialComment { id, postId, authorUserId, body, createdAt }`, `SocialPostLike { id, postId, userId, createdAt }` with compound unique `@@unique([postId, userId])` (Prisma where-key: `postId_userId`).

- [ ] **Step 1: Add the three models to `schema.prisma`**

Insert immediately before `model TrafficLog {`:

```prisma
// IWT Social - a company posts photos/updates under its corporate identity
// (authorUserId is audit-only, never exposed publicly - a post is attributed
// to the Company, exactly like CompanyReply). Employees comment and like
// with full anonymity (see SocialComment).
model SocialPost {
  id           String   @id @default(uuid())
  companyId    String
  company      Company  @relation(fields: [companyId], references: [id])
  authorUserId String
  authorUser   User     @relation("SocialPostAuthor", fields: [authorUserId], references: [id])
  // Server-produced compressed WebP URL under /uploads/social/ (see
  // social-image.util.ts) - never a client-supplied URL.
  imageUrl     String
  // Optional "Tell us what you think !" text, run through
  // ModerationService.checkContent before persist (hard-reject on violation).
  caption      String?
  createdAt    DateTime @default(now())

  comments SocialComment[]
  likes    SocialPostLike[]

  @@index([companyId])
  @@index([authorUserId])
  @@index([createdAt])
  @@schema("public")
}

// An employee's comment on a post. Anonymity model is identical to Review:
// authorUserId is audit-only and NEVER on the public shape; the displayed
// handle/avatar come from User.reviewUsername + avatarKey/avatarGradient via
// an explicit select (see SocialService.serializeComments / REVIEW.md).
model SocialComment {
  id           String     @id @default(uuid())
  postId       String
  post         SocialPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  authorUserId String
  authorUser   User       @relation("SocialCommentAuthor", fields: [authorUserId], references: [id])
  body         String
  createdAt    DateTime   @default(now())

  @@index([postId])
  @@index([authorUserId])
  @@schema("public")
}

// One like per (post, user). Post-level only - there is deliberately no
// CommentLike model (see the backend spec's decision log).
model SocialPostLike {
  id        String     @id @default(uuid())
  postId    String
  post      SocialPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  userId    String
  user      User       @relation("SocialPostLiker", fields: [userId], references: [id])
  createdAt DateTime   @default(now())

  @@unique([postId, userId])
  @@index([userId])
  @@schema("public")
}
```

- [ ] **Step 2: Add relation fields to `model User`**

In `model User { ... }`, after `jobPostings JobPosting[]` in the relation-field block:

```prisma
  socialPosts     SocialPost[]     @relation("SocialPostAuthor")
  socialComments  SocialComment[]  @relation("SocialCommentAuthor")
  socialPostLikes SocialPostLike[] @relation("SocialPostLiker")
```

- [ ] **Step 3: Add the relation field to `model Company`**

In `model Company { ... }`, after `jobPostings JobPosting[]`:

```prisma
  socialPosts SocialPost[]
```

- [ ] **Step 4: Regenerate the client and push the schema**

Stop both dev servers first. Then:

```bash
cd apps/api
pnpm exec prisma generate
pnpm exec prisma db push
```

Expected: `db push` reports the three new tables created, no data-loss prompt (all-additive).

- [ ] **Step 5: Write a schema smoke test**

`apps/api/src/modules/social/__tests__/social-schema.test.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

// Guards the model names later tasks depend on. Not a DB round-trip - just
// proves prisma generate ran and the delegates exist.
describe("social schema", () => {
  const prisma = new PrismaClient();
  afterAll(() => prisma.$disconnect());

  it("exposes socialPost / socialComment / socialPostLike delegates", () => {
    expect(typeof prisma.socialPost.findMany).toBe("function");
    expect(typeof prisma.socialComment.findMany).toBe("function");
    expect(typeof prisma.socialPostLike.findMany).toBe("function");
  });
});
```

- [ ] **Step 6: Run it**

Run: `cd apps/api && pnpm exec jest social-schema`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/src/modules/social/__tests__/social-schema.test.ts
git commit -m "feat(api): SocialPost/SocialComment/SocialPostLike models"
```

---

### Task 2: shared-types - `social.ts` schema module

**Files:**
- Create: `packages/shared-types/src/schemas/social.ts`
- Modify: `packages/shared-types/src/index.ts` (add `export * from "./schemas/social";` after the `jobPosting` line)
- Test: `packages/shared-types/src/schemas/__tests__/social.test.ts` (Create)

**Interfaces:**
- Consumes: `workplaceTypeSchema` from `./company` (already exported).
- Produces (used by every later backend task and the whole frontend plan): `createSocialPostInputSchema`/`CreateSocialPostInput`, `createSocialCommentInputSchema`/`CreateSocialCommentInput`, `publicSocialPostSchema`/`PublicSocialPost`, `publicSocialCommentSchema`/`PublicSocialComment`, `socialFeedPageSchema`/`SocialFeedPage`, `socialPostLikeResultSchema`/`SocialPostLikeResult`, `socialCompanyHeaderSchema`/`SocialCompanyHeader`, `SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES`, `SOCIAL_IMAGE_ACCEPTED_MIME_TYPES`, `validateSocialImageUpload`.

- [ ] **Step 1: Write `social.ts`**

```typescript
import { z } from "zod";
import { workplaceTypeSchema } from "./company";

// --- Upload validation (mime + size only; dimensions are not constrained -
// sharp downscales anything oversized). Pure/environment-agnostic so the
// same rule runs client-side for instant feedback and server-side as the
// authoritative check, matching companyLogo.ts's validateLogoFile pattern.
export const SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024;
export const SOCIAL_IMAGE_ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
] as const;

export interface SocialImageFileMeta {
  mimeType: string;
  sizeBytes: number;
}

export function validateSocialImageUpload(
  meta: SocialImageFileMeta,
): { valid: true } | { valid: false; error: string } {
  if (!(SOCIAL_IMAGE_ACCEPTED_MIME_TYPES as readonly string[]).includes(meta.mimeType)) {
    return { valid: false, error: "Photo must be a JPEG, PNG, or HEIC image." };
  }
  if (meta.sizeBytes > SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Photo is too large - keep it under ${SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
    };
  }
  return { valid: true };
}

// --- Create inputs
export const createSocialPostInputSchema = z.object({
  companyId: z.string().uuid(),
  caption: z.string().trim().max(1000).optional(),
});
export type CreateSocialPostInput = z.infer<typeof createSocialPostInputSchema>;

export const createSocialCommentInputSchema = z.object({
  body: z.string().trim().min(1).max(1000),
});
export type CreateSocialCommentInput = z.infer<typeof createSocialCommentInputSchema>;

// --- Public read shapes. NOTE (REVIEW.md-adjacent): no authorUserId / userId
// on either shape. The comment's identity fields are the same anonymous
// triple a review exposes (avatarKey/avatarGradient/displayUsername).
export const socialBadgeTierSchema = z.enum(["FREE", "BLUE", "BLUE_PLUS", "ENTERPRISE"]);

export const publicSocialPostSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  companySlug: z.string(),
  companyName: z.string(),
  companyLogoUrl: z.string().nullable(),
  companyBadgeTier: socialBadgeTierSchema,
  imageUrl: z.string(),
  caption: z.string().nullable(),
  createdAt: z.string().datetime(),
  likeCount: z.number().int(),
  commentCount: z.number().int(),
  // null when the viewer is anonymous; boolean when authenticated.
  likedByMe: z.boolean().nullable(),
});
export type PublicSocialPost = z.infer<typeof publicSocialPostSchema>;

export const publicSocialCommentSchema = z.object({
  id: z.string(),
  postId: z.string(),
  body: z.string(),
  createdAt: z.string().datetime(),
  displayUsername: z.string().nullable(),
  avatarKey: z.string().nullable(),
  avatarGradient: z.string().nullable(),
  // True only for the currently-authenticated viewer's own comments, so the
  // frontend can show a delete affordance. Never reveals other authors.
  mine: z.boolean(),
});
export type PublicSocialComment = z.infer<typeof publicSocialCommentSchema>;

export const socialFeedPageSchema = z.object({
  posts: z.array(publicSocialPostSchema),
  nextCursor: z.string().nullable(),
});
export type SocialFeedPage = z.infer<typeof socialFeedPageSchema>;

export const socialPostLikeResultSchema = z.object({
  postId: z.string(),
  likeCount: z.number().int(),
  likedByMe: z.boolean(),
});
export type SocialPostLikeResult = z.infer<typeof socialPostLikeResultSchema>;

// Hero card on the company IWT Social profile - a strict subset of
// CompanyDetail. The frontend page can also just reuse CompanyDetail
// directly; this exists so a dedicated endpoint stays an option.
export const socialCompanyHeaderSchema = z.object({
  slug: z.string(),
  name: z.string(),
  category: z.string(),
  workplaceTypes: z.array(workplaceTypeSchema),
  logoUrl: z.string().nullable(),
  bannerImageUrl: z.string().nullable(),
  overallAvg: z.number().nullable(),
  reviewCount: z.number().int(),
});
export type SocialCompanyHeader = z.infer<typeof socialCompanyHeaderSchema>;
```

- [ ] **Step 2: Export from the barrel** - in `packages/shared-types/src/index.ts` add after the `jobPosting` line: `export * from "./schemas/social";`

- [ ] **Step 3: Write the test**

`packages/shared-types/src/schemas/__tests__/social.test.ts`:

```typescript
import {
  createSocialCommentInputSchema,
  validateSocialImageUpload,
  SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES,
} from "../social";

describe("social schemas", () => {
  it("rejects an empty comment body", () => {
    expect(createSocialCommentInputSchema.safeParse({ body: "   " }).success).toBe(false);
  });
  it("accepts a normal comment body", () => {
    expect(createSocialCommentInputSchema.safeParse({ body: "great place" }).success).toBe(true);
  });
  it("rejects a non-image mime type", () => {
    expect(validateSocialImageUpload({ mimeType: "application/pdf", sizeBytes: 10 }).valid).toBe(false);
  });
  it("rejects an oversized file", () => {
    expect(
      validateSocialImageUpload({ mimeType: "image/jpeg", sizeBytes: SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES + 1 }).valid,
    ).toBe(false);
  });
  it("accepts a normal HEIC upload", () => {
    expect(validateSocialImageUpload({ mimeType: "image/heic", sizeBytes: 2_000_000 }).valid).toBe(true);
  });
});
```

- [ ] **Step 4: Run tests + rebuild dist**

```bash
cd packages/shared-types && pnpm exec jest social && pnpm exec tsc
```

Expected: tests PASS, `tsc` emits with no errors (updates `dist/`).

- [ ] **Step 5: Commit**

```bash
git add packages/shared-types/src/schemas/social.ts packages/shared-types/src/index.ts packages/shared-types/src/schemas/__tests__/social.test.ts
git commit -m "feat(shared-types): IWT Social post/comment/feed schemas"
```

---

### Task 3: Image pipeline - `social-image.util.ts` (HEIC/JPEG/PNG -> compressed WebP)

**Files:**
- Create: `apps/api/src/modules/social/social-image.util.ts`
- Modify: `apps/api/package.json` (add `heic-convert` + `@types/heic-convert`; `sharp` should already be present from the owner-dashboard merge)
- Test: `apps/api/src/modules/social/__tests__/social-image.util.test.ts` (Create)

**Interfaces:**
- Produces: `processSocialImage(buffer: Buffer, mimeType: string): Promise<Buffer>` (compressed WebP; throws `BadRequestException` if undecodable). Consumed by Task 4.
- Constants: `SOCIAL_IMAGE_OUTPUT_MAX_WIDTH_PX = 1080`, `SOCIAL_IMAGE_WEBP_QUALITY = 58`.

- [ ] **Step 1: Add the dependency**

```bash
cd apps/api && pnpm add heic-convert && pnpm add -D @types/heic-convert
```

(If `sharp` is missing from `apps/api/package.json`: `pnpm add sharp` too.)

- [ ] **Step 2: Write the failing test**

`apps/api/src/modules/social/__tests__/social-image.util.test.ts`:

```typescript
import sharp from "sharp";
import { processSocialImage, SOCIAL_IMAGE_OUTPUT_MAX_WIDTH_PX } from "../social-image.util";

async function makeJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 30, b: 30 } } })
    .jpeg()
    .toBuffer();
}

describe("processSocialImage", () => {
  it("downscales an oversized JPEG and returns WebP", async () => {
    const input = await makeJpeg(2000, 1500);
    const out = await processSocialImage(input, "image/jpeg");
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(SOCIAL_IMAGE_OUTPUT_MAX_WIDTH_PX);
    expect(out.length).toBeLessThan(input.length);
  });

  it("leaves a small image at its own size but still re-encodes to WebP", async () => {
    const input = await makeJpeg(400, 400);
    const out = await processSocialImage(input, "image/png");
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(400);
  });

  it("throws on an undecodable buffer", async () => {
    await expect(processSocialImage(Buffer.from("not an image"), "image/jpeg")).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run it (fails)** - `cd apps/api && pnpm exec jest social-image`. Expected: FAIL, "Cannot find module '../social-image.util'".

- [ ] **Step 4: Write `social-image.util.ts`**

```typescript
import { BadRequestException } from "@nestjs/common";
import sharp from "sharp";
import heicConvert from "heic-convert";

// Instagram-ish long-edge cap - big enough to stay legible on a desktop
// feed card, small enough that a re-encoded WebP is a few dozen KB.
export const SOCIAL_IMAGE_OUTPUT_MAX_WIDTH_PX = 1080;
// Deliberately aggressive: the spec asks for "cost-effective for mass
// storage without becoming illegible". 58 keeps photos readable while
// roughly halving the size vs the ~80 default.
export const SOCIAL_IMAGE_WEBP_QUALITY = 58;

const HEIC_MIME_TYPES = new Set(["image/heic", "image/heif"]);

/**
 * Decode any accepted upload (HEIC via heic-convert, JPEG/PNG natively) and
 * re-encode it to a compressed, metadata-stripped WebP. The returned buffer
 * is what gets written to disk - a client-supplied file is never stored
 * as-is. Throws BadRequestException if the bytes can't be decoded.
 */
export async function processSocialImage(buffer: Buffer, mimeType: string): Promise<Buffer> {
  let decoded = buffer;

  // sharp's prebuilt binaries omit HEIC decoding (libheif licensing), so a
  // .heic upload is converted to a JPEG buffer first, then treated like any
  // other JPEG below.
  if (HEIC_MIME_TYPES.has(mimeType)) {
    try {
      const jpeg = await heicConvert({ buffer, format: "JPEG", quality: 0.9 });
      decoded = Buffer.from(jpeg);
    } catch {
      throw new BadRequestException("Could not read that HEIC photo - try exporting it as JPEG.");
    }
  }

  try {
    return await sharp(decoded)
      // Honour EXIF orientation before stripping metadata, or a phone photo
      // lands sideways.
      .rotate()
      .resize({ width: SOCIAL_IMAGE_OUTPUT_MAX_WIDTH_PX, withoutEnlargement: true })
      .webp({ quality: SOCIAL_IMAGE_WEBP_QUALITY })
      .toBuffer();
  } catch {
    throw new BadRequestException("That file could not be read as an image.");
  }
}
```

- [ ] **Step 5: Run the test (passes)** - `cd apps/api && pnpm exec jest social-image`. Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api/package.json apps/api/src/modules/social/social-image.util.ts apps/api/src/modules/social/__tests__/social-image.util.test.ts pnpm-lock.yaml
git commit -m "feat(api): social image pipeline - HEIC/JPEG/PNG to compressed WebP"
```

(The lockfile is at the repo root: `pnpm-lock.yaml`.)

---

### Task 4: SocialModule + post creation endpoint

**Files:**
- Create: `apps/api/src/modules/social/social.module.ts`, `social.controller.ts`, `social.service.ts`
- Modify: `apps/api/src/app.module.ts` (register `SocialModule` after `JobPostingsModule`)
- Test: `apps/api/src/modules/social/__tests__/social.service.test.ts` (Create)

**Interfaces:**
- Consumes: `processSocialImage` (Task 3), `createSocialPostInputSchema` / `validateSocialImageUpload` (Task 2), `ModerationService.checkContent` (existing), `PrismaService` (existing).
- Produces: `SocialService.createPost(userId, input, file): Promise<{ id: string }>`; `POST /social/posts` (multipart `file` + `companyId` + optional `caption`, `JwtAuthGuard`); private `SocialService.requireApprovedOwnership(userId, companyId)`.

- [ ] **Step 1: Write the failing service test**

`apps/api/src/modules/social/__tests__/social.service.test.ts` (top-of-file mock so the fake buffer never reaches `sharp`):

```typescript
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { SocialService } from "../social.service";

jest.mock("../social-image.util", () => ({
  processSocialImage: jest.fn().mockResolvedValue(Buffer.alloc(64, 9)),
  SOCIAL_IMAGE_OUTPUT_MAX_WIDTH_PX: 1080,
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
});
```

- [ ] **Step 2: Run it (fails)** - `cd apps/api && pnpm exec jest social.service`. Expected: "Cannot find module '../social.service'".

- [ ] **Step 3: Write `social.service.ts`**

```typescript
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { validateSocialImageUpload, type CreateSocialPostInput } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ModerationService } from "../moderation/moderation.service";
import { processSocialImage } from "./social-image.util";

// Local disk, dev-safe - same pattern as OwnerService.uploadLogo. Served at
// /uploads/social/ by main.ts's existing useStaticAssets("uploads") mount.
const SOCIAL_UPLOADS_DIR = join(process.cwd(), "uploads", "social");

@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: ModerationService,
  ) {}

  async createPost(
    userId: string,
    input: CreateSocialPostInput,
    file: Express.Multer.File | undefined,
  ): Promise<{ id: string }> {
    await this.requireApprovedOwnership(userId, input.companyId);

    if (!file) {
      throw new BadRequestException("Attach a photo to post.");
    }
    const check = validateSocialImageUpload({ mimeType: file.mimetype, sizeBytes: file.buffer.length });
    if (!check.valid) {
      throw new BadRequestException(check.error);
    }

    if (input.caption) {
      const result = this.moderation.checkContent([input.caption]);
      if (result.violates) {
        throw new BadRequestException(
          "That caption looks like it names a person or breaks our content rules - please reword it.",
        );
      }
    }

    const webp = await processSocialImage(file.buffer, file.mimetype);
    await mkdir(SOCIAL_UPLOADS_DIR, { recursive: true });
    const filename = `${randomUUID()}.webp`;
    await writeFile(join(SOCIAL_UPLOADS_DIR, filename), webp);
    const origin = process.env.API_PUBLIC_ORIGIN ?? `http://localhost:${process.env.PORT ?? 3001}`;
    const imageUrl = `${origin}/uploads/social/${filename}`;

    const post = await this.prisma.socialPost.create({
      data: { companyId: input.companyId, authorUserId: userId, imageUrl, caption: input.caption ?? null },
      select: { id: true },
    });
    return { id: post.id };
  }

  // Copy of OwnerService's check (not imported - a 6-line guard is not worth
  // a cross-module dependency, and the spec calls this out explicitly).
  private async requireApprovedOwnership(userId: string, companyId: string) {
    const ownership = await this.prisma.companyOwner.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!ownership || ownership.claimStatus !== "APPROVED") {
      throw new ForbiddenException("You are not an approved owner of this company.");
    }
    return ownership;
  }
}
```

- [ ] **Step 4: Write `social.controller.ts`**

```typescript
import { Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { createSocialPostInputSchema, type CreateSocialPostInput } from "@iwtr/shared-types";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { AuthenticatedUser } from "../auth/auth.types";
import { SocialService } from "./social.service";

@Controller("social")
export class SocialController {
  constructor(private readonly social: SocialService) {}

  // Multipart: `file` + `companyId` + optional `caption`. Tighter throttle
  // than the global 100/min - creating a post is expensive (decode + encode).
  @Post("posts")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file"))
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  createPost(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createSocialPostInputSchema)) body: CreateSocialPostInput,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.social.createPost(user.id, body, file);
  }
}
```

Confirm the exact import paths for `JwtAuthGuard`, `CurrentUser`, `ZodValidationPipe`, `AuthenticatedUser` against `apps/api/src/modules/owner/owner.controller.ts` (it uses all four).

- [ ] **Step 5: Write `social.module.ts` and register it**

```typescript
import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { ModerationModule } from "../moderation/moderation.module";
import { SocialController } from "./social.controller";
import { SocialService } from "./social.service";

@Module({
  imports: [PrismaModule, ModerationModule],
  controllers: [SocialController],
  providers: [SocialService],
})
export class SocialModule {}
```

Confirm `apps/api/src/modules/moderation/moderation.module.ts` `exports: [ModerationService]` (it does - `reviews.module.ts` imports it the same way; if not, add the export). In `app.module.ts`: `import { SocialModule } from "./modules/social/social.module";` and add `SocialModule` to `imports` after `JobPostingsModule`.

- [ ] **Step 6: Run tests + typecheck + boot** - `cd apps/api && pnpm exec jest social && pnpm exec tsc --noEmit`; then start the API and confirm "Nest application successfully started".

- [ ] **Step 7: Manual smoke test** (API running; dev owner `iworkedthere@hotmail.com` is an ENTERPRISE owner of "I Worked There" - get its company uuid and an access token)

```bash
curl -sS -X POST http://localhost:3001/v1/social/posts \
  -H "Authorization: Bearer <token>" \
  -F "companyId=<company uuid>" -F "caption=Our new workshop" -F "file=@some-photo.jpg" | jq
```

Expected: `{ "id": "..." }`; `apps/api/uploads/social/<uuid>.webp` exists and is far smaller than the source.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/social apps/api/src/app.module.ts
git commit -m "feat(api): POST /social/posts - owner-gated, moderated, WebP pipeline"
```

---

### Task 5: Feed read endpoints (`GET /social/feed`, `GET /social/companies/:slug/posts`)

**Files:**
- Modify: `apps/api/src/modules/social/social.service.ts` (add `feed`, `companyFeed`, private `pageFromWhere`, `serializePosts`, const `SOCIAL_FEED_PAGE_SIZE = 10`)
- Modify: `apps/api/src/modules/social/social.controller.ts` (2 GET routes)
- Modify: `apps/api/src/modules/social/__tests__/social.service.test.ts` (add feed tests)

**Interfaces:**
- Consumes: `OptionalJwtAuthGuard` / `OptionalCurrentUser` - confirm the exact names + import paths from `apps/api/src/modules/reviews/reviews.controller.ts` (that file's `GET /companies/:slug/reviews` uses this pattern; project memory calls them `OptionalJwtAuthGuard` / `OptionalCurrentUser`).
- Produces: `SocialService.feed(viewerUserId: string | undefined, opts: { cursor?: string; q?: string }): Promise<SocialFeedPage>`; `SocialService.companyFeed(viewerUserId: string | undefined, slug: string, opts: { cursor?: string }): Promise<SocialFeedPage>`; `GET /social/feed?cursor=&q=` and `GET /social/companies/:slug/posts?cursor=` (both `OptionalJwtAuthGuard`).

- [ ] **Step 1: Add feed tests** (append to `social.service.test.ts`)

```typescript
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
});
```

- [ ] **Step 2: Run (fails)** - `cd apps/api && pnpm exec jest social.service`. Expected: "svc.feed is not a function".

- [ ] **Step 3: Implement in `social.service.ts`**

Add imports/const at top: `import type { SocialFeedPage, PublicSocialPost } from "@iwtr/shared-types";` and `export const SOCIAL_FEED_PAGE_SIZE = 10;`

```typescript
  async feed(
    viewerUserId: string | undefined,
    opts: { cursor?: string; q?: string },
  ): Promise<SocialFeedPage> {
    const where = opts.q?.trim()
      ? { company: { name: { contains: opts.q.trim(), mode: "insensitive" as const } } }
      : {};
    return this.pageFromWhere(viewerUserId, where, opts.cursor);
  }

  async companyFeed(
    viewerUserId: string | undefined,
    slug: string,
    opts: { cursor?: string },
  ): Promise<SocialFeedPage> {
    const company = await this.prisma.company.findUnique({ where: { slug }, select: { id: true } });
    if (!company) throw new NotFoundException("Company not found");
    return this.pageFromWhere(viewerUserId, { companyId: company.id }, opts.cursor);
  }

  // Cursor = the previous page's last post id. Fetch PAGE_SIZE + 1 to learn
  // whether a next page exists without a second query.
  private async pageFromWhere(
    viewerUserId: string | undefined,
    where: Record<string, unknown>,
    cursor: string | undefined,
  ): Promise<SocialFeedPage> {
    const rows = await this.prisma.socialPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: SOCIAL_FEED_PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { company: { select: { slug: true, name: true, mainPhotoUrl: true, badgeTier: true } } },
    });
    const hasMore = rows.length > SOCIAL_FEED_PAGE_SIZE;
    const pageRows = hasMore ? rows.slice(0, SOCIAL_FEED_PAGE_SIZE) : rows;
    const posts = await this.serializePosts(pageRows, viewerUserId);
    return { posts, nextCursor: hasMore ? pageRows[pageRows.length - 1].id : null };
  }

  private async serializePosts(
    rows: Array<{
      id: string; companyId: string; imageUrl: string; caption: string | null; createdAt: Date;
      company: { slug: string; name: string; mainPhotoUrl: string | null; badgeTier: string };
    }>,
    viewerUserId: string | undefined,
  ): Promise<PublicSocialPost[]> {
    const ids = rows.map((r) => r.id);
    const [likeCounts, commentCounts, myLikes] = await Promise.all([
      this.prisma.socialPostLike.groupBy({ by: ["postId"], where: { postId: { in: ids } }, _count: { _all: true } }),
      this.prisma.socialComment.groupBy({ by: ["postId"], where: { postId: { in: ids } }, _count: { _all: true } }),
      viewerUserId
        ? this.prisma.socialPostLike.findMany({
            where: { postId: { in: ids }, userId: viewerUserId },
            select: { postId: true },
          })
        : Promise.resolve([]),
    ]);
    const likeByPost = new Map(likeCounts.map((r) => [r.postId, r._count._all]));
    const commentByPost = new Map(commentCounts.map((r) => [r.postId, r._count._all]));
    const likedByMe = new Set(myLikes.map((r) => r.postId));

    return rows.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      companySlug: r.company.slug,
      companyName: r.company.name,
      companyLogoUrl: r.company.mainPhotoUrl,
      companyBadgeTier: r.company.badgeTier as PublicSocialPost["companyBadgeTier"],
      imageUrl: r.imageUrl,
      caption: r.caption,
      createdAt: r.createdAt.toISOString(),
      likeCount: likeByPost.get(r.id) ?? 0,
      commentCount: commentByPost.get(r.id) ?? 0,
      likedByMe: viewerUserId ? likedByMe.has(r.id) : null,
    }));
  }
```

- [ ] **Step 4: Add the GET routes to `social.controller.ts`** (confirm optional-auth guard path first, see Interfaces)

```typescript
import { Get, Param, Query } from "@nestjs/common";
import { OptionalJwtAuthGuard } from "../../common/guards/optional-jwt-auth.guard"; // confirm
import { OptionalCurrentUser } from "../../common/decorators/optional-current-user.decorator"; // confirm

  @Get("feed")
  @UseGuards(OptionalJwtAuthGuard)
  feed(
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
    @Query("cursor") cursor?: string,
    @Query("q") q?: string,
  ) {
    return this.social.feed(user?.id, { cursor, q });
  }

  @Get("companies/:slug/posts")
  @UseGuards(OptionalJwtAuthGuard)
  companyPosts(
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
    @Param("slug") slug: string,
    @Query("cursor") cursor?: string,
  ) {
    return this.social.companyFeed(user?.id, slug, { cursor });
  }
```

- [ ] **Step 5: Run tests + typecheck** - `cd apps/api && pnpm exec jest social && pnpm exec tsc --noEmit`. Expected: PASS + clean.

- [ ] **Step 6: Manual smoke test**

```bash
curl -sS "http://localhost:3001/v1/social/feed" | jq '.posts | length, .nextCursor'
curl -sS "http://localhost:3001/v1/social/feed?q=worked" | jq '.posts[].companyName'
curl -sS "http://localhost:3001/v1/social/companies/i-worked-there/posts" | jq '.posts | length'
```

Expected: Task 4's post appears; `q` filters by company name; unknown slug 404s.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/social
git commit -m "feat(api): GET /social/feed + per-company feed, cursor-paginated"
```

---

### Task 6: Comments + post likes

**Files:**
- Modify: `apps/api/src/modules/social/social.service.ts` (add `addComment`, `listComments`, `deleteComment`, `toggleLike`, private `requirePost`, `serializeComments`)
- Modify: `apps/api/src/modules/social/social.controller.ts` (4 routes)
- Modify: `apps/api/src/modules/social/__tests__/social.service.test.ts` (add tests)

**Interfaces:**
- Produces: `SocialService.addComment(userId, postId, input): Promise<PublicSocialComment>`; `listComments(viewerUserId, postId): Promise<PublicSocialComment[]>`; `deleteComment(userId, commentId): Promise<void>`; `toggleLike(userId, postId): Promise<SocialPostLikeResult>`. Routes: `POST /social/posts/:id/comments` (JwtAuthGuard), `GET /social/posts/:id/comments` (OptionalJwtAuthGuard), `DELETE /social/comments/:id` (JwtAuthGuard), `POST /social/posts/:id/like` (JwtAuthGuard, toggles).

- [ ] **Step 1: Add tests** (append to `social.service.test.ts`)

```typescript
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
```

- [ ] **Step 2: Run (fails)** - `cd apps/api && pnpm exec jest social.service`.

- [ ] **Step 3: Implement in `social.service.ts`**

Add imports: `import type { CreateSocialCommentInput, PublicSocialComment, SocialPostLikeResult } from "@iwtr/shared-types";`

```typescript
  async addComment(userId: string, postId: string, input: CreateSocialCommentInput): Promise<PublicSocialComment> {
    await this.requirePost(postId);
    const result = this.moderation.checkContent([input.body]);
    if (result.violates) {
      throw new BadRequestException(
        "That comment looks like it names a person or breaks our content rules - please reword it.",
      );
    }
    const row = await this.prisma.socialComment.create({
      data: { postId, authorUserId: userId, body: input.body },
    });
    const [serialized] = await this.serializeComments([row], userId);
    return serialized;
  }

  async listComments(viewerUserId: string | undefined, postId: string): Promise<PublicSocialComment[]> {
    await this.requirePost(postId);
    const rows = await this.prisma.socialComment.findMany({ where: { postId }, orderBy: { createdAt: "asc" } });
    return this.serializeComments(rows, viewerUserId);
  }

  async deleteComment(userId: string, commentId: string): Promise<void> {
    const comment = await this.prisma.socialComment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException("Comment not found");
    if (comment.authorUserId !== userId) throw new ForbiddenException("You can only delete your own comment.");
    await this.prisma.socialComment.delete({ where: { id: commentId } });
  }

  async toggleLike(userId: string, postId: string): Promise<SocialPostLikeResult> {
    await this.requirePost(postId);
    const existing = await this.prisma.socialPostLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });
    if (existing) {
      await this.prisma.socialPostLike.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.socialPostLike.create({ data: { postId, userId } });
    }
    const likeCount = await this.prisma.socialPostLike.count({ where: { postId } });
    return { postId, likeCount, likedByMe: !existing };
  }

  private async requirePost(postId: string) {
    const post = await this.prisma.socialPost.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) throw new NotFoundException("Post not found");
    return post;
  }

  // REVIEW.md-adjacent: identical shape to ReviewsService.listForCompany's
  // author lookup. Explicit select, never include: { user: true }. The
  // returned shape has no authorUserId.
  private async serializeComments(
    rows: Array<{ id: string; postId: string; body: string; createdAt: Date; authorUserId: string }>,
    viewerUserId: string | undefined,
  ): Promise<PublicSocialComment[]> {
    const authorIds = [...new Set(rows.map((r) => r.authorUserId))];
    const authors = await this.prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, avatarKey: true, avatarGradient: true, reviewUsername: true },
    });
    const byId = new Map(authors.map((a) => [a.id, a]));
    return rows.map((r) => {
      const a = byId.get(r.authorUserId);
      return {
        id: r.id,
        postId: r.postId,
        body: r.body,
        createdAt: r.createdAt.toISOString(),
        displayUsername: a?.reviewUsername ?? null,
        avatarKey: a?.avatarKey ?? null,
        avatarGradient: a?.avatarGradient ?? null,
        mine: viewerUserId !== undefined && r.authorUserId === viewerUserId,
      };
    });
  }
```

- [ ] **Step 4: Add routes to `social.controller.ts`**

```typescript
import { Delete } from "@nestjs/common";
import { createSocialCommentInputSchema, type CreateSocialCommentInput } from "@iwtr/shared-types";

  @Post("posts/:id/comments")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  addComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") postId: string,
    @Body(new ZodValidationPipe(createSocialCommentInputSchema)) body: CreateSocialCommentInput,
  ) {
    return this.social.addComment(user.id, postId, body);
  }

  @Get("posts/:id/comments")
  @UseGuards(OptionalJwtAuthGuard)
  listComments(@OptionalCurrentUser() user: AuthenticatedUser | undefined, @Param("id") postId: string) {
    return this.social.listComments(user?.id, postId);
  }

  @Delete("comments/:id")
  @UseGuards(JwtAuthGuard)
  deleteComment(@CurrentUser() user: AuthenticatedUser, @Param("id") commentId: string) {
    return this.social.deleteComment(user.id, commentId);
  }

  @Post("posts/:id/like")
  @UseGuards(JwtAuthGuard)
  toggleLike(@CurrentUser() user: AuthenticatedUser, @Param("id") postId: string) {
    return this.social.toggleLike(user.id, postId);
  }
```

- [ ] **Step 5: Run tests + typecheck** - `cd apps/api && pnpm exec jest social && pnpm exec tsc --noEmit`. Expected: PASS + clean.

- [ ] **Step 6: Manual smoke test** (API running; two member tokens)

```bash
curl -sS -X POST http://localhost:3001/v1/social/posts/<postId>/comments -H "Authorization: Bearer <memberA>" -H "Content-Type: application/json" -d '{"body":"looks great"}' | jq
curl -sS "http://localhost:3001/v1/social/posts/<postId>/comments" | jq '.[0] | keys'   # no authorUserId/userId
curl -sS -X POST http://localhost:3001/v1/social/posts/<postId>/like -H "Authorization: Bearer <memberA>" | jq
curl -sS -X POST http://localhost:3001/v1/social/posts/<postId>/like -H "Authorization: Bearer <memberA>" | jq   # count back
curl -sS -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3001/v1/social/posts/<postId>/comments -H "Authorization: Bearer <memberA>" -H "Content-Type: application/json" -d '{"body":"this place is shit"}'   # 400
```

Expected: comment JSON keys are exactly `id, postId, body, createdAt, displayUsername, avatarKey, avatarGradient, mine`; like toggles; profanity -> `400`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/social
git commit -m "feat(api): social comments (moderated, anonymous) + post like toggle"
```

---

### Task 7: REVIEW.md update + whole-module review pass

**Files:**
- Modify: `REVIEW.md`
- Confirm: `uploads/` is gitignored

- [ ] **Step 1: Add the social module to REVIEW.md**

Under "What counts as anonymous routing logic", add:

```
- `apps/api/src/modules/social/**` - `SocialComment` is read/serialized under
  the same rule as `Review`: `SocialService.serializeComments` must stay an
  explicit `select` of `{ id, avatarKey, avatarGradient, reviewUsername }`,
  the public `PublicSocialComment` shape must never carry `authorUserId`, and
  no `prisma.socialComment.*` / `prisma.socialPost.*` query may add
  `include: { user: true }`.
```

Extend red-flag #1's model list with `prisma.socialComment.*` / `prisma.socialPost.*`, and red-flag #3's schema list with `packages/shared-types/src/schemas/social.ts`.

- [ ] **Step 2: Confirm uploads are gitignored** - `git check-ignore apps/api/uploads/social/x.webp` (should print the path). If not, add `apps/api/uploads/` to `.gitignore`.

- [ ] **Step 3: Full backend verification**

```bash
cd apps/api && pnpm exec tsc --noEmit && pnpm exec jest
cd ../.. && pnpm --filter @iwtr/api build
```

Expected: tsc clean, entire jest suite green, nest build succeeds.

- [ ] **Step 4: Self-review against the spec** - re-read `docs/superpowers/specs/2026-09-07-iwt-social-backend.md`. Confirm every requirement maps to a task (see Self-Review below).

- [ ] **Step 5: Commit**

```bash
git add REVIEW.md .gitignore
git commit -m "docs: add social module to REVIEW.md anonymity scope"
```

---

## Self-Review (done while writing this plan)

**Spec coverage:**
- Media pipeline (accept JPEG/PNG/HEIC, convert to compressed WebP, quality low but legible) -> Task 3 (`processSocialImage`, quality 58, max width 1080) + Task 4 (wired into `createPost`).
- Moderation on the "Tell us what you think !" text -> Task 4 (caption) + Task 6 (comment body), both hard 400 on `result.violates`.
- Net-new schema + `db push` -> Task 1.
- Anonymity reuse (`reviewUsername`, explicit select) -> Task 6 `serializeComments` + Task 7 REVIEW.md.
- Owner-verification gate -> Task 4 `requireApprovedOwnership`.
- Cursor pagination + server-side `q` company-name filter -> Task 5.
- No notifications table -> not built (spec's "reuse" note is descriptive; the task never asks for social notifications).
- No comment likes -> Task 1 has no `CommentLike`.

**Placeholder scan:** no TBD/TODO; every code step has full code. The "confirm exact path" notes are for existing symbols (`OptionalJwtAuthGuard`, `OptionalCurrentUser`, the guard/decorator import paths) the implementer verifies against a named existing file in the same step - not placeholders for missing logic.

**Type consistency:** `PublicSocialPost` / `PublicSocialComment` / `SocialFeedPage` / `SocialPostLikeResult` defined in Task 2, used with identical field names in Tasks 5-6. `processSocialImage(buffer, mimeType)` signature identical in Tasks 3-4. `requireApprovedOwnership` (Task 4) / `requirePost` (Task 6) / `serializeComments` (Task 6) / `serializePosts` (Task 5) each defined once and reused. `@@unique([postId, userId])` in Task 1 -> `where: { postId_userId: { postId, userId } }` in Task 6.

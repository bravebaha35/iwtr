# CV Generator, Job Application, and Member Display Name — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a job seeker fill in an optional CV (custom experience text, public-employee flag, a self-chosen display name), preview it live as an A4 document, and send it as a PDF to a company by clicking "Apply" on a job card — landing in a new owner-facing Applications inbox. Also give members a self-chosen display name (shown in the header instead of their anonymous handle, if they set one) alongside the existing owner real-name-in-header behavior.

**Architecture:** New Prisma fields on `User` (`displayName`, `isPublicEmployee`, `customExperienceText`) plus a new `JobApplication` model. PDF generation happens entirely client-side (`html2pdf.js` snapshotting a real DOM node) — the API only ever receives and stores an already-rendered PDF file, mirroring the existing `AvatarPhotoUploader` → `POST .../photo` → `{url}` pattern already used for employer photos. A new `job-applications` Nest module handles the upload + the owner's inbox reads.

**Tech Stack:** Next.js/React (apps/web), NestJS/Prisma (apps/api), zod (packages/shared-types), `html2pdf.js` + `framer-motion` (new apps/web deps), `isomorphic-dompurify` (new apps/api dep).

**Spec:** This plan is written directly from the feature request in conversation (no separate spec doc). Two clarifications the user gave before this plan was written, both binding:
1. The header's "real name instead of username" behavior is for **company-owner accounts only** (already built — see Task 5's note). Member/reviewer accounts keep their anonymous handle by default; this plan adds a **self-chosen, optional** display name a member can set for themselves.
2. A member's real first/last name (captured at registration for fraud deterrence, stored in `PiiVault`, already decrypted back to them only on `/me`'s read-only Personal tab) is never auto-pulled into anything public-facing. The CV's "real name" is whatever the member voluntarily types into the new `displayName` field — never a silent read from `PiiVault`.

## Global Constraints

- **Anonymity boundary (hard rule):** `displayName`, `isPublicEmployee`, and `customExperienceText` are never read by `ReviewsService`, `SocialService`, or any code path that serializes a `Review`/`SocialComment`/`SocialPost` author. Those keep using only `reviewUsername` / `randomUsername` / `OWNER_REAL_NAME`'s `EmployerProfile` lookup, exactly as today. This is the platform's core anonymity guarantee (see root `CLAUDE.md`) — do not wire the new fields into any of those three services, even for convenience.
- **No `dangerouslySetInnerHTML` anywhere in this plan.** `customExperienceText` and `displayName` are always rendered as plain React children (auto-escaped). Server-side DOMPurify sanitization (Task 3) is defense-in-depth on top of that, not a substitute for it — required explicitly by the user's security ask.
- **PDF generation is 100% client-side.** The API never renders HTML/CSS into a PDF and never fetches a URL to produce one (no server-side headless browser, no SSRF surface). It only accepts an already-rendered PDF file upload.
- Upload validation for the PDF: `mimetype === "application/pdf"` AND the first 5 bytes of the buffer equal `%PDF-` (ASCII) AND size ≤ 8 MB. Reject otherwise with `BadRequestException`.
- New Prisma migration applied via `prisma db push` (this repo has no working `prisma migrate dev` — see root CLAUDE.md gotcha). Stop the running `apps/api` dev server before `prisma generate`/`db push` (Windows `EPERM` on the loaded query-engine `.dll`), restart it after.
- Fonts: `next/font/google`'s `Plus_Jakarta_Sans` and `Space_Grotesk`, self-hosted at build time — never a runtime Google Fonts `<link>`/`@import`.
- New colors: use Tailwind's built-in `zinc`/`slate` scale (already available, no new hex/theme tokens needed) — `bg-zinc-50 dark:bg-zinc-950`, `text-slate-900 dark:text-slate-100`, `border-slate-800`. Radius: `rounded-none`/`rounded-sm` only inside this feature's own new components (`CvPreview`, the Apply button, the Applications inbox) — do not touch existing card radii elsewhere.
- Motion: `framer-motion` with an explicit cubic-bezier easing array (e.g. `[0.34, 1.56, 0.64, 1]` for a magnetic snap) — never `animate-pulse` or a linear CSS transition for these specific new interactions.
- `ZodValidationPipe` stays `@Body()`/`@Query()`-scoped per parameter, never a method-level `@UsePipes` (root CLAUDE.md gotcha — several new endpoints below take a `@CurrentUser()` too).
- `apps/web` never talks to the DB directly; every new client call goes through `apiGet`/`apiPost`/`apiUpload` in `apps/web/src/lib/api-client.ts`.
- Rebuild `packages/shared-types` (`pnpm exec tsc`) after every schema edit, before any `apps/web`/`apps/api` task that imports the new types.

---

### Task 1: Prisma schema — new User fields and the JobApplication model

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

**Interfaces:**
- Produces: `User.displayName: string | null`, `User.isPublicEmployee: boolean`, `User.customExperienceText: string | null`, and a new `JobApplication` model with fields `id, jobPostingId, companyId, applicantUserId, pdfUrl, createdAt, viewedAt`.

- [ ] **Step 1: Stop the running API dev server**

It's tracked as background task `bi0ejr53k` in this session — stop it via your task-stop tool before touching the schema (Windows EPERM otherwise). Restart it (`cd apps/api && pnpm dev`) only after Step 4 below succeeds.

- [ ] **Step 2: Add the three new scalar fields to `model User`**

Add these lines inside `model User { ... }`, directly after the existing `district String?` field (around line 227):

```prisma
  // Optional, self-chosen, free-text display name a member can set on their
  // own Edit Profile page. Purely voluntary disclosure by the member
  // themselves — this is NEVER read from PiiVault and NEVER used as a
  // Review/SocialComment author identity (see this plan's Global
  // Constraints). Shown in GlobalHeader (falling back to reviewUsername when
  // null) and on the member's own CV/PDF application, nowhere else.
  displayName          String?
  // Self-declared on the CV / Edit Profile page. No server-side verification
  // of this claim — it's informational context on the applicant's own CV,
  // not a moderation or eligibility gate.
  isPublicEmployee     Boolean  @default(false)
  // Free-typed employment history for a company not in the constrained
  // EmploymentHistory picker list (e.g. "Freelance, 2022-2023, no matching
  // company on file"). Sanitized server-side (ProfileService.updateProfile,
  // Task 3) before storage; always rendered as plain text, never HTML.
  customExperienceText String?
```

Add this to `User`'s relations block, alongside the other `xyz Xyz[]` lines (near `savedJobPostings JobApplication[]` — insert right after `savedJobPostings SavedJobPosting[]`):

```prisma
  jobApplications  JobApplication[]
```

- [ ] **Step 3: Add `jobApplications JobApplication[]` relations and the new model**

Add `jobApplications JobApplication[]` to the relations list inside `model JobPosting { ... }` (right after `savedBy SavedJobPosting[]`) and inside `model Company { ... }` (find its relations block near the other `xyz[]` lines and add it there, same convention).

Add this new model directly after `model JobPosting { ... }` (after its closing `}` around line 571), before `OwnerContactMessage`:

```prisma
// A job seeker's application to one JobPosting: a client-generated PDF CV
// (apps/web renders it via html2pdf.js from the CvPreview component, never
// server-side — see this plan's Global Constraints on avoiding an SSRF
// surface) plus nothing else — no snapshot of profile fields is duplicated
// onto this row, since the PDF itself is the durable record of what the
// applicant submitted at that moment.
model JobApplication {
  id              String     @id @default(uuid())
  jobPostingId    String
  jobPosting      JobPosting @relation(fields: [jobPostingId], references: [id], onDelete: Cascade)
  companyId       String
  company         Company    @relation(fields: [companyId], references: [id])
  applicantUserId String
  applicant       User       @relation(fields: [applicantUserId], references: [id])
  pdfUrl          String
  createdAt       DateTime   @default(now())
  // Set by the owner's "mark viewed" action in the Applications inbox
  // (Task 4/7) — null means unread, same on/off-null pattern as
  // OwnerContactMessage.resolvedAt.
  viewedAt        DateTime?

  // Re-applying to the same posting replaces the existing row (Task 4
  // deletes the old PDF file and updates this row) rather than piling up
  // duplicates in the owner's inbox.
  @@unique([jobPostingId, applicantUserId])
  @@index([companyId])
  @@index([jobPostingId])
  @@schema("public")
}
```

- [ ] **Step 4: Regenerate the Prisma client and push the schema**

```bash
cd apps/api
pnpm exec prisma generate
pnpm exec prisma db push
```

Expected: both commands succeed with no errors. `db push` reports the new `JobApplication` table and the three new `User` columns.

- [ ] **Step 5: Restart the API dev server**

Restart the background task you stopped in Step 1 (`cd apps/api && pnpm dev`). Confirm the NestJS startup log ends with `API listening on http://localhost:3001/v1` with no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(api): add User CV fields and JobApplication model"
```

---

### Task 2: shared-types — zod schemas for the new profile fields and job applications

**Files:**
- Modify: `packages/shared-types/src/schemas/user.ts`
- Create: `packages/shared-types/src/schemas/jobApplication.ts`
- Modify: `packages/shared-types/src/index.ts`

**Interfaces:**
- Consumes: nothing new from other tasks (pure schema addition).
- Produces: `MyProfile.displayName/isPublicEmployee/customExperienceText`, `UpdateProfileInput` gains the same three (optional), `OnboardingStatus.displayName`, and a new `JobApplicationListItem` / `SubmitJobApplicationResponse` pair Tasks 4/6/7 import.

- [ ] **Step 1: Extend `onboardingStatusSchema`**

In `packages/shared-types/src/schemas/user.ts`, inside `onboardingStatusSchema` (around line 145-159), add a field after `reviewUsername`:

```ts
  reviewUsername: z.string().nullable(),
  // Self-chosen, optional — see MyProfile.displayName's comment below. Read
  // by GlobalHeader as the member-side counterpart to the owner-side
  // employerDisplayName fallback that already exists there.
  displayName: z.string().nullable(),
```

- [ ] **Step 2: Extend `myProfileSchema`**

Add after `email: z.string().nullable(),` inside `myProfileSchema` (around line 188):

```ts
  // Voluntary, member-chosen display name — NEVER auto-filled from PiiVault,
  // NEVER used as a Review/SocialComment author identity. See this file's
  // updateProfileInputSchema comment and the plan's Global Constraints.
  displayName: z.string().nullable(),
  isPublicEmployee: z.boolean(),
  customExperienceText: z.string().nullable(),
```

- [ ] **Step 3: Extend `updateProfileInputSchema`**

Add inside the `.object({ ... })` (around line 192-204), after `district: z.string().min(1).optional(),`:

```ts
    // "" clears the field back to null (ProfileService.updateProfile maps
    // "" -> null, same emptyToNull pattern already used for company contact
    // fields) — kept as a plain string union rather than .nullable() so an
    // HTML form field (which can only ever submit a string) can express
    // "clear this" without a separate boolean.
    displayName: z.union([z.string().trim().min(1).max(80), z.literal("")]).optional(),
    isPublicEmployee: z.boolean().optional(),
    customExperienceText: z.union([z.string().trim().max(2000), z.literal("")]).optional(),
```

And add the three new fields to the trailing `.refine(...)` "at least one field" check (around line 205-214), inside the boolean OR chain:

```ts
      v.reviewUsername !== undefined ||
      v.avatarKey !== undefined ||
      v.avatarGradient !== undefined ||
      v.country !== undefined ||
      v.city !== undefined ||
      v.district !== undefined ||
      v.displayName !== undefined ||
      v.isPublicEmployee !== undefined ||
      v.customExperienceText !== undefined,
```

- [ ] **Step 4: Create `packages/shared-types/src/schemas/jobApplication.ts`**

```ts
import { z } from "zod";

// Returned by POST job-postings/:jobPostingId/apply once the PDF is stored.
export const submitJobApplicationResponseSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string(),
});
export type SubmitJobApplicationResponse = z.infer<typeof submitJobApplicationResponseSchema>;

// One row in an owner's Applications inbox (GET my-companies/:companyId/job-applications).
export const jobApplicationListItemSchema = z.object({
  id: z.string().uuid(),
  jobPostingId: z.string().uuid(),
  jobTitle: z.string(),
  // The applicant's own displayName if they set one, else "Anonymous
  // applicant" — never the applicant's PiiVault real name or userId. See
  // this plan's Global Constraints.
  applicantDisplayName: z.string(),
  pdfUrl: z.string(),
  createdAt: z.string(),
  viewedAt: z.string().nullable(),
});
export type JobApplicationListItem = z.infer<typeof jobApplicationListItemSchema>;
```

- [ ] **Step 5: Export the new schema file**

In `packages/shared-types/src/index.ts`, find the block of `export * from "./schemas/..."` lines and add, alphabetically near the other job-related exports:

```ts
export * from "./schemas/jobApplication";
```

- [ ] **Step 6: Rebuild and commit**

```bash
cd packages/shared-types
pnpm exec tsc
git add src/schemas/user.ts src/schemas/jobApplication.ts src/index.ts
git commit -m "feat(shared-types): add CV profile fields and job application schemas"
```

(Do not commit `dist/` — it's gitignored in this repo.)

---

### Task 3: apps/api — extend ProfileService with the new fields, DOMPurify-sanitize customExperienceText

**Files:**
- Modify: `apps/api/src/modules/profile/profile.service.ts`
- Modify: `apps/api/src/modules/profile/__tests__/profile.service.test.ts` (or wherever its existing test file lives — locate it with `Glob apps/api/src/modules/profile/**/*.test.ts` first)
- Modify: `apps/api/package.json` (new dependency)

**Interfaces:**
- Consumes: `MyProfile`, `UpdateProfileInput` from Task 2.
- Produces: `GET /me/profile` and `PATCH /me/profile` now read/write `displayName`, `isPublicEmployee`, `customExperienceText`.

- [ ] **Step 1: Add the sanitizer dependency**

```bash
cd apps/api
pnpm add isomorphic-dompurify
```

- [ ] **Step 2: Sanitize and persist the new fields in `updateProfile`**

At the top of `apps/api/src/modules/profile/profile.service.ts`, add:

```ts
import DOMPurify from "isomorphic-dompurify";
```

Add this helper near the top of the file (alongside the existing `EDU_LEVEL_RANK`/`byEduLevel` helpers):

```ts
// "" from the client means "clear this field" (see updateProfileInputSchema's
// comment) — mapped to null for storage, same emptyToNull convention already
// used for company contact fields (see owner.service.ts). ALLOWED_TAGS: []
// makes this a strict HTML-stripping pass — the field is always rendered as
// plain text (never dangerouslySetInnerHTML), so this is defense-in-depth
// against a stored-XSS payload that some future code path might render as
// HTML, not the only thing preventing it today.
function sanitizeFreeText(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === "") return null;
  return DOMPurify.sanitize(value, { ALLOWED_TAGS: [] }).trim();
}
```

In `updateProfile`'s `data: { ... }` block (around line 115-124), add three lines:

```ts
        ...(input.displayName !== undefined ? { displayName: sanitizeFreeText(input.displayName) } : {}),
        ...(input.isPublicEmployee !== undefined ? { isPublicEmployee: input.isPublicEmployee } : {}),
        ...(input.customExperienceText !== undefined
          ? { customExperienceText: sanitizeFreeText(input.customExperienceText) }
          : {}),
```

- [ ] **Step 3: Return the new fields from `getMyProfile`**

In the `return { ... }` block of `getMyProfile` (around line 73-89), add after `district: user.district,`:

```ts
      displayName: user.displayName,
      isPublicEmployee: user.isPublicEmployee,
      customExperienceText: user.customExperienceText,
```

- [ ] **Step 4: Add displayName to onboarding status**

In `apps/api/src/modules/onboarding/onboarding.service.ts`, in `getStatus`'s return object (around line 25-33), add after `reviewUsername: user.reviewUsername,`:

```ts
      displayName: user.displayName,
```

- [ ] **Step 5: Write the tests**

Locate the existing profile service test file (`Glob apps/api/src/modules/profile/**/*.test.ts`) and add a new `describe("CV profile fields", ...)` block with these cases:

```ts
describe("CV profile fields", () => {
  it("strips HTML tags from customExperienceText before saving", async () => {
    // Arrange: mock prisma.user.findUniqueOrThrow to return an ACTIVE user.
    // Act: call updateProfile(userId, { customExperienceText: "<script>alert(1)</script>Worked at a bakery" }).
    // Assert: prisma.user.update was called with
    //   data.customExperienceText === "Worked at a bakery" (no tags, trimmed).
  });

  it("clears customExperienceText when given an empty string", async () => {
    // Act: updateProfile(userId, { customExperienceText: "" }).
    // Assert: data.customExperienceText === null.
  });

  it("clears displayName when given an empty string", async () => {
    // Act: updateProfile(userId, { displayName: "" }).
    // Assert: data.displayName === null.
  });

  it("persists isPublicEmployee as given", async () => {
    // Act: updateProfile(userId, { isPublicEmployee: true }).
    // Assert: data.isPublicEmployee === true.
  });

  it("getMyProfile returns the three new fields", async () => {
    // Arrange: mock user row with displayName: "Ada", isPublicEmployee: true, customExperienceText: "Freelance work".
    // Act: getMyProfile(userId).
    // Assert: result.displayName === "Ada", result.isPublicEmployee === true, result.customExperienceText === "Freelance work".
  });
});
```

Follow this test file's existing mocking conventions exactly (how it mocks `PrismaService`, `PiiVaultService`, `PhoneVerificationService` — read the file's existing `describe("updateProfile", ...)` block first and match its setup pattern precisely, including how it asserts on `prisma.user.update`'s call arguments).

- [ ] **Step 6: Run the tests**

```bash
cd apps/api
pnpm test -- profile.service
```

Expected: all tests pass, including the 5 new ones.

- [ ] **Step 7: Commit**

```bash
git add apps/api/package.json apps/api/pnpm-lock.yaml apps/api/src/modules/profile apps/api/src/modules/onboarding
git commit -m "feat(api): persist and sanitize CV profile fields (displayName, isPublicEmployee, customExperienceText)"
```

---

### Task 4: apps/api — new job-applications module (apply upload + owner inbox)

**Files:**
- Create: `apps/api/src/modules/job-applications/job-applications.module.ts`
- Create: `apps/api/src/modules/job-applications/job-applications.controller.ts`
- Create: `apps/api/src/modules/job-applications/job-applications.service.ts`
- Create: `apps/api/src/modules/job-applications/__tests__/job-applications.service.test.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `JobApplication` Prisma model (Task 1), `JobApplicationListItem`/`SubmitJobApplicationResponse` (Task 2).
- Produces: `POST job-postings/:jobPostingId/apply`, `GET my-companies/:companyId/job-applications`, `POST my-companies/:companyId/job-applications/:id/mark-viewed` — Task 6 (Apply button) and Task 7 (owner inbox UI) call these through `apiUpload`/`apiGet`/`apiPost`.

- [ ] **Step 1: Write `job-applications.service.ts`**

```ts
import { randomUUID } from "crypto";
import { join } from "path";
import { mkdir, unlink, writeFile } from "fs/promises";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { JobApplicationListItem, SubmitJobApplicationResponse } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";

const UPLOADS_DIR = join(process.cwd(), "uploads", "job-applications");
const MAX_PDF_SIZE_BYTES = 8 * 1024 * 1024;
const PDF_MAGIC_BYTES = Buffer.from("%PDF-", "ascii");

function isRealPdf(file: Express.Multer.File): boolean {
  if (file.mimetype !== "application/pdf") return false;
  if (file.buffer.length > MAX_PDF_SIZE_BYTES) return false;
  return file.buffer.subarray(0, 5).equals(PDF_MAGIC_BYTES);
}

@Injectable()
export class JobApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Duplicated from JobPostingsService.requireApprovedOwnership on purpose —
  // matches this codebase's existing module-per-feature convention (see the
  // identical comment on JobPostingsService's own copy).
  private async requireApprovedOwnership(userId: string, companyId: string) {
    const ownership = await this.prisma.companyOwner.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!ownership || ownership.claimStatus !== "APPROVED") {
      throw new ForbiddenException("You are not an approved owner of this company");
    }
    return ownership;
  }

  async apply(
    userId: string,
    userRole: string,
    jobPostingId: string,
    file: Express.Multer.File | undefined,
  ): Promise<SubmitJobApplicationResponse> {
    if (userRole === "COMPANY_OWNER") {
      throw new ForbiddenException("Company owners can't apply to job postings.");
    }
    if (!file) {
      throw new BadRequestException("No file uploaded.");
    }
    if (!isRealPdf(file)) {
      throw new BadRequestException("Uploaded file must be a valid PDF under 8MB.");
    }

    const posting = await this.prisma.jobPosting.findUnique({ where: { id: jobPostingId } });
    if (!posting || posting.status !== "PUBLISHED" || posting.filledAt !== null) {
      throw new NotFoundException("This job posting is no longer accepting applications.");
    }

    const existing = await this.prisma.jobApplication.findUnique({
      where: { jobPostingId_applicantUserId: { jobPostingId, applicantUserId: userId } },
    });

    await mkdir(UPLOADS_DIR, { recursive: true });
    const filename = `${randomUUID()}.pdf`;
    await writeFile(join(UPLOADS_DIR, filename), file.buffer);
    const origin = process.env.API_PUBLIC_ORIGIN ?? `http://localhost:${process.env.PORT ?? 3001}`;
    const pdfUrl = `${origin}/uploads/job-applications/${filename}`;

    if (existing) {
      // Re-applying replaces the previous submission rather than piling up
      // duplicates in the owner's inbox (see @@unique on the Prisma model).
      const oldPath = existing.pdfUrl.split("/uploads/job-applications/")[1];
      if (oldPath) {
        await unlink(join(UPLOADS_DIR, oldPath)).catch(() => {
          // Best-effort cleanup — an orphaned old file is harmless disk usage,
          // never worth failing the new application over.
        });
      }
      const updated = await this.prisma.jobApplication.update({
        where: { id: existing.id },
        data: { pdfUrl, createdAt: new Date(), viewedAt: null },
      });
      return { id: updated.id, createdAt: updated.createdAt.toISOString() };
    }

    const created = await this.prisma.jobApplication.create({
      data: { jobPostingId, companyId: posting.companyId, applicantUserId: userId, pdfUrl },
    });
    return { id: created.id, createdAt: created.createdAt.toISOString() };
  }

  async listForCompany(userId: string, companyId: string): Promise<JobApplicationListItem[]> {
    await this.requireApprovedOwnership(userId, companyId);
    const rows = await this.prisma.jobApplication.findMany({
      where: { companyId },
      include: { jobPosting: { select: { jobTitle: true } }, applicant: { select: { displayName: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      jobPostingId: r.jobPostingId,
      jobTitle: r.jobPosting.jobTitle,
      applicantDisplayName: r.applicant.displayName ?? "Anonymous applicant",
      pdfUrl: r.pdfUrl,
      createdAt: r.createdAt.toISOString(),
      viewedAt: r.viewedAt ? r.viewedAt.toISOString() : null,
    }));
  }

  async markViewed(userId: string, companyId: string, id: string): Promise<void> {
    await this.requireApprovedOwnership(userId, companyId);
    const application = await this.prisma.jobApplication.findUnique({ where: { id } });
    if (!application || application.companyId !== companyId) {
      throw new NotFoundException("Application not found.");
    }
    if (application.viewedAt === null) {
      await this.prisma.jobApplication.update({ where: { id }, data: { viewedAt: new Date() } });
    }
  }
}
```

- [ ] **Step 2: Write `job-applications.controller.ts`**

```ts
import { Body, Controller, Param, ParseUUIDPipe, Post, Get, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { JobApplicationsService } from "./job-applications.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class JobApplicationsController {
  constructor(private readonly jobApplications: JobApplicationsService) {}

  @Post("job-postings/:jobPostingId/apply")
  @UseInterceptors(FileInterceptor("file"))
  apply(
    @CurrentUser() user: AuthenticatedUser,
    @Param("jobPostingId", new ParseUUIDPipe()) jobPostingId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.jobApplications.apply(user.id, user.role, jobPostingId, file);
  }

  @Get("my-companies/:companyId/job-applications")
  list(@CurrentUser() user: AuthenticatedUser, @Param("companyId", new ParseUUIDPipe()) companyId: string) {
    return this.jobApplications.listForCompany(user.id, companyId);
  }

  @Post("my-companies/:companyId/job-applications/:id/mark-viewed")
  markViewed(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.jobApplications.markViewed(user.id, companyId, id);
  }
}
```

Note: `@Body(new ZodValidationPipe(...))` isn't used here since neither endpoint takes a JSON body — this doesn't violate the root CLAUDE.md gotcha (that rule is about method-level `@UsePipes`, not about endpoints with no body schema at all).

- [ ] **Step 3: Write `job-applications.module.ts`**

```ts
import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { JobApplicationsController } from "./job-applications.controller";
import { JobApplicationsService } from "./job-applications.service";

@Module({
  imports: [PrismaModule],
  controllers: [JobApplicationsController],
  providers: [JobApplicationsService],
})
export class JobApplicationsModule {}
```

(Confirm `PrismaModule`'s exact import path/name by checking how `JobPostingsModule` imports it — mirror that exactly if it differs from the above.)

- [ ] **Step 4: Register the module**

In `apps/api/src/app.module.ts`, add `JobApplicationsModule` to the `imports` array, alongside `JobPostingsModule`.

- [ ] **Step 5: Write the tests**

Create `apps/api/src/modules/job-applications/__tests__/job-applications.service.test.ts`. Match the mocking style of `apps/api/src/modules/job-postings/__tests__/job-postings.service.test.ts` (read it first for the exact `PrismaService` mock shape this codebase uses). Cover:

- `apply` rejects a `COMPANY_OWNER` caller with `ForbiddenException`.
- `apply` rejects a non-PDF mimetype with `BadRequestException`.
- `apply` rejects a file whose buffer doesn't start with `%PDF-` even if `mimetype` claims `application/pdf`.
- `apply` rejects when the posting's `status !== "PUBLISHED"` or `filledAt !== null`, with `NotFoundException`.
- `apply` creates a new `JobApplication` row on first application.
- `apply` updates (not duplicates) the existing row on a second application to the same posting by the same user.
- `listForCompany` throws `ForbiddenException` for a non-approved-owner caller.
- `listForCompany` maps a null `applicant.displayName` to `"Anonymous applicant"`.
- `markViewed` is a no-op (doesn't call `prisma.jobApplication.update`) when `viewedAt` is already set.

- [ ] **Step 6: Run the tests**

```bash
cd apps/api
pnpm test -- job-applications
```

Expected: all new tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/job-applications apps/api/src/app.module.ts
git commit -m "feat(api): add job-applications module (apply upload + owner inbox)"
```

---

### Task 5: apps/web — fonts, palette setup, and the CV editor + live A4 preview on /me

**Files:**
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/globals.css`
- Create: `apps/web/src/components/profile/CvPreview.tsx`
- Modify: `apps/web/src/app/me/page.tsx`
- Modify: `apps/web/src/components/GlobalHeader.tsx`

**Interfaces:**
- Consumes: `MyProfile` (Task 2/3, now carrying `displayName`/`isPublicEmployee`/`customExperienceText`), `OnboardingStatus.displayName`.
- Produces: `CvPreview` component, imported by Task 6's Apply-button flow (the same DOM node it renders is what `html2pdf.js` snapshots) — export it so Task 6 can reuse it directly rather than re-deriving the CV layout.

- [ ] **Step 1: Add self-hosted fonts**

In `apps/web/src/app/layout.tsx`, alongside however the existing font (if any — check for an existing `next/font` import first) is wired, add:

```ts
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });
```

Add both `.variable` classes to the `<html>` (or `<body>`) element's `className`, alongside whatever classes are already there — e.g. `` `${plusJakartaSans.variable} ${spaceGrotesk.variable}` ``.

- [ ] **Step 2: Map the font CSS variables into Tailwind**

In `apps/web/src/app/globals.css`, inside the existing `@theme inline { ... }` block (around line 74-80), add:

```css
  --font-jakarta: var(--font-jakarta);
  --font-grotesk: var(--font-grotesk);
```

This makes `font-jakarta` / `font-grotesk` available as Tailwind utility classes.

- [ ] **Step 3: Create `CvPreview.tsx`**

`MyProfile` (Task 2/3) carries `education` but not employment history — that's a separate existing endpoint, `GET /me/employment-history` returning `MyEmploymentEntry[]` (`packages/shared-types/src/schemas/review.ts`, fields: `rawCompanyName`, `jobTitle`, `startDate`, `endDate`, plus `companyId`/`hasReview`/`reviewId` this component ignores). `CvPreview` fetches that itself (rather than pushing a second required prop onto both of Task 6's call sites) so it stays a single self-contained "give me a profile, get a CV" component:

```tsx
"use client";

import { useEffect, useState } from "react";
import type { MyEmploymentEntry, MyProfile } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { Avatar } from "@/components/Avatar";

function formatRange(startDate: string | null, endDate: string | null): string {
  const start = startDate ? new Date(startDate).getFullYear() : "?";
  const end = endDate ? new Date(endDate).getFullYear() : "Present";
  return `${start} - ${end}`;
}

// The single source of truth for what a CV looks like — both the live
// preview on /me and Task 6's PDF generation render this exact component
// (html2pdf.js snapshots this component's DOM node directly), so the PDF a
// company receives always matches what the applicant saw on screen.
export function CvPreview({ profile, id }: { profile: MyProfile; id?: string }) {
  const [employment, setEmployment] = useState<MyEmploymentEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiGet<MyEmploymentEntry[]>("/me/employment-history").then((data) => {
      if (!cancelled) setEmployment(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const name = profile.displayName?.trim() || "Your name here";
  const hasAnyExperience = employment.length > 0 || !!profile.customExperienceText;

  return (
    <div
      id={id}
      className="flex aspect-[1/1.414] w-full flex-col gap-4 overflow-y-auto border border-slate-800 bg-zinc-50 p-6 font-jakarta text-slate-900 dark:bg-zinc-50 dark:text-slate-900"
    >
      <header className="flex items-center gap-4 border-b border-slate-800 pb-4">
        <Avatar avatarKey={profile.avatarKey} avatarGradient={profile.avatarGradient} size="md" />
        <div className="min-w-0">
          <h1 className="truncate font-grotesk text-2xl font-bold">{name}</h1>
          <p className="truncate text-sm text-slate-600">
            {profile.email}
            {profile.phoneNumber ? ` · ${profile.phoneNumber}` : ""}
          </p>
          {profile.isPublicEmployee && (
            <span className="mt-1 inline-block rounded-none border border-slate-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              Public Sector Employee
            </span>
          )}
        </div>
      </header>

      <section>
        <h2 className="font-grotesk text-xs font-bold uppercase tracking-wide text-slate-600">Employment History</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {!hasAnyExperience && <li className="text-sm text-slate-500">Nothing added yet.</li>}
          {employment.map((e) => (
            <li key={e.id} className="text-sm">
              <p className="font-bold">{e.jobTitle ?? "Employee"} — {e.rawCompanyName}</p>
              <p className="text-xs text-slate-600">{formatRange(e.startDate, e.endDate)}</p>
            </li>
          ))}
          {profile.customExperienceText && (
            <li className="whitespace-pre-wrap text-sm">{profile.customExperienceText}</li>
          )}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Add a "My CV" tab to `/me`**

In `apps/web/src/app/me/page.tsx`, find the tab list (around line 30-39, the same `customize/personal/contact/education/security/account` set referenced in this plan's research). Add a 7th tab key `"cv"` with label "My CV", following the exact pattern the existing tabs use for their button/active-state rendering.

Render, when `activeTab === "cv"`, a two-column layout (stack to one column below `sm:`):

```tsx
<div className="flex flex-col gap-6 sm:flex-row">
  <div className="flex-1 flex flex-col gap-4">
    <div>
      <label className="text-sm font-medium text-foreground">Display name</label>
      <p className="text-xs text-muted-foreground">
        Optional. Shown on your CV and in the site header instead of your anonymous handle — your reviews
        always stay under your anonymous handle regardless of this setting.
      </p>
      <input
        type="text"
        maxLength={80}
        value={displayNameDraft}
        onChange={(e) => setDisplayNameDraft(e.target.value)}
        className="mt-1 w-full rounded-none border border-slate-800 bg-surface px-3 py-2 text-sm"
      />
    </div>
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={isPublicEmployeeDraft} onChange={(e) => setIsPublicEmployeeDraft(e.target.checked)} />
      I am a public sector employee
    </label>
    <div>
      <label className="text-sm font-medium text-foreground">Other work experience</label>
      <p className="text-xs text-muted-foreground">
        For an employer not in the list on your Personal tab — free text, up to 2000 characters.
      </p>
      <textarea
        maxLength={2000}
        rows={6}
        value={customExperienceDraft}
        onChange={(e) => setCustomExperienceDraft(e.target.value)}
        className="mt-1 w-full rounded-none border border-slate-800 bg-surface px-3 py-2 text-sm"
      />
    </div>
    <button
      type="button"
      onClick={saveCv}
      disabled={cvSaving}
      className="self-start rounded-none border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-bold text-zinc-50 transition disabled:opacity-50"
    >
      {cvSaving ? "Saving..." : "Save CV"}
    </button>
  </div>
  <div className="flex-1">
    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">How it looks</p>
    <CvPreview profile={profile} />
  </div>
</div>
```

Wire `displayNameDraft`/`isPublicEmployeeDraft`/`customExperienceDraft` as `useState` initialized from the loaded `profile` (matching how this page's other tabs initialize their own draft state from `profile` — read one existing tab's save handler, e.g. the Personal tab's `country`/`city` save flow, and mirror its `apiPatch("/me/profile", {...})` + local-state-refresh pattern exactly for `saveCv`).

- [ ] **Step 5: Wire displayName into GlobalHeader's fallback chain**

In `apps/web/src/components/GlobalHeader.tsx`, at line 205, change:

```tsx
{employerDisplayName || onboardingStatus.reviewUsername || avatarLabel(onboardingStatus.avatarKey) || "Anonymous"}
```

to:

```tsx
{employerDisplayName || onboardingStatus.displayName || onboardingStatus.reviewUsername || avatarLabel(onboardingStatus.avatarKey) || "Anonymous"}
```

`employerDisplayName` (owner real name) still wins for owners, exactly as today — this only adds a rung between it and `reviewUsername` for everyone else.

- [ ] **Step 6: Manual verification**

Start both dev servers if not already running. Log in as a MEMBER (not an owner), go to `/me`, open the new "My CV" tab, type a display name and some custom experience text containing `<b>test</b>`, save, and confirm: (a) the live preview updates without a page reload, (b) after saving and reloading `/me`, the custom experience text renders as literal `<b>test</b>` text — never bold — confirming the sanitizer stripped the tag and the client never interprets it as HTML, (c) the header now shows the chosen display name instead of the anonymous handle.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/layout.tsx apps/web/src/app/globals.css apps/web/src/components/profile/CvPreview.tsx apps/web/src/app/me/page.tsx apps/web/src/components/GlobalHeader.tsx
git commit -m "feat(web): CV editor with live A4 preview, member-chosen display name in header"
```

---

### Task 6: apps/web — client-side PDF generation and the Apply button on JobCard

**Files:**
- Modify: `apps/web/package.json` (new deps)
- Modify: `apps/web/src/lib/api-client.ts`
- Create: `apps/web/src/components/jobs/ApplyButton.tsx`
- Modify: `apps/web/src/components/jobs/JobCard.tsx`

**Interfaces:**
- Consumes: `CvPreview` (Task 5), `SubmitJobApplicationResponse` (Task 2), `apiUpload` (existing).
- Produces: `<ApplyButton jobPostingId={...} />`, rendered by `JobCard` next to the existing Mail/Call buttons.

- [ ] **Step 1: Add dependencies**

```bash
cd apps/web
pnpm add html2pdf.js framer-motion
```

- [ ] **Step 2: Add an `apiUpload`-based helper for applying**

`apiUpload` in `apps/web/src/lib/api-client.ts` is already generic — no change needed there. `ApplyButton` will call `apiUpload<SubmitJobApplicationResponse>(\`/job-postings/${jobPostingId}/apply\`, formData)` directly.

- [ ] **Step 3: Write `ApplyButton.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { MyProfile, SubmitJobApplicationResponse } from "@iwtr/shared-types";
import { apiGet, apiUpload } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { CvPreview } from "@/components/profile/CvPreview";

// Renders the actual CvPreview off-screen (never visible to the user as a
// second copy on the page) purely so html2pdf.js has a real DOM node with
// real layout to snapshot — this is the same node design shown live on
// /me's "My CV" tab (see Task 5), so the PDF a company receives always
// matches what the applicant already saw there. profile is fetched once on
// mount (not per click) since Apply is a fast action — a stale-by-a-few-
// minutes CV snapshot is an acceptable tradeoff against re-fetching on
// every click.
export function ApplyButton({ jobPostingId }: { jobPostingId: string }) {
  const { isAuthenticated, role } = useAuth();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [state, setState] = useState<"idle" | "generating" | "sending" | "done" | "error">("idle");
  const hiddenPreviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated || role === "COMPANY_OWNER") return;
    let cancelled = false;
    apiGet<MyProfile>("/me/profile").then((data) => {
      if (!cancelled) setProfile(data);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, role]);

  if (!isAuthenticated || role === "COMPANY_OWNER") return null;

  async function handleApply() {
    if (!hiddenPreviewRef.current) return;
    setState("generating");
    try {
      // html2pdf.js needs the node actually mounted (even if visually
      // hidden via position, never `display:none` — that produces a blank
      // PDF) to compute real layout before snapshotting it.
      const html2pdf = (await import("html2pdf.js")).default;
      const blob: Blob = await html2pdf()
        .set({ filename: "cv.pdf", jsPDF: { format: "a4" } })
        .from(hiddenPreviewRef.current)
        .outputPdf("blob");

      setState("sending");
      const formData = new FormData();
      formData.append("file", blob, "cv.pdf");
      await apiUpload<SubmitJobApplicationResponse>(`/job-postings/${jobPostingId}/apply`, formData);
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <>
      <motion.button
        type="button"
        onClick={handleApply}
        disabled={!profile || state === "generating" || state === "sending"}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
        className="flex h-7 items-center gap-1 rounded-none border border-slate-800 bg-slate-900 px-2 text-xs font-bold text-zinc-50 transition disabled:opacity-50"
      >
        {state === "done" ? "Applied" : state === "generating" || state === "sending" ? "Sending..." : "Apply"}
      </motion.button>
      {/* Positioned off-screen, not display:none, so html2pdf.js can still
          measure real layout. */}
      {profile && (
        <div style={{ position: "fixed", left: "-9999px", top: 0, width: "210mm" }} aria-hidden="true">
          <div ref={hiddenPreviewRef}>
            <CvPreview profile={profile} />
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Render the Apply button on JobCard**

In `apps/web/src/components/jobs/JobCard.tsx`, in the contact-buttons row (around line 344-347), add `ApplyButton` as a third sibling — but only when this card represents a real posting (`posting?.id` is set, same guard the bookmark button already uses):

```tsx
            <div className="flex shrink-0 items-center gap-1.5">
              <ContactButton icon="mail" label="Mail" value={company.contactEmail} />
              <ContactButton icon="phone" label="Call" value={company.contactPhone} />
              {posting?.id && <ApplyButton jobPostingId={posting.id} />}
            </div>
```

Add the import: `import { ApplyButton } from "@/components/jobs/ApplyButton";`

- [ ] **Step 5: Manual verification**

Log in as a MEMBER on `/jobs`, click "Apply" on a real job posting's card (one with a genuine `posting.id`, i.e. an owner-authored posting, not an auto-classified fallback title). Confirm: the button shows "Sending...", then "Applied"; a PDF file appears under `apps/api/uploads/job-applications/`; re-clicking Apply on the same posting replaces that file rather than creating a second one. Confirm the button does not render at all when logged out or logged in as a `COMPANY_OWNER`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/src/components/jobs/ApplyButton.tsx apps/web/src/components/jobs/JobCard.tsx
git commit -m "feat(web): client-side PDF generation and Apply button on job cards"
```

---

### Task 7: apps/web — owner-facing Applications inbox tab

**Files:**
- Create: `apps/web/src/components/owner/sections/ApplicationsCategory.tsx`
- Modify: `apps/web/src/components/owner/OwnerDashboardSidePanel.tsx`
- Modify: `apps/web/src/app/my/companies/page.tsx`

**Interfaces:**
- Consumes: `JobApplicationListItem` (Task 2), `GET`/`POST my-companies/:companyId/job-applications...` (Task 4).
- Produces: a 5th `OwnerDashboardCategory` value `"applications"`, rendered the same way the existing 4 sibling category components are.

- [ ] **Step 1: Add the new category value**

In `apps/web/src/components/owner/OwnerDashboardSidePanel.tsx`, extend the type and the `CATEGORIES` array:

```ts
export type OwnerDashboardCategory = "general-info" | "premium-features" | "contact-social" | "reviews-ratings" | "applications";
```

```ts
const CATEGORIES: { key: OwnerDashboardCategory; label: string }[] = [
  { key: "general-info", label: "General Information" },
  { key: "premium-features", label: "Premium Features" },
  { key: "contact-social", label: "Contact & Social Media" },
  { key: "reviews-ratings", label: "Reviews & Ratings" },
  { key: "applications", label: "Applications" },
];
```

- [ ] **Step 2: Write `ApplicationsCategory.tsx`**

Read `apps/web/src/components/owner/sections/ContactSocialCategory.tsx` first for this codebase's exact category-component prop/loading/error conventions (how it receives `companyId`, fetches on mount, shows a loading state), then write:

```tsx
"use client";

import { useEffect, useState } from "react";
import type { JobApplicationListItem } from "@iwtr/shared-types";
import { apiGet, apiPost } from "@/lib/api-client";

export function ApplicationsCategory({ companyId }: { companyId: string }) {
  const [applications, setApplications] = useState<JobApplicationListItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiGet<JobApplicationListItem[]>(`/my-companies/${companyId}/job-applications`).then((data) => {
      if (!cancelled) setApplications(data);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  async function markViewed(id: string) {
    await apiPost(`/my-companies/${companyId}/job-applications/${id}/mark-viewed`, {});
    setApplications((prev) => prev && prev.map((a) => (a.id === id ? { ...a, viewedAt: new Date().toISOString() } : a)));
  }

  if (applications === null) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (applications.length === 0) return <p className="text-sm text-muted-foreground">No applications yet.</p>;

  return (
    <ul className="flex flex-col gap-2">
      {applications.map((a) => (
        <li
          key={a.id}
          className="flex items-center justify-between gap-3 border border-slate-800 bg-zinc-50 p-3 dark:bg-zinc-950"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{a.applicantDisplayName}</p>
            <p className="truncate text-xs text-muted-foreground">
              Applied to {a.jobTitle} · {new Date(a.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {a.viewedAt === null && (
              <span className="rounded-none border border-slate-800 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                New
              </span>
            )}
            <a
              href={a.pdfUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => a.viewedAt === null && markViewed(a.id)}
              className="text-xs font-bold underline"
            >
              View CV
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

Confirm `apiPost`'s exact signature in `api-client.ts` before using it (it may require a body argument even for an empty POST — check the existing `apiPost` calls elsewhere in this file, e.g. `saveContact`'s usage in `apps/web/src/app/my/companies/page.tsx`, and match its call shape exactly).

- [ ] **Step 3: Wire the new category into the dashboard page**

In `apps/web/src/app/my/companies/page.tsx`, near the other `activeCategory === "..."` conditional blocks (around line 535-629 per this plan's research), add:

```tsx
{activeCategory === "applications" && <ApplicationsCategory companyId={company.id} />}
```

Add the import: `import { ApplicationsCategory } from "@/components/owner/sections/ApplicationsCategory";`. Match the exact prop name used for the company's id in the sibling category components (it may be `company.id` or a differently-named variable in scope at that point — check one neighboring category's usage first).

- [ ] **Step 4: Manual verification**

As an approved owner on `/my/companies`, open the new "Applications" tab. Submit a test application from a separate member account (Task 6), confirm it appears in the list with a "New" badge, click "View CV" and confirm the PDF opens and the badge clears.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/owner/sections/ApplicationsCategory.tsx apps/web/src/components/owner/OwnerDashboardSidePanel.tsx apps/web/src/app/my/companies/page.tsx
git commit -m "feat(web): owner-facing Applications inbox tab"
```

---

## Final Review Note

Before the final whole-branch review: re-run `apps/web` and `apps/api` typecheck and test suites in full (not just this plan's own new test files) — Tasks 2/3 change `MyProfile`/`updateProfileInputSchema`'s shape, which past experience on this project (see prior Risk Score plan) shows can silently break an unrelated existing test fixture or typecheck elsewhere that isn't in any one task's own verification scope.

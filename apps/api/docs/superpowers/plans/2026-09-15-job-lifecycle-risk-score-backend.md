# Job Posting Lifecycle & Risk Score — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a company Risk Score (0-3) that increments when a company reposts a previously-filled job, plus a self-service posting lifecycle (owner's own listing, soft-delete via "mark filled", lazy 30-day expiry/reshare) and a worker-side job-bookmarking backend — all without ever hard-deleting a `JobPosting` row.

**Architecture:** One Prisma migration adds the new fields/model. A small pure-function module (`job-postings.util.ts`) centralizes all "is this posting still live / when does it stop being live / should it lazily reshare" logic so every caller (public feed, owner list, saved list) uses identical rules. `JobPostingsService` gains the risk-score check (reads a prior `FILLED` match) and two new endpoints; a new `SavedJobPostingsModule` mirrors the existing `SavedPost`/`CompanyFollow` toggle pattern exactly.

**Tech Stack:** NestJS, Prisma (Postgres, `multiSchema`), Zod (`@iwtr/shared-types`), Jest.

**Spec:** `docs/superpowers/specs/2026-09-15-job-lifecycle-risk-score-backend.md`

## Global Constraints

- No hard deletions of `JobPosting` rows, ever — every "removal" is a status change.
- No cron/scheduler dependency — reshare/expiry logic is lazy, computed on read.
- Risk Score increments only when a company reposts a title+workType that matches an **earlier posting of theirs marked `FILLED`** — never for a plain repost of a still-open or naturally-expired-but-never-filled posting. Capped at 3.
- `apps/web` is not touched by this plan (see the paired frontend plan, executed only after this one is verified).
- `packages/shared-types` ships compiled JS — rebuild `dist/` (`cd packages/shared-types && pnpm exec tsc`) after every schema change in this plan, before running any `apps/api` test that depends on it.
- Schema changes go live via `prisma generate` + `prisma db push` (non-interactive; `prisma migrate dev` does not work in this environment). Stop the `apps/api` dev server first if it's running, to avoid the Windows `EPERM` query-engine-`.dll`-lock issue.
- Every new required(-looking) field added to an existing table with rows already in the dev DB must have a default or be nullable — `db push` is non-interactive and cannot prompt for a backfill value.

---

## Task 1: Extract `workplaceType.ts` (prerequisite refactor — avoids a circular import)

**Why this task exists:** `company.ts` already does `import { publicJobPostingSchema } from "./jobPosting"`. Task 3 needs `jobPosting.ts` to use the `WorkplaceType` enum for its new `workType` field. If `jobPosting.ts` imported that enum back from `"./company"`, the two files would import each other — and since `company.ts` is evaluated first in that cycle (its import of `jobPosting.ts` is hoisted before its own body runs), `jobPosting.ts` would receive `company.ts`'s still-empty module exports, and `workplaceTypeSchema` would be `undefined` at the point `jobPosting.ts` tries to use it in a `z.object(...)` call — a real runtime crash, not a style nitpick. Extracting the workplace-type symbols into their own leaf file, with `company.ts` importing (and re-exporting) from it, breaks the cycle: both `company.ts` and `jobPosting.ts` depend on the same leaf, neither depends on the other for this.

**Files:**
- Create: `packages/shared-types/src/schemas/workplaceType.ts`
- Modify: `packages/shared-types/src/schemas/company.ts:1-59`
- Test: `packages/shared-types/src/schemas/__tests__/workplaceType.test.ts`

**Interfaces:**
- Produces: `workplaceTypeSchema`, `type WorkplaceType`, `companyWorkplaceTypesSchema`, `primaryWorkplaceType(company)`, `secondaryWorkplaceType(company)`, `DEFAULT_BANNER_URL_BY_WORKPLACE_TYPE`, `defaultBannerUrlForWorkplaceType(primary)` — same names/signatures as today, just relocated. Every existing external import (`@iwtr/shared-types`) and every existing internal import from `"./company"` keeps working unchanged.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/shared-types/src/schemas/__tests__/workplaceType.test.ts
import { workplaceTypeSchema, defaultBannerUrlForWorkplaceType, primaryWorkplaceType } from "../workplaceType";

describe("workplaceType", () => {
  it("accepts the four known values and rejects anything else", () => {
    expect(workplaceTypeSchema.safeParse("OFFICE").success).toBe(true);
    expect(workplaceTypeSchema.safeParse("REMOTE").success).toBe(false);
  });

  it("maps a primary work-type to its default banner", () => {
    expect(defaultBannerUrlForWorkplaceType("MANUAL_LABOUR")).toBe("/manual-labour-default-banner.webp");
  });

  it("primaryWorkplaceType returns the first entry", () => {
    expect(primaryWorkplaceType({ workplaceTypes: ["SERVICE", "OFFICE"] })).toBe("SERVICE");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from repo root): `cd packages/shared-types && pnpm exec jest workplaceType.test.ts`
Expected: FAIL — `Cannot find module '../workplaceType'`.

- [ ] **Step 3: Create the new file, moving the block verbatim out of `company.ts`**

```typescript
// packages/shared-types/src/schemas/workplaceType.ts
import { z } from "zod";

// A deliberately small, fixed classification of the *nature* of the work —
// distinct from `Company.category`, which is the specific business type
// (e.g. "Software", "Restaurant"). This is what drives the browse-page
// filter sidebar; `category` does not. Display labels live in apps/web
// (presentation concern), not here — see apps/web/src/lib/workplaceTypes.ts.
export const workplaceTypeSchema = z.enum(["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"]);
export type WorkplaceType = z.infer<typeof workplaceTypeSchema>;

// A company can genuinely span more than one kind of work (e.g. a hospital
// is SERVICE + OFFICE) but never more than 2 — a reviewer's own review still
// records a single workplaceType (see review.ts's createReviewInputSchema),
// picked from this set at rating time.
export const companyWorkplaceTypesSchema = z.array(workplaceTypeSchema).min(1).max(2);

// The work-type list is capped at 1-2 above. By platform convention item 0
// is the company's PRIMARY work-type (required) and item 1, when present, the
// SECONDARY (optional) - the owner picks them as two separate dropdowns and
// every employee-facing surface renders the primary in bold, the secondary
// in a normal weight. Kept as one ordered array rather than two columns
// because the cap already encodes "one required + one optional"; these
// accessors are the single place that ordering is given meaning.
export function primaryWorkplaceType(company: { workplaceTypes: WorkplaceType[] }): WorkplaceType {
  return company.workplaceTypes[0];
}
export function secondaryWorkplaceType(company: { workplaceTypes: WorkplaceType[] }): WorkplaceType | null {
  return company.workplaceTypes[1] ?? null;
}

// System-assigned default banner, keyed SOLELY on the primary work-type -
// served by the company read endpoints as Company.defaultBannerUrl and
// rendered whenever a company has no custom bannerImageUrl. Paths are
// root-relative to the web app, which serves these files from its public/
// directory (committed alongside this repo).
export const DEFAULT_BANNER_URL_BY_WORKPLACE_TYPE: Record<WorkplaceType, string> = {
  OFFICE: "/office-default-banner.webp",
  HYBRID_REMOTE: "/hybrid-remote-default-banner.webp",
  SERVICE: "/service-default-banner.webp",
  MANUAL_LABOUR: "/manual-labour-default-banner.webp",
};

export function defaultBannerUrlForWorkplaceType(primary: WorkplaceType): string {
  return DEFAULT_BANNER_URL_BY_WORKPLACE_TYPE[primary];
}
```

- [ ] **Step 4: Replace the moved block in `company.ts` with an import + re-export**

In `packages/shared-types/src/schemas/company.ts`, delete lines 17-59 (the block from the `// A deliberately small...` comment through the closing brace of `defaultBannerUrlForWorkplaceType`) and replace with:

```typescript
import {
  workplaceTypeSchema,
  companyWorkplaceTypesSchema,
  primaryWorkplaceType,
  secondaryWorkplaceType,
  DEFAULT_BANNER_URL_BY_WORKPLACE_TYPE,
  defaultBannerUrlForWorkplaceType,
  type WorkplaceType,
} from "./workplaceType";
export {
  workplaceTypeSchema,
  companyWorkplaceTypesSchema,
  primaryWorkplaceType,
  secondaryWorkplaceType,
  DEFAULT_BANNER_URL_BY_WORKPLACE_TYPE,
  defaultBannerUrlForWorkplaceType,
  type WorkplaceType,
};
```

Place this new block where the old one was (right after the existing `import { publicJobPostingSchema } from "./jobPosting";` line). Everything else in `company.ts` (which references `WorkplaceType`, `workplaceTypeSchema`, `companyWorkplaceTypesSchema`, `defaultBannerUrlForWorkplaceType` at its original lines 79, 400, 453 etc.) is untouched — the import above puts those same names back in local scope.

- [ ] **Step 5: Add the new file to the package barrel**

In `packages/shared-types/src/index.ts`, add one line (anywhere in the list, e.g. right before the `company` line):
```typescript
export * from "./schemas/workplaceType";
```

- [ ] **Step 6: Run test to verify it passes, then rebuild dist and run the full existing test suite**

```bash
cd packages/shared-types && pnpm exec jest workplaceType.test.ts
```
Expected: PASS (3 tests).

```bash
cd packages/shared-types && pnpm exec tsc
cd apps/api && pnpm exec jest
```
Expected: every existing `apps/api` test still passes — this step is a pure refactor, nothing about existing behavior changed.

- [ ] **Step 7: Commit**

```bash
git add packages/shared-types/src/schemas/workplaceType.ts packages/shared-types/src/schemas/company.ts packages/shared-types/src/schemas/__tests__/workplaceType.test.ts packages/shared-types/src/index.ts packages/shared-types/dist
git commit -m "refactor(shared-types): extract workplaceType.ts to avoid a jobPosting<->company import cycle"
```

---

## Task 2: Prisma schema — Risk Score, per-posting work-type, lifecycle fields, SavedJobPosting

**Files:**
- Modify: `apps/api/prisma/schema.prisma:120-126` (enum), `:377-488` (Company model), `:534-552` (JobPosting model)
- Create: new `SavedJobPosting` model (append near the existing `SavedPost` model, around line 1132)

**Interfaces:**
- Produces: `Company.riskScore: number` (default 0), `JobPosting.workType: WorkplaceType | null`, `JobPosting.autoReshareEnabled: boolean` (default false), `JobPosting.lastResharedAt: Date | null`, `JobPosting.filledAt: Date | null`, `JobPostingStatus` gains `"FILLED"`, new `SavedJobPosting` model with a `userId_jobPostingId` compound unique.

- [ ] **Step 1: Edit the enum**

In `apps/api/prisma/schema.prisma`, change:
```prisma
enum JobPostingStatus {
  PUBLISHED
  PENDING_ADMIN
  REJECTED
}
```
to:
```prisma
enum JobPostingStatus {
  PUBLISHED
  PENDING_ADMIN
  REJECTED
  FILLED
}
```

- [ ] **Step 2: Add `riskScore` to `Company`**

In the `Company` model, add one line (e.g. right after `hiddenAt DateTime?`):
```prisma
  hiddenAt         DateTime?
  riskScore        Int             @default(0)
```

- [ ] **Step 3: Add the new fields to `JobPosting`**

Change:
```prisma
model JobPosting {
  id                 String                        @id @default(uuid())
  companyId          String
  company            Company                       @relation(fields: [companyId], references: [id])
  createdByUserId    String
  createdByUser      User                          @relation(fields: [createdByUserId], references: [id])
  jobTitle           String
  description        String
  status             JobPostingStatus              @default(PUBLISHED)
  boostDurationDays  Int?
  boostIsFree        Boolean                       @default(false)
  boostPaymentStatus JobPostingBoostPaymentStatus?
  boostExpiresAt     DateTime?
  createdAt          DateTime                      @default(now())

  @@index([companyId])
  @@index([createdByUserId])
  @@schema("public")
}
```
to:
```prisma
model JobPosting {
  id                 String                        @id @default(uuid())
  companyId          String
  company            Company                       @relation(fields: [companyId], references: [id])
  createdByUserId    String
  createdByUser      User                          @relation(fields: [createdByUserId], references: [id])
  jobTitle           String
  description        String
  status             JobPostingStatus              @default(PUBLISHED)
  // Nullable, not required: adding a required enum column with no default
  // would fail prisma db push non-interactively against a table that
  // already has rows (existing demo postings). New postings always set
  // this (createJobPostingInputSchema requires it) — a null here only ever
  // means "created before this field existed", and is naturally excluded
  // from the risk-score match query (it can never `equals` a real enum
  // value), so no other code needs to special-case it.
  workType           WorkplaceType?
  autoReshareEnabled Boolean                       @default(false)
  lastResharedAt     DateTime?
  // Set only by JobPostingsService.markFilled — the anchor the 30-day
  // "still visible to the owner dashboard / a saver's Saved Posts" grace
  // window counts from for a manually-closed posting (see job-postings.util.ts).
  filledAt           DateTime?
  boostDurationDays  Int?
  boostIsFree        Boolean                       @default(false)
  boostPaymentStatus JobPostingBoostPaymentStatus?
  boostExpiresAt     DateTime?
  createdAt          DateTime                      @default(now())
  savedBy            SavedJobPosting[]

  @@index([companyId])
  @@index([createdByUserId])
  @@index([companyId, jobTitle, workType])
  @@schema("public")
}
```

- [ ] **Step 4: Add the new `SavedJobPosting` model**

Append this new model right after the existing `SavedPost` model (after its closing `}` around line 1132), mirroring its exact shape:
```prisma
// A private bookmark on a job posting — same shape/semantics as SavedPost
// (no public save-count, only the saver can ever list their own saves).
model SavedJobPosting {
  id           String     @id @default(uuid())
  userId       String
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  jobPostingId String
  jobPosting   JobPosting @relation(fields: [jobPostingId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now())

  @@unique([userId, jobPostingId])
  @@index([jobPostingId])
  @@schema("public")
}
```

- [ ] **Step 5: Add the back-relation on `User`**

`User` already has `socialCommentReports`/`socialCommentIdentityLocks` etc. as relation fields (see CLAUDE.md's Data Model section). Add one line next to those:
```prisma
  savedJobPostings SavedJobPosting[]
```

- [ ] **Step 6: Stop the dev server, regenerate the client, push the schema**

```bash
# stop any running `apps/api` dev server first (Windows EPERM gotcha)
cd apps/api
pnpm exec prisma generate
pnpm exec prisma db push
```
Expected: both commands succeed with no prompts (every new/changed field is either nullable or has a default, per this plan's Global Constraints).

- [ ] **Step 7: Verify the columns actually exist**

```bash
cd apps/api
pnpm exec ts-node -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.company.findFirst({ select: { riskScore: true } })
  .then((r) => { console.log('Company.riskScore OK', r); return p.jobPosting.findFirst({ select: { workType: true, autoReshareEnabled: true, lastResharedAt: true, filledAt: true } }); })
  .then((r) => { console.log('JobPosting new fields OK', r); return p.savedJobPosting.findMany(); })
  .then((r) => { console.log('SavedJobPosting table OK', r); })
  .finally(() => p.\$disconnect());
"
```
Expected: three "OK" lines print, no errors, `SavedJobPosting table OK []` (empty — table exists, no rows yet).

- [ ] **Step 8: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(db): add Company.riskScore, JobPosting lifecycle fields, SavedJobPosting model"
```

---

## Task 3: `packages/shared-types` — new/changed schemas

**Files:**
- Modify: `packages/shared-types/src/schemas/jobPosting.ts`
- Modify: `packages/shared-types/src/schemas/company.ts` (add `riskScore` to `companySchema`)
- Create: `packages/shared-types/src/schemas/savedJobPosting.ts`
- Modify: `packages/shared-types/src/index.ts`
- Test: `packages/shared-types/src/schemas/__tests__/jobPosting.test.ts`, `packages/shared-types/src/schemas/__tests__/savedJobPosting.test.ts`

**Interfaces:**
- Produces: `jobPostingStatusSchema` (now includes `"FILLED"`), `jobPostingSchema` (gains `workType: WorkplaceType | null`), `createJobPostingInputSchema` (gains required `workType`, optional `autoReshareEnabled` defaulting to `false`), `publicJobPostingSchema` (gains `id: string`), new `ownerJobPostingSchema` (`jobPostingSchema` + `daysRemaining: number`), `companySchema` (gains `riskScore: number`), new `savedJobPostingToggleResultSchema`, new `savedJobPostingSchema` (`{ id, companyId, jobTitle, description, expired }`).

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/shared-types/src/schemas/__tests__/jobPosting.test.ts
import {
  jobPostingStatusSchema,
  createJobPostingInputSchema,
  publicJobPostingSchema,
  ownerJobPostingSchema,
} from "../jobPosting";

describe("jobPosting schemas", () => {
  it("jobPostingStatusSchema accepts FILLED", () => {
    expect(jobPostingStatusSchema.safeParse("FILLED").success).toBe(true);
  });

  it("createJobPostingInputSchema requires workType and defaults autoReshareEnabled to false", () => {
    const parsed = createJobPostingInputSchema.parse({
      jobTitle: "Cashier",
      description: "Front register",
      workType: "SERVICE",
      boost: null,
    });
    expect(parsed.autoReshareEnabled).toBe(false);
    expect(createJobPostingInputSchema.safeParse({ jobTitle: "x", description: "y", boost: null }).success).toBe(
      false,
    );
  });

  it("createJobPostingInputSchema trims jobTitle", () => {
    const parsed = createJobPostingInputSchema.parse({
      jobTitle: "  Cashier  ",
      description: "d",
      workType: "SERVICE",
      boost: null,
    });
    expect(parsed.jobTitle).toBe("Cashier");
  });

  it("publicJobPostingSchema requires an id", () => {
    expect(publicJobPostingSchema.safeParse({ jobTitle: "x", description: "y" }).success).toBe(false);
    expect(
      publicJobPostingSchema.safeParse({ id: "11111111-1111-1111-1111-111111111111", jobTitle: "x", description: "y" })
        .success,
    ).toBe(true);
  });

  it("ownerJobPostingSchema carries daysRemaining", () => {
    const base = {
      id: "11111111-1111-1111-1111-111111111111",
      companyId: "22222222-2222-2222-2222-222222222222",
      jobTitle: "x",
      description: "y",
      status: "PUBLISHED",
      workType: "SERVICE",
      boostDurationDays: null,
      boostExpiresAt: null,
      createdAt: new Date().toISOString(),
      daysRemaining: 17,
    };
    expect(ownerJobPostingSchema.safeParse(base).success).toBe(true);
  });
});
```

```typescript
// packages/shared-types/src/schemas/__tests__/savedJobPosting.test.ts
import { savedJobPostingToggleResultSchema, savedJobPostingSchema } from "../savedJobPosting";

describe("savedJobPosting schemas", () => {
  it("toggle result", () => {
    expect(savedJobPostingToggleResultSchema.safeParse({ jobPostingId: "x", saved: true }).success).toBe(true);
  });

  it("list item requires expired flag", () => {
    expect(
      savedJobPostingSchema.safeParse({ id: "x", companyId: "y", jobTitle: "t", description: "d" }).success,
    ).toBe(false);
    expect(
      savedJobPostingSchema.safeParse({ id: "x", companyId: "y", jobTitle: "t", description: "d", expired: false })
        .success,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/shared-types && pnpm exec jest jobPosting.test.ts savedJobPosting.test.ts
```
Expected: FAIL (`workType`/`id`/`daysRemaining` not yet accepted/required; `savedJobPosting` module doesn't exist).

- [ ] **Step 3: Edit `jobPosting.ts`**

Add the import at the top:
```typescript
import { workplaceTypeSchema } from "./workplaceType";
```

Change `jobPostingStatusSchema`:
```typescript
export const jobPostingStatusSchema = z.enum(["PUBLISHED", "PENDING_ADMIN", "REJECTED", "FILLED"]);
```

Change `jobPostingSchema` — add `workType` right after `description`:
```typescript
export const jobPostingSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  jobTitle: z.string(),
  description: z.string(),
  workType: workplaceTypeSchema.nullable(),
  status: jobPostingStatusSchema,
  boostDurationDays: boostDurationDaysSchema.nullable(),
  boostExpiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type JobPosting = z.infer<typeof jobPostingSchema>;
```

Change `publicJobPostingSchema` — add `id`:
```typescript
export const publicJobPostingSchema = z.object({
  id: z.string().uuid(),
  jobTitle: z.string(),
  description: z.string(),
});
export type PublicJobPosting = z.infer<typeof publicJobPostingSchema>;
```

Change `createJobPostingInputSchema` — add `.trim()`, required `workType`, optional `autoReshareEnabled`:
```typescript
export const createJobPostingInputSchema = z.object({
  jobTitle: z.string().trim().min(1).max(200),
  description: z.string().min(1).max(600),
  workType: workplaceTypeSchema,
  autoReshareEnabled: z.boolean().optional().default(false),
  boost: z
    .object({
      durationDays: boostDurationDaysSchema,
      billing: checkoutBillingInputSchema.optional(),
    })
    .nullable(),
});
export type CreateJobPostingInput = z.infer<typeof createJobPostingInputSchema>;
```

Add a new schema, right after `adminJobPostingSchema` at the bottom of the file:
```typescript
// The owner's own view of one of their postings (GET
// my-companies/:companyId/job-postings) — jobPostingSchema plus how many
// days are left before it naturally lapses (0 once it's stopped being
// publicly live, whatever the reason).
export const ownerJobPostingSchema = jobPostingSchema.extend({
  daysRemaining: z.number().int().min(0),
});
export type OwnerJobPosting = z.infer<typeof ownerJobPostingSchema>;
```

- [ ] **Step 4: Add `riskScore` to `companySchema`**

In `packages/shared-types/src/schemas/company.ts`, in `companySchema`, add one line right after `featuredReviewId: z.string().uuid().nullable(),`:
```typescript
  featuredReviewId: z.string().uuid().nullable(),
  // 0-3. Increments when this company reposts a title+workType that matches
  // an earlier posting of theirs already marked FILLED — see
  // JobPostingsService.create. Visible to every worker, by design (the
  // whole point is public accountability for repost-after-claiming-a-hire
  // spam).
  riskScore: z.number().int().min(0).max(3),
  workplaceTypesLocked: z.boolean().optional(),
```

- [ ] **Step 5: Create `savedJobPosting.ts`**

```typescript
// packages/shared-types/src/schemas/savedJobPosting.ts
import { z } from "zod";

// Toggle result mirrors savedPostToggleResultSchema's shape/convention
// exactly (see follow.ts).
export const savedJobPostingToggleResultSchema = z.object({
  jobPostingId: z.string(),
  saved: z.boolean(),
});
export type SavedJobPostingToggleResult = z.infer<typeof savedJobPostingToggleResultSchema>;

// One row of the caller's own saved-postings list (GET me/saved-job-postings).
// Deliberately thin, same minimalism as publicJobPostingSchema — `expired`
// is the one extra bit the Saved Posts view needs to grey a card out and
// make it inert.
export const savedJobPostingSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  jobTitle: z.string(),
  description: z.string(),
  expired: z.boolean(),
});
export type SavedJobPosting = z.infer<typeof savedJobPostingSchema>;
```

- [ ] **Step 6: Add the new file to the barrel**

In `packages/shared-types/src/index.ts`:
```typescript
export * from "./schemas/savedJobPosting";
```

- [ ] **Step 7: Run tests to verify they pass, rebuild dist**

```bash
cd packages/shared-types
pnpm exec jest jobPosting.test.ts savedJobPosting.test.ts
```
Expected: PASS (all cases).

```bash
pnpm exec tsc
```
Expected: no type errors.

- [ ] **Step 8: Commit**

```bash
git add packages/shared-types/src/schemas/jobPosting.ts packages/shared-types/src/schemas/company.ts packages/shared-types/src/schemas/savedJobPosting.ts packages/shared-types/src/schemas/__tests__/jobPosting.test.ts packages/shared-types/src/schemas/__tests__/savedJobPosting.test.ts packages/shared-types/src/index.ts packages/shared-types/dist
git commit -m "feat(shared-types): riskScore, per-posting workType, FILLED status, saved-job-posting schemas"
```

---

## Task 4: `job-postings.util.ts` — pure lifecycle helpers

**Files:**
- Create: `apps/api/src/modules/job-postings/job-postings.util.ts`
- Test: `apps/api/src/modules/job-postings/__tests__/job-postings.util.test.ts`

**Interfaces:**
- Produces: `PostingLifecycleFields` (interface), `effectivePostDate(p)`, `liveEndDate(p)`, `daysRemaining(p, now?)`, `daysPastLiveEnd(p, now?)`, `isWithinSavedGraceWindow(p, now?)`, `shouldLazyReshare(p, now?)`. Every later task in this plan (`JobPostingsService`, `CompaniesService`, `SavedJobPostingsService`) imports these by these exact names.

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/api/src/modules/job-postings/__tests__/job-postings.util.test.ts
import {
  effectivePostDate,
  liveEndDate,
  daysRemaining,
  daysPastLiveEnd,
  isWithinSavedGraceWindow,
  shouldLazyReshare,
  type PostingLifecycleFields,
} from "../job-postings.util";

function posting(overrides: Partial<PostingLifecycleFields> = {}): PostingLifecycleFields {
  return {
    status: "PUBLISHED",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    lastResharedAt: null,
    filledAt: null,
    autoReshareEnabled: false,
    ...overrides,
  };
}

describe("effectivePostDate", () => {
  it("uses createdAt when never reshared", () => {
    expect(effectivePostDate(posting())).toEqual(new Date("2026-01-01T00:00:00Z"));
  });
  it("uses lastResharedAt when set", () => {
    const reshared = new Date("2026-02-01T00:00:00Z");
    expect(effectivePostDate(posting({ lastResharedAt: reshared }))).toEqual(reshared);
  });
});

describe("liveEndDate", () => {
  it("is 30 days after the effective post date for a PUBLISHED posting", () => {
    expect(liveEndDate(posting())).toEqual(new Date("2026-01-31T00:00:00Z"));
  });
  it("is filledAt for a FILLED posting", () => {
    const filled = new Date("2026-01-10T00:00:00Z");
    expect(liveEndDate(posting({ status: "FILLED", filledAt: filled }))).toEqual(filled);
  });
});

describe("daysRemaining", () => {
  it("counts down toward 30 days from the effective post date", () => {
    const now = new Date("2026-01-11T00:00:00Z"); // 10 days after createdAt
    expect(daysRemaining(posting(), now)).toBe(20);
  });
  it("is 0 once past the live end", () => {
    const now = new Date("2026-02-05T00:00:00Z");
    expect(daysRemaining(posting(), now)).toBe(0);
  });
  it("is always 0 for a non-PUBLISHED posting, regardless of dates", () => {
    const now = new Date("2026-01-02T00:00:00Z");
    expect(daysRemaining(posting({ status: "FILLED", filledAt: new Date("2026-01-01T00:00:00Z") }), now)).toBe(0);
  });
});

describe("daysPastLiveEnd / isWithinSavedGraceWindow", () => {
  it("a still-live PUBLISHED posting is within the grace window (daysPastLiveEnd 0)", () => {
    const now = new Date("2026-01-05T00:00:00Z");
    expect(daysPastLiveEnd(posting(), now)).toBe(0);
    expect(isWithinSavedGraceWindow(posting(), now)).toBe(true);
  });
  it("stays within the grace window up to 30 days after the live end", () => {
    const now = new Date("2026-02-28T00:00:00Z"); // 28 days past the Jan 31 live end
    expect(isWithinSavedGraceWindow(posting(), now)).toBe(true);
  });
  it("falls out of the grace window past 30 days after the live end", () => {
    const now = new Date("2026-03-15T00:00:00Z"); // 43 days past the Jan 31 live end
    expect(isWithinSavedGraceWindow(posting(), now)).toBe(false);
  });
  it("grace window for a FILLED posting counts from filledAt, not createdAt", () => {
    const filled = new Date("2026-01-05T00:00:00Z"); // only 4 days into its life
    const now = new Date("2026-01-20T00:00:00Z"); // 15 days after filledAt
    expect(isWithinSavedGraceWindow(posting({ status: "FILLED", filledAt: filled }), now)).toBe(true);
  });
});

describe("shouldLazyReshare", () => {
  it("true only when PUBLISHED, autoReshareEnabled, and daysRemaining is 0", () => {
    const now = new Date("2026-02-05T00:00:00Z"); // past the 30-day live end
    expect(shouldLazyReshare(posting({ autoReshareEnabled: true }), now)).toBe(true);
    expect(shouldLazyReshare(posting({ autoReshareEnabled: false }), now)).toBe(false);
    expect(shouldLazyReshare(posting({ autoReshareEnabled: true, status: "FILLED", filledAt: new Date() }), now)).toBe(
      false,
    );
  });
  it("false while still within the 30-day live window even if autoReshareEnabled", () => {
    const now = new Date("2026-01-05T00:00:00Z");
    expect(shouldLazyReshare(posting({ autoReshareEnabled: true }), now)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && pnpm exec jest job-postings.util.test.ts
```
Expected: FAIL — `Cannot find module '../job-postings.util'`.

- [ ] **Step 3: Implement**

```typescript
// apps/api/src/modules/job-postings/job-postings.util.ts

// The subset of JobPosting fields every lifecycle calculation below needs.
// A plain interface (not imported from @prisma/client) so these functions
// stay pure and trivially unit-testable without a DB.
export interface PostingLifecycleFields {
  status: "PUBLISHED" | "PENDING_ADMIN" | "REJECTED" | "FILLED";
  createdAt: Date;
  lastResharedAt: Date | null;
  filledAt: Date | null;
  autoReshareEnabled: boolean;
}

const LIVE_WINDOW_DAYS = 30;
const GRACE_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// When this posting's current "live run" started — resets every time it's
// lazily reshared, so a reshared posting gets a fresh 30-day window from
// that point, not from its original createdAt.
export function effectivePostDate(p: Pick<PostingLifecycleFields, "createdAt" | "lastResharedAt">): Date {
  return p.lastResharedAt ?? p.createdAt;
}

// The moment this posting stopped (or, for a still-live PUBLISHED posting,
// will stop) being publicly visible. FILLED postings end the moment they
// were marked filled; everything else ends 30 days after its effective
// post date.
export function liveEndDate(p: PostingLifecycleFields): Date {
  if (p.status === "FILLED") {
    return p.filledAt ?? p.createdAt;
  }
  const end = new Date(effectivePostDate(p));
  end.setDate(end.getDate() + LIVE_WINDOW_DAYS);
  return end;
}

// Whole days left before this posting stops being publicly live. Always 0
// for anything not currently PUBLISHED (a FILLED/REJECTED/PENDING_ADMIN
// posting has no "days remaining" to count down).
export function daysRemaining(p: PostingLifecycleFields, now: Date = new Date()): number {
  if (p.status !== "PUBLISHED") return 0;
  return Math.max(0, Math.ceil((liveEndDate(p).getTime() - now.getTime()) / MS_PER_DAY));
}

// Whole days since this posting's live end (0 while still live or exactly
// at the boundary). Drives the 30-day grace window below.
export function daysPastLiveEnd(p: PostingLifecycleFields, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((now.getTime() - liveEndDate(p).getTime()) / MS_PER_DAY));
}

// True while a posting should still show up in the owner's own dashboard or
// a worker's Saved Posts list — either because it's still genuinely live,
// or because it's within the 30-day grace period after it stopped being
// live (whether that was a natural expiry or a manual mark-filled).
export function isWithinSavedGraceWindow(p: PostingLifecycleFields, now: Date = new Date()): boolean {
  if (p.status === "PUBLISHED" && daysRemaining(p, now) > 0) return true;
  return daysPastLiveEnd(p, now) <= GRACE_WINDOW_DAYS;
}

// True exactly when a listing query should bump lastResharedAt right now —
// the entire "no cron" mechanism. Only ever true for a PUBLISHED posting
// that opted in and has genuinely run out its 30 days.
export function shouldLazyReshare(p: PostingLifecycleFields, now: Date = new Date()): boolean {
  return p.status === "PUBLISHED" && p.autoReshareEnabled && daysRemaining(p, now) === 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && pnpm exec jest job-postings.util.test.ts
```
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/job-postings/job-postings.util.ts apps/api/src/modules/job-postings/__tests__/job-postings.util.test.ts
git commit -m "feat(api): pure job-posting lifecycle helpers (effective date, days remaining, grace window, lazy reshare)"
```

---

## Task 5: `JobPostingsService.create` — per-posting workType + Risk Score increment

**Files:**
- Modify: `apps/api/src/modules/job-postings/job-postings.service.ts:31-51` (`toPublic`), `:117-130` (start of `create`)
- Test: `apps/api/src/modules/job-postings/__tests__/job-postings.service.test.ts` (new file)

**Interfaces:**
- Consumes: nothing new from earlier tasks (Prisma client fields from Task 2, shared-types from Task 3).
- Produces: `JobPostingsService.create(...)` now validates `workType` against the company's own `workplaceTypes` and bumps `Company.riskScore` (capped at 3) when the new posting's `jobTitle`+`workType` matches a prior `FILLED` posting from the same company. `toPublic(...)` now includes `workType` in its output.

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/api/src/modules/job-postings/__tests__/job-postings.service.test.ts
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { JobPostingsService } from "../job-postings.service";

const moderationPass = { checkContent: jest.fn().mockReturnValue({ violates: false, violationTypes: [] }) } as never;

function makePrisma(overrides: Partial<Record<string, any>> = {}) {
  const base: Record<string, any> = {
    companyOwner: {
      findUnique: jest.fn().mockResolvedValue({ userId: "u1", companyId: "c1", claimStatus: "APPROVED", tier: "FREE" }),
    },
    company: {
      findUnique: jest.fn().mockResolvedValue({ workplaceTypes: ["SERVICE"], riskScore: 0 }),
      findMany: jest.fn().mockResolvedValue([]), // mentionsCompetitorName's scan
      update: jest.fn().mockResolvedValue({}),
    },
    jobPosting: {
      findFirst: jest.fn().mockResolvedValue(null), // no prior FILLED match by default
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "p1", createdAt: new Date(), ...data })),
      count: jest.fn().mockResolvedValue(0),
    },
  };
  return { ...base, ...overrides };
}

function service(prisma: Record<string, any>) {
  return new JobPostingsService(prisma as any, moderationPass, {} as any);
}

describe("JobPostingsService.create — workType validation", () => {
  it("rejects a workType the company doesn't have", async () => {
    const prisma = makePrisma();
    await expect(
      service(prisma).create("u1", "c1", {
        jobTitle: "Cashier",
        description: "d",
        workType: "MANUAL_LABOUR",
        autoReshareEnabled: false,
        boost: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("accepts a workType the company does have", async () => {
    const prisma = makePrisma();
    const result = await service(prisma).create("u1", "c1", {
      jobTitle: "Cashier",
      description: "d",
      workType: "SERVICE",
      autoReshareEnabled: false,
      boost: null,
    });
    expect(result.jobPosting.workType).toBe("SERVICE");
  });

  it("still enforces ownership before anything else", async () => {
    const prisma = makePrisma({ companyOwner: { findUnique: jest.fn().mockResolvedValue(null) } });
    await expect(
      service(prisma).create("u1", "c1", {
        jobTitle: "Cashier",
        description: "d",
        workType: "SERVICE",
        autoReshareEnabled: false,
        boost: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("JobPostingsService.create — Risk Score", () => {
  it("does not increment riskScore when there is no prior FILLED match", async () => {
    const prisma = makePrisma();
    await service(prisma).create("u1", "c1", {
      jobTitle: "Cashier",
      description: "d",
      workType: "SERVICE",
      autoReshareEnabled: false,
      boost: null,
    });
    expect(prisma.company.update).not.toHaveBeenCalled();
  });

  it("increments riskScore by 1 when a prior FILLED posting matches title+workType", async () => {
    const prisma = makePrisma({
      jobPosting: {
        findFirst: jest.fn().mockResolvedValue({ id: "old" }),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "p2", createdAt: new Date(), ...data })),
      },
    });
    await service(prisma).create("u1", "c1", {
      jobTitle: "Cashier",
      description: "d",
      workType: "SERVICE",
      autoReshareEnabled: false,
      boost: null,
    });
    expect(prisma.company.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { riskScore: 1 } });
    expect(prisma.jobPosting.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: "c1",
          workType: "SERVICE",
          status: "FILLED",
          jobTitle: { equals: "Cashier", mode: "insensitive" },
        }),
      }),
    );
  });

  it("caps riskScore at 3", async () => {
    const prisma = makePrisma({
      company: {
        findUnique: jest.fn().mockResolvedValue({ workplaceTypes: ["SERVICE"], riskScore: 3 }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      jobPosting: {
        findFirst: jest.fn().mockResolvedValue({ id: "old" }),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "p3", createdAt: new Date(), ...data })),
      },
    });
    await service(prisma).create("u1", "c1", {
      jobTitle: "Cashier",
      description: "d",
      workType: "SERVICE",
      autoReshareEnabled: false,
      boost: null,
    });
    expect(prisma.company.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { riskScore: 3 } });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && pnpm exec jest job-postings.service.test.ts
```
Expected: FAIL — `create` doesn't yet validate `workType` or touch `riskScore`; `toPublic`'s output has no `workType`.

- [ ] **Step 3: Implement — update `toPublic` and the start of `create`**

In `apps/api/src/modules/job-postings/job-postings.service.ts`, add `WorkplaceType` to the type-only import at the top:
```typescript
import type {
  AdminJobPosting,
  CreateJobPostingInput,
  CreateJobPostingResult,
  JobPosting as JobPostingView,
  JobPostingBoostStatus,
  JobPostingStatus,
  WorkplaceType,
} from "@iwtr/shared-types";
```

Replace the `toPublic` function:
```typescript
function toPublic(posting: {
  id: string;
  companyId: string;
  jobTitle: string;
  description: string;
  workType: WorkplaceType | null;
  status: JobPostingStatus;
  boostDurationDays: number | null;
  boostExpiresAt: Date | null;
  createdAt: Date;
}): JobPostingView {
  return {
    id: posting.id,
    companyId: posting.companyId,
    jobTitle: posting.jobTitle,
    description: posting.description,
    workType: posting.workType,
    status: posting.status,
    boostDurationDays: (posting.boostDurationDays as 7 | 14 | 21 | null) ?? null,
    boostExpiresAt: posting.boostExpiresAt ? posting.boostExpiresAt.toISOString() : null,
    createdAt: posting.createdAt.toISOString(),
  };
}
```

Replace the start of `create` (everything from the method signature through the `prisma.jobPosting.create` call — the boost-handling code below it, lines ~128-196, is unchanged):
```typescript
  async create(userId: string, companyId: string, input: CreateJobPostingInput): Promise<CreateJobPostingResult> {
    const ownership = await this.requireApprovedOwnership(userId, companyId);

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { workplaceTypes: true, riskScore: true },
    });
    if (!company || !(company.workplaceTypes as WorkplaceType[]).includes(input.workType)) {
      throw new BadRequestException("workType must be one of this company's own work types.");
    }

    const contentCheck = this.moderation.checkContent([input.jobTitle, input.description]);
    const hasCompetitorName = await this.mentionsCompetitorName(companyId, `${input.jobTitle} ${input.description}`);
    const status: JobPostingStatus = contentCheck.violates || hasCompetitorName ? "PENDING_ADMIN" : "PUBLISHED";

    // Risk Score: does this exact title+workType match an earlier posting of
    // this company's that was marked FILLED (i.e. they claimed a hire, then
    // reopened the identical role)? A plain repost of a still-open or
    // naturally-expired-but-never-filled posting does NOT count — see
    // job-lifecycle-risk-score-backend.md's brainstorming section.
    const priorFilledMatch = await this.prisma.jobPosting.findFirst({
      where: {
        companyId,
        workType: input.workType,
        status: "FILLED",
        jobTitle: { equals: input.jobTitle, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (priorFilledMatch) {
      await this.prisma.company.update({
        where: { id: companyId },
        data: { riskScore: Math.min(3, company.riskScore + 1) },
      });
    }

    const posting = await this.prisma.jobPosting.create({
      data: {
        companyId,
        createdByUserId: userId,
        jobTitle: input.jobTitle,
        description: input.description,
        workType: input.workType,
        autoReshareEnabled: input.autoReshareEnabled,
        status,
      },
    });
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && pnpm exec jest job-postings.service.test.ts
```
Expected: PASS (6 tests).

- [ ] **Step 5: Run the full existing job-postings-adjacent suite to confirm no regression**

```bash
cd apps/api && pnpm exec jest job-postings
```
Expected: all pass, including the new file.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/job-postings/job-postings.service.ts apps/api/src/modules/job-postings/__tests__/job-postings.service.test.ts
git commit -m "feat(api): validate per-posting workType and increment Risk Score on repost-after-filled"
```

---

## Task 6: `markFilled` — the soft-delete endpoint

**Files:**
- Modify: `apps/api/src/modules/job-postings/job-postings.service.ts` (add method after `create`)
- Modify: `apps/api/src/modules/job-postings/job-postings.controller.ts`
- Test: `apps/api/src/modules/job-postings/__tests__/job-postings.service.test.ts` (append)

**Interfaces:**
- Consumes: `requireApprovedOwnership` (existing private method), `toPublic` (Task 5).
- Produces: `JobPostingsService.markFilled(userId, companyId, jobPostingId): Promise<JobPostingView>`; route `POST my-companies/:companyId/job-postings/:jobPostingId/mark-filled`.

- [ ] **Step 1: Write the failing tests (append to the same test file)**

```typescript
describe("JobPostingsService.markFilled", () => {
  function filledPrisma(overrides: Partial<Record<string, any>> = {}) {
    return makePrisma({
      jobPosting: {
        findUnique: jest.fn().mockResolvedValue({ id: "p1", companyId: "c1", status: "PUBLISHED" }),
        update: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve({ id: "p1", companyId: "c1", createdAt: new Date(), ...data })),
      },
      ...overrides,
    });
  }

  it("sets status to FILLED and stamps filledAt", async () => {
    const prisma = filledPrisma();
    const result = await service(prisma).markFilled("u1", "c1", "p1");
    expect(result.status).toBe("FILLED");
    expect(prisma.jobPosting.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { status: "FILLED", filledAt: expect.any(Date) },
    });
  });

  it("404s when the posting doesn't belong to this company", async () => {
    const prisma = filledPrisma({
      jobPosting: {
        findUnique: jest.fn().mockResolvedValue({ id: "p1", companyId: "OTHER", status: "PUBLISHED" }),
        update: jest.fn(),
      },
    });
    await expect(service(prisma).markFilled("u1", "c1", "p1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("refuses to mark an already-non-PUBLISHED posting filled", async () => {
    const prisma = filledPrisma({
      jobPosting: {
        findUnique: jest.fn().mockResolvedValue({ id: "p1", companyId: "c1", status: "FILLED" }),
        update: jest.fn(),
      },
    });
    await expect(service(prisma).markFilled("u1", "c1", "p1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("requires approved ownership of the company", async () => {
    const prisma = filledPrisma({ companyOwner: { findUnique: jest.fn().mockResolvedValue(null) } });
    await expect(service(prisma).markFilled("u1", "c1", "p1")).rejects.toBeInstanceOf(ForbiddenException);
  });
});
```

Add `NotFoundException` to this test file's existing `@nestjs/common` import line.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && pnpm exec jest job-postings.service.test.ts -t markFilled
```
Expected: FAIL — `service(prisma).markFilled is not a function`.

- [ ] **Step 3: Implement the service method**

Add this method to `JobPostingsService`, right after `create` (before `completeCheckout`):
```typescript
  /**
   * The soft-delete: the only manual way a posting stops being publicly
   * live. Never deletes the row — Risk Score's create-time check depends on
   * FILLED rows persisting forever (see mentionsCompetitorName-adjacent
   * comment above for the same "never trust the client, always re-verify
   * ownership" pattern).
   */
  async markFilled(userId: string, companyId: string, jobPostingId: string): Promise<JobPostingView> {
    await this.requireApprovedOwnership(userId, companyId);
    const posting = await this.prisma.jobPosting.findUnique({ where: { id: jobPostingId } });
    if (!posting || posting.companyId !== companyId) {
      throw new NotFoundException("Job posting not found");
    }
    if (posting.status !== "PUBLISHED") {
      throw new BadRequestException("Only a published posting can be marked filled.");
    }
    const updated = await this.prisma.jobPosting.update({
      where: { id: jobPostingId },
      data: { status: "FILLED", filledAt: new Date() },
    });
    return toPublic(updated);
  }
```

- [ ] **Step 4: Add the controller route**

In `apps/api/src/modules/job-postings/job-postings.controller.ts`, add right after the existing `create` method:
```typescript
  @Post("my-companies/:companyId/job-postings/:jobPostingId/mark-filled")
  @UseGuards(JwtAuthGuard)
  markFilled(
    @CurrentUser() user: AuthenticatedUser,
    @Param("companyId", new ParseUUIDPipe()) companyId: string,
    @Param("jobPostingId", new ParseUUIDPipe()) jobPostingId: string,
  ) {
    return this.jobPostings.markFilled(user.id, companyId, jobPostingId);
  }
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/api && pnpm exec jest job-postings.service.test.ts
```
Expected: PASS (all cases in the file so far).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/job-postings/job-postings.service.ts apps/api/src/modules/job-postings/job-postings.controller.ts apps/api/src/modules/job-postings/__tests__/job-postings.service.test.ts
git commit -m "feat(api): mark-filled soft-delete endpoint for job postings"
```

---

## Task 7: `listOwnerPostings` — the owner's own postings list, with days-remaining and lazy reshare

**Files:**
- Modify: `apps/api/src/modules/job-postings/job-postings.service.ts` (add method + import)
- Modify: `apps/api/src/modules/job-postings/job-postings.controller.ts`
- Test: `apps/api/src/modules/job-postings/__tests__/job-postings.service.test.ts` (append)

**Interfaces:**
- Consumes: `shouldLazyReshare`, `isWithinSavedGraceWindow`, `daysRemaining` from `job-postings.util.ts` (Task 4).
- Produces: `JobPostingsService.listOwnerPostings(userId, companyId): Promise<OwnerJobPosting[]>`; route `GET my-companies/:companyId/job-postings`.

- [ ] **Step 1: Write the failing tests (append)**

```typescript
describe("JobPostingsService.listOwnerPostings", () => {
  function row(overrides: Partial<Record<string, any>> = {}) {
    return {
      id: "p1",
      companyId: "c1",
      jobTitle: "Cashier",
      description: "d",
      workType: "SERVICE",
      status: "PUBLISHED",
      boostDurationDays: null,
      boostExpiresAt: null,
      createdAt: new Date(),
      lastResharedAt: null,
      filledAt: null,
      autoReshareEnabled: false,
      ...overrides,
    };
  }

  it("includes daysRemaining on each row", async () => {
    const prisma = makePrisma({ jobPosting: { findMany: jest.fn().mockResolvedValue([row()]) } });
    const result = await service(prisma).listOwnerPostings("u1", "c1");
    expect(result[0].daysRemaining).toBeGreaterThan(0);
    expect(result[0].id).toBe("p1");
  });

  it("lazily reshares a stale PUBLISHED posting with autoReshareEnabled, instead of dropping it", async () => {
    const stale = row({
      createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      autoReshareEnabled: true,
    });
    const update = jest.fn().mockResolvedValue({ ...stale, lastResharedAt: new Date() });
    const prisma = makePrisma({ jobPosting: { findMany: jest.fn().mockResolvedValue([stale]), update } });
    const result = await service(prisma).listOwnerPostings("u1", "c1");
    expect(update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { lastResharedAt: expect.any(Date) } });
    expect(result[0].daysRemaining).toBe(30);
  });

  it("drops a posting past its 30-day grace window", async () => {
    const longGone = row({
      status: "FILLED",
      filledAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    });
    const prisma = makePrisma({ jobPosting: { findMany: jest.fn().mockResolvedValue([longGone]) } });
    const result = await service(prisma).listOwnerPostings("u1", "c1");
    expect(result).toEqual([]);
  });

  it("keeps a FILLED posting within its 30-day grace window", async () => {
    const recentlyFilled = row({ status: "FILLED", filledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) });
    const prisma = makePrisma({ jobPosting: { findMany: jest.fn().mockResolvedValue([recentlyFilled]) } });
    const result = await service(prisma).listOwnerPostings("u1", "c1");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("FILLED");
  });

  it("requires approved ownership", async () => {
    const prisma = makePrisma({ companyOwner: { findUnique: jest.fn().mockResolvedValue(null) } });
    await expect(service(prisma).listOwnerPostings("u1", "c1")).rejects.toBeInstanceOf(ForbiddenException);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && pnpm exec jest job-postings.service.test.ts -t listOwnerPostings
```
Expected: FAIL — method doesn't exist.

- [ ] **Step 3: Implement**

Add this import to the top of `job-postings.service.ts`:
```typescript
import type { OwnerJobPosting } from "@iwtr/shared-types";
import { shouldLazyReshare, isWithinSavedGraceWindow, daysRemaining } from "./job-postings.util";
```

Add this method, right after `markFilled`:
```typescript
  /**
   * The owner's own view of every posting they've ever made for this
   * company — every status, including ones that have left the public feed,
   * for up to 30 more days (isWithinSavedGraceWindow) so they can still see
   * their recent history. A stale-but-resharing posting is refreshed right
   * here (shouldLazyReshare) rather than dropped — the entire "no cron"
   * mechanism this plan relies on.
   */
  async listOwnerPostings(userId: string, companyId: string): Promise<OwnerJobPosting[]> {
    await this.requireApprovedOwnership(userId, companyId);
    const rows = await this.prisma.jobPosting.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });

    const result: OwnerJobPosting[] = [];
    for (const row of rows) {
      let current = row;
      if (shouldLazyReshare(current)) {
        current = await this.prisma.jobPosting.update({
          where: { id: current.id },
          data: { lastResharedAt: new Date() },
        });
      }
      if (!isWithinSavedGraceWindow(current)) continue;
      result.push({ ...toPublic(current), daysRemaining: daysRemaining(current) });
    }
    return result;
  }
```

- [ ] **Step 4: Add the controller route**

In `job-postings.controller.ts`, add right after `boostStatus` (or anywhere alongside the other `my-companies/:companyId/job-postings*` routes):
```typescript
  @Get("my-companies/:companyId/job-postings")
  @UseGuards(JwtAuthGuard)
  listOwnerPostings(@CurrentUser() user: AuthenticatedUser, @Param("companyId", new ParseUUIDPipe()) companyId: string) {
    return this.jobPostings.listOwnerPostings(user.id, companyId);
  }
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/api && pnpm exec jest job-postings.service.test.ts
```
Expected: PASS (every case in the file).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/job-postings/job-postings.service.ts apps/api/src/modules/job-postings/job-postings.controller.ts apps/api/src/modules/job-postings/__tests__/job-postings.service.test.ts
git commit -m "feat(api): owner job-postings list endpoint with days-remaining and lazy reshare"
```

---

## Task 8: Public Jobs feed — carry `id`, apply lazy reshare + 30-day expiry filter

**Files:**
- Modify: `apps/api/src/modules/companies/companies.service.ts:223-243` (`jobPostingsByCompanyId`)
- Test: `apps/api/src/modules/companies/__tests__/companies.service.test.ts` (append)

**Interfaces:**
- Consumes: `shouldLazyReshare`, `daysRemaining` from `apps/api/src/modules/job-postings/job-postings.util.ts` (Task 4) — first cross-module import between `companies` and `job-postings`.
- Produces: `jobPostingsByCompanyId` return values now include `id`; a stale, non-resharing posting is silently excluded from both `search()`'s `jobPostings` array and `jobPostingsForSlug`'s (both already call this one shared helper, so both are fixed by this one change).

- [ ] **Step 1: Write the failing tests (append to `companies.service.test.ts`)**

```typescript
describe("CompaniesService — public job postings lifecycle", () => {
  it("includes id on each posting (needed for saving/bookmarking)", async () => {
    const prisma = makePrisma({
      company: {
        findMany: jest.fn().mockResolvedValue([
          { id: "c1", slug: "c1", name: "Co", category: "Software", workplaceTypes: ["OFFICE"], aggregate: null },
        ]),
      },
      jobPosting: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "jp1",
            companyId: "c1",
            jobTitle: "Cashier",
            description: "d",
            status: "PUBLISHED",
            createdAt: new Date(),
            lastResharedAt: null,
            filledAt: null,
            autoReshareEnabled: false,
          },
        ]),
      },
    });
    const service = new CompaniesService(prisma as any, {} as any);

    const results = await service.search({ includeJobTitles: true } as any);

    expect(results[0].jobPostings).toEqual([{ id: "jp1", jobTitle: "Cashier", description: "d" }]);
  });

  it("drops a stale posting that isn't set to auto-reshare", async () => {
    const prisma = makePrisma({
      company: {
        findMany: jest.fn().mockResolvedValue([
          { id: "c1", slug: "c1", name: "Co", category: "Software", workplaceTypes: ["OFFICE"], aggregate: null },
        ]),
      },
      jobPosting: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "jp1",
            companyId: "c1",
            jobTitle: "Cashier",
            description: "d",
            status: "PUBLISHED",
            createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
            lastResharedAt: null,
            filledAt: null,
            autoReshareEnabled: false,
          },
        ]),
      },
    });
    const service = new CompaniesService(prisma as any, {} as any);

    const results = await service.search({ includeJobTitles: true } as any);

    expect(results[0].jobPostings).toEqual([]);
  });

  it("lazily reshares a stale posting that IS set to auto-reshare, and keeps it in the feed", async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = makePrisma({
      company: {
        findMany: jest.fn().mockResolvedValue([
          { id: "c1", slug: "c1", name: "Co", category: "Software", workplaceTypes: ["OFFICE"], aggregate: null },
        ]),
      },
      jobPosting: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "jp1",
            companyId: "c1",
            jobTitle: "Cashier",
            description: "d",
            status: "PUBLISHED",
            createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
            lastResharedAt: null,
            filledAt: null,
            autoReshareEnabled: true,
          },
        ]),
        update,
      },
    });
    const service = new CompaniesService(prisma as any, {} as any);

    const results = await service.search({ includeJobTitles: true } as any);

    expect(update).toHaveBeenCalledWith({ where: { id: "jp1" }, data: { lastResharedAt: expect.any(Date) } });
    expect(results[0].jobPostings).toEqual([{ id: "jp1", jobTitle: "Cashier", description: "d" }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && pnpm exec jest companies.service.test.ts -t "public job postings lifecycle"
```
Expected: FAIL — no `id` in the returned rows yet, no lazy-reshare/expiry filtering.

- [ ] **Step 3: Implement**

Add this import to the top of `companies.service.ts`:
```typescript
import { shouldLazyReshare, daysRemaining } from "../job-postings/job-postings.util";
```

Replace `jobPostingsByCompanyId`:
```typescript
  private async jobPostingsByCompanyId(companyIds: string[]): Promise<Map<string, PublicJobPosting[]>> {
    if (companyIds.length === 0) return new Map();

    const rows = await this.prisma.jobPosting.findMany({
      // The public /jobs browser is this service's `search` + these postings;
      // `search` already drops hidden companies, but gate the posting read
      // itself too so a hidden company's job cards can never leak here
      // regardless of how the caller built `companyIds`.
      where: { company: { ...PUBLIC_COMPANY_WHERE }, companyId: { in: companyIds }, status: "PUBLISHED" },
      select: {
        id: true,
        companyId: true,
        jobTitle: true,
        description: true,
        status: true,
        createdAt: true,
        lastResharedAt: true,
        filledAt: true,
        autoReshareEnabled: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const byCompany = new Map<string, PublicJobPosting[]>();
    for (const row of rows) {
      let current = row;
      if (shouldLazyReshare(current)) {
        current = await this.prisma.jobPosting.update({
          where: { id: current.id },
          data: { lastResharedAt: new Date() },
        });
      } else if (daysRemaining(current) === 0) {
        // Stale and not resharing — gone from the public feed. Still a real
        // row in the DB (no hard deletions) and still visible to the owner
        // dashboard / Saved Posts for their own 30-day grace windows.
        continue;
      }
      const list = byCompany.get(current.companyId) ?? [];
      list.push({ id: current.id, jobTitle: current.jobTitle, description: current.description });
      byCompany.set(current.companyId, list);
    }
    return byCompany;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && pnpm exec jest companies.service.test.ts
```
Expected: PASS — the 3 new cases plus every pre-existing test in this file (none of which assert against the exact shape of a `jobPostings` row, only `jobTitles`, per Task 8's earlier read of this file).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/companies/companies.service.ts apps/api/src/modules/companies/__tests__/companies.service.test.ts
git commit -m "feat(api): public Jobs feed carries posting id and applies lazy reshare / 30-day expiry"
```

---

## Task 9: Expose `riskScore` on every Company payload

**Files:**
- Modify: `apps/api/src/modules/companies/companies.service.ts:395-457` (`toPublicCompany`)
- Test: `apps/api/src/modules/companies/__tests__/companies.service.test.ts` (append)

**Interfaces:**
- Produces: `toPublicCompany(...)` now requires `riskScore: number` on its input and includes it in its output — reaches `search()` (`CompanyListItem`, the Jobs list) and `getBySlug()` (`CompanyDetail`, the Company profile) automatically, since both already funnel through this one method.

- [ ] **Step 1: Write the failing tests (append)**

```typescript
describe("CompaniesService — riskScore exposure", () => {
  it("search() includes each company's riskScore", async () => {
    const prisma = makePrisma({
      company: {
        findMany: jest.fn().mockResolvedValue([
          { id: "c1", slug: "c1", name: "Co", category: "Software", workplaceTypes: ["OFFICE"], aggregate: null, riskScore: 2 },
        ]),
      },
    });
    const service = new CompaniesService(prisma as any, {} as any);
    const results = await service.search(baseQuery());
    expect(results[0].riskScore).toBe(2);
  });

  it("getBySlug() includes riskScore", async () => {
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: "c1",
          slug: "co",
          name: "Co",
          category: "Software",
          workplaceTypes: ["OFFICE"],
          hiddenAt: null,
          riskScore: 1,
          aggregate: null,
          owners: [],
        }),
      },
    };
    const reviews = { areAllWorkplaceTypesReviewed: jest.fn().mockResolvedValue(false) };
    const service = new CompaniesService(prisma as any, reviews as any);
    const detail = await service.getBySlug("co");
    expect(detail.company.riskScore).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && pnpm exec jest companies.service.test.ts -t riskScore
```
Expected: FAIL — `riskScore` is `undefined` on both results (the field doesn't exist on `toPublicCompany`'s output yet).

- [ ] **Step 3: Implement**

In `toPublicCompany`'s input type (the first argument's inline type, ending `featuredReviewId: string | null;`), add one line:
```typescript
    featuredReviewId: string | null;
    riskScore: number;
  }, hasApprovedOwner: boolean): Company {
```

In the method's return object, add one line right after `featuredReviewId: c.featuredReviewId,`:
```typescript
      featuredReviewId: c.featuredReviewId,
      riskScore: c.riskScore,
      hasApprovedOwner,
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && pnpm exec jest companies.service.test.ts
```
Expected: PASS — the whole file, including every pre-existing test (none of them assert full-object equality against `toPublicCompany`'s output, so adding a field doesn't break them; confirmed by reading the file before this task).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/companies/companies.service.ts apps/api/src/modules/companies/__tests__/companies.service.test.ts
git commit -m "feat(api): expose Company.riskScore on the Jobs list and Company profile payloads"
```

---

## Task 10: `SavedJobPostingsModule` — toggle + list

**Files:**
- Create: `apps/api/src/modules/saved-job-postings/saved-job-postings.service.ts`
- Create: `apps/api/src/modules/saved-job-postings/saved-job-postings.controller.ts`
- Create: `apps/api/src/modules/saved-job-postings/saved-job-postings.module.ts`
- Create: `apps/api/src/modules/saved-job-postings/__tests__/saved-job-postings.service.test.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `shouldLazyReshare`, `isWithinSavedGraceWindow`, `daysRemaining` from `job-postings.util.ts` (Task 4).
- Produces: `SavedJobPostingsService.toggle(userId, jobPostingId): Promise<SavedJobPostingToggleResult>`, `.list(userId): Promise<SavedJobPosting[]>`; routes `POST me/saved-job-postings/:jobPostingId`, `GET me/saved-job-postings`.

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/api/src/modules/saved-job-postings/__tests__/saved-job-postings.service.test.ts
import { NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { SavedJobPostingsService } from "../saved-job-postings.service";

function makePrisma(overrides: Partial<Record<string, any>> = {}) {
  const base: Record<string, any> = {
    jobPosting: {
      findUnique: jest.fn().mockResolvedValue({ id: "jp1" }),
    },
    savedJobPosting: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  return { ...base, ...overrides };
}

describe("SavedJobPostingsService.toggle", () => {
  it("404s on an unknown job posting", async () => {
    const prisma = makePrisma({ jobPosting: { findUnique: jest.fn().mockResolvedValue(null) } });
    await expect(new SavedJobPostingsService(prisma as any).toggle("u1", "ghost")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("saves when not already saved", async () => {
    const prisma = makePrisma();
    const result = await new SavedJobPostingsService(prisma as any).toggle("u1", "jp1");
    expect(result).toEqual({ jobPostingId: "jp1", saved: true });
    expect(prisma.savedJobPosting.create).toHaveBeenCalledWith({ data: { userId: "u1", jobPostingId: "jp1" } });
  });

  it("unsaves when already saved", async () => {
    const prisma = makePrisma({
      savedJobPosting: {
        findUnique: jest.fn().mockResolvedValue({ id: "s1" }),
        delete: jest.fn().mockResolvedValue({}),
      },
    });
    const result = await new SavedJobPostingsService(prisma as any).toggle("u1", "jp1");
    expect(result).toEqual({ jobPostingId: "jp1", saved: false });
    expect(prisma.savedJobPosting.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
  });

  it("a repeat save from a race doesn't throw (P2002 swallowed)", async () => {
    const prisma = makePrisma({
      savedJobPosting: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" })),
      },
    });
    const result = await new SavedJobPostingsService(prisma as any).toggle("u1", "jp1");
    expect(result).toEqual({ jobPostingId: "jp1", saved: true });
  });
});

describe("SavedJobPostingsService.list", () => {
  function savedRow(postingOverrides: Partial<Record<string, any>> = {}) {
    return {
      jobPosting: {
        id: "jp1",
        companyId: "c1",
        jobTitle: "Cashier",
        description: "d",
        status: "PUBLISHED",
        createdAt: new Date(),
        lastResharedAt: null,
        filledAt: null,
        autoReshareEnabled: false,
        ...postingOverrides,
      },
    };
  }

  it("marks a still-live posting as not expired", async () => {
    const prisma = makePrisma({ savedJobPosting: { findMany: jest.fn().mockResolvedValue([savedRow()]) } });
    const result = await new SavedJobPostingsService(prisma as any).list("u1");
    expect(result).toEqual([{ id: "jp1", companyId: "c1", jobTitle: "Cashier", description: "d", expired: false }]);
  });

  it("marks a FILLED posting as expired but still returns it within the grace window", async () => {
    const filled = savedRow({ status: "FILLED", filledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) });
    const prisma = makePrisma({ savedJobPosting: { findMany: jest.fn().mockResolvedValue([filled]) } });
    const result = await new SavedJobPostingsService(prisma as any).list("u1");
    expect(result[0].expired).toBe(true);
  });

  it("drops a posting past its 30-day grace window entirely", async () => {
    const longGone = savedRow({ status: "FILLED", filledAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) });
    const prisma = makePrisma({ savedJobPosting: { findMany: jest.fn().mockResolvedValue([longGone]) } });
    const result = await new SavedJobPostingsService(prisma as any).list("u1");
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && pnpm exec jest saved-job-postings.service.test.ts
```
Expected: FAIL — `Cannot find module '../saved-job-postings.service'`.

- [ ] **Step 3: Implement the service**

```typescript
// apps/api/src/modules/saved-job-postings/saved-job-postings.service.ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { SavedJobPosting, SavedJobPostingToggleResult } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { shouldLazyReshare, isWithinSavedGraceWindow, daysRemaining } from "../job-postings/job-postings.util";

@Injectable()
export class SavedJobPostingsService {
  constructor(private readonly prisma: PrismaService) {}

  // Same race-safe toggle shape as SocialService.toggleSave (see
  // saved-posts.controller.ts's precedent) — a private bookmark, no public
  // save count.
  async toggle(userId: string, jobPostingId: string): Promise<SavedJobPostingToggleResult> {
    const posting = await this.prisma.jobPosting.findUnique({ where: { id: jobPostingId } });
    if (!posting) {
      throw new NotFoundException("Job posting not found");
    }

    const existing = await this.prisma.savedJobPosting.findUnique({
      where: { userId_jobPostingId: { userId, jobPostingId } },
    });
    if (existing) {
      try {
        await this.prisma.savedJobPosting.delete({ where: { id: existing.id } });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025")) {
          throw err;
        }
      }
      return { jobPostingId, saved: false };
    }

    try {
      await this.prisma.savedJobPosting.create({ data: { userId, jobPostingId } });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) {
        throw err;
      }
    }
    return { jobPostingId, saved: true };
  }

  // The caller's own saved postings, most-recently-saved first. Applies the
  // same lazy-reshare pass the public feed and owner list use, then the
  // same 30-day grace window — a saved posting that's dropped out of the
  // grace window simply stops appearing here (its SavedJobPosting row is
  // never deleted; if it ever becomes relevant again there's nothing to
  // restore since the underlying JobPosting row is untouched either).
  async list(userId: string): Promise<SavedJobPosting[]> {
    const rows = await this.prisma.savedJobPosting.findMany({
      where: { userId },
      include: { jobPosting: true },
      orderBy: { createdAt: "desc" },
    });

    const result: SavedJobPosting[] = [];
    for (const row of rows) {
      let posting = row.jobPosting;
      if (shouldLazyReshare(posting)) {
        posting = await this.prisma.jobPosting.update({
          where: { id: posting.id },
          data: { lastResharedAt: new Date() },
        });
      }
      if (!isWithinSavedGraceWindow(posting)) continue;
      result.push({
        id: posting.id,
        companyId: posting.companyId,
        jobTitle: posting.jobTitle,
        description: posting.description,
        expired: posting.status !== "PUBLISHED" || daysRemaining(posting) === 0,
      });
    }
    return result;
  }
}
```

- [ ] **Step 4: Implement the controller**

```typescript
// apps/api/src/modules/saved-job-postings/saved-job-postings.controller.ts
import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { SavedJobPostingsService } from "./saved-job-postings.service";

// `/me/*`-style routes (unprefixed controller), same convention as
// SavedPostsController and OwnerController's `me/owned-companies`.
@Controller()
export class SavedJobPostingsController {
  constructor(private readonly savedJobPostings: SavedJobPostingsService) {}

  @Post("me/saved-job-postings/:jobPostingId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("MEMBER")
  toggle(@CurrentUser() user: AuthenticatedUser, @Param("jobPostingId", new ParseUUIDPipe()) jobPostingId: string) {
    return this.savedJobPostings.toggle(user.id, jobPostingId);
  }

  @Get("me/saved-job-postings")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("MEMBER")
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.savedJobPostings.list(user.id);
  }
}
```

- [ ] **Step 5: Implement the module**

```typescript
// apps/api/src/modules/saved-job-postings/saved-job-postings.module.ts
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SavedJobPostingsController } from "./saved-job-postings.controller";
import { SavedJobPostingsService } from "./saved-job-postings.service";

@Module({
  imports: [AuthModule],
  controllers: [SavedJobPostingsController],
  providers: [SavedJobPostingsService],
})
export class SavedJobPostingsModule {}
```

- [ ] **Step 6: Register the module in `app.module.ts`**

Add the import near the other module imports:
```typescript
import { SavedJobPostingsModule } from "./modules/saved-job-postings/saved-job-postings.module";
```
Add `SavedJobPostingsModule` to the `imports` array, next to `JobPostingsModule`:
```typescript
    JobPostingsModule,
    SavedJobPostingsModule,
    SocialModule,
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd apps/api && pnpm exec jest saved-job-postings.service.test.ts
```
Expected: PASS (7 tests).

- [ ] **Step 8: Boot the server to confirm the module wires up cleanly**

```bash
cd apps/api && pnpm exec tsc --noEmit
```
Expected: no type errors (a quick, non-network way to catch a broken module registration before running the real dev server).

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/saved-job-postings apps/api/src/app.module.ts
git commit -m "feat(api): saved-job-postings module (toggle + list, mirrors saved-posts)"
```

---

## Task 11: Live verification — create and remove postings from the demo company, watch Risk Score move

This is the user's explicit ask: *"test out this new Risk Score feature by creating and removing job posting from a test company."* Runs the real `JobPostingsService` through NestJS's application context (not a re-implementation, not raw SQL) against the actual dev database, using the existing `demo-finans-holding` company.

**Files:**
- Create: `apps/api/scripts/verify-risk-score.ts`

- [ ] **Step 1: Write the script**

```typescript
// apps/api/scripts/verify-risk-score.ts
// Run from apps/api: pnpm exec ts-node scripts/verify-risk-score.ts
//
// Live end-to-end check of the Risk Score feature against the real dev DB,
// using the existing demo-finans-holding company: post a role, mark it
// filled, repost the identical role, confirm riskScore reads back as 1 via
// the real JobPostingsService/CompaniesService — repeat to confirm the cap
// at 3. Prints every intermediate state so the run is auditable, not just
// "PASS"/"FAIL".
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { JobPostingsService } from "../src/modules/job-postings/job-postings.service";
import { CompaniesService } from "../src/modules/companies/companies.service";
import { PrismaService } from "../src/prisma/prisma.service";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const jobPostings = app.get(JobPostingsService);
  const companies = app.get(CompaniesService);
  const prisma = app.get(PrismaService);

  const company = await prisma.company.findUnique({ where: { slug: "demo-finans-holding" } });
  if (!company) throw new Error("demo-finans-holding not found — seed it first.");

  const owner = await prisma.companyOwner.findFirst({ where: { companyId: company.id, claimStatus: "APPROVED" } });
  if (!owner) throw new Error("demo-finans-holding has no approved owner to post as.");

  const workType = company.workplaceTypes[0] as "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
  const jobTitle = `Risk Score Verification Role ${Date.now()}`;

  console.log(`Using company "${company.name}" (${company.id}), owner user ${owner.userId}, workType ${workType}`);
  console.log(`Starting riskScore: ${company.riskScore}`);

  for (let round = 1; round <= 4; round++) {
    const created = await jobPostings.create(owner.userId, company.id, {
      jobTitle,
      description: `Verification round ${round}`,
      workType,
      autoReshareEnabled: false,
      boost: null,
    });
    if (created.status !== "PUBLISHED" && created.status !== "PENDING_ADMIN") {
      throw new Error(`Unexpected create() status: ${created.status}`);
    }
    console.log(`Round ${round}: created posting ${created.jobPosting.id}, status ${created.jobPosting.status}`);

    const afterCreate = await prisma.company.findUnique({ where: { id: company.id }, select: { riskScore: true } });
    console.log(`Round ${round}: Company.riskScore after create = ${afterCreate?.riskScore}`);

    await jobPostings.markFilled(owner.userId, company.id, created.jobPosting.id);
    console.log(`Round ${round}: marked ${created.jobPosting.id} FILLED`);
  }

  const finalCompany = await companies.getBySlug("demo-finans-holding");
  console.log(`Final riskScore via CompaniesService.getBySlug (the real public API payload): ${finalCompany.company.riskScore}`);
  if (finalCompany.company.riskScore !== 3) {
    throw new Error(`Expected riskScore to cap at 3, got ${finalCompany.company.riskScore}`);
  }
  console.log("Risk Score verification PASSED — capped correctly at 3 after 4 repost-after-filled rounds.");

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run it against the real dev DB**

```bash
cd apps/api && pnpm exec ts-node scripts/verify-risk-score.ts
```
Expected: 4 rounds print, `riskScore after create` reads `0, 1, 2, 3` across the 4 rounds (round 1 has no prior FILLED match yet — 0; each subsequent round's create finds the previous round's now-FILLED posting), and the script exits 0 with the PASSED line. **Paste the actual console output into the plan's execution notes / PR description when this task is marked done — this is the deliverable the user asked for, not just a green checkmark.**

- [ ] **Step 3: Commit**

```bash
git add apps/api/scripts/verify-risk-score.ts
git commit -m "test(api): live Risk Score verification script against the demo company"
```

---

## Task 12: Full verification pass

**Files:** none new — this task only runs commands.

- [ ] **Step 1: Rebuild shared-types from a clean state**

```bash
cd packages/shared-types && pnpm exec tsc
```
Expected: no errors.

- [ ] **Step 2: Typecheck the whole API**

```bash
cd apps/api && pnpm exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Run the full API test suite**

```bash
cd apps/api && pnpm exec jest
```
Expected: every test passes, old and new (Tasks 1-11's new files plus every pre-existing test file untouched by this plan).

- [ ] **Step 4: Lint**

```bash
cd apps/api && pnpm lint
```
Expected: no errors (this repo added `apps/api` eslint per CLAUDE.md's security-debt history — don't skip this).

- [ ] **Step 5: Push**

```bash
git push
```

This closes out the backend plan. The paired frontend plan
(`docs/superpowers/specs/2026-09-15-job-lifecycle-risk-score-frontend.md` →
its own implementation plan, written after this one is verified) consumes:
`GET my-companies/:companyId/job-postings`, `POST
my-companies/:companyId/job-postings/:jobPostingId/mark-filled`, `POST
me/saved-job-postings/:jobPostingId`, `GET me/saved-job-postings`, the
`workType`/`autoReshareEnabled` fields on `createJobPostingInputSchema`, and
`riskScore` on `Company`.

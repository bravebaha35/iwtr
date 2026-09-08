# Owner Dashboard — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add work-type edit locking, a real banner-storage utility
(server-side resize/compression, correct validation), the backend half of the
Gold→Enterprise badge rename, and example-banner seeding — with zero
`apps/web` changes and zero Prisma schema/migration changes.

**Architecture:** All four items are additive service-layer changes on top of
the owner dashboard backend that shipped yesterday (`OwnerService`,
`CompaniesService`, `ReviewsService`). `workplaceTypesLocked` is computed
on-demand from `Review` rows (via a new `ReviewsService` method), not stored.
Banner upload gets a new validator (`packages/shared-types`) and a `sharp`
resize/compress step, in its own `uploads/company-banners/` directory. A new,
idempotent seeding script sets example banners (and the tier that makes them
visible) on a handful of already-seeded real companies.

**Tech Stack:** NestJS 10, Prisma 5, Jest (existing `apps/api` test
convention: hand-rolled `{ methodName: jest.fn() }` mocks passed as `as any`
to a directly-`new`'d service — no test DB, no Nest testing module), `sharp`
(new dependency, image processing), `image-size` (existing, dimension
reading).

**Spec:** `docs/superpowers/specs/2026-09-07-owner-dashboard-backend.md` —
read it first. It documents 5 corrections to the original task text that this
plan is built on (banner upload already exists; the "Gold" rename is mostly a
frontend concern; work-type editing has no auto-save bug, only a missing
lock; the banner tier gate stays Blue+/Enterprise, confirmed with the user;
"oil/clothing/market" means the real seeded nationwide-brand rows).

## Global Constraints

- Do not modify any file under `apps/web` in this plan.
- No `schema.prisma` column/model changes and no `prisma db push` — every
  field this plan adds is either a code-level computed value or lives in
  `packages/shared-types` only.
- Banner access stays gated to `BLUE_PLUS`/`ENTERPRISE` (not narrowed to
  `ENTERPRISE`-only) — confirmed with the user, do not change this gate.
- The work-type lock applies to `OwnerService.updateMyCompany` only. Do not
  add it to `AdminCompaniesService.update`.
- After any edit under `packages/shared-types/src/`, rebuild its `dist/`
  (`cd packages/shared-types && pnpm exec tsc`) — `apps/api` consumes the
  compiled output, not the raw source (see CLAUDE.md's gotcha on this).
- Match existing test convention exactly: hand-rolled mocks (`{ review: {
  findMany: jest.fn()... } }` cast `as any`), services instantiated directly
  with `new`, no Nest `Test.createTestingModule`. Every existing test file
  touched by this plan already uses this style — do not introduce a
  different one.
- Windows dev environment: if `apps/api`'s dev server is running, no
  `prisma generate`/`db push` is needed by this plan (no schema change), so
  the usual EPERM-on-Windows gotcha doesn't apply here.

---

### Task 1: Rename "Gold" → "Enterprise" in backend-owned comments

**Files:**
- Modify: `apps/api/prisma/schema.prisma:49-59` and `:374`
- Modify: `apps/api/src/modules/job-postings/decideBoostAccess.ts:3-7`

**Interfaces:** None — comment-only, no code behavior changes, nothing for
a later task to consume.

- [ ] **Step 1: Update the `OwnerTier` enum's doc comment**

In `apps/api/prisma/schema.prisma`, replace:

```prisma
// Resolves the "unified 4-tier pricing model" question the comment below
// used to flag as open (see project memory, 2026-09-06 decision): FREE plus
// exactly the 3 paid ranks from the CEO-finalized Free/Starter/Pro/Enterprise
// matrix (apps/web/src/lib/pricingTiers.ts), renamed here to match the badge
// each rank grants (Blue/Blue+/Enterprise — the top rank keeps the name
// "Enterprise" from that matrix, whose badge is "Gold", not a 4th name).
// tierKeyFromOwnerTier (apps/web/src/lib/pricingTiers.ts,
// apps/api/src/modules/job-postings/decideBoostAccess.ts) maps this 1:1 onto
// that matrix's free/starter/pro/enterprise keys — the matrix's own content
// (prices, feature copy) is unchanged, only the DB-backed axis driving it is
// new.
```

with:

```prisma
// Resolves the "unified 4-tier pricing model" question the comment below
// used to flag as open (see project memory, 2026-09-06 decision): FREE plus
// exactly the 3 paid ranks from the CEO-finalized Free/Starter/Pro/Enterprise
// matrix (apps/web/src/lib/pricingTiers.ts), renamed here to match the badge
// each rank grants (Blue/Blue+/Enterprise — the top rank's badge is named
// "Enterprise Badge", same as the tier itself, no separate "Gold" name).
// tierKeyFromOwnerTier (apps/web/src/lib/pricingTiers.ts,
// apps/api/src/modules/job-postings/decideBoostAccess.ts) maps this 1:1 onto
// that matrix's free/starter/pro/enterprise keys — the matrix's own content
// (prices, feature copy) is unchanged, only the DB-backed axis driving it is
// new.
```

- [ ] **Step 2: Update the `Company.badgeTier` field comment**

In the same file, replace:

```prisma
  // Denormalized copy of the approved owner's OwnerTier, kept in sync in the
  // same place isVerifiedBadge already is (PaymentsService.
  // applySubscriptionStatus) — needed alongside the boolean because the
  // public badge now has 4 distinct looks (none/Blue/Blue+/Gold), not just
  // yes/no. Never read CompanyOwner.tier directly for public display; this
  // is the public-safe copy of it.
```

with:

```prisma
  // Denormalized copy of the approved owner's OwnerTier, kept in sync in the
  // same place isVerifiedBadge already is (PaymentsService.
  // applySubscriptionStatus) — needed alongside the boolean because the
  // public badge now has 4 distinct looks (none/Blue/Blue+/Enterprise), not
  // just yes/no. Never read CompanyOwner.tier directly for public display;
  // this is the public-safe copy of it.
```

- [ ] **Step 3: Update `decideBoostAccess.ts`'s comment**

In `apps/api/src/modules/job-postings/decideBoostAccess.ts`, replace:

```ts
// The real, DB-backed OwnerTier axis (see its schema.prisma comment) mapped
// onto the same free/starter/pro/enterprise MembershipTierKey buckets the
// job-ads pricing-matrix row already uses — GOLD doesn't exist as a
// standalone tier name (see OwnerTier), it's ENTERPRISE's badge, so
// ENTERPRISE alone maps onto the matrix's top "enterprise" bucket.
```

with:

```ts
// The real, DB-backed OwnerTier axis (see its schema.prisma comment) mapped
// onto the same free/starter/pro/enterprise MembershipTierKey buckets the
// job-ads pricing-matrix row already uses — ENTERPRISE alone maps onto the
// matrix's top "enterprise" bucket (it's the only tier whose badge and tier
// name are the same word).
```

- [ ] **Step 4: Verify no backend "Gold" references remain**

Run: `grep -ril gold apps/api/src apps/api/prisma`
Expected: no output (empty match set). The 7 frontend occurrences are
intentionally out of scope here — see the spec.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/src/modules/job-postings/decideBoostAccess.ts
git commit -m "docs(api): rename Gold badge references to Enterprise in comments"
```

---

### Task 2: `ReviewsService.areAllWorkplaceTypesReviewed`

**Files:**
- Modify: `apps/api/src/modules/reviews/reviews.service.ts` (add one public
  method, right before the existing private `getPublishedSurveyAnswersByType`
  at line 822)
- Test: `apps/api/src/modules/reviews/__tests__/reviews.service.test.ts`
  (append to the existing file — it already covers other `ReviewsService`
  methods in separate `describe` blocks)

**Interfaces:**
- Produces: `ReviewsService.areAllWorkplaceTypesReviewed(companyId: string,
  workplaceTypes: WorkplaceType[]): Promise<boolean>` — Task 3 (`OwnerService`)
  and Task 4 (`CompaniesService`) both call this.

- [ ] **Step 1: Write the failing tests**

In `apps/api/src/modules/reviews/__tests__/reviews.service.test.ts`, insert
this new `describe` block immediately before the existing
`describe("ReviewsService.submitReview", () => {` (the file's first line
after the imports/helper at the top):

```ts
describe("ReviewsService.areAllWorkplaceTypesReviewed", () => {
  it("is false for a single-workplaceType company regardless of review count", async () => {
    const prisma = { review: { findMany: jest.fn().mockResolvedValue([{ workplaceType: "OFFICE" }]) } };
    const service = new ReviewsService(prisma as any, new ModerationService(), { purgeTcKimlikNoIfPresent: jest.fn() } as any);

    await expect(service.areAllWorkplaceTypesReviewed("company-1", ["OFFICE"])).resolves.toBe(false);
    expect(prisma.review.findMany).not.toHaveBeenCalled();
  });

  it("is true only once every one of the given workplaceTypes has a published review", async () => {
    const prisma = {
      review: {
        findMany: jest.fn().mockResolvedValue([{ workplaceType: "OFFICE" }, { workplaceType: "SERVICE" }]),
      },
    };
    const service = new ReviewsService(prisma as any, new ModerationService(), { purgeTcKimlikNoIfPresent: jest.fn() } as any);

    await expect(service.areAllWorkplaceTypesReviewed("company-1", ["OFFICE", "SERVICE"])).resolves.toBe(true);
  });

  it("is false when only one of the two workplaceTypes has a published review", async () => {
    const prisma = { review: { findMany: jest.fn().mockResolvedValue([{ workplaceType: "OFFICE" }]) } };
    const service = new ReviewsService(prisma as any, new ModerationService(), { purgeTcKimlikNoIfPresent: jest.fn() } as any);

    await expect(service.areAllWorkplaceTypesReviewed("company-1", ["OFFICE", "SERVICE"])).resolves.toBe(false);
  });
});

```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/api && pnpm exec jest reviews.service.test.ts`
Expected: FAIL — `service.areAllWorkplaceTypesReviewed is not a function`.

- [ ] **Step 3: Implement the method**

In `apps/api/src/modules/reviews/reviews.service.ts`, insert this new public
method immediately before the `/**` doc comment that starts the private
`getPublishedSurveyAnswersByType` method (i.e. right after `getSurveyStats`'s
closing `}` at line 820, before line 822's comment block):

```ts
  /**
   * True when every one of the given workplaceTypes already has at least one
   * PUBLISHED review — the trigger condition for locking
   * Company.workplaceTypes against further owner edits
   * (OwnerService.updateMyCompany). A company with only one workplaceType,
   * or with any unreviewed type among the given ones, is never locked.
   */
  async areAllWorkplaceTypesReviewed(companyId: string, workplaceTypes: WorkplaceType[]): Promise<boolean> {
    if (workplaceTypes.length < 2) return false;
    const published = await this.prisma.review.findMany({
      where: { companyId, status: "PUBLISHED", workplaceType: { in: workplaceTypes } },
      select: { workplaceType: true },
      distinct: ["workplaceType"],
    });
    const reviewedTypes = new Set(published.map((r) => r.workplaceType));
    return workplaceTypes.every((t) => reviewedTypes.has(t));
  }

```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/api && pnpm exec jest reviews.service.test.ts`
Expected: PASS, all tests including the pre-existing `submitReview`/
`listForCompany` ones (unaffected by this change).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/reviews/reviews.service.ts apps/api/src/modules/reviews/__tests__/reviews.service.test.ts
git commit -m "feat(api): add ReviewsService.areAllWorkplaceTypesReviewed"
```

---

### Task 3: Lock `workplaceTypes` edits in `OwnerService.updateMyCompany`

**Files:**
- Modify: `apps/api/src/modules/owner/owner.module.ts` (import `ReviewsModule`)
- Modify: `apps/api/src/modules/owner/owner.service.ts` (inject
  `ReviewsService`, add the lock check)
- Test: `apps/api/src/modules/owner/__tests__/owner.service.test.ts` (new file)

**Interfaces:**
- Consumes: `ReviewsService.areAllWorkplaceTypesReviewed` (Task 2).
- Produces: `OwnerService.updateMyCompany` now throws `ForbiddenException`
  when the caller tries to change `workplaceTypes` on a company whose
  current 2 workplaceTypes both already have a published review. No
  signature change — same `(userId, companyId, input): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/modules/owner/__tests__/owner.service.test.ts`:

```ts
import { ForbiddenException } from "@nestjs/common";
import { OwnerService } from "../owner.service";
import type { ReviewsService } from "../../reviews/reviews.service";

describe("OwnerService.updateMyCompany — workplaceTypes locking", () => {
  function buildService(opts: { currentTypes: string[]; allReviewed: boolean }) {
    const prisma = {
      companyOwner: {
        findUnique: jest.fn().mockResolvedValue({ tier: "FREE", planStatus: "NONE", claimStatus: "APPROVED" }),
      },
      company: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ workplaceTypes: opts.currentTypes }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const reviews = { areAllWorkplaceTypesReviewed: jest.fn().mockResolvedValue(opts.allReviewed) };
    const service = new OwnerService(prisma as any, reviews as unknown as ReviewsService);
    return { service, prisma, reviews };
  }

  it("rejects a workplaceTypes change once both current types have been reviewed", async () => {
    const { service, reviews } = buildService({ currentTypes: ["OFFICE", "SERVICE"], allReviewed: true });

    await expect(
      service.updateMyCompany("user-1", "company-1", { workplaceTypes: ["OFFICE", "MANUAL_LABOUR"] }),
    ).rejects.toThrow(ForbiddenException);
    expect(reviews.areAllWorkplaceTypesReviewed).toHaveBeenCalledWith("company-1", ["OFFICE", "SERVICE"]);
  });

  it("allows a workplaceTypes change when not both current types are reviewed yet", async () => {
    const { service, prisma } = buildService({ currentTypes: ["OFFICE", "SERVICE"], allReviewed: false });

    await service.updateMyCompany("user-1", "company-1", { workplaceTypes: ["OFFICE", "MANUAL_LABOUR"] });
    expect(prisma.company.update).toHaveBeenCalled();
  });

  it("allows saving other fields untouched when workplaceTypes isn't part of the request", async () => {
    const { service, prisma, reviews } = buildService({ currentTypes: ["OFFICE", "SERVICE"], allReviewed: true });

    await service.updateMyCompany("user-1", "company-1", { isHiring: true });
    expect(reviews.areAllWorkplaceTypesReviewed).not.toHaveBeenCalled();
    expect(prisma.company.update).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/api && pnpm exec jest owner.service.test.ts`
Expected: FAIL — `OwnerService` constructor currently takes only 1 argument
(TypeScript error) or the lock never fires (runtime assertion failure),
depending on how strict the test run is; either way, not passing yet.

- [ ] **Step 3: Add `ReviewsModule` to `OwnerModule`'s imports**

In `apps/api/src/modules/owner/owner.module.ts`, replace:

```ts
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OwnerController } from "./owner.controller";
import { OwnerService } from "./owner.service";

@Module({
  imports: [AuthModule],
  controllers: [OwnerController],
  providers: [OwnerService],
  exports: [OwnerService],
})
export class OwnerModule {}
```

with:

```ts
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { OwnerController } from "./owner.controller";
import { OwnerService } from "./owner.service";

@Module({
  imports: [AuthModule, ReviewsModule],
  controllers: [OwnerController],
  providers: [OwnerService],
  exports: [OwnerService],
})
export class OwnerModule {}
```

`ReviewsModule` already `exports: [ReviewsService]` and does not import
`OwnerModule` (confirmed — no circular dependency).

- [ ] **Step 4: Inject `ReviewsService` and add the lock check**

In `apps/api/src/modules/owner/owner.service.ts`, replace the imports block:

```ts
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { ConflictException, ForbiddenException, Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { imageSize } from "image-size";
import { validateLogoFile, type LogoUploadResult } from "@iwtr/shared-types";
import type {
  AdminOwnerClaim,
  ClaimCompanyInput,
  ContactAdminInput,
  MyCompanyClaim,
  OwnedCompany,
  OwnerClaimStatus,
  OwnerContactMessage,
  OwnerTier,
  PlanStatus,
  RivalAnalyticsTier,
  UpdateCompanyInput,
} from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { resolveLocation } from "../companies/resolve-location.util";

const UPLOADS_DIR = join(process.cwd(), "uploads", "company-logos");

@Injectable()
export class OwnerService {
  constructor(private readonly prisma: PrismaService) {}
```

with:

```ts
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { ConflictException, ForbiddenException, Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { imageSize } from "image-size";
import { validateLogoFile, type LogoUploadResult } from "@iwtr/shared-types";
import type {
  AdminOwnerClaim,
  ClaimCompanyInput,
  ContactAdminInput,
  MyCompanyClaim,
  OwnedCompany,
  OwnerClaimStatus,
  OwnerContactMessage,
  OwnerTier,
  PlanStatus,
  RivalAnalyticsTier,
  UpdateCompanyInput,
  WorkplaceType,
} from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ReviewsService } from "../reviews/reviews.service";
import { resolveLocation } from "../companies/resolve-location.util";

const UPLOADS_DIR = join(process.cwd(), "uploads", "company-logos");

function sameWorkplaceTypes(a: WorkplaceType[], b: WorkplaceType[]): boolean {
  return a.length === b.length && a.every((v) => b.includes(v));
}

@Injectable()
export class OwnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewsService,
  ) {}
```

Then, in the same file, in `updateMyCompany`, insert the lock check right
after the banner-tier check and before the `featuredReviewId` check —
replace:

```ts
    // Banner is a narrower privilege than the rest of the Premium box — Blue
    // (Starter) doesn't include it, only Blue+ (Pro) and Enterprise do (same
    // rule as uploadBanner below).
    const hasBannerTier = ownership.tier === "BLUE_PLUS" || ownership.tier === "ENTERPRISE";
    if (input.bannerImageUrl !== undefined && !(hasBannerTier && ownership.planStatus === "ACTIVE")) {
      throw new ForbiddenException("Upgrade to Blue+ or Enterprise to set a banner image.");
    }

    if (input.featuredReviewId !== undefined && input.featuredReviewId !== null) {
```

with:

```ts
    // Banner is a narrower privilege than the rest of the Premium box — Blue
    // (Starter) doesn't include it, only Blue+ (Pro) and Enterprise do (same
    // rule as uploadBanner below).
    const hasBannerTier = ownership.tier === "BLUE_PLUS" || ownership.tier === "ENTERPRISE";
    if (input.bannerImageUrl !== undefined && !(hasBannerTier && ownership.planStatus === "ACTIVE")) {
      throw new ForbiddenException("Upgrade to Blue+ or Enterprise to set a banner image.");
    }

    // Once a company's (at most 2) workplaceTypes have each collected a
    // published review, they're locked against further self-service edits —
    // an owner reclassifying work-types after reviews land under them would
    // let bad reviews get orphaned from the type a future visitor filters
    // by. Only checked when workplaceTypes is actually part of this request,
    // and only against a real change (re-submitting the same 2 values is a
    // no-op, not a lock violation).
    if (input.workplaceTypes !== undefined) {
      const currentCompany = await this.prisma.company.findUniqueOrThrow({
        where: { id: companyId },
        select: { workplaceTypes: true },
      });
      const isChanging = !sameWorkplaceTypes(currentCompany.workplaceTypes, input.workplaceTypes);
      if (isChanging && (await this.reviews.areAllWorkplaceTypesReviewed(companyId, currentCompany.workplaceTypes))) {
        throw new ForbiddenException(
          "Workplace types are locked once both have received reviews. Contact support to change them.",
        );
      }
    }

    if (input.featuredReviewId !== undefined && input.featuredReviewId !== null) {
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd apps/api && pnpm exec jest owner.service.test.ts`
Expected: PASS, all 3 tests.

- [ ] **Step 6: Typecheck the whole API**

Run: `cd apps/api && pnpm exec tsc --noEmit`
Expected: no errors (confirms `OwnerModule`'s new DI wiring and the
`WorkplaceType` import are correct).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/owner/owner.module.ts apps/api/src/modules/owner/owner.service.ts apps/api/src/modules/owner/__tests__/owner.service.test.ts
git commit -m "feat(api): lock Company.workplaceTypes once both types have reviews"
```

---

### Task 4: Expose `workplaceTypesLocked` on the public Company shape

**Files:**
- Modify: `packages/shared-types/src/schemas/company.ts` (add optional field
  to `companySchema`)
- Modify: `apps/api/src/modules/companies/companies.service.ts` (inject
  `ReviewsService`, compute the field in `getBySlug` only — not in the list/
  search path, to avoid an added query per browse-grid card)
- Modify/Test: `apps/api/src/modules/companies/__tests__/companies.service.test.ts`
  (fix 3 existing constructor calls, add a new `describe` block)

**Interfaces:**
- Consumes: `ReviewsService.areAllWorkplaceTypesReviewed` (Task 2).
- Produces: `Company.workplaceTypesLocked?: boolean` — present (`true`/
  `false`) only on the result of `GET /companies/:slug`
  (`CompanyDetail.company.workplaceTypesLocked`); always `undefined` on
  browse/search list rows (`CompanyListItem`). The frontend plan's Task on
  the work-type Save/lock UI reads `detail?.company.workplaceTypesLocked`.

- [ ] **Step 1: Write the failing tests**

In `apps/api/src/modules/companies/__tests__/companies.service.test.ts`, fix
the 3 existing constructor calls (the new second constructor argument is
unused by these 3 tests, so a bare mock is enough — same pattern the
existing `reviews.service.test.ts` already uses for an unused third
dependency):

Replace (all 3 occurrences — same exact text on lines 29, 58, 83):
```ts
    const service = new CompaniesService(prisma as any);
```
with:
```ts
    const service = new CompaniesService(prisma as any, {} as any);
```

Then append this new `describe` block at the end of the file (after the last
existing test's closing `});`):

```ts

describe("CompaniesService.getBySlug — workplaceTypesLocked", () => {
  it("is true when the company's workplaceTypes are both already reviewed", async () => {
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: "c1",
          slug: "co",
          name: "Co",
          category: "Software",
          workplaceTypes: ["OFFICE", "SERVICE"],
          aggregate: null,
        }),
      },
    };
    const reviews = { areAllWorkplaceTypesReviewed: jest.fn().mockResolvedValue(true) };
    const service = new CompaniesService(prisma as any, reviews as any);

    const result = await service.getBySlug("co");

    expect(result.company.workplaceTypesLocked).toBe(true);
    expect(reviews.areAllWorkplaceTypesReviewed).toHaveBeenCalledWith("c1", ["OFFICE", "SERVICE"]);
  });

  it("is false when they aren't both reviewed yet", async () => {
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          id: "c1",
          slug: "co",
          name: "Co",
          category: "Software",
          workplaceTypes: ["OFFICE", "SERVICE"],
          aggregate: null,
        }),
      },
    };
    const reviews = { areAllWorkplaceTypesReviewed: jest.fn().mockResolvedValue(false) };
    const service = new CompaniesService(prisma as any, reviews as any);

    const result = await service.getBySlug("co");

    expect(result.company.workplaceTypesLocked).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/api && pnpm exec jest companies.service.test.ts`
Expected: FAIL — `CompaniesService` currently takes 1 constructor argument,
and `workplaceTypesLocked` doesn't exist on the result yet.

- [ ] **Step 3: Add the field to `companySchema`**

In `packages/shared-types/src/schemas/company.ts`, replace:

```ts
  // Premium Features box (owner dashboard), paid-tier-gated like
  // description/website above.
  bannerImageUrl: httpUrlSchema.nullable(),
  featuredReviewId: z.string().uuid().nullable(),
});
export type Company = z.infer<typeof companySchema>;
```

with:

```ts
  // Premium Features box (owner dashboard), paid-tier-gated like
  // description/website above.
  bannerImageUrl: httpUrlSchema.nullable(),
  featuredReviewId: z.string().uuid().nullable(),
  // Computed (not stored) — true when both of this company's workplaceTypes
  // already have a PUBLISHED review, which locks OwnerService.updateMyCompany
  // against further workplaceTypes edits. Only ever computed on the
  // single-company detail fetch (CompaniesService.getBySlug) — omitted
  // (undefined) on browse/search list rows, where per-row lock status isn't
  // needed and computing it for every row would add a query per card.
  workplaceTypesLocked: z.boolean().optional(),
});
export type Company = z.infer<typeof companySchema>;
```

- [ ] **Step 4: Rebuild `packages/shared-types`**

Run: `cd packages/shared-types && pnpm exec tsc`
Expected: no errors.

- [ ] **Step 5: Inject `ReviewsService` and compute the field in `getBySlug`**

In `apps/api/src/modules/companies/companies.service.ts`, replace:

```ts
@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}
```

with:

```ts
@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewsService,
  ) {}
```

and add the import at the top of the file, alongside the existing
`PrismaService` import:

```ts
import { PrismaService } from "../../prisma/prisma.service";
import { ReviewsService } from "../reviews/reviews.service";
```

Then replace `getBySlug`:

```ts
  async getBySlug(slug: string): Promise<CompanyDetail> {
    const company = await this.prisma.company.findUnique({
      where: { slug },
      include: { aggregate: true },
    });
    if (!company) {
      throw new NotFoundException("Company not found");
    }

    return {
      company: this.toPublicCompany(company),
      aggregate: company.aggregate
        ? {
            companyId: company.aggregate.companyId,
            overallAvg: company.aggregate.overallAvg,
            corporateCultureAvg: company.aggregate.corporateCultureAvg,
            leadershipAvg: company.aggregate.leadershipAvg,
            infrastructureAvg: company.aggregate.infrastructureAvg,
            workLifeBalanceAvg: company.aggregate.workLifeBalanceAvg,
            stabilityAvg: company.aggregate.stabilityAvg,
            reviewCount: company.aggregate.reviewCount,
          }
        : null,
    };
  }
```

with:

```ts
  async getBySlug(slug: string): Promise<CompanyDetail> {
    const company = await this.prisma.company.findUnique({
      where: { slug },
      include: { aggregate: true },
    });
    if (!company) {
      throw new NotFoundException("Company not found");
    }

    const workplaceTypesLocked = await this.reviews.areAllWorkplaceTypesReviewed(
      company.id,
      company.workplaceTypes,
    );

    return {
      company: { ...this.toPublicCompany(company), workplaceTypesLocked },
      aggregate: company.aggregate
        ? {
            companyId: company.aggregate.companyId,
            overallAvg: company.aggregate.overallAvg,
            corporateCultureAvg: company.aggregate.corporateCultureAvg,
            leadershipAvg: company.aggregate.leadershipAvg,
            infrastructureAvg: company.aggregate.infrastructureAvg,
            workLifeBalanceAvg: company.aggregate.workLifeBalanceAvg,
            stabilityAvg: company.aggregate.stabilityAvg,
            reviewCount: company.aggregate.reviewCount,
          }
        : null,
    };
  }
```

`CompaniesModule` already has `imports: [AuthModule, ReviewsModule,
FlagsModule, CompanyNarrativeModule]` — `ReviewsModule` is already there, so
no module-wiring change is needed for this injection to resolve.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd apps/api && pnpm exec jest companies.service.test.ts`
Expected: PASS, all tests (the 3 pre-existing ones plus the 2 new ones).

- [ ] **Step 7: Typecheck the whole API**

Run: `cd apps/api && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/shared-types/src/schemas/company.ts packages/shared-types/dist apps/api/src/modules/companies/companies.service.ts apps/api/src/modules/companies/__tests__/companies.service.test.ts
git commit -m "feat(api): expose Company.workplaceTypesLocked on the detail endpoint"
```

---

### Task 5: Banner-specific file validator in `shared-types`

**Files:**
- Create: `packages/shared-types/src/schemas/companyBanner.ts`
- Modify: `packages/shared-types/src/index.ts` (export the new file)
- Test: `packages/shared-types/src/schemas/__tests__/companyBanner.test.ts`
  (new file — check `packages/shared-types/src/schemas/__tests__/` for the
  existing convention before writing; if a `companyLogo.test.ts` exists
  there, mirror its structure exactly)

**Interfaces:**
- Produces: `validateBannerSourceFile(meta: BannerSourceFileMeta): { valid:
  true } | { valid: false; error: string }`, `BANNER_SOURCE_MAX_FILE_SIZE_BYTES`,
  `BANNER_SOURCE_MIN_DIMENSION_PX`, `bannerUploadResultSchema` /
  `BannerUploadResult` type (`{ url: string }`). Task 6's `OwnerService.uploadBanner`
  consumes `validateBannerSourceFile` and `BannerUploadResult`.

- [ ] **Step 1: Check for an existing schema-test convention**

Run: `ls packages/shared-types/src/schemas/__tests__/ 2>/dev/null || echo none`
If a `companyLogo.test.ts` (or similar pure-function schema test) exists,
read it and match its import/assertion style exactly in Step 2 below instead
of the style shown — the shown style is a safe default if no such directory
exists yet.

- [ ] **Step 2: Write the failing tests**

Create `packages/shared-types/src/schemas/__tests__/companyBanner.test.ts`:

```ts
import { validateBannerSourceFile, BANNER_SOURCE_MAX_FILE_SIZE_BYTES, BANNER_SOURCE_MIN_DIMENSION_PX } from "../companyBanner";

describe("validateBannerSourceFile", () => {
  const validMeta = { mimeType: "image/jpeg", sizeBytes: 500_000, width: 1600, height: 900 };

  it("accepts a reasonably-sized JPEG regardless of aspect ratio", () => {
    expect(validateBannerSourceFile(validMeta)).toEqual({ valid: true });
  });

  it("accepts PNG and WebP too", () => {
    expect(validateBannerSourceFile({ ...validMeta, mimeType: "image/png" })).toEqual({ valid: true });
    expect(validateBannerSourceFile({ ...validMeta, mimeType: "image/webp" })).toEqual({ valid: true });
  });

  it("rejects an unsupported format", () => {
    const result = validateBannerSourceFile({ ...validMeta, mimeType: "image/gif" });
    expect(result.valid).toBe(false);
  });

  it("rejects a file over the max size", () => {
    const result = validateBannerSourceFile({ ...validMeta, sizeBytes: BANNER_SOURCE_MAX_FILE_SIZE_BYTES + 1 });
    expect(result.valid).toBe(false);
  });

  it("rejects an image whose shorter side is below the minimum", () => {
    const result = validateBannerSourceFile({
      ...validMeta,
      width: BANNER_SOURCE_MIN_DIMENSION_PX - 1,
      height: 900,
    });
    expect(result.valid).toBe(false);
  });

  it("accepts a square image — no aspect-ratio requirement", () => {
    expect(validateBannerSourceFile({ ...validMeta, width: 800, height: 800 })).toEqual({ valid: true });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd packages/shared-types && pnpm exec jest companyBanner.test.ts`
(If `packages/shared-types` has no jest config of its own yet, run
`pnpm exec tsc --noEmit` instead to confirm it fails to compile — the
`companyBanner` module doesn't exist yet either way.)
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the validator**

Create `packages/shared-types/src/schemas/companyBanner.ts`:

```ts
import { z } from "zod";
import { httpUrlSchema } from "./company";

// Server-side resizing/compression (OwnerService.uploadBanner, via sharp)
// means the owner never needs to pre-crop or hit an exact resolution — this
// only rejects genuinely unusable source files (wrong format, too small to
// look decent after a center-crop resize, or an unreasonably large upload).
// Deliberately no aspect-ratio or exact-dimension check, unlike the logo
// validator (companyLogo.ts) — the server crops whatever shape comes in
// down to the card's fixed 4:1 banner box.
export const BANNER_SOURCE_MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
export const BANNER_SOURCE_MIN_DIMENSION_PX = 400;

export interface BannerSourceFileMeta {
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

// Pure, environment-agnostic — same reasoning as validateLogoFile
// (companyLogo.ts): the authoritative call is server-side, reading
// dimensions from the uploaded buffer via `image-size`, never trusting the
// client alone.
export function validateBannerSourceFile(
  meta: BannerSourceFileMeta,
): { valid: true } | { valid: false; error: string } {
  if (meta.mimeType !== "image/png" && meta.mimeType !== "image/jpeg" && meta.mimeType !== "image/webp") {
    return { valid: false, error: "Banner must be a PNG, JPEG, or WebP file." };
  }
  if (meta.sizeBytes > BANNER_SOURCE_MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Banner file is too large — keep it under ${BANNER_SOURCE_MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
    };
  }
  const shorterSide = Math.min(meta.width, meta.height);
  if (shorterSide < BANNER_SOURCE_MIN_DIMENSION_PX) {
    return {
      valid: false,
      error: `Image is too small for a banner — its shorter side must be at least ${BANNER_SOURCE_MIN_DIMENSION_PX}px (got ${meta.width}x${meta.height}px).`,
    };
  }
  return { valid: true };
}

export const bannerUploadResultSchema = z.object({ url: httpUrlSchema });
export type BannerUploadResult = z.infer<typeof bannerUploadResultSchema>;
```

- [ ] **Step 5: Export it from the package root**

In `packages/shared-types/src/index.ts`, replace:

```ts
export * from "./schemas/companyLogo";
```

with:

```ts
export * from "./schemas/companyLogo";
export * from "./schemas/companyBanner";
```

- [ ] **Step 6: Rebuild and run the tests to verify they pass**

Run: `cd packages/shared-types && pnpm exec tsc && pnpm exec jest companyBanner.test.ts`
Expected: builds clean, all 6 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/shared-types/src/schemas/companyBanner.ts packages/shared-types/src/schemas/__tests__/companyBanner.test.ts packages/shared-types/src/index.ts packages/shared-types/dist
git commit -m "feat(shared-types): add validateBannerSourceFile (no aspect-ratio requirement)"
```

---

### Task 6: Server-side resize/compression for banner uploads

**Files:**
- Modify: `apps/api/package.json` (add `sharp` dependency)
- Modify: `apps/api/src/modules/owner/owner.service.ts` (rewrite
  `uploadBanner`)

**Interfaces:**
- Consumes: `validateBannerSourceFile`, `BannerUploadResult` (Task 5).
- Produces: `OwnerService.uploadBanner` now returns a compressed,
  center-cropped 1200×300 WebP regardless of the source image's shape, and
  stores it under `uploads/company-banners/` instead of
  `uploads/company-logos/`. Same public signature: `(userId, companyId,
  file): Promise<BannerUploadResult>` (structurally identical to the old
  `LogoUploadResult` — both are `{ url: string }` — so `owner.controller.ts`
  needs no change).

- [ ] **Step 1: Add the `sharp` dependency**

Run: `cd apps/api && pnpm add sharp`
Expected: `apps/api/package.json`'s `dependencies` gains a `"sharp": "^..."`
line and `pnpm-lock.yaml` updates. If the API dev server is running, stop it
first (Windows can hold the native module's files locked otherwise — same
class of issue as the Prisma-client EPERM gotcha in CLAUDE.md).

- [ ] **Step 2: Rewrite `uploadBanner`**

In `apps/api/src/modules/owner/owner.service.ts`, replace the import line:

```ts
import { validateLogoFile, type LogoUploadResult } from "@iwtr/shared-types";
```

with:

```ts
import sharp from "sharp";
import { validateLogoFile, validateBannerSourceFile, type LogoUploadResult, type BannerUploadResult } from "@iwtr/shared-types";
```

Add a second uploads directory constant next to the existing one:

```ts
const UPLOADS_DIR = join(process.cwd(), "uploads", "company-logos");
const BANNER_UPLOADS_DIR = join(process.cwd(), "uploads", "company-banners");
const BANNER_OUTPUT_WIDTH_PX = 1200;
const BANNER_OUTPUT_HEIGHT_PX = 300; // fixed 4:1 — matches CompanyWorkCard's aspect-[4/1] banner box
```

Then replace the entire `uploadBanner` method:

```ts
  // Same validation/storage path as the logo — a wide banner image is just a
  // second upload target, gated to Blue+ (Pro) and Enterprise only (unlike
  // the logo, which is free-tier, and unlike the rest of the Premium
  // Features box, which Blue/Starter can already use) since a banner is
  // specifically a Pro/Enterprise privilege in the pricing matrix.
  async uploadBanner(userId: string, companyId: string, file: Express.Multer.File | undefined): Promise<LogoUploadResult> {
    const ownership = await this.requireApprovedOwnership(userId, companyId);
    const hasBannerTier = ownership.tier === "BLUE_PLUS" || ownership.tier === "ENTERPRISE";
    if (!hasBannerTier || ownership.planStatus !== "ACTIVE") {
      throw new ForbiddenException("Upgrade to Blue+ or Enterprise to upload a banner image.");
    }
    if (!file) {
      throw new BadRequestException("No file uploaded.");
    }

    const { width, height } = imageSize(file.buffer);
    const check = validateLogoFile({
      mimeType: file.mimetype,
      sizeBytes: file.buffer.length,
      width: width ?? 0,
      height: height ?? 0,
    });
    if (!check.valid) {
      throw new BadRequestException(check.error);
    }

    await mkdir(UPLOADS_DIR, { recursive: true });
    const filename = `${randomUUID()}.png`;
    await writeFile(join(UPLOADS_DIR, filename), file.buffer);

    const origin = process.env.API_PUBLIC_ORIGIN ?? `http://localhost:${process.env.PORT ?? 3001}`;
    return { url: `${origin}/uploads/company-logos/${filename}` };
  }
```

with:

```ts
  // Its own uploads/company-banners directory (not the logo one) — a banner
  // is always re-encoded to a fixed 1200x300 WebP server-side regardless of
  // the source image's shape (see the sharp.resize call below), so it never
  // needs to share the logo's exact-square rule. Dimensions are read from
  // the uploaded buffer via `image-size` (never trusted from the client) and
  // checked against validateBannerSourceFile — deliberately looser than the
  // logo's rule, since the resize step crops+scales whatever shape comes in.
  // This is what lets an owner upload literally any reasonably-sized photo
  // without pre-cropping it themselves.
  async uploadBanner(userId: string, companyId: string, file: Express.Multer.File | undefined): Promise<BannerUploadResult> {
    const ownership = await this.requireApprovedOwnership(userId, companyId);
    const hasBannerTier = ownership.tier === "BLUE_PLUS" || ownership.tier === "ENTERPRISE";
    if (!hasBannerTier || ownership.planStatus !== "ACTIVE") {
      throw new ForbiddenException("Upgrade to Blue+ or Enterprise to upload a banner image.");
    }
    if (!file) {
      throw new BadRequestException("No file uploaded.");
    }

    const { width, height } = imageSize(file.buffer);
    const check = validateBannerSourceFile({
      mimeType: file.mimetype,
      sizeBytes: file.buffer.length,
      width: width ?? 0,
      height: height ?? 0,
    });
    if (!check.valid) {
      throw new BadRequestException(check.error);
    }

    // "position: attention" picks the crop window using sharp's
    // saliency/entropy heuristic (busiest region of the image) rather than a
    // plain center crop — a better default for an arbitrary owner-submitted
    // photo than always keeping the geometric middle.
    const resized = await sharp(file.buffer)
      .resize(BANNER_OUTPUT_WIDTH_PX, BANNER_OUTPUT_HEIGHT_PX, { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer();

    await mkdir(BANNER_UPLOADS_DIR, { recursive: true });
    const filename = `${randomUUID()}.webp`;
    await writeFile(join(BANNER_UPLOADS_DIR, filename), resized);

    const origin = process.env.API_PUBLIC_ORIGIN ?? `http://localhost:${process.env.PORT ?? 3001}`;
    return { url: `${origin}/uploads/company-banners/${filename}` };
  }
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/api && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification (no existing test precedent for this I/O path)**

`uploadLogo`/`uploadBanner` have no unit test today (they're local-disk
multipart-upload glue, not pure logic — matches this codebase's existing
split between unit-tested pure functions and manually-verified I/O
endpoints). Verify by hand instead:

1. Start the API dev server: `cd apps/api && pnpm dev`
2. `curl -X POST http://localhost:3001/v1/my-companies/<a-blue-plus-or-enterprise-companyId>/banner -H "Authorization: Bearer <token>" -F "file=@/path/to/any/photo.jpg"` (any aspect ratio/size within 400px–8MB)
3. Confirm the JSON response's `url` points at
   `/uploads/company-banners/<uuid>.webp`, and that fetching that URL in a
   browser shows a 1200×300 image cropped from the source photo.
4. Confirm a source image under 400px on its shorter side is rejected with
   a 400 and the expected message.

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json apps/api/pnpm-lock.yaml apps/api/src/modules/owner/owner.service.ts
git commit -m "feat(api): server-side resize/compress banner uploads with sharp"
```

---

### Task 7: Seed example banners onto real companies

**Files:**
- Create: `apps/api/scripts/seed-example-banners.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks directly (uses `sharp` from Task 6
  and `PrismaClient` directly, same as every other script in
  `apps/api/scripts/`).
- Produces: nothing other code depends on — this is a standalone,
  re-runnable script. The frontend plan's banner-layout task manually
  verifies against whatever companies this script targets.

- [ ] **Step 1: Write the script**

Create `apps/api/scripts/seed-example-banners.ts`:

```ts
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

const prisma = new PrismaClient();

// One already-seeded real company per CLAUDE.md's "oil, clothing, market"
// example categories (seed-nationwide-brands.ts) — not the fictional
// reset-to-demo-companies.ts placeholders, which use a different category
// vocabulary entirely and don't populate these categories. Existing fields
// on these rows (name, category, city, etc.) are never touched — this
// script only ever sets bannerImageUrl and badgeTier on them.
const TARGETS: { name: string; gradient: [string, string] }[] = [
  { name: "Shell", gradient: ["#e8302a", "#8a1a17"] },
  { name: "LC Waikiki", gradient: ["#1f3a93", "#0d1b3e"] },
  { name: "Migros", gradient: ["#f5a623", "#8a5a0f"] },
];

const BANNER_UPLOADS_DIR = join(process.cwd(), "uploads", "company-banners");
const BANNER_OUTPUT_WIDTH_PX = 1200;
const BANNER_OUTPUT_HEIGHT_PX = 300;

// A plain two-stop diagonal gradient PNG, generated in-memory — deliberately
// not scraped brand photography (avoids any trademark/IP question), just
// enough of a real image to exercise the Facebook-style banner+avatar layout
// against real, already-seeded company rows.
async function generatePlaceholderBanner(gradient: [string, string]): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${BANNER_OUTPUT_WIDTH_PX}" height="${BANNER_OUTPUT_HEIGHT_PX}">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${gradient[0]}" />
        <stop offset="100%" stop-color="${gradient[1]}" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)" />
  </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 82 }).toBuffer();
}

async function main() {
  const origin = process.env.API_PUBLIC_ORIGIN ?? "http://localhost:3001";
  await mkdir(BANNER_UPLOADS_DIR, { recursive: true });

  for (const target of TARGETS) {
    const company = await prisma.company.findFirst({
      where: { name: { equals: target.name, mode: "insensitive" } },
    });
    if (!company) {
      console.log(`Skipping "${target.name}" — not found (run seed-nationwide-brands.ts first).`);
      continue;
    }

    const buffer = await generatePlaceholderBanner(target.gradient);
    const filename = `${randomUUID()}.webp`;
    await writeFile(join(BANNER_UPLOADS_DIR, filename), buffer);
    const bannerImageUrl = `${origin}/uploads/company-banners/${filename}`;

    // BLUE_PLUS, not ENTERPRISE — canUseBanner() (apps/web/src/lib/pricingTiers.ts)
    // grants banner display to both, so BLUE_PLUS is enough to prove the
    // gate isn't accidentally Enterprise-only, while leaving at least one of
    // these three free to separately promote to ENTERPRISE by hand if a
    // reviewer wants an Enterprise-badge example too.
    await prisma.company.update({
      where: { id: company.id },
      data: { bannerImageUrl, badgeTier: "BLUE_PLUS" },
    });
    console.log(`Set example banner + BLUE_PLUS badge on "${company.name}" (${bannerImageUrl})`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run it**

Run: `cd apps/api && pnpm exec ts-node scripts/seed-example-banners.ts`
Expected: 3 lines of `Set example banner + BLUE_PLUS badge on "..."` output
(or a `Skipping "..."` line for any brand not yet present in the local DB —
run `pnpm exec ts-node scripts/seed-nationwide-brands.ts` first if so).

- [ ] **Step 3: Verify idempotency**

Run the same command a second time.
Expected: succeeds again, generating a *new* banner file and updating the
same 3 companies in place (re-runnable, matches every other script in this
directory — does not error or duplicate companies).

- [ ] **Step 4: Spot-check one company via the API**

Run: `curl http://localhost:3001/v1/companies/shell` (adjust slug if
different) and confirm the JSON response's `company.bannerImageUrl` is set
and `company.badgeTier` is `"BLUE_PLUS"`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/scripts/seed-example-banners.ts
git commit -m "feat(api): add seed script for example company banners"
```

---

## After all 7 tasks: full verification pass

- [ ] `cd apps/api && pnpm exec tsc --noEmit` — no errors
- [ ] `cd apps/api && pnpm exec jest` — full suite passes (not just the files
  touched above)
- [ ] `cd packages/shared-types && pnpm exec tsc` — builds clean, `dist/` is
  up to date
- [ ] `grep -ril gold apps/api/src apps/api/prisma` — empty
- [ ] Manually re-run Task 6 Step 4's curl check and Task 7's spot-check
  once more against a freshly-started `apps/api` dev server, to confirm
  nothing regressed from later tasks touching the same files

This is the point at which the plan is ready to hand back to the user for
approval before the frontend plan
(`docs/superpowers/plans/2026-09-07-owner-dashboard-frontend.md`) begins.

# Admin Content Moderation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give ADMINs a panel to (a) hide a whole company (reversible), (b) wipe one company's IWT Social feed, and (c) remove any single IWT Social post.

**Architecture:** New `Company.hiddenAt` timestamp column; a shared `notHidden` where-fragment applied to every public `Company` read (search, detail, filters, job browse, social feed). New admin-only routes: `PATCH /admin/companies/:id/visibility`, `DELETE /admin/social/companies/:id/posts`, `DELETE /admin/social/posts/:id` — the last two also unlink the WebP files from disk. New `apps/web/src/app/admin/content/` page plus a "hidden" affordance on the existing admin companies list. Built on branch `worktree-iwt-social`, stacked on the IWT Social backend + revision (HEAD `56c07e4`).

**Tech Stack:** NestJS 10, Prisma 5 (multiSchema), `RolesGuard` + `@Roles("ADMIN")`, `@iwtr/shared-types` zod, Next.js App Router admin pages.

**Spec:** none — this plan is the design (user decisions 2026-09-08: "remove a company" = hide/reversible; single-post and feed removal = real delete).

## Global Constraints

- ADMIN-only: every new route is `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("ADMIN")`, matching `admin-companies.controller.ts` / `admin-queue.controller.ts`.
- Anonymity unchanged: none of this exposes review authorship or social comment authorship. Post/feed deletes operate on `SocialPost` by `id`/`companyId` only.
- A hidden company must disappear from EVERY unauthenticated/public surface. Its owner still sees it in `/my/companies` with a "hidden by admin" flag (so they know to contact support). An ADMIN sees all companies.
- `prisma db push`, not `migrate dev`. Rebuild `packages/shared-types` `dist/` after any schema edit there.
- `apps/api/uploads/` is gitignored; deleting a post must `unlink` its `uploads/social/<uuid>.webp` (best-effort — a missing file is not an error).
- Do not touch the moderation pipeline, the review-submission flow, or the IWT Social write/read endpoints beyond adding the `notHidden` filter.

---

### Task 1: `Company.hiddenAt` column + shared visibility filter

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (add `hiddenAt DateTime?` + `@@index([hiddenAt])` to `model Company`)
- Create: `apps/api/src/modules/companies/company-visibility.ts` (the shared where-fragment + a guard helper)
- Modify: `apps/api/src/modules/companies/companies.service.ts` (apply to `search`, `listCities`, `getBySlug`)
- Test: `apps/api/src/modules/companies/__tests__/company-visibility.test.ts` (Create)

**Interfaces:**
- Produces: `PUBLIC_COMPANY_WHERE = { hiddenAt: null } as const` (spread into a `Prisma.CompanyWhereInput`); `assertCompanyVisibleOrThrow(company: { hiddenAt: Date | null } | null): asserts company is { hiddenAt: null }` — throws `NotFoundException` when null or hidden.

- [ ] **Step 1: Write the failing test**

```typescript
import { NotFoundException } from "@nestjs/common";
import { PUBLIC_COMPANY_WHERE, assertCompanyVisibleOrThrow } from "../company-visibility";

describe("company visibility", () => {
  it("PUBLIC_COMPANY_WHERE filters to non-hidden", () => {
    expect(PUBLIC_COMPANY_WHERE).toEqual({ hiddenAt: null });
  });
  it("assertCompanyVisibleOrThrow throws on a missing company", () => {
    expect(() => assertCompanyVisibleOrThrow(null)).toThrow(NotFoundException);
  });
  it("assertCompanyVisibleOrThrow throws on a hidden company", () => {
    expect(() => assertCompanyVisibleOrThrow({ hiddenAt: new Date() })).toThrow(NotFoundException);
  });
  it("assertCompanyVisibleOrThrow passes a visible company", () => {
    expect(() => assertCompanyVisibleOrThrow({ hiddenAt: null })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it — fails (module missing)**

Run: `cd apps/api && pnpm exec jest src/modules/companies/__tests__/company-visibility`

- [ ] **Step 3: Add the column**

In `model Company` add near the other nullable flags:
```prisma
  // Set by an ADMIN via PATCH /admin/companies/:id/visibility. A hidden company
  // vanishes from every public surface (search, detail, filters, job browse,
  // IWT Social feed) but keeps all its data; unhiding clears this.
  hiddenAt      DateTime?
```
and with the other indexes: `@@index([hiddenAt])`.

Then: `cd apps/api && pnpm exec prisma generate && pnpm exec prisma db push` (safe additive nullable column — no data-loss prompt).

- [ ] **Step 4: Write `company-visibility.ts`**

```typescript
import { NotFoundException } from "@nestjs/common";

// Spread into any public Prisma `where` on Company. A hidden company is
// invisible to everyone except an ADMIN and (flagged) its own owner.
export const PUBLIC_COMPANY_WHERE = { hiddenAt: null } as const;

export function assertCompanyVisibleOrThrow(
  company: { hiddenAt: Date | null } | null,
): asserts company is { hiddenAt: null } {
  if (!company || company.hiddenAt !== null) {
    throw new NotFoundException("Company not found");
  }
}
```

- [ ] **Step 5: Apply it in `companies.service.ts`**

- `search` (`~line 164`): `where: { ...PUBLIC_COMPANY_WHERE, /* existing clauses */ }`
- `listCities` / the cities `findMany` (`~line 297`): add `...PUBLIC_COMPANY_WHERE` to its `where`
- `getBySlug` (`~line 308`): ensure the selected fields include `hiddenAt`, then `assertCompanyVisibleOrThrow(company)` before building the detail (the helper subsumes the existing null-check).

- [ ] **Step 6: Run the test + the companies suite + tsc**

Run: `cd apps/api && pnpm exec jest src/modules/companies && pnpm exec tsc --noEmit`
Expected: green; pre-existing `workplace-classifier` failures are unrelated baseline.

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/src/modules/companies
git commit -m "feat(api): Company.hiddenAt + shared public-visibility filter"
```

---

### Task 2: Propagate the filter to job postings + the IWT Social feed

**Files:**
- Modify: `apps/api/src/modules/job-postings/job-postings.service.ts` (public browse/list query)
- Modify: `apps/api/src/modules/social/social.service.ts` (`feed` where; `companyFeed` slug lookup)
- Modify: `apps/api/src/modules/social/__tests__/social.service.test.ts`

**Interfaces:**
- Consumes: `PUBLIC_COMPANY_WHERE`, `assertCompanyVisibleOrThrow` from `../companies/company-visibility` (Task 1).

- [ ] **Step 1: Add social feed tests** (append to `social.service.test.ts`'s feed describe)

```typescript
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
```

- [ ] **Step 2: Run — fails**

- [ ] **Step 3: Implement in `social.service.ts`**

- `feed`: always gate the company:
  ```typescript
  const companyWhere = {
    ...PUBLIC_COMPANY_WHERE,
    ...(opts.q?.trim() ? { name: { contains: opts.q.trim(), mode: "insensitive" as const } } : {}),
  };
  const where: Prisma.SocialPostWhereInput = { company: companyWhere };
  ```
- `companyFeed`: `findUnique({ where: { slug }, select: { id: true, hiddenAt: true } })` then `assertCompanyVisibleOrThrow(company)` (replaces the bare `if (!company) throw`).

- [ ] **Step 4: Implement in `job-postings.service.ts`**

Locate the public browse query (what `JobsBrowser` hits). Add the company visibility gate — `where: { company: { ...PUBLIC_COMPANY_WHERE, ... } }` if posting-first, or `...PUBLIC_COMPANY_WHERE` on the company where if company-first — so a hidden company's job cards drop out. Do NOT touch an owner's own "my job postings" query.

- [ ] **Step 5: Run social + job-postings suites + tsc**

Run: `cd apps/api && pnpm exec jest src/modules/social src/modules/job-postings && pnpm exec tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/social apps/api/src/modules/job-postings
git commit -m "feat(api): drop a hidden company's job cards + social posts from public views"
```

---

### Task 3: Admin routes — visibility toggle + social post/feed removal

**Files:**
- Modify: `apps/api/src/modules/admin-companies/admin-companies.controller.ts` + `admin-companies.service.ts`
- Create: `apps/api/src/modules/social/admin-social.controller.ts` + methods on `social.service.ts`
- Modify: `apps/api/src/modules/social/social.module.ts` (register the admin controller)
- Modify: `packages/shared-types/src/schemas/company.ts` (`setCompanyVisibilityInputSchema`)
- Test: extend `admin-companies` + `social` test files

**Interfaces:**
- Produces:
  - `PATCH /admin/companies/:id/visibility` body `{ hidden: boolean }` → sets/clears `hiddenAt`, `AuditLog` (`"COMPANY_HIDDEN"` / `"COMPANY_UNHIDDEN"`).
  - `DELETE /admin/social/posts/:id` → deletes the post (cascades comments/likes), unlinks the file, `AuditLog` `"SOCIAL_POST_REMOVED"`. 404 if missing.
  - `DELETE /admin/social/companies/:id/posts` → deletes every `SocialPost` for that company, unlinks each file, returns `{ deletedCount }`, `AuditLog` `"SOCIAL_FEED_WIPED"`.

- [ ] **Step 1: shared-types**

```typescript
// company.ts
export const setCompanyVisibilityInputSchema = z.object({ hidden: z.boolean() });
export type SetCompanyVisibilityInput = z.infer<typeof setCompanyVisibilityInputSchema>;
```
Rebuild: `cd packages/shared-types && pnpm exec tsc`.

- [ ] **Step 2: Write failing service tests**

`admin-companies.service.ts`: `setVisibility(companyId, hidden)` sets `hiddenAt` to a Date when `hidden` true, `null` when false; 404 on unknown id.
Social admin: `adminRemovePost(postId)` calls `socialPost.delete` + `unlink`; `adminWipeCompanyFeed(companyId)` calls `deleteMany` and unlinks each file; both 404 / no-op cleanly. Mock `fs/promises` `unlink` at the top of the test file.

- [ ] **Step 3: Implement the visibility toggle**

`admin-companies.service.ts`:
```typescript
async setVisibility(companyId: string, hidden: boolean): Promise<void> {
  const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) throw new NotFoundException("Company not found");
  await this.prisma.$transaction([
    this.prisma.company.update({ where: { id: companyId }, data: { hiddenAt: hidden ? new Date() : null } }),
    this.prisma.auditLog.create({
      data: { actorUserId: null, action: hidden ? "COMPANY_HIDDEN" : "COMPANY_UNHIDDEN", targetType: "Company", targetId: companyId },
    }),
  ]);
}
```
Controller (next to the other `@Roles("ADMIN")` routes):
```typescript
@Patch(":id/visibility")
@UseGuards(RolesGuard)
@Roles("ADMIN")
setVisibility(
  @Param("id", new ParseUUIDPipe()) id: string,
  @Body(new ZodValidationPipe(setCompanyVisibilityInputSchema)) body: SetCompanyVisibilityInput,
) {
  return this.adminCompanies.setVisibility(id, body.hidden);
}
```

- [ ] **Step 4: Implement admin social removal**

`admin-social.controller.ts` (`@Controller("admin/social")`, class-level `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("ADMIN")`):
```typescript
@Delete("posts/:id")
removePost(@Param("id", new ParseUUIDPipe()) id: string) { return this.social.adminRemovePost(id); }

@Delete("companies/:id/posts")
wipeFeed(@Param("id", new ParseUUIDPipe()) id: string) { return this.social.adminWipeCompanyFeed(id); }
```
`social.service.ts` (add `import { unlink } from "fs/promises";`):
```typescript
async adminRemovePost(postId: string): Promise<{ success: true }> {
  const post = await this.prisma.socialPost.findUnique({ where: { id: postId }, select: { id: true, imageUrl: true } });
  if (!post) throw new NotFoundException("Post not found");
  await this.prisma.socialPost.delete({ where: { id: postId } });   // cascades comments + likes
  await this.unlinkSocialImage(post.imageUrl);
  return { success: true };
}

async adminWipeCompanyFeed(companyId: string): Promise<{ deletedCount: number }> {
  const posts = await this.prisma.socialPost.findMany({ where: { companyId }, select: { id: true, imageUrl: true } });
  await this.prisma.socialPost.deleteMany({ where: { companyId } });
  await Promise.all(posts.map((p) => this.unlinkSocialImage(p.imageUrl)));
  return { deletedCount: posts.length };
}

private async unlinkSocialImage(imageUrl: string): Promise<void> {
  const name = imageUrl.split("/uploads/social/")[1];
  if (!name) return;
  try { await unlink(join(SOCIAL_UPLOADS_DIR, name)); } catch { /* already gone */ }
}
```
Add `AuditLog` writes for both admin-social ops. Register `AdminSocialController` in `social.module.ts` `controllers`.

- [ ] **Step 5: Run — `cd apps/api && pnpm exec jest src/modules/social src/modules/admin-companies && pnpm exec tsc --noEmit`**

- [ ] **Step 6: Manual smoke** (worktree API on `PORT=3011`, ADMIN token via `POST /v1/auth/dev-admin-login` with the admin email `onboard.test@example.com`)

```bash
curl -sS -X PATCH localhost:3011/v1/admin/companies/<id>/visibility -H "Authorization: Bearer <admin>" -H "Content-Type: application/json" -d '{"hidden":true}'
curl -sS "localhost:3011/v1/companies/<slug>" -o /dev/null -w "%{http_code}\n"   # expect 404
curl -sS -X DELETE localhost:3011/v1/admin/social/posts/<postId> -H "Authorization: Bearer <admin>"
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/admin-companies apps/api/src/modules/social packages/shared-types
git commit -m "feat(api): admin routes — company visibility toggle + social post/feed removal"
```

---

### Task 4: Admin web UI + owner notice

**Files:**
- Create: `apps/web/src/app/admin/content/page.tsx` (+ client components as needed)
- Modify: the admin nav (add a "Content" link for admins — see `GlobalHeader.tsx`)
- Modify: `apps/web/src/app/my/companies/page.tsx` (owner "hidden by admin" banner)
- Modify: `apps/api/src/modules/owner/owner.service.ts` + `packages/shared-types` (expose `hiddenAt` / a `hidden` boolean on the owner's company shape)

- [ ] **Step 1: Owner shape** — add `hidden: boolean` to `MyCompanyClaim` / `OwnedCompany` in `shared-types` and set it from `company.hiddenAt !== null` in `owner.service.ts`'s `toMyClaim` / `myOwnedCompanies`. Rebuild `dist`.

- [ ] **Step 2: Admin content page** — an admin-gated page (redirect non-admins, same pattern as `/admin/owner-claims`). A searchable company list from `GET /admin/companies`; each row: a Hide/Unhide toggle (`PATCH /admin/companies/:id/visibility`), a "Wipe IWT Social feed" button behind a confirm dialog (`DELETE /admin/social/companies/:id/posts`), and an expander showing that company's social posts each with a "Remove" button (`DELETE /admin/social/posts/:id`, needs a `GET /social/companies/:slug/posts` call — already public). Style to match the existing `/admin/*` pages.

- [ ] **Step 3: Nav** — add "Content" to the admin-only links block in `GlobalHeader.tsx` alongside "Moderation Queue" / "Owner Claims".

- [ ] **Step 4: Owner notice** — in `/my/companies`, when `claim.hidden`, show an amber "This company is currently hidden by an administrator. Contact support at iworkedthere@hotmail.com." banner and disable the edit form for that company.

- [ ] **Step 5: Verify** — `cd apps/web && pnpm exec tsc --noEmit && pnpm exec next lint` (expect the repo's pre-existing lint baseline only). Manual: as admin, hide a demo company → gone from the homepage browser, `/companies/<slug>` 404s, its posts gone from `/social` feed → unhide → restored.

- [ ] **Step 6: Commit**

```bash
git add apps/web apps/api/src/modules/owner packages/shared-types
git commit -m "feat(web): admin content-moderation page + owner hidden-company notice"
```

---

## Self-Review

- **Coverage:** hide-company (T1 column + T1/T2 filter across search/detail/filters/jobs/social) + T3 toggle route; wipe-feed (T3); remove-post (T3); admin UI + owner notice (T4). All three user asks covered.
- **Placeholder scan:** the job-postings query location (T2 Step 4) is described by behavior, not line — the implementer locates the public browse query; flagged, not hidden. No TBDs elsewhere.
- **Type consistency:** `PUBLIC_COMPANY_WHERE` / `assertCompanyVisibleOrThrow` defined T1, consumed T2. `setCompanyVisibilityInputSchema` defined T3.1, used T3.3. `hidden` on the owner shape is T4.1, used T4.4.
- **Risk:** the filter must not miss a public Company read. Known ones: `CompaniesService.search`, `.getBySlug`, cities list; `JobPostingsService` browse; `SocialService.feed` / `.companyFeed`. Reviews / vibe-flags / survey-stats / narrative are slug-scoped and become unreachable once `getBySlug` 404s — the whole-branch review must still confirm none does its own independent company lookup that bypasses `getBySlug`.

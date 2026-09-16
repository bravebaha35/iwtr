# Risk Score Defaults, Single Work-Type Job Cards & Contact Requirement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `Company.riskScore` (already built, see `apps/api/src/modules/job-postings/`) visible by default everywhere a company is shown, show exactly one work-type per job card instead of the company's full list, require at least one contact method (phone or email) instead of both, and add a Risk Score range slider to the `/jobs` page filters.

**Architecture:** Four small backend schema/service additions (a `workType` field on public job postings, a classified work-type per auto-generated job title, a `maxRiskScore` search filter, and relaxed contact-info validation), then five frontend changes that consume them — a rewritten `RiskScoreBadge` (dash state + per-value explanations + a shared color scale), `JobCard`'s footer (single work-type, right-aligned badge), the company profile hero, the `/jobs` sidebar's new Risk Score slider, and the contact-info form. `CompanyJobPostings.tsx` (the profile page's "Job Postings" tab) needs no changes — it already re-fetches and re-renders through the same `postingsForCard`/`JobCard` pipeline `/jobs` uses, so Tasks 1-2's schema changes and Task 6's `JobCard` changes reach it automatically.

**Tech Stack:** NestJS + Prisma (`apps/api`), Next.js App Router + Tailwind v4 (`apps/web`), zod schemas in `packages/shared-types` (must be rebuilt with `pnpm exec tsc` after every schema-touching task — ships compiled JS, not raw TS).

**Spec:** This plan *is* the spec — it was written directly from a detailed, fully-specified user request (paraphrased below); there is no separate spec file.

1. **Risk Score default visibility:** show `Risk Score` on every company by default (not just when > 0, as today). Where a card/page has no real, appliable job posting to show it against, display `Risk Score: -` instead of a number (since there's nothing to have a repost history against yet).
2. **Job cards on `/jobs` already show Risk Score** (existing feature) — it must follow the same default/dash rule, right-aligned in the card footer next to the work-type text.
3. **Contact info:** a company must provide at least a phone number *or* an email (not both, as the form currently requires) to save its Contact & Social info, with a professional note encouraging providing both anyway.
4. **One work-type per job card, not the company's whole list:** e.g. a company tagged both Office and Manual-Labour, with a "Forklift Operator" posting, should show "Manual-Labour" under that card — not "Office/Manual-Labour". Each individual posting already carries (or, for a single-work-type company, auto-fills) its own `workType`; job cards should show that one value. The same rule applies to the auto-classified job-title fallback cards (postings inferred from employment history, not an owner-authored listing) — each title is already run through the existing Turkish keyword classifier server-side to decide whether to show it at all, so it can carry its classified type along too.
5. **A new Risk Score filter on `/jobs`,** styled like the existing Rating slider: 4 discrete stops (0, 1, 2, 3), a green→orange→red gradient track, and a warning-triangle tick icon at each stop that grows larger the higher the score.
6. **A short explanatory note for every value** (including the dash), e.g. "-" = no job postings yet, so no repost history to show; "0" = no repeat postings on the same role; "3" = maximum, repeated reposting after marking prior postings filled.

## Global Constraints

- **Dark/light parity**: every new color uses this app's existing Tailwind semantic classes or the small closed set of `text-{color}-600 dark:text-{color}-400` pairs already used elsewhere in this codebase (see `RiskScoreBadge.tsx`, `collarColors.ts`) — never a hardcoded hex value outside a CSS gradient `style` attribute (gradients are the one place this codebase already uses raw hex — see the existing Rating slider's `linear-gradient(to right, #ef4444, #22c55e)`).
- **`packages/shared-types` must be rebuilt** (`cd packages/shared-types && pnpm exec tsc`) after every task that touches `packages/shared-types/src/`, before typechecking `apps/api`/`apps/web` against it.
- **`ZodValidationPipe` scoping rule**: any new/changed `@Body()`/`@Query()` schema must stay scoped to that one parameter (`@Body(new ZodValidationPipe(schema)) body: X`), never a method-level `@UsePipes(...)` — this codebase has handlers with a `@CurrentUser()` decorator that a method-level pipe would incorrectly re-validate.
- **Never trust the client for a business rule already enforced server-side** — the "at least one contact method" rule and the Risk Score filter both need a real server-side check/query, not just a disabled button or an unvalidated query param.
- **No new automated test suite convention-break**: simple/pure logic changes (schema shapes, service methods, validation rules) get a test in this plan; presentational-only JSX changes (footer layout, slider markup) do not, matching this repo's existing sparse-by-design test coverage (see CLAUDE.md).
- Every task ends with `pnpm exec tsc --noEmit` (and, for backend tasks, the relevant Jest file) passing, plus a note on what to check in a real browser. A final manual browser pass happens after Task 9.

---

### Task 1: Backend — expose `workType` on public job postings

**Files:**
- Modify: `packages/shared-types/src/schemas/jobPosting.ts:33-37` (`publicJobPostingSchema`)
- Modify: `apps/api/src/modules/companies/companies.service.ts:222-271` (`jobPostingsByCompanyId`)
- Modify: `apps/api/src/modules/companies/__tests__/companies.service.test.ts:220-260`

**Interfaces:**
- Produces: `PublicJobPosting` now includes `workType: WorkplaceType | null`. Consumed by Task 6 (`JobCard`'s `postingsForCard`).

- [ ] **Step 1: Add `workType` to the public job posting schema**

In `packages/shared-types/src/schemas/jobPosting.ts`, change:

```ts
// What a job-seeker sees on a hiring company's card (JobsBrowser.tsx) —
// deliberately thinner than jobPostingSchema above, no id/status/boost
// internals, those are an owner-facing concern only.
export const publicJobPostingSchema = z.object({
  id: z.string().uuid(),
  jobTitle: z.string(),
  description: z.string(),
});
export type PublicJobPosting = z.infer<typeof publicJobPostingSchema>;
```

to:

```ts
// What a job-seeker sees on a hiring company's card (JobsBrowser.tsx) —
// deliberately thinner than jobPostingSchema above, no id/status/boost
// internals, those are an owner-facing concern only. workType is nullable
// only for legacy rows created before the work-type picker existed —
// every posting created through JobSetupModal now always has one.
export const publicJobPostingSchema = z.object({
  id: z.string().uuid(),
  jobTitle: z.string(),
  description: z.string(),
  workType: workplaceTypeSchema.nullable(),
});
export type PublicJobPosting = z.infer<typeof publicJobPostingSchema>;
```

- [ ] **Step 2: Rebuild shared-types**

Run: `cd packages/shared-types && pnpm exec tsc`

- [ ] **Step 3: Select and return `workType` from `jobPostingsByCompanyId`**

In `apps/api/src/modules/companies/companies.service.ts`, in `jobPostingsByCompanyId`, change the Prisma `select` and the pushed row:

```ts
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
        workType: true,
      },
```

and

```ts
      const list = byCompany.get(row.companyId) ?? [];
      list.push({ id: row.id, jobTitle: row.jobTitle, description: row.description, workType: row.workType });
      byCompany.set(row.companyId, list);
```

- [ ] **Step 4: Update the existing `jobPostingsForSlug` test to expect `workType`**

In `apps/api/src/modules/companies/__tests__/companies.service.test.ts`, in the `"returns owner-authored PUBLISHED postings plus the classified job-title fallback"` test, add `workType: "MANUAL_LABOUR"` to the mocked `jobPosting.findMany` row and to the expected result:

```ts
      jobPosting: {
        findMany: jest.fn().mockResolvedValue([
          {
            companyId: "c1",
            jobTitle: "Forklift Operatörü",
            description: "Depo vardiyası",
            status: "PUBLISHED",
            createdAt: new Date(),
            lastResharedAt: null,
            filledAt: null,
            autoReshareEnabled: false,
            workType: "MANUAL_LABOUR",
          },
        ]),
      },
```

```ts
    expect(result.jobPostings).toEqual([
      { jobTitle: "Forklift Operatörü", description: "Depo vardiyası", workType: "MANUAL_LABOUR" },
    ]);
```

- [ ] **Step 5: Run the test**

Run: `cd apps/api && pnpm exec jest companies.service.test.ts`
Expected: PASS (all existing cases plus the updated one)

- [ ] **Step 6: Typecheck**

Run: `pnpm exec turbo run typecheck --filter=@iwtr/shared-types --filter=@iwtr/api`

- [ ] **Step 7: Commit**

```bash
git add packages/shared-types/src/schemas/jobPosting.ts apps/api/src/modules/companies/companies.service.ts apps/api/src/modules/companies/__tests__/companies.service.test.ts packages/shared-types/dist
git commit -m "feat(api): expose workType on public job postings"
```

---

### Task 2: Backend — a classified work-type per auto-generated job title

**Files:**
- Modify: `packages/shared-types/src/schemas/jobPosting.ts` (new `classifiedJobTitleSchema`, `companyJobPostingsSchema`)
- Modify: `packages/shared-types/src/schemas/company.ts:159-171` (`companyListItemSchema.jobTitles`)
- Modify: `apps/api/src/modules/companies/companies.service.ts:198-217,343-374` (`search`, `jobTitlesByCompanyId`)
- Modify: `apps/api/src/modules/companies/__tests__/companies.service.test.ts:26-96,240-271`

**Interfaces:**
- Consumes: `classifyJobRole(title: string): WorkplaceType | null` (already exists, `apps/api/src/modules/companies/workplace-classifier/classifyJobRole.ts`).
- Produces: `CompanyListItem.jobTitles` and `CompanyJobPostings.jobTitles` are now `{ title: string; workType: WorkplaceType }[]` instead of `string[]`. Consumed by Task 6 (`JobCard`'s `postingsForCard`).

- [ ] **Step 1: Add the shared shape for a classified job title**

In `packages/shared-types/src/schemas/jobPosting.ts`, add (near the top, after `publicJobPostingSchema`):

```ts
// A job title inferred from EmploymentHistory (no real owner-authored
// posting behind it) plus the work-type classifyJobRole already assigns it
// server-side — carried through so a fallback job card can show one
// specific work-type instead of the company's whole workplaceTypes list.
export const classifiedJobTitleSchema = z.object({
  title: z.string(),
  workType: workplaceTypeSchema,
});
export type ClassifiedJobTitle = z.infer<typeof classifiedJobTitleSchema>;
```

Then update `companyJobPostingsSchema`:

```ts
export const companyJobPostingsSchema = z.object({
  jobPostings: z.array(publicJobPostingSchema),
  jobTitles: z.array(classifiedJobTitleSchema),
});
export type CompanyJobPostings = z.infer<typeof companyJobPostingsSchema>;
```

- [ ] **Step 2: Update `companyListItemSchema.jobTitles`**

In `packages/shared-types/src/schemas/company.ts`, change the import on line 3:

```ts
import { publicJobPostingSchema, classifiedJobTitleSchema } from "./jobPosting";
```

and change:

```ts
  // Distinct, classified job titles drawn from this company's own
  // EmploymentHistory rows (see classifyJobRole) — only ever populated when
  // the request set includeJobTitles; otherwise always [], never omitted, so
  // every CompanyListItem consumer can rely on the field existing.
  jobTitles: z.array(z.string()),
```

to:

```ts
  // Distinct job titles drawn from this company's own EmploymentHistory
  // rows, each paired with the work-type classifyJobRole assigned it (see
  // ClassifiedJobTitle) — only ever populated when the request set
  // includeJobTitles; otherwise always [], never omitted, so every
  // CompanyListItem consumer can rely on the field existing.
  jobTitles: z.array(classifiedJobTitleSchema),
```

- [ ] **Step 3: Rebuild shared-types**

Run: `cd packages/shared-types && pnpm exec tsc`

- [ ] **Step 4: Carry the classified work-type through `jobTitlesByCompanyId`**

In `apps/api/src/modules/companies/companies.service.ts`, change `jobTitlesByCompanyId`:

```ts
  private async jobTitlesByCompanyId(companyIds: string[]): Promise<Map<string, ClassifiedJobTitle[]>> {
    if (companyIds.length === 0) return new Map();

    const rows = await this.prisma.employmentHistory.groupBy({
      by: ["companyId", "jobTitle"],
      where: { companyId: { in: companyIds }, jobTitle: { not: null } },
      _count: { jobTitle: true },
    });

    const byCompany = new Map<string, { title: string; workType: WorkplaceType; count: number }[]>();
    for (const row of rows) {
      if (!row.companyId || !row.jobTitle) continue;
      // Only "categorized" titles surface here — classifyJobRole returning
      // null (confidenceScore 0, i.e. an unrecognized keyword) means the raw
      // text is too noisy/ambiguous to show as a job title card, same
      // fallback semantics that function already documents.
      const workType = classifyJobRole(row.jobTitle);
      if (workType === null) continue;
      const list = byCompany.get(row.companyId) ?? [];
      list.push({ title: row.jobTitle, workType, count: row._count.jobTitle });
      byCompany.set(row.companyId, list);
    }

    const result = new Map<string, ClassifiedJobTitle[]>();
    for (const [companyId, titles] of byCompany) {
      const topTitles = titles
        .sort((a, b) => b.count - a.count)
        .slice(0, 4)
        .map((t) => ({ title: t.title, workType: t.workType }));
      result.set(companyId, topTitles);
    }
    return result;
  }
```

Add `ClassifiedJobTitle` to the `@iwtr/shared-types` import at the top of the file.

- [ ] **Step 5: Fix `search()`'s now-stale empty-map type annotations**

In `search()`, change:

```ts
    const jobTitlesByCompanyId = query.includeJobTitles
      ? await this.jobTitlesByCompanyId(companies.map((c) => c.id))
      : new Map<string, string[]>();
```

to:

```ts
    const jobTitlesByCompanyId = query.includeJobTitles
      ? await this.jobTitlesByCompanyId(companies.map((c) => c.id))
      : new Map<string, ClassifiedJobTitle[]>();
```

- [ ] **Step 6: Update the existing tests for the new shape**

In `apps/api/src/modules/companies/__tests__/companies.service.test.ts`:

```ts
    expect(results[0].jobTitles).toEqual([]);
```
stays as-is (an empty array either way).

```ts
    const results = await service.search({ ...baseQuery(), includeJobTitles: true });

    expect(prisma.company.findMany.mock.calls[0][0].where.isHiring).toBe(true);
    expect(results[0].jobTitles).toEqual(["Muhasebe", "Avukat"]);
```
becomes:
```ts
    const results = await service.search({ ...baseQuery(), includeJobTitles: true });

    expect(prisma.company.findMany.mock.calls[0][0].where.isHiring).toBe(true);
    expect(results[0].jobTitles).toEqual([
      { title: "Muhasebe", workType: "OFFICE" },
      { title: "Avukat", workType: "OFFICE" },
    ]);
```

```ts
    expect(results[0].jobTitles).toHaveLength(4);
    expect(results[0].jobTitles).not.toContain("CEO");
```
becomes:
```ts
    expect(results[0].jobTitles).toHaveLength(4);
    expect(results[0].jobTitles.map((t) => t.title)).not.toContain("CEO");
```

And in the `jobPostingsForSlug` describe block:
```ts
    // Gibberish that classifyJobRole can't place is dropped, same as /jobs.
    expect(result.jobTitles).toEqual(["Muhasebe"]);
```
becomes:
```ts
    // Gibberish that classifyJobRole can't place is dropped, same as /jobs.
    expect(result.jobTitles).toEqual([{ title: "Muhasebe", workType: "OFFICE" }]);
```

(`"Muhasebe"` and `"Avukat"` are both real classifier keywords already used in this same test file's comments as OFFICE-classifying — verify with `pnpm exec jest classifyJobRole.test.ts` if either assertion fails, and use whatever `classifyWorkplace` actually returns for that exact string instead of assuming.)

- [ ] **Step 7: Run the tests**

Run: `cd apps/api && pnpm exec jest companies.service.test.ts`
Expected: PASS

- [ ] **Step 8: Typecheck**

Run: `pnpm exec turbo run typecheck --filter=@iwtr/shared-types --filter=@iwtr/api`

- [ ] **Step 9: Commit**

```bash
git add packages/shared-types/src apps/api/src/modules/companies packages/shared-types/dist
git commit -m "feat(api): classify a work-type per auto-generated job title"
```

---

### Task 3: Backend — Risk Score search filter

**Files:**
- Modify: `packages/shared-types/src/schemas/company.ts:133-154` (`companySearchQuerySchema`)
- Modify: `apps/api/src/modules/companies/companies.service.ts:133-196` (`search`)
- Modify: `apps/api/src/modules/companies/__tests__/companies.service.test.ts` (new test)

**Interfaces:**
- Produces: `GET /companies?maxRiskScore=N` filters to companies with `riskScore <= N`. Consumed by Task 7 (`JobsBrowser`'s new slider).

- [ ] **Step 1: Add `maxRiskScore` to the search query schema**

In `packages/shared-types/src/schemas/company.ts`, in `companySearchQuerySchema`, add after `minRating`:

```ts
  minRating: z.coerce.number().min(0).max(5).optional(),
  // "Show companies at or below this Risk Score" — same and-below semantics
  // as minRating above (a misleading name inherited from that field's own
  // history; kept consistent rather than fixed here). 0-3, see
  // Company.riskScore. Omitted entirely means no filtering, same convention
  // as minRating.
  maxRiskScore: z.coerce.number().int().min(0).max(3).optional(),
```

- [ ] **Step 2: Rebuild shared-types**

Run: `cd packages/shared-types && pnpm exec tsc`

- [ ] **Step 3: Apply the filter in `search()`**

In `apps/api/src/modules/companies/companies.service.ts`, in the `where` object inside `search()`, add after the `minRating` line:

```ts
        ...(query.minRating !== undefined ? { aggregate: { is: { overallAvg: { lte: query.minRating } } } } : {}),
        ...(query.maxRiskScore !== undefined ? { riskScore: { lte: query.maxRiskScore } } : {}),
```

- [ ] **Step 4: Write the test**

Add to `apps/api/src/modules/companies/__tests__/companies.service.test.ts`, in a new `describe` block:

```ts
describe("CompaniesService.search — maxRiskScore filter", () => {
  it("filters to companies at or below the given Risk Score", async () => {
    const prisma = makePrisma();
    const service = new CompaniesService(prisma as any, {} as any);

    await service.search({ ...baseQuery(), maxRiskScore: 1 });

    expect(prisma.company.findMany.mock.calls[0][0].where.riskScore).toEqual({ lte: 1 });
  });

  it("applies no riskScore filter when maxRiskScore is omitted", async () => {
    const prisma = makePrisma();
    const service = new CompaniesService(prisma as any, {} as any);

    await service.search(baseQuery());

    expect(prisma.company.findMany.mock.calls[0][0].where).not.toHaveProperty("riskScore");
  });
});
```

- [ ] **Step 5: Run the test**

Run: `cd apps/api && pnpm exec jest companies.service.test.ts`
Expected: PASS

- [ ] **Step 6: Typecheck**

Run: `pnpm exec turbo run typecheck --filter=@iwtr/shared-types --filter=@iwtr/api`

- [ ] **Step 7: Commit**

```bash
git add packages/shared-types/src/schemas/company.ts apps/api/src/modules/companies/companies.service.ts apps/api/src/modules/companies/__tests__/companies.service.test.ts packages/shared-types/dist
git commit -m "feat(api): add maxRiskScore filter to company search"
```

---

### Task 4: Backend — relax contact info to "at least one of phone or email"

**Files:**
- Modify: `packages/shared-types/src/schemas/owner.ts:64-113` (`updateCompanyInputSchema`)
- Modify: `apps/api/src/modules/owner/owner.service.ts:94-187` (`updateMyCompany`)
- Modify: `apps/api/src/modules/owner/__tests__/owner.service.test.ts` (new tests)

**Interfaces:**
- Consumes: `companyContactPhoneSchema` (`packages/shared-types/src/schemas/turkishPhone.ts`, unchanged).
- Produces: `updateCompanyInputSchema` now accepts `contactEmail`/`contactPhone` as either a valid value or `""` (meaning "not provided"), and rejects a request that explicitly sends both as `""`. `OwnerService.updateMyCompany` rejects (400) any update that would leave a company with neither. Consumed by Task 9 (the contact form).

- [ ] **Step 1: Loosen the two field schemas and add the object-level refine**

In `packages/shared-types/src/schemas/owner.ts`, change:

```ts
    contactEmail: z.string().email().optional(),
    // Turkey-specific: a mobile number (any 05XX prefix) or a landline whose
    // area code is a real one of the 81 provinces' — see
    // schemas/turkishPhone.ts. Deliberately stricter than the generic E.164
    // pattern used for personal phone numbers elsewhere (user.ts,
    // employerProfile.ts) since this platform is Turkey-only and the
    // dashboard's own guidance note promises area-code validation.
    contactPhone: companyContactPhoneSchema.optional(),
```

to:

```ts
    // Both accept "" (meaning "leave this one blank") because only one of
    // the two is actually required — see the object-level refine below and
    // OwnerService.updateMyCompany's own server-side check against whatever
    // is already stored for the field not included in a given request.
    contactEmail: z.union([z.string().email(), z.literal("")]).optional(),
    // Turkey-specific: a mobile number (any 05XX prefix) or a landline whose
    // area code is a real one of the 81 provinces' — see
    // schemas/turkishPhone.ts. Deliberately stricter than the generic E.164
    // pattern used for personal phone numbers elsewhere (user.ts,
    // employerProfile.ts) since this platform is Turkey-only and the
    // dashboard's own guidance note promises area-code validation.
    contactPhone: z.union([companyContactPhoneSchema, z.literal("")]).optional(),
```

and change the schema's closing `.refine(...)` to chain a second one:

```ts
  })
  .refine((v) => Object.values(v).some((value) => value !== undefined), {
    message: "Provide at least one field to update",
  })
  .refine((v) => !(v.contactEmail === "" && v.contactPhone === ""), {
    message: "Provide at least a phone number or an email address so applicants can reach you.",
    path: ["contactEmail"],
  });
export type UpdateCompanyInput = z.infer<typeof updateCompanyInputSchema>;
```

- [ ] **Step 2: Rebuild shared-types**

Run: `cd packages/shared-types && pnpm exec tsc`

- [ ] **Step 3: Enforce it server-side against whatever is already stored, and write `""` as `null`**

In `apps/api/src/modules/owner/owner.service.ts`, add a small helper near the top of the file (after `sameWorkplaceTypes`):

```ts
function emptyToNull(value: string | undefined): string | null | undefined {
  return value === "" ? null : value;
}
```

Then in `updateMyCompany`, add this block before the final `this.prisma.company.update(...)` call (right after the existing `featuredReviewId` ownership check, before the `input.name` uniqueness check reads naturally either order — place it right after the `location` computation so it sits with the other pre-write checks):

```ts
    // At least one contact method must remain reachable after this update.
    // Only reads the current row when either field is actually part of this
    // request — same targeted-read pattern as the workplaceTypes lock check
    // above, not a read on every single unrelated PATCH.
    if (input.contactEmail !== undefined || input.contactPhone !== undefined) {
      const current = await this.prisma.company.findUniqueOrThrow({
        where: { id: companyId },
        select: { contactEmail: true, contactPhone: true },
      });
      const finalEmail = input.contactEmail !== undefined ? emptyToNull(input.contactEmail) : current.contactEmail;
      const finalPhone = input.contactPhone !== undefined ? emptyToNull(input.contactPhone) : current.contactPhone;
      if (!finalEmail && !finalPhone) {
        throw new BadRequestException("Provide at least a phone number or an email address so applicants can reach you.");
      }
    }
```

And change the two lines inside the `data: {...}` object of the final `this.prisma.company.update(...)` call:

```ts
        contactEmail: emptyToNull(input.contactEmail),
        contactPhone: emptyToNull(input.contactPhone),
```

- [ ] **Step 4: Write the tests**

Add to `apps/api/src/modules/owner/__tests__/owner.service.test.ts`:

```ts
describe("OwnerService.updateMyCompany — at least one contact method required", () => {
  function buildService(current: { contactEmail: string | null; contactPhone: string | null }) {
    const prisma = {
      companyOwner: {
        findUnique: jest.fn().mockResolvedValue({ tier: "FREE", planStatus: "NONE", claimStatus: "APPROVED" }),
      },
      company: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ workplaceTypes: ["OFFICE"], ...current }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const reviews = { areAllWorkplaceTypesReviewed: jest.fn().mockResolvedValue(false) };
    return { service: new OwnerService(prisma as any, reviews as unknown as ReviewsService), prisma };
  }

  it("rejects clearing both when the company currently has both set", async () => {
    const { service } = buildService({ contactEmail: "hr@co.com", contactPhone: "+905551234567" });
    await expect(
      service.updateMyCompany("u1", "c1", { contactEmail: "", contactPhone: "" }),
    ).rejects.toThrow("Provide at least a phone number or an email address");
  });

  it("allows setting only an email when phone is left blank and none is stored yet", async () => {
    const { service, prisma } = buildService({ contactEmail: null, contactPhone: null });
    await service.updateMyCompany("u1", "c1", { contactEmail: "hr@co.com", contactPhone: "" });
    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ contactEmail: "hr@co.com", contactPhone: null }) }),
    );
  });

  it("allows updating an unrelated field when an email is already stored and phone is untouched", async () => {
    const { service, prisma } = buildService({ contactEmail: "hr@co.com", contactPhone: null });
    await service.updateMyCompany("u1", "c1", { isHiring: true });
    expect(prisma.company.update).toHaveBeenCalled();
    // contactEmail/contactPhone weren't part of this request, so the guard
    // must not have needed (or found) a reason to reject it.
  });
});
```

- [ ] **Step 5: Run the tests**

Run: `cd apps/api && pnpm exec jest owner.service.test.ts`
Expected: PASS

- [ ] **Step 6: Typecheck**

Run: `pnpm exec turbo run typecheck --filter=@iwtr/shared-types --filter=@iwtr/api`

- [ ] **Step 7: Commit**

```bash
git add packages/shared-types/src/schemas/owner.ts apps/api/src/modules/owner packages/shared-types/dist
git commit -m "feat(api): require only one of phone/email, not both, for company contact info"
```

---

### Task 5: Frontend — `RiskScoreBadge` rewrite (dash state, per-value notes, color scale)

**Files:**
- Modify: `apps/web/src/components/jobs/RiskScoreBadge.tsx`

**Interfaces:**
- Produces: `RiskScoreBadge({ riskScore: number | null, className? })` — `null` renders `Risk Score: -`; otherwise renders the existing icon+number treatment, now color-coded and always shown (even at 0). Also exports `riskScoreColorClass(riskScore: number): string` and `RISK_SCORE_NOTES: Record<number, string>` and `NO_OPEN_POSTING_NOTE: string`. Consumed by Task 6 (`JobCard`), Task 7 (`JobsBrowser`'s slider legend/ticks), Task 8 (company profile page).

- [ ] **Step 1: Rewrite the component**

Replace the full contents of `apps/web/src/components/jobs/RiskScoreBadge.tsx`:

```tsx
// Worker-facing accountability signal: riskScore increments (server-side,
// see JobPostingsService.create) when a company reposts the exact same
// title+workType after marking an earlier identical posting FILLED. Shown
// by default on every company now (not hidden at 0) — "-" is the distinct
// "no data yet" state for a card/page with no real, appliable job posting
// behind it, not the same thing as a clean 0.
export const RISK_SCORE_NOTES: Record<number, string> = {
  0: "No repeat postings for the same role — a clean track record so far.",
  1: "This company has reposted an identical role once after marking a prior posting as filled.",
  2: "This company has reposted an identical role twice after marking prior postings as filled.",
  3: "Maximum Risk Score — this company has repeatedly reposted identical roles after marking them filled.",
};

export const NO_OPEN_POSTING_NOTE =
  "This company hasn't posted a job opening yet, so there's no repost history to show.";

// Shared green→orange→red severity scale, also used by the Risk Score
// filter slider's tick icons in JobsBrowser.tsx so the two stay visually
// consistent.
export function riskScoreColorClass(riskScore: number): string {
  if (riskScore === 0) return "text-green-600 dark:text-green-400";
  if (riskScore === 1) return "text-amber-500 dark:text-amber-400";
  if (riskScore === 2) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

export function RiskScoreBadge({ riskScore, className }: { riskScore: number | null; className?: string }) {
  if (riskScore === null) {
    return (
      <span
        className={`text-xs font-semibold text-muted-foreground ${className ?? ""}`}
        title={NO_OPEN_POSTING_NOTE}
      >
        Risk Score: -
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${riskScoreColorClass(riskScore)} ${className ?? ""}`}
      title={RISK_SCORE_NOTES[riskScore]}
    >
      {Array.from({ length: riskScore }, (_, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3 2 21h20L12 3Z" />
          <path d="M12 9v5" />
          <path d="M12 17h.01" />
        </svg>
      ))}
      Risk Score: {riskScore}/3
    </span>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: PASS — `JobCard.tsx` and `companies/[slug]/page.tsx` still pass a bare `number` to `RiskScoreBadge`, which stays assignable to the new `number | null` prop type, so this compiles as-is. Tasks 6 and 8 later update those call sites' *values* (to add the dash logic), not required for this task's typecheck to pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/jobs/RiskScoreBadge.tsx
git commit -m "feat(web): RiskScoreBadge dash state, per-value notes, severity colors"
```

---

### Task 6: Frontend — `JobCard`: single work-type + right-aligned Risk Score

**Files:**
- Modify: `apps/web/src/components/jobs/JobCard.tsx`

**Interfaces:**
- Consumes: `RiskScoreBadge` from Task 5; `PublicJobPosting.workType` from Task 1; `CompanyListItem.jobTitles[].workType` from Task 2.
- Produces: `CardPosting` now carries `workType: WorkplaceType | null`. `postingsForCard` passes it through from both real postings and the classified-title fallback.

- [ ] **Step 1: Add `workType` to `CardPosting` and thread it through `postingsForCard`**

In `apps/web/src/components/jobs/JobCard.tsx`, change:

```ts
export type CardPosting = { id?: string; jobTitle: string; description: string | null } | null;

export function postingsForCard(company: CompanyListItem): CardPosting[] {
  if (company.jobPostings.length > 0) {
    return company.jobPostings.map((p) => ({ id: p.id, jobTitle: p.jobTitle, description: p.description }));
  }
  if (company.jobTitles.length > 0) {
    // Auto-classified titles have no owner-authored description to show, and
    // no real posting id — never bookmarkable (see the bookmark button's own
    // posting?.id guard below).
    return company.jobTitles.map((title) => ({ jobTitle: title, description: null }));
  }
  return [null];
}
```

to:

```ts
export type CardPosting =
  | { id?: string; jobTitle: string; description: string | null; workType: WorkplaceType | null }
  | null;

export function postingsForCard(company: CompanyListItem): CardPosting[] {
  if (company.jobPostings.length > 0) {
    return company.jobPostings.map((p) => ({
      id: p.id,
      jobTitle: p.jobTitle,
      description: p.description,
      workType: p.workType,
    }));
  }
  if (company.jobTitles.length > 0) {
    // Auto-classified titles have no owner-authored description to show, and
    // no real posting id — never bookmarkable (see the bookmark button's own
    // posting?.id guard below). workType comes from the same classifyJobRole
    // call the server already ran to decide whether to surface this title at
    // all (see CompaniesService.jobTitlesByCompanyId) — never re-derived
    // client-side.
    return company.jobTitles.map((t) => ({ jobTitle: t.title, description: null, workType: t.workType }));
  }
  return [null];
}
```

Add `WorkplaceType` to the `@iwtr/shared-types` type-only import at the top of the file (it currently imports `CompanyListItem`, `CompanyVibeFlags`, `VibeFlag`).

- [ ] **Step 2: Pick one work-type for this card and show it, right-aligned next to Risk Score, in the footer**

Find this line inside the `JobCard` function body (after `isSaved`):

```ts
  const isSaved = posting?.id ? savedIds.has(posting.id) : false;
```

Add right after it:

```ts
  // One work-type per card, not the company's whole (up to 2) list — the
  // posting's own workType when there is one (real postings always have one
  // now; the auto-classified fallback carries its classifyJobRole result),
  // falling back to the company's primary type only for pre-existing
  // postings created before this field existed.
  const cardWorkType = posting?.workType ?? company.workplaceTypes[0];
```

Then replace the footer block:

```tsx
      {/* Card footer, below the main content box */}
      <div className="border-t border-border px-3 py-2 compact:px-2 compact:py-1.5">
        <p className="truncate text-xs text-muted-foreground">
          <WorkTypeLabel workplaceTypes={company.workplaceTypes} />
          {company.isChainStore ? " · Chain store" : ""}
          {" · "}
          {company.reviewCount} review{company.reviewCount === 1 ? "" : "s"}
        </p>
        <RiskScoreBadge riskScore={company.riskScore} />
      </div>
```

with:

```tsx
      {/* Card footer, below the main content box. Work-type text on the
          left, Risk Score right-aligned in the same row (not stacked) —
          "-" whenever this card has no real, appliable posting behind it
          (the auto-classified fallback and the "no open roles" empty
          state both count as no real posting; see RiskScoreBadge). */}
      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 compact:px-2 compact:py-1.5">
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          <span className="font-bold">{workplaceTypeLabel(cardWorkType)}</span>
          {company.isChainStore ? " · Chain store" : ""}
          {" · "}
          {company.reviewCount} review{company.reviewCount === 1 ? "" : "s"}
        </p>
        <RiskScoreBadge riskScore={posting?.id ? company.riskScore : null} className="shrink-0" />
      </div>
```

- [ ] **Step 3: Swap the now-unused `WorkTypeLabel` import for `workplaceTypeLabel`**

`WorkTypeLabel` is no longer used anywhere in this file (grep the file to confirm before removing its import — it's a different component from the one being called above, `workplaceTypeLabel` the plain function). Change:

```ts
import { WorkTypeLabel } from "@/components/WorkTypeLabel";
```

to:

```ts
import { workplaceTypeLabel } from "@/lib/workplaceTypes";
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Lint**

Run: `cd apps/web && pnpm exec eslint src/components/jobs/JobCard.tsx`
Expected: no new errors (an unused-import error here means Step 3 missed a reference — search the file again)

- [ ] **Step 6: Manual browser check**

Start both dev servers if not already running (`cd apps/api && pnpm dev`, `cd apps/web && pnpm dev`) and open `/jobs`. Find `Demo Finans Holding`'s card (or any company with 2 workplaceTypes and a real posting) and confirm: exactly one work-type shows in the footer (matching that specific posting, not both company types), and the Risk Score badge sits at the right edge of that same footer row. Open a company profile page's "Job Postings" tab and confirm the same (it reuses this component with no code changes of its own).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/jobs/JobCard.tsx
git commit -m "feat(web): one work-type per job card, right-aligned Risk Score"
```

---

### Task 7: Frontend — Risk Score filter slider on `/jobs`

**Files:**
- Modify: `apps/web/src/components/JobsBrowser.tsx`

**Interfaces:**
- Consumes: `riskScoreColorClass`, `RISK_SCORE_NOTES` from Task 5; `maxRiskScore` query param from Task 3.

- [ ] **Step 1: Add state, a slider-drag helper, and the query param**

Add near the other filter `useState`s (after `const [minRating, setMinRating] = useState(0);`):

```ts
  // 3 = "Any" (no filter) — riskScore's own max is 3, so "3 and below"
  // trivially matches every company, same reasoning minRating's top end
  // (5) already uses for its own "Any" state.
  const [maxRiskScore, setMaxRiskScore] = useState(3);
  const riskSliderTrackRef = useRef<HTMLDivElement>(null);
```

Add a new import line alongside the existing `BookmarkIcon` import (this file doesn't render `RiskScoreBadge` itself — that stays inside `JobCard.tsx` — it only needs the color/notes helpers for the slider):

```ts
import { riskScoreColorClass, RISK_SCORE_NOTES } from "@/components/jobs/RiskScoreBadge";
```

Add the discrete-snap slider helpers near `applyRatingFromClientX`/`handleSliderPointerDown`/`handleSliderPointerMove`:

```ts
  function stepRiskScore(delta: number) {
    setMaxRiskScore((prev) => Math.min(3, Math.max(0, prev + delta)));
  }

  function applyRiskScoreFromClientX(el: HTMLDivElement, clientX: number) {
    const rect = el.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setMaxRiskScore(Math.round(fraction * 3));
  }

  function handleRiskSliderPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    applyRiskScoreFromClientX(e.currentTarget, e.clientX);
  }

  function handleRiskSliderPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.buttons !== 1) return;
    applyRiskScoreFromClientX(e.currentTarget, e.clientX);
  }
```

Add a wheel listener next to the existing rating one (right after the `useEffect` that wires `sliderTrackRef`'s wheel handler):

```ts
  useEffect(() => {
    const el = riskSliderTrackRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stepRiskScore(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
```

- [ ] **Step 2: Wire the query param and the page-reset effect**

In the `GET /companies` fetch effect, add after the `minRating` line:

```ts
    if (minRating > 0) params.set("minRating", String(minRating));
    if (maxRiskScore < 3) params.set("maxRiskScore", String(maxRiskScore));
```

and add `maxRiskScore` to that effect's dependency array:

```ts
  }, [query, workplaceTypes, selectedCities, selectedDistrictKeys, minRating, maxRiskScore]);
```

Add `maxRiskScore` to the `setPage(1)` reset effect's dependency array too:

```ts
  useEffect(() => {
    setPage(1);
  }, [
    workplaceTypes,
    selectedCategory,
    categoryGroup,
    minRating,
    maxRiskScore,
    selectedCities,
    selectedDistrictKeys,
    sortBy,
    query,
    selectedCompanyId,
  ]);
```

- [ ] **Step 3: Add the filter block's JSX**

Find the Rating filter's closing `</div>` right before `<CityDistrictPicker`:

```tsx
                <span className="text-center text-xs font-normal text-muted-foreground">
                  {minRating === 0 || minRating === 5 ? "Any" : `${minRating.toFixed(1)} and Below`}
                </span>
              </div>
            </div>

            <CityDistrictPicker
```

Insert a new filter block between them:

```tsx
                <span className="text-center text-xs font-normal text-muted-foreground">
                  {minRating === 0 || minRating === 5 ? "Any" : `${minRating.toFixed(1)} and Below`}
                </span>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Risk Score</h3>
                <RewindButton onClick={() => setMaxRiskScore(3)} active={maxRiskScore !== 3} title="Reset Risk Score filter" />
              </div>
              <div className="flex flex-col gap-3 rounded-lg px-3 py-3 select-none">
                <div className="relative pt-8">
                  {[0, 1, 2, 3].map((tickValue) => {
                    const active = maxRiskScore === tickValue;
                    // Grows from 14px (tick 0) to 26px (tick 3) — "exclamation
                    // mark gets bigger and bigger until 3" per the design.
                    const sizePx = 14 + tickValue * 4;
                    return (
                      <span
                        key={tickValue}
                        className={`absolute top-0 flex items-center justify-center transition-all duration-200 ${
                          active ? "scale-110 opacity-100" : "scale-90 opacity-40 grayscale"
                        } ${riskScoreColorClass(tickValue)}`}
                        style={{ left: `${(tickValue / 3) * 100}%`, width: sizePx, height: sizePx, transform: "translateX(-50%)" }}
                        aria-hidden="true"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-full w-full"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 3 2 21h20L12 3Z" />
                          <path d="M12 9v5" />
                          <path d="M12 17h.01" />
                        </svg>
                      </span>
                    );
                  })}

                  <div
                    ref={riskSliderTrackRef}
                    onPointerDown={handleRiskSliderPointerDown}
                    onPointerMove={handleRiskSliderPointerMove}
                    className="relative h-2 w-full cursor-pointer touch-none rounded-full"
                    style={{ background: "linear-gradient(to right, #22c55e, #f97316, #ef4444)" }}
                    title="Click and drag along the slider, or scroll, to choose a maximum Risk Score"
                  >
                    {[0, 1, 2, 3].map((tickValue) => (
                      <span
                        key={tickValue}
                        className="absolute top-0 h-full w-0.5 -translate-x-1/2 bg-white/70"
                        style={{ left: `${(tickValue / 3) * 100}%` }}
                      />
                    ))}
                    <span
                      className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-foreground shadow"
                      style={{ left: `${(maxRiskScore / 3) * 100}%` }}
                    />
                  </div>
                </div>

                <span className="text-center text-xs font-normal text-muted-foreground">
                  {maxRiskScore === 3 ? "Any" : `${maxRiskScore} and Below`}
                </span>
                <p className="text-xs text-muted-foreground">{RISK_SCORE_NOTES[maxRiskScore]}</p>
              </div>
            </div>

            <CityDistrictPicker
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Lint**

Run: `cd apps/web && pnpm exec eslint src/components/JobsBrowser.tsx`
Expected: no new errors

- [ ] **Step 6: Manual browser check**

Open `/jobs`, drag the new Risk Score slider (and scroll-wheel over it) through all 4 stops, confirm: the track shows a green→orange→red gradient, the exclamation-mark ticks grow larger left-to-right and highlight the active one, the label reads "Any" at the far right and "N and Below" elsewhere, the note text below changes per value, and the results grid actually narrows (test against a company you've temporarily set a non-zero `riskScore` on, e.g. `demo-finans-holding`, which already has `riskScore: 3` in the dev DB per project memory — dragging to 2 or below should hide it, 3 or "Any" should show it).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/JobsBrowser.tsx
git commit -m "feat(web): Risk Score filter slider on the Jobs page"
```

---

### Task 8: Frontend — company profile page Risk Score dash state

**Files:**
- Modify: `apps/web/src/app/companies/[slug]/page.tsx`

**Interfaces:**
- Consumes: `RiskScoreBadge` from Task 5.

- [ ] **Step 1: Pass `null` instead of the raw number when the company isn't currently hiring**

Find:

```tsx
              <div className="mt-1">
                <RiskScoreBadge riskScore={company.riskScore} />
              </div>
```

Replace with:

```tsx
              <div className="mt-1">
                {/* "-" mirrors the same rule job cards use: no real, open
                    posting to have a repost history against yet. isHiring is
                    the one signal already on this page's own CompanyDetail
                    fetch without an extra request. */}
                <RiskScoreBadge riskScore={company.isHiring ? company.riskScore : null} />
              </div>
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Manual browser check**

Open a company profile page for a company with `isHiring: false` and confirm the badge reads "Risk Score: -"; open one with `isHiring: true` (e.g. `demo-finans-holding`) and confirm it shows the real number.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/companies/[slug]/page.tsx"
git commit -m "feat(web): dash-state Risk Score on the company profile page"
```

---

### Task 9: Frontend — contact form: either phone or email, with a professional note

**Files:**
- Modify: `apps/web/src/components/owner/sections/ContactSocialCategory.tsx`
- Modify: `apps/web/src/app/my/companies/page.tsx:430-460` (`saveContact`)

**Interfaces:**
- Consumes: Task 4's relaxed `updateCompanyInputSchema` (sending `""` for a field left blank must now succeed server-side, as long as the other one isn't also blank).

- [ ] **Step 1: Update the labels, note, and button-disabled logic**

In `apps/web/src/components/owner/sections/ContactSocialCategory.tsx`, replace the two `(required)` labels and add a note above them. Change:

```tsx
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Official website URL is set from the General Information tab (a paid-tier field, alongside the
          About/Description text).
        </p>
        <label className="text-xs font-medium text-muted-foreground">
          Public HR / Contact Email <span className="text-red-600 dark:text-red-400">(required)</span>
          <input
            type="email"
            value={props.contactEmail}
            onChange={(e) => props.setContactEmail(e.target.value)}
            placeholder="hr@company.com"
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
          />
        </label>

        <label className="text-xs font-medium text-muted-foreground">
          Business Phone Number <span className="text-red-600 dark:text-red-400">(required)</span>
          <div className="mt-1">
            <TurkishPhoneInput value={props.contactPhone} onChange={props.setContactPhone} suggestedProvince={props.city} />
          </div>
        </label>
```

to:

```tsx
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Official website URL is set from the General Information tab (a paid-tier field, alongside the
          About/Description text).
        </p>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          At least one contact method is required. For best results, we recommend providing both a phone
          number and an email address so applicants can reach you as easily as possible.
        </p>
        <label className="text-xs font-medium text-muted-foreground">
          Public HR / Contact Email <span className="text-muted-foreground/70">(one of email or phone is required)</span>
          <input
            type="email"
            value={props.contactEmail}
            onChange={(e) => props.setContactEmail(e.target.value)}
            placeholder="hr@company.com"
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
          />
        </label>

        <label className="text-xs font-medium text-muted-foreground">
          Business Phone Number <span className="text-muted-foreground/70">(one of email or phone is required)</span>
          <div className="mt-1">
            <TurkishPhoneInput value={props.contactPhone} onChange={props.setContactPhone} suggestedProvince={props.city} />
          </div>
        </label>
```

Change the Save button's `disabled` condition:

```tsx
        disabled={props.saving || !props.contactEmail.trim() || !props.contactPhone.trim() || props.contactPhone.trim() === "+90"}
```

to:

```tsx
        disabled={
          props.saving ||
          (!props.contactEmail.trim() && (!props.contactPhone.trim() || props.contactPhone.trim() === "+90"))
        }
```

- [ ] **Step 2: Update `saveContact` to only validate/send a field that's actually filled in**

In `apps/web/src/app/my/companies/page.tsx`, replace:

```ts
  async function saveContact() {
    setContactSaving(true);
    setContactError(null);
    setContactStatus(null);
    const phoneCheck = companyContactPhoneSchema.safeParse(contactPhone.trim());
    if (!phoneCheck.success) {
      setContactError(phoneCheck.error.issues[0]?.message ?? "That phone number isn't valid.");
      setContactSaving(false);
      return;
    }
    try {
      const body: Record<string, string> = {
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
      };
```

with:

```ts
  async function saveContact() {
    setContactSaving(true);
    setContactError(null);
    setContactStatus(null);
    const trimmedEmail = contactEmail.trim();
    const trimmedPhone = contactPhone.trim() === "+90" ? "" : contactPhone.trim();
    if (!trimmedEmail && !trimmedPhone) {
      setContactError("Provide at least a phone number or an email address so applicants can reach you.");
      setContactSaving(false);
      return;
    }
    if (trimmedPhone) {
      const phoneCheck = companyContactPhoneSchema.safeParse(trimmedPhone);
      if (!phoneCheck.success) {
        setContactError(phoneCheck.error.issues[0]?.message ?? "That phone number isn't valid.");
        setContactSaving(false);
        return;
      }
    }
    try {
      const body: Record<string, string> = {
        contactEmail: trimmedEmail,
        contactPhone: trimmedPhone,
      };
```

(The rest of the function is unchanged — `contactEmail`/`contactPhone` keep being sent together every time, now potentially one of them as `""`, which Task 4's backend now accepts as long as the other isn't also blank.)

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Manual browser check**

On `/my/companies`, open the Contact & Social tab for an owned company. Confirm: the note above the two fields reads the new professional copy, both labels now say "(one of email or phone is required)", the Save button is disabled only when *both* are empty, filling in just an email (leaving phone at its default `+90`) enables Save and it succeeds, and clearing both re-disables it. Also confirm entering an invalid (non-Turkish) phone while email is filled still shows the phone-format error rather than silently succeeding.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/owner/sections/ContactSocialCategory.tsx apps/web/src/app/my/companies/page.tsx
git commit -m "feat(web): require only one of phone/email for company contact info"
```

---

## Final verification (after Task 9)

- [ ] Run `pnpm exec turbo run typecheck lint` from the repo root — expect the same pre-existing warning count as before this plan (0 errors), nothing new introduced.
- [ ] Run `cd apps/api && pnpm exec jest` — full suite green (aside from the 4 pre-existing, unrelated `classifyJobRole` failures already noted in project memory, if still present).
- [ ] Manual pass in the browser covering all 6 numbered requirements from the Spec section above, on both a company with `riskScore > 0` and one with `riskScore === 0`, and both a hiring and a non-hiring company.

# Sidebar Geometry Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the duplicated, drifted sidebar/row wrapper markup across `WorkplaceBrowser`, `JobsBrowser`, `SocialSidebar` (both modes), `SocialShell`, and `CompanyProfileTabs`, replacing it with two shared shell components locked to the Homepage's exact geometry, so every page's left filter panel uses the same width/gap rhythm.

**Architecture:** Two new presentational components in `apps/web/src/components/layout/`: `SidebarShell` (the `<aside>` wrapper) and `SidebarContentRow` (the `flex flex-col gap-6 sm:flex-row` row pairing sidebar + main content). Both take `children` and render fixed, non-configurable classNames — no props for width/gap, so a future edit can't silently reintroduce drift. Five existing files swap their inline markup for these two components; none of their internal filter logic changes.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, Jest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-09-22-sidebar-geometry-consistency-design.md`

## Global Constraints

- Aside shell classes are exactly: `flex shrink-0 flex-col gap-6 sm:w-56` (Homepage's values — the source of truth; this is what fixes the `gap-5` drift in `SocialSidebar`).
- Row shell classes are exactly: `flex flex-col gap-6 sm:flex-row`.
- Neither shared component takes a `className`/width/gap override prop — if a page needs different geometry, that is a product decision to raise separately, not a silent per-call override.
- Do not touch the outer page containers (`max-w-[1600px]` etc.) — only the aside and the row wrapper.
- Do not add any identity-toggle, "Anonymous Mode", or new nav-link sidebar — out of scope per the spec's clarified decision.
- No new dependencies (no DOMPurify) unless Task 6's grep actually finds an unescaped-HTML gap.

---

### Task 1: Create `SidebarShell` and `SidebarContentRow`

**Files:**
- Create: `apps/web/src/components/layout/SidebarShell.tsx`
- Test: `apps/web/src/components/layout/__tests__/SidebarShell.test.tsx`

**Interfaces:**
- Produces: `export function SidebarShell({ children }: { children: React.ReactNode })` — renders `<aside className="flex shrink-0 flex-col gap-6 sm:w-56">{children}</aside>`.
- Produces: `export function SidebarContentRow({ children }: { children: React.ReactNode })` — renders `<div className="flex flex-col gap-6 sm:flex-row">{children}</div>`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { SidebarShell, SidebarContentRow } from "../SidebarShell";

it("SidebarShell renders an aside with the locked width/gap classes", () => {
  render(<SidebarShell><p>content</p></SidebarShell>);
  const aside = screen.getByText("content").closest("aside");
  expect(aside).not.toBeNull();
  expect(aside?.className).toBe("flex shrink-0 flex-col gap-6 sm:w-56");
});

it("SidebarContentRow renders a row div with the locked flex classes", () => {
  render(<SidebarContentRow><p>content</p></SidebarContentRow>);
  const row = screen.getByText("content").parentElement;
  expect(row?.className).toBe("flex flex-col gap-6 sm:flex-row");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm exec jest src/components/layout/__tests__/SidebarShell.test.tsx`
Expected: FAIL — cannot find module `../SidebarShell`.

- [ ] **Step 3: Write minimal implementation**

```tsx
import type { ReactNode } from "react";

// Locked geometry, extracted verbatim from the Homepage's WorkplaceBrowser
// aside (the project's geometric source of truth) — no className/width/gap
// prop on purpose, so no call site can silently drift this again the way
// SocialSidebar's gap-5 did.
export function SidebarShell({ children }: { children: ReactNode }) {
  return <aside className="flex shrink-0 flex-col gap-6 sm:w-56">{children}</aside>;
}

export function SidebarContentRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-6 sm:flex-row">{children}</div>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm exec jest src/components/layout/__tests__/SidebarShell.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout/SidebarShell.tsx apps/web/src/components/layout/__tests__/SidebarShell.test.tsx
git commit -m "feat(web): add locked-geometry SidebarShell/SidebarContentRow components"
```

---

### Task 2: Migrate `WorkplaceBrowser` (Homepage) to the shared shells

**Files:**
- Modify: `apps/web/src/components/WorkplaceBrowser.tsx:461-557` (the row + aside wrapper)

**Interfaces:**
- Consumes: `SidebarShell`, `SidebarContentRow` from `@/components/layout/SidebarShell` (Task 1).

- [ ] **Step 1: Write the failing test**

There is no existing test file for `WorkplaceBrowser.tsx`, and this change is a pure markup swap with identical resulting classNames — write a targeted DOM assertion instead of a full new test suite:

```tsx
// Add to a new file: apps/web/src/components/__tests__/WorkplaceBrowser.layout.test.tsx
import { render, screen } from "@testing-library/react";
import { WorkplaceBrowser } from "../WorkplaceBrowser";

jest.mock("@/lib/api-client", () => ({ apiGet: jest.fn(() => Promise.resolve([])) }));

it("renders the Work-Type filter inside a SidebarShell aside", () => {
  render(<WorkplaceBrowser />);
  const heading = screen.getByText("Work-Type");
  const aside = heading.closest("aside");
  expect(aside?.className).toBe("flex shrink-0 flex-col gap-6 sm:w-56");
});
```

- [ ] **Step 2: Run test to verify it fails or passes for the wrong reason**

Run: `cd apps/web && pnpm exec jest src/components/__tests__/WorkplaceBrowser.layout.test.tsx`
Expected: PASS already (the inline classes are already identical) — this test's job is to lock in the current-and-correct behavior *before* the refactor, so Step 4 proves the refactor didn't change it.

- [ ] **Step 3: Swap the inline markup for the shared components**

In `WorkplaceBrowser.tsx`, add the import:

```tsx
import { SidebarShell, SidebarContentRow } from "@/components/layout/SidebarShell";
```

Replace:

```tsx
        <div className="flex flex-col gap-6 sm:flex-row">
          <aside className="flex shrink-0 flex-col gap-6 sm:w-56">
```

with:

```tsx
        <SidebarContentRow>
          <SidebarShell>
```

and replace the matching closing tags:

```tsx
          </aside>

          {/* Results */}
```

with:

```tsx
          </SidebarShell>

          {/* Results */}
```

and, at `WorkplaceBrowser.tsx:680-684` (confirmed by reading the file's end — the Results `<div>` closes first, then the row wrapper, then the outer `max-w-[1600px]` div, then `<AdSlot />` follows):

```tsx
          </div>
        </div>
      </div>

      <AdSlot />
```

with:

```tsx
          </div>
        </SidebarContentRow>
      </div>

      <AdSlot />
```

- [ ] **Step 4: Run test to verify it still passes**

Run: `cd apps/web && pnpm exec jest src/components/__tests__/WorkplaceBrowser.layout.test.tsx`
Expected: PASS — identical className, now sourced from the shared component.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/WorkplaceBrowser.tsx apps/web/src/components/__tests__/WorkplaceBrowser.layout.test.tsx
git commit -m "refactor(web): migrate WorkplaceBrowser to shared SidebarShell/SidebarContentRow"
```

---

### Task 3: Migrate `JobsBrowser` to the shared shells

**Files:**
- Modify: `apps/web/src/components/JobsBrowser.tsx:404-405` and its matching closing tags.

**Interfaces:**
- Consumes: `SidebarShell`, `SidebarContentRow` from `@/components/layout/SidebarShell` (Task 1).

- [ ] **Step 1: Write the failing-for-the-right-reason test**

`JobsBrowser.tsx` doesn't call `useAuth` directly — it calls `useIsCompanyOwner`, `useFollowedCompanies`, and `useSavedJobPostings` (all three internally call `useAuth` from `@/lib/auth-context`), so mocking that one module covers all three:

```tsx
// Add to a new file: apps/web/src/components/__tests__/JobsBrowser.layout.test.tsx
import { render, screen } from "@testing-library/react";
import { JobsBrowser } from "../JobsBrowser";

jest.mock("@/lib/api-client", () => ({ apiGet: jest.fn(() => Promise.resolve([])) }));
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ isAuthenticated: false, role: null, onboardingStatus: null, isLoading: false }),
}));

it("renders the Jobs page sidebar inside a SidebarShell aside", () => {
  render(<JobsBrowser />);
  const heading = screen.getByText("Work-Type");
  const aside = heading.closest("aside");
  expect(aside?.className).toBe("flex shrink-0 flex-col gap-6 sm:w-56");
});
```

- [ ] **Step 2: Run test, confirm current behavior**

Run: `cd apps/web && pnpm exec jest src/components/__tests__/JobsBrowser.layout.test.tsx`
Expected: PASS already (the inline classes are already `gap-6 sm:w-56`) — same "lock in current-and-correct behavior before refactoring" purpose as Task 2's test.

- [ ] **Step 3: Swap the inline markup**

Add the import (alongside the existing `@/components/...` imports at the top of the file):

```tsx
import { SidebarShell, SidebarContentRow } from "@/components/layout/SidebarShell";
```

Replace the opening tags at `JobsBrowser.tsx:404-405`:

```tsx
        <div className="flex flex-col gap-6 sm:flex-row">
          <aside className="flex shrink-0 flex-col gap-6 sm:w-56">
```

with:

```tsx
        <SidebarContentRow>
          <SidebarShell>
```

Replace the closing `</aside>` at `JobsBrowser.tsx:564` (confirmed the only `<aside>...</aside>` pair in this file) with `</SidebarShell>`.

Replace the row's closing `</div>` at `JobsBrowser.tsx:700` (the line directly between the Results panel's closing `</div>` at line 699 and the outer `max-w-[1600px]` div's closing `</div>` at line 701 — confirmed by reading the file's end) with `</SidebarContentRow>`:

```tsx
          </div>
        </div>
      </div>

      {isCompanyOwner && <JobCreationFlow open={jobFlowOpen} onClose={() => setJobFlowOpen(false)} />}
```

becomes:

```tsx
          </div>
        </SidebarContentRow>
      </div>

      {isCompanyOwner && <JobCreationFlow open={jobFlowOpen} onClose={() => setJobFlowOpen(false)} />}
```

- [ ] **Step 4: Run test to verify it still passes**

Run: `cd apps/web && pnpm exec jest src/components/__tests__/JobsBrowser.layout.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/JobsBrowser.tsx apps/web/src/components/__tests__/JobsBrowser.layout.test.tsx
git commit -m "refactor(web): migrate JobsBrowser to shared SidebarShell/SidebarContentRow"
```

---

### Task 4: Migrate `SocialSidebar` (both modes) — fixes the real `gap-5` drift

**Files:**
- Modify: `apps/web/src/components/social/SocialSidebar.tsx:243` (mode="company") and `:262` (mode="global")
- Modify: `apps/web/src/components/social/__tests__/SocialSidebar.test.tsx` (existing tests must keep passing unmodified — this task only changes wrapper markup, not content)

**Interfaces:**
- Consumes: `SidebarShell` from `@/components/layout/SidebarShell` (Task 1).

- [ ] **Step 1: Run the existing test suite to confirm today's baseline**

Run: `cd apps/web && pnpm exec jest src/components/social/__tests__/SocialSidebar.test.tsx`
Expected: PASS (all 6 existing tests) — this is the regression guard; none of them assert on the wrapper's exact className today, so they should keep passing unchanged after Step 2.

- [ ] **Step 2: Swap both `<aside>` wrappers**

Add the import:

```tsx
import { SidebarShell } from "@/components/layout/SidebarShell";
```

Replace (mode="company" branch):

```tsx
      <aside className="flex shrink-0 flex-col gap-5 sm:w-56">
        <SortPills value={props.sort} onChange={props.onSortChange} />
        <SeeThemOn links={props.socialLinks} />
      </aside>
```

with:

```tsx
      <SidebarShell>
        <SortPills value={props.sort} onChange={props.onSortChange} />
        <SeeThemOn links={props.socialLinks} />
      </SidebarShell>
```

Replace (mode="global" branch, the final return):

```tsx
    <aside className="flex shrink-0 flex-col gap-5 sm:w-56">
```

... through its matching closing `</aside>` ... with `<SidebarShell>` / `</SidebarShell>`, keeping every child element between them unchanged.

- [ ] **Step 3: Run the existing test suite again**

Run: `cd apps/web && pnpm exec jest src/components/social/__tests__/SocialSidebar.test.tsx`
Expected: PASS — same 6 tests, unchanged, confirming the wrapper swap didn't touch any filter behavior.

- [ ] **Step 4: Add one new test pinning the corrected gap**

```tsx
// Add to apps/web/src/components/social/__tests__/SocialSidebar.test.tsx
it("uses the locked SidebarShell geometry (gap-6, not the old gap-5)", () => {
  render(<SocialSidebar {...baseProps} isMember={false} />);
  const aside = screen.getByPlaceholderText(/search a company by name/i).closest("aside");
  expect(aside?.className).toBe("flex shrink-0 flex-col gap-6 sm:w-56");
});
```

Run: `cd apps/web && pnpm exec jest src/components/social/__tests__/SocialSidebar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/social/SocialSidebar.tsx apps/web/src/components/social/__tests__/SocialSidebar.test.tsx
git commit -m "fix(web): migrate SocialSidebar to SidebarShell, correcting its gap-5 drift to gap-6"
```

---

### Task 5: Migrate the row wrapper in `SocialShell` and `CompanyProfileTabs`

**Files:**
- Modify: `apps/web/src/components/social/SocialShell.tsx:33`
- Modify: `apps/web/src/components/companies/CompanyProfileTabs.tsx:208`

**Interfaces:**
- Consumes: `SidebarContentRow` from `@/components/layout/SidebarShell` (Task 1).

- [ ] **Step 1: Run existing tests for a baseline**

Run: `cd apps/web && pnpm exec jest src/components/social/__tests__/SocialFeed.test.tsx`
Expected: PASS (existing baseline before touching `SocialShell.tsx`).

- [ ] **Step 2: Swap `SocialShell.tsx`'s row wrapper**

Add the import:

```tsx
import { SidebarContentRow } from "@/components/layout/SidebarShell";
```

Replace:

```tsx
      <div className="flex flex-col gap-6 sm:flex-row">
        <SocialSidebar
```

with:

```tsx
      <SidebarContentRow>
        <SocialSidebar
```

and its matching closing `</div>` (the one right before the final `</>`) with `</SidebarContentRow>`.

- [ ] **Step 3: Swap `CompanyProfileTabs.tsx`'s row wrapper**

Add the import (check the top of the file for existing `@/components/...` imports and place it alongside them):

```tsx
import { SidebarContentRow } from "@/components/layout/SidebarShell";
```

Replace:

```tsx
            <div className="flex flex-col gap-6 sm:flex-row">
              <SocialSidebar
```

with:

```tsx
            <SidebarContentRow>
              <SocialSidebar
```

and its matching closing `</div>` with `</SidebarContentRow>`.

- [ ] **Step 4: Run tests to verify nothing broke**

Run: `cd apps/web && pnpm exec jest src/components/social/__tests__/SocialFeed.test.tsx src/components/social/__tests__/SocialSidebar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/social/SocialShell.tsx apps/web/src/components/companies/CompanyProfileTabs.tsx
git commit -m "refactor(web): migrate SocialShell and CompanyProfileTabs row wrapper to SidebarContentRow"
```

---

### Task 6: XSS verification sweep + live-browser pixel check

**Files:**
- No production code changes expected (verification-only task) unless the grep in Step 1 finds a real gap.

- [ ] **Step 1: Grep the 5 touched files for unescaped-HTML injection points**

Run:

```bash
grep -n "dangerouslySetInnerHTML" apps/web/src/components/WorkplaceBrowser.tsx apps/web/src/components/JobsBrowser.tsx apps/web/src/components/social/SocialSidebar.tsx apps/web/src/components/social/SocialShell.tsx apps/web/src/components/companies/CompanyProfileTabs.tsx apps/web/src/components/layout/SidebarShell.tsx
```

Expected: no matches. If a match is found, stop and report it before continuing — do not add DOMPurify speculatively; confirm there's a real unescaped-HTML sink first, then sanitize that specific value at that specific point.

- [ ] **Step 2: Run the full web typecheck and lint**

Run: `cd packages/shared-types && pnpm exec tsc && cd ../../apps/web && pnpm exec tsc --noEmit && pnpm lint`
Expected: no new errors (pre-existing warnings noted in `AUDIT_REPORT.md` are fine).

- [ ] **Step 3: Run the full web test suite**

Run: `cd apps/web && pnpm exec jest`
Expected: PASS

- [ ] **Step 4: Live-browser pixel comparison**

With both dev servers running (`apps/api` on 3001, `apps/web` on 3000):
1. Navigate to `http://localhost:3000/` (Homepage), screenshot the left sidebar region.
2. Navigate to `http://localhost:3000/social`, screenshot the left sidebar region.
3. Navigate to any `http://localhost:3000/companies/<slug>?tab=social`, screenshot the left sidebar region.
4. Confirm all three show the same left-edge x-position, width, and vertical gap rhythm between filter blocks (visually — this is a design-consistency check, not a pixel-diffing script).
5. Confirm navigating Homepage → IWT Social via the top-bar `IWT Social` link does not visibly flash/remount the top-bar (GlobalHeader) — it was already structurally persistent before this plan; this step just confirms the refactor didn't regress it.

- [ ] **Step 5: Commit (only if Step 1 found and fixed a real gap; otherwise no commit needed for this task)**

```bash
git add -A
git commit -m "fix(web): sanitize <specific finding from Step 1>"
```

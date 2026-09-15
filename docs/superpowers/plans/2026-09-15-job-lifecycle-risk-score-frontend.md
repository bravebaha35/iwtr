# Job Posting Lifecycle & Risk Score — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the frontend UI for the Job Posting Lifecycle & Risk Score feature — job-card bookmarking, a Following/Saved-Posts sidebar on the Jobs page, Risk Score badges, the job-creation work-type picker plus the mandatory Fair-Hiring-Rules disclaimer, and an employer-side job-postings dashboard with the remove/mark-filled confirmation flow — against the already-merged, already-verified backend (`main` at `5f7855f`, plus one small pre-plan backend fix described below).

**Architecture:** 10 tasks, small leaf components/hooks first (Risk Score badge, bookmark icon, a saved-postings hook mirroring the existing `useFollowedCompanies` pattern), then the shared `JobCard` component that consumes them, then the two job-creation modals, then the new owner dashboard page, then the two remaining mount points (company profile page, Jobs page sidebar). Every task is additive or a small localized edit to an existing file — no file is rewritten wholesale.

**Tech Stack:** Next.js App Router (Turbopack), React function components, Tailwind v4 via this app's existing CSS custom properties (no new dependencies), zod-inferred types from `@iwtr/shared-types`.

**Spec:** `docs/superpowers/specs/2026-09-15-job-lifecycle-risk-score-frontend.md`

## Pre-plan backend note (context, not a task in this plan)

Immediately before writing this plan, a real gap was found and closed: `GET me/saved-job-postings` originally returned only `{id, companyId, jobTitle, description, expired}` per row — a bare `companyId` isn't enough to render a `JobCard` (which needs a full `CompanyListItem`: name, slug, banner, rating, etc.) or even link to the company's page. This was fixed on `main` (commit before this plan starts) by widening `savedJobPostingSchema` to `{company: CompanyListItem, posting: {id, jobTitle, description}, expired}` and updating `SavedJobPostingsService.list()` to build the full company shape via a newly-extracted `toPublicCompany` util. This plan's tasks assume that richer shape already exists — do not re-derive or second-guess it.

## Global Constraints

- **Font**: Plus Jakarta Sans is already site-wide. Never introduce a competing `font-family` in any new markup.
- **Dark/light parity**: every new color MUST use this app's existing Tailwind semantic classes tied to CSS custom properties — `text-foreground`, `bg-surface`, `bg-surface-muted`, `border-border`, `text-muted-foreground`, `bg-brand-*`/`text-brand-*`/`border-brand-*`, `text-red-600 dark:text-red-400`, `bg-green-600 hover:bg-green-700 text-white` — never a hardcoded hex value. No new one-off colors.
- **Accessibility / no geographic bias**: nothing in this plan reads or displays a city/region list. Touch targets match this codebase's existing icon-button sizing convention (a `h-4 w-4` SVG inside a padded button/link).
- **Verbatim text — use exactly as written, no paraphrasing:**
  - Disclaimer checkbox label (Task 5): "By publishing this job, you accept our Fair Hiring Rules. To prevent job-board spamming and protect workers from high-turnover roles, posting the exact same position and work-type repeatedly will increase your company's public 'Risk Score' up to a maximum of 3. This score is visible to all workers. You cannot simply post and delete jobs to manipulate the system. Furthermore, all worker applications are anonymous by default; we prioritize direct, bias-free contact by providing only candidate emails and phone numbers."
  - Reshare checkbox label (Task 5): "Re-share automatically after 30 days"
  - Remove-modal header (Task 6): "Are you sure you want to remove this post ?"
  - Remove-modal green action button (Task 6): "Yes, already hired someone."
  - Remove-modal cancel button (Task 6), with the real number substituted: "No, I will wait until my post expires ({daysRemaining} days left)"
  - Saved-Posts sidebar button label (Task 10): "Saved Posts"
- **Backend endpoints this plan consumes (already built, merged, verified — do not re-verify their backend correctness, just use them exactly as shaped):**
  - `GET my-companies/:companyId/job-postings` → `OwnerJobPosting[]` = `{id, companyId, jobTitle, description, workType, status, boostDurationDays, boostExpiresAt, createdAt, daysRemaining}[]`
  - `POST my-companies/:companyId/job-postings/:jobPostingId/mark-filled` → `JobPosting` (soft-delete; body is `{}`)
  - `POST me/saved-job-postings/:jobPostingId` → `SavedJobPostingToggleResult` = `{jobPostingId, saved}` (toggle; body is `{}`)
  - `GET me/saved-job-postings` → `SavedJobPosting[]` = `{company: CompanyListItem, posting: {id, jobTitle, description}, expired}[]`
  - `POST my-companies/:companyId/job-postings` (existing endpoint) — `createJobPostingInputSchema` now has `workType: workplaceTypeSchema.optional()` and `autoReshareEnabled: z.boolean().optional().default(false)`; `CreateJobPostingInput` is a `z.input` type (both genuinely optional at the call site).
  - `Company.riskScore: number` (0-3, always present) already flows through `CompanyListItem`, `Company`, and `CompanyDetail.company` — every place this plan needs it is already on the object with zero extra fetching.
- **No new automated test suite is being invented.** This repo's existing test coverage under `apps/web/src` is real but sparse-by-design — simple/pure files get a co-located test (`WorkTypeLabel.test.tsx`, `useIsCompanyOwner.test.tsx`), complex stateful UI (`JobCard.tsx`, `JobBoostModal.tsx`, `JobSetupModal.tsx`, `JobsBrowser.tsx` today have zero tests despite real complexity) does not. This plan follows that same convention: no new test files invented for genuinely complex/stateful pieces, but any EXISTING test file a task's change would break MUST be fixed in that same task (Task 3 explicitly requires this — see below), and every task ends with `pnpm exec tsc --noEmit` plus a note on what to check in a real browser. A final manual browser verification pass across the whole feature happens after Task 10.

---

### Task 1: RiskScoreBadge + BookmarkIcon components

**Files:**
- Create: `apps/web/src/components/jobs/RiskScoreBadge.tsx`
- Create: `apps/web/src/components/jobs/BookmarkIcon.tsx`

**Interfaces:**
- Produces: `RiskScoreBadge({ riskScore: number })` — renders nothing when `riskScore === 0`. Consumed by Tasks 3 and 9.
- Produces: `BookmarkIcon({ className, filled }: { className?: string; filled?: boolean })`. Consumed by Tasks 3 and 10.

- [ ] **Step 1: Create the Risk Score badge**

```tsx
// apps/web/src/components/jobs/RiskScoreBadge.tsx

// Worker-facing accountability signal: riskScore increments (server-side,
// see JobPostingsService.create) when a company reposts the exact same
// title+workType after marking an earlier identical posting FILLED. A clean
// company (riskScore 0) shows nothing at all — this deliberately avoids
// cluttering every card with "Risk Score: 0/3".
export function RiskScoreBadge({ riskScore }: { riskScore: number }) {
  if (riskScore === 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400"
      title="This company has reposted an identical role after marking a prior posting filled"
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

- [ ] **Step 2: Create the bookmark icon**

```tsx
// apps/web/src/components/jobs/BookmarkIcon.tsx

// Same path SocialSidebar.tsx's own local BookmarkIcon uses, promoted to a
// shared file since this plan needs it in two more places (JobCard.tsx's
// per-posting save button, JobsBrowser.tsx's Saved Posts toggle) — real,
// concrete reuse, not speculative. SocialSidebar.tsx's own copy is
// untouched; that component is outside this feature's scope.
export function BookmarkIcon({ className, filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: no errors (these two files have no consumers yet).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/jobs/RiskScoreBadge.tsx apps/web/src/components/jobs/BookmarkIcon.tsx
git commit -m "feat(web): RiskScoreBadge and shared BookmarkIcon components"
```

---

### Task 2: useSavedJobPostings hook

**Files:**
- Create: `apps/web/src/lib/useSavedJobPostings.ts`

**Interfaces:**
- Consumes: `GET me/saved-job-postings` → `SavedJobPosting[]`, `POST me/saved-job-postings/:jobPostingId` → `SavedJobPostingToggleResult` (both from `apiGet`/`apiPost` in `@/lib/api-client`).
- Produces: `useSavedJobPostings(): { postings: SavedJobPosting[]; savedIds: Set<string>; loading: boolean; canSave: boolean; toggleSave: (jobPostingId: string) => Promise<void> }`. Consumed by Tasks 3 and 10.

- [ ] **Step 1: Create the hook**

```ts
// apps/web/src/lib/useSavedJobPostings.ts
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SavedJobPosting, SavedJobPostingToggleResult } from "@iwtr/shared-types";
import { apiGet, apiPost } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

// Same module-level cache + subscriber pattern as useFollowedCompanies.ts —
// the bookmark icon on every JobCard and the Jobs page's Saved Posts view
// are mounted independently and must stay in sync the instant either one
// toggles a save.
let cache: SavedJobPosting[] | null = null;
let inFlight: Promise<SavedJobPosting[]> | null = null;
const listeners = new Set<() => void>();

function setCache(next: SavedJobPosting[]) {
  cache = next;
  listeners.forEach((l) => l());
}

function load(): Promise<SavedJobPosting[]> {
  if (cache) return Promise.resolve(cache);
  if (!inFlight) {
    inFlight = apiGet<SavedJobPosting[]>("/me/saved-job-postings")
      .then((list) => {
        cache = list;
        return list;
      })
      .catch(() => {
        cache = [];
        return [];
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export function useSavedJobPostings() {
  const { isAuthenticated, role } = useAuth();
  // Owners cannot save postings as a job-seeker — RolesGuard 403s this
  // server-side too (@Roles("MEMBER") on SavedJobPostingsController), same
  // reasoning as useFollowedCompanies' canFollow.
  const canSave = isAuthenticated && role === "MEMBER";
  const [postings, setPostings] = useState<SavedJobPosting[]>(cache ?? []);
  const [loading, setLoading] = useState(() => canSave && cache === null);

  useEffect(() => {
    const listener = () => setPostings(cache ?? []);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!canSave) {
      setCache([]);
      return;
    }
    if (cache) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    load().then((list) => {
      setCache(list);
      setLoading(false);
    });
  }, [canSave]);

  const savedIds = useMemo(() => new Set(postings.map((p) => p.posting.id)), [postings]);

  const toggleSave = useCallback(
    async (jobPostingId: string) => {
      if (!canSave) return;
      const before = cache ?? [];
      const wasSaved = before.some((p) => p.posting.id === jobPostingId);
      // Optimistic removal only — adding a row back in needs the full
      // {company, posting, expired} shape this call's result doesn't carry
      // (POST only returns {jobPostingId, saved}), so a fresh save
      // invalidates the cache and re-fetches instead of guessing a shape.
      if (wasSaved) {
        setCache(before.filter((p) => p.posting.id !== jobPostingId));
      }
      try {
        const result = await apiPost<SavedJobPostingToggleResult>(`/me/saved-job-postings/${jobPostingId}`, {});
        if (result.saved) {
          cache = null;
          setCache(await load());
        }
      } catch {
        if (wasSaved) setCache(before);
      }
    },
    [canSave],
  );

  return { postings, savedIds, loading, canSave, toggleSave };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/useSavedJobPostings.ts
git commit -m "feat(web): useSavedJobPostings hook, mirrors useFollowedCompanies"
```

---

### Task 3: JobCard.tsx — bookmark button, expired styling, Risk Score badge

**Files:**
- Modify: `apps/web/src/components/jobs/JobCard.tsx`
- Modify: `apps/web/src/components/companies/__tests__/CompanyJobPostings.test.tsx`

**Interfaces:**
- Consumes: `RiskScoreBadge`, `BookmarkIcon` (Task 1), `useSavedJobPostings` (Task 2).
- Produces: `CardPosting` now includes an optional `id?: string`; `JobCard` now accepts an optional `expired?: boolean` prop (default `false`). Consumed by Task 10 (`JobsBrowser.tsx`, both reads `CardPosting.id` and passes `expired`).

**Important — this task WILL break an existing test if not fixed in the same task:** `JobCard` will now call `useSavedJobPostings()`, which calls `useAuth()` — and `useAuth()` throws `"useAuth must be used within AuthProvider"` when rendered without an `AuthProvider` ancestor. `apps/web/src/components/companies/__tests__/CompanyJobPostings.test.tsx` renders `CompanyJobPostings` (which renders `JobCard`) with no provider and no existing mock for this, so all 5 of its tests will crash once this task's `JobCard` change lands. Fix it the same way `SocialSidebar.test.tsx` already handles the identical situation for `useFollowedCompanies` — mock the hook module directly, never touch `auth-context.tsx` itself.

- [ ] **Step 1: Add the new imports to JobCard.tsx**

At the top of `apps/web/src/components/jobs/JobCard.tsx`, change:

```tsx
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { type CompanyListItem, type CompanyVibeFlags, type VibeFlag } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { scoreTextColor } from "@/lib/scoreBandColors";
import { WorkTypeLabel } from "@/components/WorkTypeLabel";
import { canUseBanner } from "@/lib/pricingTiers";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CompanyVerificationTick } from "@/components/CompanyVerificationTick";
```

to:

```tsx
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { type CompanyListItem, type CompanyVibeFlags, type VibeFlag } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { scoreTextColor } from "@/lib/scoreBandColors";
import { WorkTypeLabel } from "@/components/WorkTypeLabel";
import { canUseBanner } from "@/lib/pricingTiers";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CompanyVerificationTick } from "@/components/CompanyVerificationTick";
import { RiskScoreBadge } from "@/components/jobs/RiskScoreBadge";
import { BookmarkIcon } from "@/components/jobs/BookmarkIcon";
import { useSavedJobPostings } from "@/lib/useSavedJobPostings";
```

- [ ] **Step 2: Widen CardPosting and postingsForCard to carry a posting id**

Change:

```tsx
export type CardPosting = { jobTitle: string; description: string | null } | null;

export function postingsForCard(company: CompanyListItem): CardPosting[] {
  if (company.jobPostings.length > 0) {
    return company.jobPostings.map((p) => ({ jobTitle: p.jobTitle, description: p.description }));
  }
  if (company.jobTitles.length > 0) {
    // Auto-classified titles have no owner-authored description to show.
    return company.jobTitles.map((title) => ({ jobTitle: title, description: null }));
  }
  return [null];
}
```

to:

```tsx
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

- [ ] **Step 3: Add the expired prop, hook usage, and root-div inert styling**

Change:

```tsx
export function JobCard({ company, posting }: { company: CompanyListItem; posting: CardPosting }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const location = [company.district, company.city].filter(Boolean).join(", ");
  // Every job card shows a banner: the owner's own image when their tier
  // includes custom banners and one is set, otherwise the system default.
  // A default banner on an unclaimed company renders greyscale.
  const hasCustomBanner = canUseBanner(company.badgeTier) && !!company.bannerImageUrl;
  const bannerUrl = hasCustomBanner ? company.bannerImageUrl! : company.defaultBannerUrl;
  const bannerIsGreyscale = !hasCustomBanner && !company.hasApprovedOwner;

  return (
    // No overflow-hidden here (unlike a typical image-topped card) — the "i"
    // button's flag dropdown and the contact popovers are absolutely
    // positioned to spill outside this box, and clipping it would make them
    // invisible.
    <div className="flex flex-col rounded-xl border border-border bg-surface transition hover:border-brand-300 dark:hover:border-brand-700">
```

to:

```tsx
export function JobCard({
  company,
  posting,
  expired = false,
}: {
  company: CompanyListItem;
  posting: CardPosting;
  // True only inside the Saved Posts view, for a posting that's expired or
  // been marked filled. Defaults false everywhere else this card renders
  // (the public browse grid and the company profile tab are unaffected).
  expired?: boolean;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const { savedIds, canSave, toggleSave } = useSavedJobPostings();
  const location = [company.district, company.city].filter(Boolean).join(", ");
  // Every job card shows a banner: the owner's own image when their tier
  // includes custom banners and one is set, otherwise the system default.
  // A default banner on an unclaimed company renders greyscale.
  const hasCustomBanner = canUseBanner(company.badgeTier) && !!company.bannerImageUrl;
  const bannerUrl = hasCustomBanner ? company.bannerImageUrl! : company.defaultBannerUrl;
  const bannerIsGreyscale = !hasCustomBanner && !company.hasApprovedOwner;
  const isSaved = posting?.id ? savedIds.has(posting.id) : false;

  return (
    // No overflow-hidden here (unlike a typical image-topped card) — the "i"
    // button's flag dropdown and the contact popovers are absolutely
    // positioned to spill outside this box, and clipping it would make them
    // invisible. expired greys the whole card and makes it inert in one
    // shot — pointer-events-none on this root cascades to every descendant
    // (Link, ContactButton, the bookmark button), no per-element disabled
    // prop needed.
    <div
      aria-disabled={expired}
      className={`flex flex-col rounded-xl border border-border bg-surface transition hover:border-brand-300 dark:hover:border-brand-700 ${expired ? "pointer-events-none opacity-50" : ""}`}
    >
```

- [ ] **Step 4: Make the content box relative and add the bookmark button**

Change:

```tsx
      <div className="flex aspect-square flex-col rounded-b-xl p-4 pt-5 compact:p-3">
```

to:

```tsx
      <div className="relative flex aspect-square flex-col rounded-b-xl p-4 pt-5 compact:p-3">
```

Then, further down in that same content box, change:

```tsx
        {posting?.description && (
          <p className="mt-3 flex-1 overflow-y-auto whitespace-pre-wrap text-xs text-muted-foreground">
            {posting.description}
          </p>
        )}
      </div>
```

to:

```tsx
        {posting?.description && (
          <p className="mt-3 flex-1 overflow-y-auto whitespace-pre-wrap text-xs text-muted-foreground">
            {posting.description}
          </p>
        )}

        {/* Only a real, individually-authored posting can be saved — the
            auto-classified jobTitles fallback has no posting.id. Only shown
            once logged in as a worker, same as vote buttons elsewhere in
            this codebase (prompt happens on click via canSave, never hides
            the icon outright for an anonymous viewer). */}
        {posting?.id && canSave && (
          <button
            type="button"
            onClick={() => toggleSave(posting.id!)}
            aria-label={isSaved ? "Remove from saved posts" : "Save this posting"}
            aria-pressed={isSaved}
            className="absolute bottom-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-surface/90 text-muted-foreground shadow transition hover:text-brand-600 dark:hover:text-brand-400"
          >
            <BookmarkIcon className="h-4 w-4" filled={isSaved} />
          </button>
        )}
      </div>
```

- [ ] **Step 5: Mount the Risk Score badge in the footer**

Change:

```tsx
      <div className="border-t border-border px-3 py-2 compact:px-2 compact:py-1.5">
        <p className="truncate text-xs text-muted-foreground">
          <WorkTypeLabel workplaceTypes={company.workplaceTypes} />
          {company.isChainStore ? " · Chain store" : ""}
          {" · "}
          {company.reviewCount} review{company.reviewCount === 1 ? "" : "s"}
        </p>
      </div>
```

to:

```tsx
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

- [ ] **Step 6: Fix CompanyJobPostings.test.tsx so it doesn't crash on the new useAuth call**

In `apps/web/src/components/companies/__tests__/CompanyJobPostings.test.tsx`, change:

```tsx
jest.mock("@/lib/api-client");
```

to:

```tsx
jest.mock("@/lib/api-client");
jest.mock("@/lib/useSavedJobPostings", () => ({
  useSavedJobPostings: () => ({ savedIds: new Set(), canSave: false, toggleSave: jest.fn() }),
}));
```

- [ ] **Step 7: Run the existing test and typecheck**

Run: `cd apps/web && pnpm exec jest src/components/companies/__tests__/CompanyJobPostings.test.tsx`
Expected: all 5 tests pass (this is the regression check the new mock in Step 6 exists for).

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/jobs/JobCard.tsx apps/web/src/components/companies/__tests__/CompanyJobPostings.test.tsx
git commit -m "feat(web): JobCard bookmark button, expired styling, Risk Score badge"
```

---

### Task 4: JobSetupModal.tsx — work-type picker

**Files:**
- Modify: `apps/web/src/components/jobs/JobSetupModal.tsx`

**Interfaces:**
- Produces: `JobSetupData` gains a required `workType: WorkplaceType` field. Consumed by Task 5 (`JobBoostModal.tsx` reads `setupData.workType`).

- [ ] **Step 1: Add the WorkplaceType import and widen JobSetupData**

Change:

```tsx
import { useEffect, useState } from "react";
import type { CompanyDetail, OwnedCompany } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { SingleSelectDropdown } from "@/components/Dropdown";

const DESCRIPTION_MAX_LENGTH = 600;

export interface JobSetupData {
  jobTitle: string;
  description: string;
}
```

to:

```tsx
import { useEffect, useState } from "react";
import type { CompanyDetail, OwnedCompany, WorkplaceType } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { SingleSelectDropdown } from "@/components/Dropdown";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";

const DESCRIPTION_MAX_LENGTH = 600;

export interface JobSetupData {
  jobTitle: string;
  description: string;
  workType: WorkplaceType;
}
```

- [ ] **Step 2: Auto-pick the work type when the company has exactly one, and add local state**

Change:

```tsx
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [jobTitle, setJobTitle] = useState<string | null>(null);
  const [description, setDescription] = useState("");

  useEffect(() => {
    apiGet<CompanyDetail>(`/companies/${company.companySlug}`)
      .then(setDetail)
      .catch(() => setDetail(null));
    apiGet<string[]>(`/companies/${company.companySlug}/job-title-suggestions`)
      .then(setSuggestions)
      .catch(() => setSuggestions([]));
  }, [company.companySlug]);

  const canContinue = Boolean(jobTitle) && description.trim().length > 0;
```

to:

```tsx
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [jobTitle, setJobTitle] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [workType, setWorkType] = useState<WorkplaceType | null>(null);

  useEffect(() => {
    apiGet<CompanyDetail>(`/companies/${company.companySlug}`)
      .then((d) => {
        setDetail(d);
        // Zero added friction for the common case: a single-work-type
        // company never sees this control at all (see the conditional
        // render below). A multi-type company must pick explicitly — see
        // the frontend spec's decision 4.
        if (d.company.workplaceTypes.length === 1) {
          setWorkType(d.company.workplaceTypes[0]);
        }
      })
      .catch(() => setDetail(null));
    apiGet<string[]>(`/companies/${company.companySlug}/job-title-suggestions`)
      .then(setSuggestions)
      .catch(() => setSuggestions([]));
  }, [company.companySlug]);

  const canContinue = Boolean(jobTitle) && description.trim().length > 0 && workType !== null;
```

- [ ] **Step 3: Render the picker only when the company has more than one work type**

Change:

```tsx
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">What are you looking for?</span>
          <SingleSelectDropdown
            value={jobTitle}
            onChange={setJobTitle}
            options={suggestions.map((title) => ({ value: title, label: title }))}
            placeholder={suggestions.length === 0 ? "Loading..." : "Choose a job title"}
            disabled={suggestions.length === 0}
          />
        </label>
```

to:

```tsx
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">What are you looking for?</span>
          <SingleSelectDropdown
            value={jobTitle}
            onChange={setJobTitle}
            options={suggestions.map((title) => ({ value: title, label: title }))}
            placeholder={suggestions.length === 0 ? "Loading..." : "Choose a job title"}
            disabled={suggestions.length === 0}
          />
        </label>

        {detail && detail.company.workplaceTypes.length > 1 && (
          <label className="mb-4 block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Which type of role is this?</span>
            <SingleSelectDropdown
              value={workType}
              onChange={(v) => setWorkType(v as WorkplaceType | null)}
              options={detail.company.workplaceTypes.map((t) => ({ value: t, label: workplaceTypeLabel(t) }))}
              placeholder="Choose a work type"
            />
          </label>
        )}
```

- [ ] **Step 4: Pass workType through on Continue**

Change:

```tsx
        <button
          type="button"
          disabled={!canContinue}
          onClick={() => jobTitle && onContinue({ jobTitle, description: description.trim() })}
          className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          Continue
        </button>
```

to:

```tsx
        <button
          type="button"
          disabled={!canContinue}
          onClick={() => jobTitle && workType && onContinue({ jobTitle, description: description.trim(), workType })}
          className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          Continue
        </button>
```

- [ ] **Step 5: Typecheck**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: errors in `JobBoostModal.tsx` and `JobCreationFlow.tsx` are expected at this point (they construct/pass `JobSetupData` and don't yet supply `workType` end-to-end) — Task 5 resolves the remaining one. Confirm the errors are only about the now-wider `JobSetupData` shape, nothing else.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/jobs/JobSetupModal.tsx
git commit -m "feat(web): required work-type picker in job-creation Setup modal"
```

---

### Task 5: JobBoostModal.tsx — disclaimer + reshare checkboxes

**Files:**
- Modify: `apps/web/src/components/jobs/JobBoostModal.tsx`

**Interfaces:**
- Consumes: `JobSetupData.workType` (Task 4).

- [ ] **Step 1: Add checkbox state**

Change:

```tsx
  const [status, setStatus] = useState<JobPostingBoostStatus | null>(null);
  const [selected, setSelected] = useState<BoostDurationDays | null>(null);
  const [billing, setBilling] = useState(emptyBilling);
  const [showPricing, setShowPricing] = useState(false);
  const [result, setResult] = useState<CreateJobPostingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
```

to:

```tsx
  const [status, setStatus] = useState<JobPostingBoostStatus | null>(null);
  const [selected, setSelected] = useState<BoostDurationDays | null>(null);
  const [billing, setBilling] = useState(emptyBilling);
  const [showPricing, setShowPricing] = useState(false);
  const [result, setResult] = useState<CreateJobPostingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);
  const [autoReshareEnabled, setAutoReshareEnabled] = useState(false);
```

- [ ] **Step 2: Include workType and autoReshareEnabled in the create body**

Change:

```tsx
      const body: CreateJobPostingInput = { jobTitle: setupData.jobTitle, description: setupData.description, boost };
```

to:

```tsx
      const body: CreateJobPostingInput = {
        jobTitle: setupData.jobTitle,
        description: setupData.description,
        workType: setupData.workType,
        autoReshareEnabled,
        boost,
      };
```

- [ ] **Step 3: Add the two checkboxes directly above the Publish/Finish button, and gate it on the disclaimer**

Change:

```tsx
            {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="mt-6 w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting ? "Please wait..." : selected ? "Finish" : "Continue without boost"}
            </button>
```

to:

```tsx
            {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

            <label className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={disclaimerChecked}
                onChange={(e) => setDisclaimerChecked(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                By publishing this job, you accept our Fair Hiring Rules. To prevent job-board spamming and protect
                workers from high-turnover roles, posting the exact same position and work-type repeatedly will
                increase your company&apos;s public &apos;Risk Score&apos; up to a maximum of 3. This score is
                visible to all workers. You cannot simply post and delete jobs to manipulate the system.
                Furthermore, all worker applications are anonymous by default; we prioritize direct, bias-free
                contact by providing only candidate emails and phone numbers.
              </span>
            </label>

            <label className="mt-2 flex items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={autoReshareEnabled}
                onChange={(e) => setAutoReshareEnabled(e.target.checked)}
              />
              Re-share automatically after 30 days
            </label>

            <button
              type="button"
              onClick={submit}
              disabled={submitting || !disclaimerChecked}
              className="mt-4 w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting ? "Please wait..." : selected ? "Finish" : "Continue without boost"}
            </button>
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: no errors — this was the remaining half of Task 4's expected transient errors; both should be clear now.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/jobs/JobBoostModal.tsx
git commit -m "feat(web): Fair Hiring Rules disclaimer and auto-reshare checkbox in job Boost modal"
```

---

### Task 6: RemoveJobPostingModal + OwnerJobPostingRow

**Files:**
- Create: `apps/web/src/components/jobs/RemoveJobPostingModal.tsx`
- Create: `apps/web/src/components/jobs/OwnerJobPostingRow.tsx`

**Interfaces:**
- Produces: `RemoveJobPostingModal({companyId, jobPostingId, jobTitle, daysRemaining, onClose, onRemoved})`; `OwnerJobPostingRow({companyId, posting: OwnerJobPosting, onChanged})`. Both consumed by Task 7.

- [ ] **Step 1: Create the confirmation modal**

```tsx
// apps/web/src/components/jobs/RemoveJobPostingModal.tsx
"use client";

import { useState } from "react";
import { apiPost, ApiError } from "@/lib/api-client";

export function RemoveJobPostingModal({
  companyId,
  jobPostingId,
  jobTitle,
  daysRemaining,
  onClose,
  onRemoved,
}: {
  companyId: string;
  jobPostingId: string;
  jobTitle: string;
  daysRemaining: number;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmFilled() {
    setSubmitting(true);
    setError(null);
    try {
      await apiPost(`/my-companies/${companyId}/job-postings/${jobPostingId}/mark-filled`, {});
      onRemoved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove this posting.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Remove posting: ${jobTitle}`}
        className="w-full max-w-sm rounded-xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-sm font-semibold text-foreground">Are you sure you want to remove this post ?</h3>
        <p className="mb-4 text-xs text-muted-foreground">{jobTitle}</p>
        {error && <p className="mb-3 text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={confirmFilled}
            disabled={submitting}
            className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            Yes, already hired someone.
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            No, I will wait until my post expires ({daysRemaining} days left)
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the owner-facing row**

```tsx
// apps/web/src/components/jobs/OwnerJobPostingRow.tsx
"use client";

import { useState } from "react";
import type { OwnerJobPosting } from "@iwtr/shared-types";
import { RemoveJobPostingModal } from "@/components/jobs/RemoveJobPostingModal";

const STATUS_LABEL: Record<OwnerJobPosting["status"], string> = {
  PUBLISHED: "Live",
  PENDING_ADMIN: "Awaiting admin review",
  REJECTED: "Rejected",
  FILLED: "Filled",
};

// Owner-oriented, not the public JobCard — an owner looking at their own
// listing has no use for JobCard's "contact this company" framing, so this
// is a distinct, simpler row rather than forcing JobCard to serve two
// purposes (per the frontend spec's own section 3).
export function OwnerJobPostingRow({
  companyId,
  posting,
  onChanged,
}: {
  companyId: string;
  posting: OwnerJobPosting;
  onChanged: () => void;
}) {
  const [removing, setRemoving] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{posting.jobTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {STATUS_LABEL[posting.status]}
            {posting.status === "PUBLISHED"
              ? ` — ${posting.daysRemaining} day${posting.daysRemaining === 1 ? "" : "s"} left`
              : ""}
          </p>
        </div>
        {posting.status === "PUBLISHED" && (
          <button
            type="button"
            onClick={() => setRemoving(true)}
            className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
          >
            Remove
          </button>
        )}
      </div>
      {posting.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{posting.description}</p>}
      {removing && (
        <RemoveJobPostingModal
          companyId={companyId}
          jobPostingId={posting.id}
          jobTitle={posting.jobTitle}
          daysRemaining={posting.daysRemaining}
          onClose={() => setRemoving(false)}
          onRemoved={() => {
            setRemoving(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/jobs/RemoveJobPostingModal.tsx apps/web/src/components/jobs/OwnerJobPostingRow.tsx
git commit -m "feat(web): remove/mark-filled confirmation modal and owner job-posting row"
```

---

### Task 7: Owner job-postings dashboard page

**Files:**
- Create: `apps/web/src/app/my/companies/[companyId]/job-postings/page.tsx`
- Create: `apps/web/src/components/jobs/OwnerJobPostingsView.tsx`

**Interfaces:**
- Consumes: `OwnerJobPostingRow` (Task 6), `GET my-companies/:companyId/job-postings`.
- Produces: the route `/my/companies/:companyId/job-postings`. Consumed by Task 8's nav link.

This app's App Router convention for a dynamic segment is an `async` Server Component that awaits `params` (a `Promise` under this Next.js version — see `app/companies/[slug]/page.tsx:160-166` for the exact precedent) and hands the resolved value to a client component that owns the actual data-fetching/interactivity — matching how that same file hands data to `CompanyProfileTabs`/`CompanyJobPostings`.

- [ ] **Step 1: Create the thin server page**

```tsx
// apps/web/src/app/my/companies/[companyId]/job-postings/page.tsx
import { OwnerJobPostingsView } from "@/components/jobs/OwnerJobPostingsView";

export default async function OwnerJobPostingsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  return <OwnerJobPostingsView companyId={companyId} />;
}
```

- [ ] **Step 2: Create the client view**

```tsx
// apps/web/src/components/jobs/OwnerJobPostingsView.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { OwnerJobPosting } from "@iwtr/shared-types";
import { useAuth } from "@/lib/auth-context";
import { apiGet, ApiError } from "@/lib/api-client";
import { OwnerJobPostingRow } from "@/components/jobs/OwnerJobPostingRow";

export function OwnerJobPostingsView({ companyId }: { companyId: string }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [postings, setPostings] = useState<OwnerJobPosting[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<OwnerJobPosting[]>(`/my-companies/${companyId}/job-postings`);
      setPostings(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load job postings.");
    }
  }, [companyId]);

  useEffect(() => {
    if (isAuthenticated) void load();
  }, [isAuthenticated, load]);

  if (authLoading) return null;

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Log in to see this company&apos;s job postings.</p>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <Link
          href="/my/companies"
          className="mb-4 inline-block text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          ← Back to My companies
        </Link>
        <h1 className="mb-1 text-2xl font-bold text-foreground">Job postings</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Every posting you&apos;ve ever made for this company, including expired and removed ones for 30 more days.
        </p>

        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {postings === null && !error && <p className="text-sm text-muted-foreground">Loading...</p>}
        {postings !== null && postings.length === 0 && (
          <p className="text-sm text-muted-foreground">No job postings yet.</p>
        )}

        <div className="flex flex-col gap-3">
          {postings?.map((p) => (
            <OwnerJobPostingRow key={p.id} companyId={companyId} posting={p} onChanged={load} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/my/companies/[companyId]/job-postings/page.tsx" apps/web/src/components/jobs/OwnerJobPostingsView.tsx
git commit -m "feat(web): owner job-postings dashboard page"
```

---

### Task 8: Wire the dashboard link into OwnerDashboardSidePanel

**Files:**
- Modify: `apps/web/src/components/owner/OwnerDashboardSidePanel.tsx`
- Modify: `apps/web/src/app/my/companies/page.tsx`

**Interfaces:**
- Consumes: the route from Task 7.

- [ ] **Step 1: Add a jobPostingsHref prop and render it as a real link alongside the existing tab buttons**

Replace the full contents of `apps/web/src/components/owner/OwnerDashboardSidePanel.tsx` with:

```tsx
"use client";

import Link from "next/link";

export type OwnerDashboardCategory = "general-info" | "premium-features" | "contact-social" | "reviews-ratings";

const CATEGORIES: { key: OwnerDashboardCategory; label: string }[] = [
  { key: "general-info", label: "General Information" },
  { key: "premium-features", label: "Premium Features" },
  { key: "contact-social", label: "Contact & Social Media" },
  { key: "reviews-ratings", label: "Reviews & Ratings" },
];

const NAV_ITEM_CLASS =
  "whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition text-muted-foreground hover:bg-surface-muted hover:text-foreground";
const NAV_ITEM_ACTIVE_CLASS =
  "whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition bg-brand-600 text-white";

/**
 * Left-side vertical nav on desktop, sticky horizontal tab bar on mobile —
 * the 4 fixed categories every approved-owner company card is organized
 * under (see sections/*.tsx), plus a real link to the Job Postings
 * dashboard (a separate route, not a locally-switched category — see
 * OwnerJobPostingsView.tsx). Purely a controlled tab switcher for the first
 * 4; every field and save action still lives in the category components
 * themselves.
 */
export function OwnerDashboardSidePanel({
  active,
  onChange,
  jobPostingsHref,
}: {
  active: OwnerDashboardCategory;
  onChange: (category: OwnerDashboardCategory) => void;
  jobPostingsHref: string;
}) {
  return (
    // Bare nav — no wrapping border/background box, matching /me's Edit
    // Profile sidebar (apps/web/src/app/me/page.tsx) — this is what makes it
    // read as a standalone sidebar next to the content instead of a tab
    // strip attached to it.
    <nav
      aria-label="Company dashboard sections"
      className="flex shrink-0 flex-row gap-1 overflow-x-auto sm:w-56 sm:flex-col sm:overflow-visible"
    >
      {CATEGORIES.map((c) => {
        const isActive = c.key === active;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(c.key)}
            aria-current={isActive ? "page" : undefined}
            className={isActive ? NAV_ITEM_ACTIVE_CLASS : NAV_ITEM_CLASS}
          >
            {c.label}
          </button>
        );
      })}
      <Link href={jobPostingsHref} className={NAV_ITEM_CLASS}>
        Job Postings
      </Link>
    </nav>
  );
}
```

- [ ] **Step 2: Pass the new prop at the call site**

In `apps/web/src/app/my/companies/page.tsx`, change:

```tsx
        <OwnerDashboardSidePanel active={activeCategory} onChange={setActiveCategory} />
```

to:

```tsx
        <OwnerDashboardSidePanel
          active={activeCategory}
          onChange={setActiveCategory}
          jobPostingsHref={`/my/companies/${claim.companyId}/job-postings`}
        />
```

- [ ] **Step 3: Run the existing test and typecheck**

Run: `cd apps/web && pnpm exec jest src/app/my/companies/__tests__/page.test.tsx`
Expected: still passes — this task doesn't change `OwnedCompanyCard`'s own rendered output in any way the test asserts on, only adds a new nav item.

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/owner/OwnerDashboardSidePanel.tsx apps/web/src/app/my/companies/page.tsx
git commit -m "feat(web): link the Job Postings dashboard from the owner side panel"
```

---

### Task 9: Company profile page — Risk Score badge

**Files:**
- Modify: `apps/web/src/app/companies/[slug]/page.tsx`

**Interfaces:**
- Consumes: `RiskScoreBadge` (Task 1).

- [ ] **Step 1: Import RiskScoreBadge**

Change:

```tsx
import { CompanyVerificationTick } from "@/components/CompanyVerificationTick";
```

to:

```tsx
import { CompanyVerificationTick } from "@/components/CompanyVerificationTick";
import { RiskScoreBadge } from "@/components/jobs/RiskScoreBadge";
```

- [ ] **Step 2: Mount it next to the category/work-type/city line, near the verification tick**

Change:

```tsx
              <p className="text-sm text-muted-foreground">
                {company.category} · <WorkTypeLabel workplaceTypes={company.workplaceTypes} />
                {company.city ? ` · ${company.city}` : ""}
              </p>
            </div>
          </div>
          <RateButton
```

to:

```tsx
              <p className="text-sm text-muted-foreground">
                {company.category} · <WorkTypeLabel workplaceTypes={company.workplaceTypes} />
                {company.city ? ` · ${company.city}` : ""}
              </p>
              <div className="mt-1">
                <RiskScoreBadge riskScore={company.riskScore} />
              </div>
            </div>
          </div>
          <RateButton
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/companies/[slug]/page.tsx"
git commit -m "feat(web): Risk Score badge on the company profile page"
```

---

### Task 10: JobsBrowser.tsx — Following + Saved Posts sidebar, company filter, bookmark-aware rendering

**Files:**
- Modify: `apps/web/src/components/JobsBrowser.tsx`

**Interfaces:**
- Consumes: `useFollowedCompanies` (existing), `useSavedJobPostings` (Task 2), `BookmarkIcon` (Task 1), `JobCard`'s `expired` prop and `CardPosting.id` (Task 3).

- [ ] **Step 1: Add the new imports**

Change:

```tsx
import { JobCard, postingsForCard } from "@/components/jobs/JobCard";
import { JobCreationFlow } from "@/components/jobs/JobCreationFlow";
import { distanceKm, findProvinceByCityName } from "@/lib/turkeyGeo";
```

to:

```tsx
import { JobCard, postingsForCard } from "@/components/jobs/JobCard";
import { JobCreationFlow } from "@/components/jobs/JobCreationFlow";
import { distanceKm, findProvinceByCityName } from "@/lib/turkeyGeo";
import { useFollowedCompanies } from "@/lib/useFollowedCompanies";
import { useSavedJobPostings } from "@/lib/useSavedJobPostings";
import { BookmarkIcon } from "@/components/jobs/BookmarkIcon";
```

- [ ] **Step 2: Add a FollowingFilterList helper, right before `export function JobsBrowser()`**

Insert immediately above `export function JobsBrowser() {`:

```tsx
// Same data source as SocialSidebar's FollowingList (useFollowedCompanies),
// but a single-select CLIENT-SIDE FILTER instead of navigation — clicking a
// name narrows the results grid to that one company; clicking the same name
// again clears the filter and restores the unfiltered view. Not shared with
// SocialSidebar's version since the click behavior is genuinely different,
// matching this file's own standing near-duplicate policy (see the
// file-header comment above).
function FollowingFilterList({
  selectedCompanyId,
  onSelect,
}: {
  selectedCompanyId: string | null;
  onSelect: (companyId: string | null) => void;
}) {
  const { companies, loading } = useFollowedCompanies();

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Following</h3>
      <div className="flex h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-1.5">
        {loading && <p className="p-1.5 text-xs text-muted-foreground">Loading...</p>}
        {!loading && companies.length === 0 && (
          <p className="p-1.5 text-xs text-muted-foreground">You&apos;re not following any companies yet.</p>
        )}
        {companies.map((c) => (
          <button
            key={c.companyId}
            type="button"
            onClick={() => onSelect(selectedCompanyId === c.companyId ? null : c.companyId)}
            aria-pressed={selectedCompanyId === c.companyId}
            className={`truncate rounded-md px-1.5 py-1 text-left text-sm transition ${
              selectedCompanyId === c.companyId
                ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                : "text-foreground hover:bg-surface-muted"
            }`}
          >
            {c.companyName}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add the new state**

Change:

```tsx
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [page, setPage] = useState(1);
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const resultsTopRef = useRef<HTMLDivElement>(null);
```

to:

```tsx
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [page, setPage] = useState(1);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [savedView, setSavedView] = useState(false);
  const { postings: savedPostings, loading: savedLoading, canSave } = useSavedJobPostings();
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const resultsTopRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 4: Apply the company filter inside visibleCompanies**

Change:

```tsx
  const visibleCompanies = useMemo(() => {
    if (!companies) return null;
    let list = selectedCategory ? companies.filter((c) => c.category === selectedCategory) : companies;
    list = list.filter((c) => matchesCategoryGroup(c, categoryGroup));
```

to:

```tsx
  const visibleCompanies = useMemo(() => {
    if (!companies) return null;
    let list = selectedCompanyId ? companies.filter((c) => c.id === selectedCompanyId) : companies;
    list = selectedCategory ? list.filter((c) => c.category === selectedCategory) : list;
    list = list.filter((c) => matchesCategoryGroup(c, categoryGroup));
```

And at the end of that same `useMemo`, change its dependency array from:

```tsx
  }, [companies, selectedCategory, categoryGroup, geo, sortBy]);
```

to:

```tsx
  }, [companies, selectedCompanyId, selectedCategory, categoryGroup, geo, sortBy]);
```

- [ ] **Step 5: Reset to page 1 when the company filter changes**

Change:

```tsx
  useEffect(() => {
    setPage(1);
  }, [workplaceTypes, selectedCategory, categoryGroup, minRating, selectedCities, selectedDistrictKeys, sortBy, query]);
```

to:

```tsx
  useEffect(() => {
    setPage(1);
  }, [
    workplaceTypes,
    selectedCategory,
    categoryGroup,
    minRating,
    selectedCities,
    selectedDistrictKeys,
    sortBy,
    query,
    selectedCompanyId,
  ]);
```

- [ ] **Step 6: Add Following + Saved Posts to the top of the sidebar**

Change:

```tsx
          <aside className="flex shrink-0 flex-col gap-6 sm:w-56">
            <div>
              <MultiFilterPillGroup
                heading="Work-Type"
```

to:

```tsx
          <aside className="flex shrink-0 flex-col gap-6 sm:w-56">
            {canSave && (
              <>
                <FollowingFilterList selectedCompanyId={selectedCompanyId} onSelect={setSelectedCompanyId} />
                <button
                  type="button"
                  onClick={() => setSavedView((v) => !v)}
                  aria-pressed={savedView}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition ${
                    savedView
                      ? "border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-950 dark:text-brand-300"
                      : "border-border text-foreground hover:bg-surface-muted"
                  }`}
                >
                  <BookmarkIcon className="h-4 w-4" />
                  Saved Posts
                </button>
              </>
            )}
            <div>
              <MultiFilterPillGroup
                heading="Work-Type"
```

- [ ] **Step 7: Branch the results area on savedView**

Change:

```tsx
            {pageCompanies === null && <p className="text-sm text-muted-foreground">Loading...</p>}
            {pageCompanies !== null && pageCompanies.length === 0 && loadError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                Couldn&apos;t load workplaces right now — check your connection and try again.
              </p>
            )}
            {pageCompanies !== null && pageCompanies.length === 0 && !loadError && (
              <p className="text-sm text-muted-foreground">
                No companies are looking for people under these filters yet.
              </p>
            )}
            {/* One card per job (see postingsForCard) — a company with N
                open postings renders N cards here, not one crowded card. */}
            <div className="grid grid-cols-1 gap-4 compact:gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {pageCompanies?.flatMap((c) =>
                postingsForCard(c).map((posting, i) => (
                  <JobCard key={`${c.id}-${posting?.jobTitle ?? "none"}-${i}`} company={c} posting={posting} />
                )),
              )}
            </div>

            {visibleCompanies !== null && visibleCompanies.length > 0 && (
              <>
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Page {page} of {totalPages} — {visibleCompanies.length} compan
                  {visibleCompanies.length === 1 ? "y" : "ies"} hiring
                </p>
                <PaginationBar page={page} totalPages={totalPages} onChange={goToPage} />
              </>
            )}
```

to:

```tsx
            {savedView ? (
              <>
                {savedLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
                {!savedLoading && savedPostings.length === 0 && (
                  <p className="text-sm text-muted-foreground">You haven&apos;t saved any job postings yet.</p>
                )}
                <div className="grid grid-cols-1 gap-4 compact:gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {savedPostings.map((p) => (
                    <JobCard key={p.posting.id} company={p.company} posting={p.posting} expired={p.expired} />
                  ))}
                </div>
              </>
            ) : (
              <>
                {pageCompanies === null && <p className="text-sm text-muted-foreground">Loading...</p>}
                {pageCompanies !== null && pageCompanies.length === 0 && loadError && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Couldn&apos;t load workplaces right now — check your connection and try again.
                  </p>
                )}
                {pageCompanies !== null && pageCompanies.length === 0 && !loadError && (
                  <p className="text-sm text-muted-foreground">
                    No companies are looking for people under these filters yet.
                  </p>
                )}
                {/* One card per job (see postingsForCard) — a company with N
                    open postings renders N cards here, not one crowded card. */}
                <div className="grid grid-cols-1 gap-4 compact:gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {pageCompanies?.flatMap((c) =>
                    postingsForCard(c).map((posting, i) => (
                      <JobCard key={`${c.id}-${posting?.jobTitle ?? "none"}-${i}`} company={c} posting={posting} />
                    )),
                  )}
                </div>

                {visibleCompanies !== null && visibleCompanies.length > 0 && (
                  <>
                    <p className="mt-4 text-center text-xs text-muted-foreground">
                      Page {page} of {totalPages} — {visibleCompanies.length} compan
                      {visibleCompanies.length === 1 ? "y" : "ies"} hiring
                    </p>
                    <PaginationBar page={page} totalPages={totalPages} onChange={goToPage} />
                  </>
                )}
              </>
            )}
```

- [ ] **Step 8: Typecheck**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: no errors across the whole `apps/web` package — this is the last task.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/JobsBrowser.tsx
git commit -m "feat(web): Following + Saved Posts sidebar and company filter on the Jobs page"
```

---

## Final manual browser verification (after Task 10, not a separate task — do this as part of closing out the plan)

No automated frontend test suite covers this feature end-to-end (see Global Constraints). Before considering this plan done, verify live in a real browser, both themes:

1. Post a job as an approved owner whose company has 2 work types — confirm the work-type picker appears and blocks Continue until chosen; confirm the disclaimer text renders exactly as specified and Publish stays disabled until checked; confirm the reshare checkbox is independent (doesn't block Publish).
2. Post a job for a company with exactly 1 work type — confirm the picker is invisible and Continue only needs job title + description.
3. Confirm the Risk Score badge appears (or is absent at 0) on the Jobs list card, the company-profile "Job Postings" tab, and the company profile page header, for a company with `riskScore > 0` (demo-finans-holding's `riskScore` is already 3 from the backend plan's own live verification — use it).
4. On the owner dashboard, open a company's new "Job Postings" nav item, click Remove on a live posting, confirm the modal's exact copy (including the real days-remaining number), confirm the green button calls mark-filled and the row leaves the public Jobs feed while staying in the owner dashboard as "Filled".
5. As a MEMBER, bookmark a posting from the Jobs grid, confirm the icon fills in; open Saved Posts, confirm it appears; unsave it from Saved Posts, confirm it disappears from the list without a page reload.
6. In the Jobs sidebar, click a followed company's name — confirm the grid narrows to just that company; click it again — confirm it restores the full unfiltered grid.
7. Toggle both dark and light mode on every new surface touched by this plan.

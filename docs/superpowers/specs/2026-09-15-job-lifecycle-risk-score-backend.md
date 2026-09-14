# Job Posting Lifecycle & Risk Score — Backend Spec

## Source

This spec covers the backend half of a large combined ask pasted in chat on
2026-09-15, in two blocks: a "UI/UX updates" block (job-card bookmarking, a
Following/Saved-Posts sidebar on the Jobs page, an employer removal flow) and
a separate "Risk Score" block (backend scoring logic + worker-facing display
+ employer disclaimer + a request to test the feature live). Brainstorming
established these are three mostly-independent sub-projects — **A: Risk
Score**, **B: Employer job lifecycle (soft-delete/expiry/reshare)**, **C:
Worker-side bookmarking** — built in that order, but A and B share one
migration and A's scoring logic depends on a status B introduces, so their
*backends* ship together. The paired frontend spec is
`docs/superpowers/specs/2026-09-15-job-lifecycle-risk-score-frontend.md`,
which depends on everything in this spec being implemented first (it
consumes the fields and endpoints this spec adds).

## Original ask (verbatim)

> Analyze the apps/web directory to locate the top-bar job section and job
> card components before implementing the following UI/UX updates for the
> iworkedthere.com platform.
>
> Core Constraints:
> * All text elements must use the "Plus Jakarta Sans" font family.
> * Maintain absolute visual parity between Dark Mode and Light Mode. Do not
>   favor one theme over the other.
> * Design for universal accessibility. A manual laborer on a mobile device
>   in any rural province must find this just as easy to navigate as an
>   office worker. Do not prioritize or default the UI to major hubs like
>   İzmir or İstanbul; treat all locations equally.
>
> UI Updates - Jobs & Hire Now! Sections (Top-Bar):
> 1. Job Cards: Locate the job cards within the top-bar job section. Add a
>    generic "bookmark" icon directly inside, positioned at the bottom right
>    of each card.
> 2. Left Sidebar (Following): Add a "Following" section to the left
>    sidebar. Display a scrollable list of followed company names (text
>    only, strictly no logos).
> 3. Sidebar Filtering Logic: Implement single-selection filtering. Clicking
>    a company name displays only that company's postings. Clicking a
>    different company deselects the first. Deselecting a company restores
>    the global view.
> 4. Left Sidebar (Saved Posts): Below the "Following" list, add the same
>    generic "bookmark" icon next to the text "Saved Posts". Make this a
>    responsive button that, when clicked, displays all job postings the
>    user has saved.
> 5. Saved Posts View (Expired Logic): Within the "Saved Posts" view, render
>    any expired or removed jobs as entirely grayed-out. These expired cards
>    must be non-reactive and non-responsive (unclickable), visually
>    distinguishing them from active posts while keeping the worker's
>    historical record intact.
> 6. Employer Job Creation (Hire Now!): On the employer's job ad creation
>    page, add a checkbox at the bottom labeled "Re-share automatically
>    after 30 days."
>
> CONTEXT: We are implementing a strict job posting removal system for
> employers on iworkedthere.com. Employers must not be allowed to spam or
> silently delete active posts to manipulate their Risk Score. We are
> introducing a confirmation gate that forces them to either declare a
> successful hire or wait out their expiration timer.
>
> STRICT RULES:
> 1. Dual-Mode Isolation: Execute backend data logic first, verify, then
>    build the frontend UI.
> 2. Design System: Use strictly the "Plus Jakarta Sans" font. Enforce
>    absolute parity between Light and Dark modes.
> 3. No Hard Deletions: Job posts must never be permanently deleted from the
>    database to preserve historical transparency.
>
> PHASE 1: BACKEND OPERATIONS (THE FORTRESS)
> 1. Expiration Calculation: Ensure the API endpoint delivering the
>    employer's job postings calculates and returns the exact integer of
>    "days remaining" until the post's 30-day expiration.
> 2. Soft-Delete Logic: Create a secure endpoint for removing a job post.
>    This must NOT delete the database row. It must change the job's status
>    to `FILLED` or `CLOSED`, immediately hiding it from the public
>    worker-facing "Jobs" feed while keeping the record intact for Risk
>    Score calculations.
>
> PHASE 2: FRONTEND OPERATIONS (THE INTERFACE)
> 1. Dashboard Integration: In the employer's job postings dashboard, add a
>    "Remove" button to every active job card.
> 2. The Confirmation Modal: Clicking "Remove" must trigger a modal with the
>    exact header: "Are you sure you want to remove this post ?"
> 3. Modal Options:
>    - Button 1 (Action): "Yes, already hired someone." Render this as a
>      highly visible green button. Clicking this triggers the backend
>      soft-delete endpoint.
>    - Button 2 (Cancel): "No, I will wait until my post expires ([X] days
>      left)". Dynamically inject the remaining days fetched from the
>      backend. Render this as a neutral, secondary button that simply
>      closes the modal without taking action.
>
> [Second block, pasted immediately after:]
>
> I am building a transparent job platform. I need to implement a "Risk
> Score" (0 to 3) for companies. If a company posts the exact same job (same
> position and work-type) repeatedly, their score goes up by 1 (max 3). This
> protects workers from high-turnover spam.
>
> You must strictly separate your backend and frontend tasks. Do not modify
> the frontend while working on the backend, and vice versa. Keep all
> frontend text in Turkish and English where applicable, but use the
> provided English text for the employer agreement logic. Ensure all UI
> uses the "Plus Jakarta Sans" font.
>
> Phase 1: Backend Operations (The Fortress)
> Database Schema: Analyze apps/api/prisma/schema.prisma. Add a riskScore
> integer field (default 0) to the Company model.
>
> Job Posting Logic: Locate apps/api/src/modules/job-postings/job-postings.
> service.ts and apps/api/src/modules/job-postings/job-postings.controller.
> ts. Update the job creation endpoint.
>
> The Calculation: Before saving a new job posting, query the database to
> see if this specific company has posted a job with the exact same
> position and workType recently. If a match is found, increment the
> company's riskScore by 1 (capping at 3). Save this updated score to the
> Company record.
>
> Data Exposure: Ensure the riskScore is exposed in the API payloads for the
> Jobs list, the Company Job Card, and the Company Profile endpoints (check
> apps/api/src/modules/companies/companies.service.ts).
>
> Phase 2: Frontend Operations (The Interface)
> [— frontend items, see paired frontend spec —]
>
> Also I want you to test out this new "Risk Score" feature we added by
> creating and removing job posting from a test company.

## What brainstorming resolved (decisions, not just notes)

A full read of the current codebase turned up several gaps between the ask's
premises and what's actually in the repo. Resolved with the user directly
before writing this spec:

1. **Font is already done.** `layout.tsx` + `globals.css` already load Plus
   Jakarta Sans site-wide via `next/font/google` and apply it as the only
   `--font-sans`. Nothing to change here — noted so it isn't re-attempted.

2. **There is no "top-bar job section."** "Hire Now!" is only nav-link text
   to `/jobs`. The actual job cards live in `JobsBrowser.tsx` (the `/jobs`
   page) and `CompanyJobPostings.tsx` (a company profile tab), both sharing
   one `JobCard.tsx` component. All "job card" and "sidebar" work in the
   frontend spec targets `JobsBrowser.tsx`'s own hand-built sidebar, which is
   a separate file from the Social page's sidebar (they share low-level
   filter primitives, not a common parent component).

3. **No employer-facing "my job postings" list exists at all today.** Only
   a public per-company read (`GET companies/:slug/job-postings`) and an
   admin moderation queue exist. The "Remove" button's dashboard is new,
   built from scratch in the frontend spec — this spec adds the endpoint it
   needs.

4. **`JobPosting` has no per-posting `workType` today** — work type only
   lives on `Company` (an array). The ask's "same position and work-type"
   duplicate check needs a per-posting value. **Decision (user-approved):**
   add a required `workType` field to `JobPosting`, chosen at creation from
   the posting company's own `workplaceTypes` (auto-picked, no extra UI
   friction, if the company only has one). This is additive to the existing
   `WorkplaceType` enum — no new enum needed.

5. **Risk Score's trigger, precisely (user-clarified, this is the load-
   bearing decision of this spec):** reposting the same title+work-type does
   **not** by itself increment the score. A posting that simply runs out its
   30 days unhired, unreshared, and lapses **never** counts against the
   company. The score increments only when a company posts a job whose
   normalized title+workType matches an **earlier posting of theirs that was
   marked `FILLED`** (i.e., they clicked "Yes, already hired someone" and
   then posted the identical role again). This is the actual anti-spam
   signal the user described — claiming a hire and then immediately
   re-opening the identical role. Consequence: the increment check depends
   on the `FILLED` status this spec also introduces, so **both pieces ship
   in the same backend pass**, `FILLED`'s write path (mark-filled endpoint)
   implemented before the increment logic that reads it.

6. **No cron/scheduler infrastructure exists anywhere in this repo** (no
   `@nestjs/schedule`, no cron package, no scheduled scripts). **Decision
   (user-approved): lazy, on-read reshare.** No new dependency. A shared
   helper computes `effectiveDate = lastResharedAt ?? createdAt` and
   `daysRemaining = 30 - daysSince(effectiveDate)`; any query path that
   lists postings (public feed, owner's own list) runs this helper first,
   and if `autoReshareEnabled && daysRemaining <= 0`, writes
   `lastResharedAt = now()` right then — so a reshared posting requalifies
   within the same request that discovered it was stale. No background
   process, ever.

7. **Saved-posting visibility window (user-clarified):** once a posting
   stops being publicly live (naturally expired, or manually marked
   `FILLED`), it disappears from the public Jobs feed immediately, but stays
   visible for **30 more days** in exactly two places: the owning company's
   own dashboard, and a worker's Saved Posts list (rendered inert/greyed-out
   there — frontend spec). After that second 30-day window, it stops
   appearing in either place. The database row (and its contribution to
   `riskScore` history) is never deleted, per the "no hard deletions" rule —
   this is purely a display-window cutoff, computed at read time.

8. **Duplicate matching is exact, not fuzzy.** Title match = trimmed,
   lowercased string equality. No stemming/fuzzy/Levenshtein matching — a
   YAGNI call consistent with the rest of this codebase's moderation checks
   (`ModerationService`'s own checks are plain substring/pattern rules, not
   ML). Work-type match = enum equality.

9. **Only one new status value.** The ask says "FILLED or CLOSED" as if
   either name works. Since the only manual trigger the spec defines is
   "already hired someone," this spec adds `FILLED` only — no separate
   `CLOSED`. Natural 30-day expiry is never written to the DB as a status
   change; it's computed at read time from `effectiveDate` (consistent with
   "no hard deletions" extending to "no unnecessary status churn" either).

## Data model changes (one migration)

All in `apps/api/prisma/schema.prisma`:

```prisma
enum JobPostingStatus {
  PUBLISHED
  PENDING_ADMIN
  REJECTED
  FILLED          // NEW — set only by the owner's mark-filled action
}

model Company {
  // ...existing fields unchanged...
  riskScore  Int  @default(0)   // NEW — 0..3, see risk-score calc below
}

model JobPosting {
  // ...existing fields unchanged...
  workType            WorkplaceType  // NEW — required, chosen at creation
  autoReshareEnabled   Boolean       @default(false)  // NEW
  lastResharedAt       DateTime?     // NEW — null until first lazy reshare

  @@index([companyId, jobTitle, workType])  // NEW — speeds the risk-score lookup
}

// NEW model — mirrors SavedPost/CompanyFollow exactly
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

Run `prisma generate` + `prisma db push` per this repo's established
non-interactive workflow (no migration files yet, per CLAUDE.md).

## Service logic

All in `apps/api/src/modules/job-postings/job-postings.service.ts` unless
noted. Reuses the existing `requireApprovedOwnership` helper for every
owner-facing endpoint below (same pattern the `create` method already uses).

**New shared helper** (`job-postings.util.ts`, alongside the existing
`decideBoostAccess.ts`):
```ts
export function effectivePostDate(p: { createdAt: Date; lastResharedAt: Date | null }): Date {
  return p.lastResharedAt ?? p.createdAt;
}
export function daysRemaining(effectiveDate: Date, now = new Date()): number {
  const elapsed = (now.getTime() - effectiveDate.getTime()) / 86_400_000;
  return Math.max(0, Math.ceil(30 - elapsed));
}
export function daysSinceExpired(effectiveDate: Date, now = new Date()): number {
  const elapsed = (now.getTime() - effectiveDate.getTime()) / 86_400_000;
  return Math.max(0, Math.ceil(elapsed - 30));
}
```
Pure functions, unit-testable without a DB — matches this module's existing
`decideBoostAccess`/`freeBoostsRemaining` style.

**Lazy reshare pass** — applied inside whichever query lists postings
(public feed's company search join, and the new owner list below): for each
`PUBLISHED` posting where `daysRemaining(effectivePostDate(p)) === 0 &&
p.autoReshareEnabled`, `update({ lastResharedAt: now() })` before serializing
the response. Cheap (only fires for genuinely stale rows), no cron.

**Risk-score increment** — inside `create`, before the existing moderation
checks or after (order doesn't matter, they're independent), add:
```ts
const normalizedTitle = jobTitle.trim().toLowerCase();
const priorFilledMatch = await this.prisma.jobPosting.findFirst({
  where: {
    companyId,
    workType,
    status: "FILLED",
    jobTitle: { equals: normalizedTitle, mode: "insensitive" },
  },
});
if (priorFilledMatch) {
  await this.prisma.company.update({
    where: { id: companyId },
    data: { riskScore: Math.min(3, company.riskScore + 1) },
  });
}
```
(Exact placement/variable names are implementation detail for the plan —
this is the algorithm, not literal diff text.)

**New endpoint — owner's own postings list**
`GET my-companies/:companyId/job-postings` (JwtAuthGuard,
`requireApprovedOwnership`). Returns every status, each row including
`daysRemaining` and `status`. Includes postings up to `daysSinceExpired <=
30` past their effective end (whether that end was natural expiry or a
`FILLED` transition); excludes anything past that second window (still in
DB, just not returned here).

**New endpoint — mark filled (the soft-delete)**
`POST my-companies/:companyId/job-postings/:jobPostingId/mark-filled`
(JwtAuthGuard, `requireApprovedOwnership`, verifies the posting belongs to
`companyId` and is currently `PUBLISHED`). Sets `status: "FILLED"`. No other
field changes, no row deletion. This is the only manual status-closing
action this spec adds — matches the modal's single action, "already hired
someone."

**Public Jobs feed** (`CompaniesService.search`'s job-postings join, or
wherever `publicJobPostingSchema` rows are assembled) — after the lazy
reshare pass runs, filter to `status: "PUBLISHED" && daysRemaining > 0`.

**Company serialization** (`companies.service.ts`'s `toPublicCompany`) —
add `riskScore: c.riskScore` to the single shared return object. This one
change is what makes `riskScore` reach the Jobs list (`search` →
`CompanyListItem`) and the Company profile (`getBySlug` → `CompanyDetail`)
for free, per the existing chokepoint pattern documented in CLAUDE.md.

**New module — saved job postings** (`apps/api/src/modules/saved-job-postings/`,
mirroring the existing `saved-posts` module's shape):
- `POST me/saved-job-postings/:jobPostingId` (JwtAuthGuard) — toggle
  save/unsave, same idempotent-toggle convention as
  `POST me/follows/companies/:companyId`.
- `GET me/saved-job-postings` (JwtAuthGuard) — list the caller's saved
  postings. Each row includes `expired: boolean` (true once the posting has
  left `PUBLISHED` or passed its 30-day live window, but is still within the
  30-day grace). Rows past the grace window are silently excluded from this
  list (never deleted — `SavedJobPosting` and `JobPosting` rows both persist).

## Shared-types changes (`packages/shared-types/src/schemas/`)

- `jobPosting.ts`: add `workType: workplaceTypeSchema` (reuse the existing
  company work-type enum schema) and `status` gains `"FILLED"` to
  `jobPostingStatusSchema`. Add a new `ownerJobPostingSchema` (or extend the
  existing `jobPostingSchema`) with `daysRemaining: z.number().int()` for the
  new owner-list endpoint's response — this field is **owner-view only**,
  not added to `publicJobPostingSchema` (the public card stays thin, per its
  existing deliberate minimalism).
- `company.ts`: add `riskScore: z.number().int().min(0).max(3)` to
  `companySchema`.
- New `savedJobPosting.ts` (or extend `follow.ts`): a toggle-result schema
  and a list-item schema (`{ posting: ..., expired: boolean }`), mirroring
  `savedPostToggleResultSchema`'s existing shape.

Rebuild `dist/` after: `cd packages/shared-types && pnpm exec tsc` — required
per this repo's build, not optional (CLAUDE.md gotcha).

## Test plan

Jest, colocated with the existing `job-postings.service.test.ts`:
- `daysRemaining`/`effectivePostDate`/`daysSinceExpired` pure-function cases
  (fresh post, mid-life, exactly 30 days, past 30 days).
- Risk-score increment: no prior posting → 0; repost of a still-`PUBLISHED`
  or naturally-expired-but-never-`FILLED` posting → stays 0; repost of a
  `FILLED` posting with matching title+workType → +1; repeated 4+ times →
  caps at 3, never goes higher.
- `mark-filled`: rejects a non-owner; rejects a posting that isn't
  `PUBLISHED`; sets status without touching other fields.
- Owner list: includes postings within the 30-day grace past expiry;
  excludes ones past it.

**Live verification (per the user's explicit ask to "test out this new Risk
Score feature by creating and removing job posting from a test company"):**
after the above passes, run a short script against the dev DB using the
existing `demo-finans-holding` company (already an approved-owner demo
company per prior session state) — create a posting, call mark-filled,
create the identical title+workType again, confirm `riskScore` reads back as
1 via the API, repeat to confirm it caps at 3 and doesn't exceed it. Report
the actual API responses, not just "tests passed."

## Out of scope (this spec)

- No `CLOSED` status, no `EXPIRED` status — expiry is computed, never
  stored.
- No cron/scheduler package added.
- The existing public Jobs-page "Work-Type" filter is left filtering on
  `Company.workplaceTypes` as it does today — it is **not** changed to
  filter on the new per-posting `workType`. Flagging this as a known minor
  inconsistency (a company offering both Office and Manual-Labour roles
  could have a posting whose own `workType` doesn't match what the filter
  used to select it) rather than silently expanding this spec's scope; worth
  a future follow-up if it turns out to matter in practice.
- No changes to the admin moderation queue beyond the new `FILLED` enum
  value existing (admin approve/reject logic is untouched).
- No `apps/web` file is touched by this spec — see the paired frontend spec,
  to be executed only after this one is implemented and verified.

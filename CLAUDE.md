# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"I Worked There" (iwtr.com) — a Turkey-first, anonymous employer-review platform. Employees rate and
comment on past employers anonymously; new hires browse company scores before accepting a job. The
central design tension: the platform must collect real identity data (including T.C. Kimlik Numarası,
the Turkish national ID) to deter fraudulent reviews, while guaranteeing reviewers stay anonymous to
the public and to employers — so "identity proof" and "review content" are deliberately kept as
separate, loosely-coupled systems (see Data Model below).

The full product spec and phased roadmap live in the plan file referenced in project memory; this repo
currently implements **Phase 0 (foundations)** and **Phase 1 (core loop)** only. Not yet built: the
paid company "Plus" tier + iyzico payments, contribution-gated like/dislike on reviews, real Google/Apple
sign-in, and the mobile app.

## Commands

This is a pnpm workspace (pnpm 11) using Turborepo to orchestrate three packages: `apps/web`, `apps/api`,
`packages/shared-types`. Run commands from the repo root unless noted.

```bash
pnpm install                      # install all workspace dependencies

pnpm dev                          # turbo run dev across all apps (not usually what you want — see below)
pnpm build                        # turbo run build (shared-types builds first, others depend on ^build)
pnpm lint                         # turbo run lint
pnpm typecheck                    # turbo run typecheck
```

In practice, run the web and API dev servers **separately** in their own terminals rather than via the
root `pnpm dev`, since they're two independent long-running processes you'll want separate logs for:

```bash
cd apps/api && pnpm dev           # NestJS with --watch, http://localhost:3001/v1
cd apps/web && pnpm dev           # Next.js (Turbopack), http://localhost:3000
```

**`packages/shared-types` must be rebuilt after any schema change**, or `apps/web`/`apps/api` will pick up
stale types (they consume its compiled `dist/`, not the raw source — see Gotchas below):

```bash
cd packages/shared-types && pnpm exec tsc     # or `pnpm dev` for tsc --watch
```

**Database (Prisma, `apps/api/prisma/schema.prisma`)**:

```bash
cd apps/api
pnpm exec prisma generate                 # regenerate Prisma Client after a schema change
pnpm exec prisma db push                  # sync schema to the dev DB directly (no migration files yet —
                                           # `prisma migrate dev` doesn't work non-interactively in this
                                           # environment, so db push is the working pattern for now)
```

No test suite exists yet in this repo (`pnpm test` is wired through Turborepo but there is nothing for it
to run). There is no CI config yet either.

## Architecture

### Monorepo boundary: web never touches the database

`apps/web` (Next.js App Router) is a thin client — it holds zero business logic and never talks to
Postgres directly. Every read/write goes through `apps/api` (NestJS) via plain `fetch` calls in
`apps/web/src/lib/api-client.ts`, using types from `packages/shared-types` as the single source of truth
for request/response shapes. This split (rather than using Next.js server actions/route handlers as the
backend) is deliberate: it's what will let a future mobile app hit the same versioned `/v1` API with no
backend changes.

`packages/shared-types` exports zod schemas (and their inferred TS types) per domain area under
`src/schemas/` (`auth.ts`, `user.ts`, `company.ts`, `review.ts`, `moderation.ts`). Both apps import from
`@iwtr/shared-types`. Extend an existing schema file rather than duplicating a shape locally in either app.

### apps/api module layout

Each feature is a self-contained Nest module under `src/modules/<name>/` (controller + service + module,
sometimes a small `.util.ts`). `src/common/` holds cross-cutting pieces used by every module: `JwtAuthGuard`,
`RolesGuard` + `@Roles()` decorator, `@CurrentUser()` decorator, and `ZodValidationPipe` (validates a
single `@Body()`/`@Param()` argument against a zod schema — see the gotcha below on scoping it correctly).

- `auth/` — email+password registration/login, JWT access tokens (15 min, HS256) + rotating opaque refresh
  tokens (30 days, stored as a SHA-256 hash in `RefreshToken`, rotated on every use). Google/Apple sign-in
  endpoints exist but throw `NotImplementedException` until `GOOGLE_CLIENT_ID` / `APPLE_*` env vars are set.
- `pii-vault/` — the **only** module allowed to read/write the `PiiVault` Prisma model. Encrypts PII
  fields with per-record envelope encryption (AES-256-GCM field values, DEK wrapped by a master key derived
  from `PII_MASTER_KEY`). See Data Model below for the retention policy this module enforces.
- `onboarding/` — the multi-step registration flow (PII → education/employment history → avatar), driving
  `User.status` through `PENDING_PII → PENDING_HISTORY → PENDING_AVATAR → ACTIVE`. Every step handler
  re-reads `User.status` from the DB before acting — never trusts the status claim embedded in the JWT,
  since that claim goes stale the moment onboarding advances.
- `companies/` — admin-only company creation (role-gated via `@Roles("ADMIN")`) plus public search/detail
  endpoints. Company creation does a case-insensitive exact-match backfill against existing
  `EmploymentHistory.rawCompanyName` rows to retroactively link them (see Gotchas re: fuzzy matching).
- `reviews/` — review submission. Enforces "you can only rate a company that's in your own employment
  history" server-side (never trusts the client), enforces one review per user per company
  (`@@unique([userId, companyId])`), runs the moderation pipeline, and recomputes `CompanyAggregateScore`
  on publish.
- `moderation/` — `ModerationService` is a **deliberate stand-in** for a future AI-backed implementation
  (see class-level comment in `moderation.service.ts`). It does rule-based content checks (profanity/name-
  pattern/job-title/shouting heuristics) and a deterministic trust score (account age, prior review
  history, employment date sanity). Swap this class's internals for a real LLM call without touching
  `reviews.service.ts` — it's called through the same two methods (`checkContent`, `scoreTrust`).
- `admin-queue/` — approve/reject/request-more-info actions on reviews the moderation pipeline routed to
  `PENDING_ADMIN_REVIEW`. Approving here runs the same publish side effects as an auto-publish (aggregate
  recompute, PII purge check) — see `AdminQueueService.approve`.

### Data model (`apps/api/prisma/schema.prisma`)

Two Postgres schemas in one Prisma client (`previewFeatures = ["multiSchema"]`): `public` for everything
else, and an isolated `pii` schema containing only `PiiVault`.

- `PiiVault` has **no Prisma relation** to `User` — it's joined only by matching `userId` values, and only
  `pii-vault/pii-vault.service.ts` ever queries it. This is intentional isolation, not an oversight; don't
  add a relation or query `PiiVault` from another module.
- **Retention policy**: `PiiVault.encTcKimlikNo` is nulled out (with an `AuditLog` entry) the moment a
  user's *first* `Review` reaches `PUBLISHED` — see `purgeTcKimlikNoIfPresent`, called from both
  `ReviewsService.submitReview` (auto-publish path) and `AdminQueueService.approve` (manual-approval path).
  `PiiVault.tcKimlikNoHash` (HMAC, non-reversible) is kept indefinitely purely to block duplicate accounts
  on the same national ID. If you add a new code path that can publish a review, it must also call this purge check.
- `Review.status` lifecycle: `PENDING_MODERATION → (PUBLISHED | PENDING_ADMIN_REVIEW | REJECTED)`, with
  `PENDING_ADMIN_REVIEW` resolved manually via `admin-queue` into `PUBLISHED` or `REJECTED`.
- `CompanyAggregateScore` is a derived/cached table, recomputed from all `PUBLISHED` reviews for a company
  every time one is published or approved (`ReviewsService.recomputeAggregate`) — never written to directly.
- `EmploymentHistory.companyId` is nullable: users can free-type an employer name before it's been
  seeded by an admin; it gets backfilled when a matching `Company` is later created (or matched
  case-insensitively when the employment entry itself is created, if the company already exists).

### apps/web structure

App Router pages under `src/app/`; `src/components/auth/` and `src/components/onboarding/` hold the
modal-driven auth/onboarding UI, orchestrated by `src/components/onboarding/OnboardingFlow.tsx` which
switches on `User.status`. Auth tokens never reach the browser: `src/app/api/auth/{login,register,logout}`
and `src/app/api/session` (Next.js Route Handlers) exchange credentials with `apps/api` and store the
resulting access/refresh JWTs as httpOnly, sameSite=lax cookies (helpers in `src/lib/server-auth.ts`,
including a single-flight refresh so concurrent requests never replay an already-rotated refresh token).
Every other authenticated call from the browser goes through the same-origin catch-all proxy at
`src/app/api/proxy/[...path]/route.ts`, which attaches the cookie's access token as `Authorization: Bearer`
server-side and transparently retries once after a silent refresh on a 401. `src/lib/auth-context.tsx` is
a client-side React context holding only `isAuthenticated`/`role` (learned from `/api/session`, never the
raw JWT) and exposes `register`/`login`/`logout`/`refreshOnboardingStatus`. `src/lib/api-client.ts`'s
`apiGet`/`apiPost`/`apiPatch`/`apiDelete` call the proxy and are the only functions client components use
to reach `apps/api`; `apiGetPublic` is a direct-to-`apps/api` escape hatch for the one unauthenticated
Server Component fetch (`app/companies/[slug]/page.tsx`), which has no browser cookies to proxy anyway.

The homepage (`src/app/page.tsx`) is the single router for top-level app state: not logged in → `AuthModal`;
logged in but `status !== "ACTIVE"` → `OnboardingFlow`; otherwise the main authenticated shell.

## Environment / local setup gotchas

- **Windows + Turkish locale**: PostgreSQL's `initdb` fails under a Turkish system locale
  (`Turkish_Türkiye.1254` contains non-ASCII characters). Install/initialize Postgres with an explicit
  ASCII locale (e.g. `English, United States`), not the OS default.
- **`packages/shared-types` ships compiled JS, not raw TypeScript** (`main`/`types` point into `dist/`).
  This is required, not stylistic: Node's native TypeScript support tries to execute the raw `.ts` source
  directly when a consumer imports it, and its ESM resolver requires explicit file extensions on relative
  imports — which the source doesn't have — causing a hard crash. Always rebuild `dist/` after editing
  `packages/shared-types/src/`.
- **`ZodValidationPipe` must be scoped to the specific parameter**, e.g.
  `@Body(new ZodValidationPipe(schema)) body: X`, never applied via a method-level `@UsePipes(...)` on a
  handler that also has a `@CurrentUser()` (or any other custom param decorator) argument. Method-level
  pipes run against *every* parameter, including custom decorators, so a schema meant only for the body
  will also fail-validate the current-user object and produce misleading "field is required" errors.
- **`prisma migrate dev` does not work non-interactively** in this environment ("Prisma Migrate has
  detected that the environment is non-interactive, which is not supported"). Use `prisma db push` for
  schema changes during local development instead.
- Regenerating the Prisma client (`prisma generate` / `prisma db push`) can fail with `EPERM` on Windows if
  a running `apps/api` dev process still has the query engine `.dll` loaded — stop the dev server (or kill
  stray `node.exe` processes) before regenerating, then restart it.

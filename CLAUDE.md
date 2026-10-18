# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"I Worked There" (iworkedthere.com) — a Turkey-first, anonymous employer-review platform. Employees rate and
comment on past employers anonymously; new hires browse company scores before accepting a job. The
central design tension: the platform must collect real identity data (including T.C. Kimlik Numarası,
the Turkish national ID) to deter fraudulent reviews, while guaranteeing reviewers stay anonymous to
the public and to employers — so "identity proof" and "review content" are deliberately kept as
separate, loosely-coupled systems (see Data Model below).

The full product spec and phased roadmap live in the plan file referenced in project memory; this repo
currently implements **Phase 0 (foundations)** and **Phase 1 (core loop)** only. Not yet built: the
paid company "Plus" tier + iyzico payments, real Google/Apple sign-in, and the mobile app. Review
like/dislike voting *is* built (`ReviewsService.castVote`) and deliberately ungated — a contribution
requirement existed once but was removed 2026-08-09 per product decision (see the doc comment on
`castVote`); any logged-in member can vote except on their own review.

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
  **Company login** (`CompanyLogin`, replaces per-person HR seats): one shared email + password per company,
  set up by its approved owner (dashboard > Company Login). `POST auth/company-login` issues a token acting as
  that owner but carrying `cl`/`cid` claims. `JwtAuthGuard` is **default-deny** for such a token: only routes
  marked `@CompanyAccountAllowed()` are reachable, a `:companyId` param must be its own company, and the login
  is re-checked against the DB on every request (deleted / password changed / owner lost the company = signed
  out). Routes without `:companyId` must scope themselves via `user.companyScope` (conversations, review
  replies, owned-companies lists). `OptionalJwtAuthGuard` treats it as logged out. The full list of opened
  routes is pinned in `auth/__tests__/company-login.test.ts` - opening a new one means updating that list
  on purpose. Never open a personal route (profile, CV, reviews, PII, notifications, IWT Social posting) to it. It sees
  everything about its company except the owner's own profile (decided 2026-10-15): the dashboard's Questions and Post
  Scheduling sections are read-only for it (their GET routes are opened; answering, hiding, scheduling stay owner-only). A company
  login can buy boosts, ad space and reports, but NOT a membership plan: `plus/checkout` is owner-only (decided
  2026-10-12).
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
  on publish. Also owns helpful/not-helpful voting on published reviews (`castVote`) — any logged-in
  member except the review's own author, one vote per user per review (`ReviewVote`), toggle-off on a
  repeat click of the same value.
- `moderation/` — `ModerationService` is a **deliberate stand-in** for a future AI-backed implementation
  (see class-level comment in `moderation.service.ts`). It does rule-based content checks (profanity/name-
  pattern/job-title/shouting heuristics) and a deterministic trust score (account age, prior review
  history, employment date sanity). Swap this class's internals for a real LLM call without touching
  `reviews.service.ts` — it's called through the same two methods (`checkContent`, `scoreTrust`).
- `admin-queue/` — approve/reject/request-more-info actions on reviews the moderation pipeline routed to
  `PENDING_ADMIN_REVIEW`. Approving here runs the same publish side effects as an auto-publish (aggregate
  recompute, PII purge check) — see `AdminQueueService.approve`.
- `messaging/` — private reviewer ↔ company conversations (`ReviewConversation`/`ReviewConversationMessage`).
  Only a review's author can open one, only after a `CompanyReply`; the company can never start one. The
  caller's side is resolved server-side on every call (outsiders get 404); the company only ever sees
  `publicReviewerName` (the review's public display name), never a user id. Timestamps are day-precision;
  ordering/unread use the message `seq`. Anything that moves or deletes reviews/companies must carry
  `ReviewConversation.companyId` along (company merge does).
  Both sides read their inbox in the bottom-right dock (`components/messaging/ChatDock.tsx`), on every page except
  Edit Profile (`/me`), the Dashboard and the admin pages: `GlobalChatDock` in `layout.tsx` decides where (a company
  login gets the dock on its Dashboard instead; owners get one list across all their companies via
  `GET owner/conversations`). Notification links are `/social?openChat=<conversationId>` (the parameter works on any
  page with the dock); the old `/messages?c=` route just redirects there.
  Each side sees the review's public name/avatar (randomized stand-ins included) and the company logo. The
  reviewer sees no owner name until the company's first message (`companyReplied`), then the answering owner's
  legal name — from `EmployerProfile` only, never the PII vault — if that owner ticked "Show company owner's name
  during messaging" (`CompanyOwner.showNameInMessages`, chosen at claim, default off), otherwise "Company
  representative". Every owner must give a legal name when claiming (one approved owner per company).
  Phone numbers are allowed in messages (skipped via `skipViolationTypes`) and flagged `sharesPhoneNumber` so
  both sides see a warning note; reviews and IWT Social still block them.
- IWT Social post/comment times go out to members and companies rounded to the hour (`toUtcHour`); the DB keeps
  the exact moment, which only the admin endpoints return (legal record).
- IWT Social is being rebuilt in four phases (`docs/superpowers/specs/2026-10-13-iwt-social-redesign-design.md`);
  phase 1 is in. `/social` is filter sidebar + feed + right-hand rail (`SocialRail`: Trending this week, Companies
  to follow, Hiring this week, then the page's right ad). Members get Explore / Following / Saved as plain-word tabs
  (`WordTabs`; `GET social/feed?following=1`); an owner or admin can't follow or save, so they get no tab row and no
  "Companies to follow". Every post has its own page (`/social/posts/:id`, same register gate), reached from the
  card's time link and Copy link. An approved owner of the post's company gets the card's "..." menu
  (`PublicSocialPost.canManage`): edit caption (`PATCH social/posts/:id`, sets `editedAt`), delete, pin (one pinned
  post per company, leads the company feed in the default order only). The company Social tab shows follower and
  post counts (`GET social/companies/:slug/summary` - a bare count, never the follower list) and Posts / Photos
  views; Follow stays the one button in the company page header. None of the new routes is opened to the company
  login. Phase 2 is in too: a post has a `kind` (PHOTO / UPDATE / POLL / EVENT / MILESTONE / HIRING, picked in the
  composer's tab row; `createSocialPostInputSchema`). Polls: members vote once (`POST social/posts/:id/poll-vote`,
  movable until `pollEndsAt`), the split stays hidden until the viewer has voted, the poll has closed or the viewer
  owns the company, and only counts ever leave the API. A HIRING post points at the company's own live job ad.
  Reactions are three line icons in one family - thumbs up / folded hands "Praise" / question mark "Curious" (LIKE /
  WELL_DONE / CURIOUS, `SocialPostLike.reaction`, one per member per post; `ReactionGlyph` in ReactionButton.tsx,
  outline at rest, filled in its colour when picked - the like fills blue). No visible waits: lists come back from memory first (`socialFeedCache`),
  first loads show `SocialPostSkeleton`, photos reserve their space from `SocialPost.imageAspectRatios` and load
  lazily, the rail is one request whose shared lists the API caches for a minute, and posting refreshes the lists
  instead of reloading the page. Phase 3 is in as well: **Questions** (`social-questions.service.ts`, its own
  controller). A member asks one company or everyone in a kind of work (max 5 a day); members answer anonymously
  (review name or a one-off name), the asked company's approved owner answers under their real name; one answer per
  account per question, never on your own. `SocialAnswer.workedThere` is settled when the answer is written (the
  company was in the member's employment history). Text goes through `checkContent` with the asked company's own
  name removed first; reports reuse the comment reasons and queue on `/admin/content`. A company can never delete
  a question put to it. Shown as a Questions tab on `/social`, a Questions view on the company Social tab, a page
  per question (`/social/questions/:id`) and the rail's "Waiting for an answer". **The asked company sees a
  question first** (`SocialQuestion.visibility` PENDING / HIDDEN / PUBLIC): put to a claimed company it reaches only
  its asker and that company's owner, who answers it in the dashboard's Questions section and picks "show to
  everyone" or "keep hidden" (changeable later; showing always needs the company's answer on it). Put to a kind of
  work or to an unclaimed company it is PUBLIC at once. Every read goes through `viewableBy` in
  `social-questions.service.ts` - a new route that returns or acts on a question must too. The owner's only reply is
  the answer: there is no message to the asker, on purpose; "Report to admin" on the card is how a company flags one. **Switched off in production
  until the lawyer has cleared the Terms**: `SOCIAL_QUESTIONS_ENABLED` (API) + `NEXT_PUBLIC_SOCIAL_QUESTIONS_ENABLED`
  (web), on by default everywhere else. The Social sidebar is soft panels now (`SidebarPanel` in
  `SocialSidebar.tsx`), matching the rail. `/social` is laid out by `SocialShell` as 1fr / feed / 1fr, so the feed
  is in the exact middle of the page (left ad from 86rem, right ad in its own column from 100rem, under the rail
  below that); the company Social tab centres the same way. Demo polls and questions for local viewing:
  `scripts/seed-social-demo.ts`. Phase 4 is in too: **owner tools** (`social-insights.service.ts`,
  `social-schedule.service.ts`, `social-owner-tools.controller.ts`). *Post views*: the page reports posts a member has
  had on screen (`lib/socialViews.ts`, `POST social/views`); only counters are written (`SocialPost.viewCount`,
  `CompanySocialDay`) - never who looked; the "once per member per post in 12 hours" memory lives in the process only.
  Only the post's own company is sent `viewCount`. *Insights* (dashboard > Post Scheduling, Starter and up only, `GET social/company-insights/:companyId`):
  followers, views, reactions, comments, a followers line and views bars, most seen posts; how far back depends on the
  plan (`SOCIAL_INSIGHTS_DAYS`: Free none / 30 / 60 / 90; day rows older than 92 days are deleted by the schedule worker). Follows and unfollows are also counted per day because an unfollow
  deletes its row; days are Turkey's (`socialDay`). *Posting later*: a waiting post is a `ScheduledSocialPost`, not a
  `SocialPost`, so no read path can show it early; `SocialScheduleWorker` publishes what is due every 30 s by deleting
  the waiting row and creating the post in one transaction (`SOCIAL_SCHEDULE_WORKER_DISABLED=1` stops a process
  polling). Waiting posts per plan: `SOCIAL_SCHEDULED_POST_LIMITS` (Free 0, 3 / 10 / 15). A new way to create a post must go
  through `prepareNewPost` + `publishPrepared`. None of these routes is opened to the company login. Demo numbers:
  `scripts/seed-social-insights-demo.ts`; real history: `scripts/backfill-social-days.ts`.
- `moderation/profanity-lexicon.ts` + `profanity-matcher.ts` — the curated English/Turkish word list and the
  matcher that undoes spaced/dotted/stretched/star/look-alike spellings. Before adding a word, check it isn't an
  everyday word once typed without Turkish letters (e.g. "sik sik" = "sık sık").
- `rival-analytics/` — now only the Sector Benchmark Report (always the owner's own sector in the owner's own
  city). The competitor "Rival Analytics" report was removed 2026-09-27 (legal decision) — don't bring it back;
  its DB tables are left untouched. The same module builds the HR Analytics Report (`hr-analytics-report.*`): one
  company's own Vibe Flags (each with a one-sentence reason), Risk Score with each past posting's effect, and every
  survey question as percentages, as a slate-monochrome Plus Jakarta Sans PDF. Who pays is `decideHrReportAccess`:
  Enterprise included, Pro 1 per calendar month (unique `[companyId, quotaMonth]`, released if the build fails),
  everyone else 199,99 TL via iyzico one-time checkout (402 without billing). Max 3 per company per day, built by
  `HrAnalyticsReportWorker` with a 30 s timeout. Only work types with 3+ published reviews appear; the data service
  converts tallies to percentages before the PDF builder sees them, and only the API's own uploaded logo file is drawn
  (never a fetched URL). Layout check without a DB: `pnpm exec ts-node --transpile-only scripts/dev-sample-hr-report.ts`.
- Company replies to reviews are capped per company per calendar month by the replying owner's plan
  (`MONTHLY_REPLY_LIMITS` in reviews.service.ts: Free 2, Starter 6, Pro 10, Enterprise unlimited); edits are free.
  Plan tiers are `OwnerTier` FREE/STARTER/PRO/ENTERPRISE (renamed from BLUE/BLUE_PLUS on 2026-10-11 - "Blue"
  now only names the Starter tick colour).
- Featured (boosted) job ads: a posting with `boostExpiresAt` in the future. Page 1 of /jobs shows up to 8 in a
  gold "Featured jobs" row above the standard cards (the gold outline marks them; no "Featured" tag on the card). `pickFeatured` (companies/featured-jobs.util.ts) orders
  them: the member's profile Sector, else work type (`forSector`/`forWorkType`, sent only while the sidebar has
  no work type/sector picked); then the chosen city/district, topped up from the same region (turkeyRegions)
  while fewer than 4; shuffled per tier. Boost options (`BoostOption`): FEATURED_7 (299,99), FEATURED_14
  (599,99), AD_SPACE_14 (999,99 - ad space ONLY: the company's ad in the employer ad space beside the search bar on
  the Rating and Jobs pages, `GET companies/employer-ad`, `JobPosting.boostAdSpace`; such a posting is never in
  the Featured row; a sample test ad shows while none is running). Free 7-day boosts per company per month match Pricing (Starter 2, Pro 5, Enterprise 10,
  `decideBoostAccess.ts`, counted from `boostStartedAt`). Owners boost at creation or later via dashboard Job Postings > Edit
  (`PATCH my-companies/:companyId/job-postings/:id`: description, positions and/or boost; title/work type fixed). Job ads
  skip the review-only NAME_OR_SURNAME/JOB_TITLE checks (a title like "Kredi Analisti" looks like a name).
- The Jobs page (`GET companies/browse?jobs=1`, `CompaniesService.browseJobs`) is paged by job card, not by company:
  4 across and 5 rows. Page 1 gives up to 2 rows to the Featured ads (8 featured -> 12 standard cards), later pages
  hold 20 (`jobsFirstPageSize` / `jobsPageRange` / `jobsPageCount` in shared-types; the result carries `totalPages`).
  Each item returned is one card: the company with the single posting (or inferred job title) it shows. The ordered
  card list for one set of filters, with that view's Featured pick, is built from light reads and kept in memory for
  60 s (`jobsIndex`), so paging and repeat views don't list every hiring company again; a featured posting is left
  out of the standard cards on every page. Only the companies on the requested page are loaded in full.
- Job positions (`JobPosition`, 11 fixed levels): an owner ticks 1 to 3 when posting and can change them later in Edit (`JobPosting.positions`); the
  Jobs sidebar's Position buttons filter on them (`positions=`, any-of; inferred job titles are left out while it is
  on); only the opened / full job card lists them, never the short grid card. "Tell us more" is plain text up to
  4000 characters (`JOB_DESCRIPTION_MAX_LENGTH`) with three conventions (`lib/richText.ts`): `**bold**`, `__italic__`,
  and "• " / "1. " list lines. `RichTextEditor` (contentEditable, built from text nodes, never innerHTML) edits it with
  Bold / Italic / list buttons; every place a posting shows renders it through `RichText` (React elements only).
- The sidebar Sector filter is a tick list: `categories=A|B` (pipe-separated, any-of) on search and browse.
- Member profile: `User.languages` (codes from shared-types `LANGUAGES`, max 8, saved the moment one is added or
  removed, always printed on the CV) - languages are no longer rows in `Skill`. Verified skills are picked through a
  search box (the list is fetched once, searched in the browser; max 10); `scripts/seed-skills.ts` is additive and
  safe to re-run. `User.showUsernameInHeader` (Edit Profile > Customize, members only) makes the header show
  `reviewUsername` instead of the CV display name (`headerDisplayName`); an owner is always shown by real name, but
  may pick a username again (2026-10-15). Owner Customize is one box: avatar, username, own picture instead of avatar.
- `company-reports/` — the Report button on a company page (fixed reasons, one open report per member per
  company) and the admin queue on `/admin/content`.

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

The homepage (`src/app/page.tsx` → `components/HomeClient.tsx`) is the single router for top-level app state:
not logged in → register prompt; logged in but `status !== "ACTIVE"` → `OnboardingFlow`; otherwise the main
authenticated shell. The server page passes whether a session cookie exists, so a logged-out visitor's prompt is
server-rendered.

**Privacy plumbing in `src/proxy.ts`** (runs on every request): HTTP→HTTPS redirect in production; review and
conversation traffic has identifying headers (user-agent, IP forwarding, referer, …) stripped before any handler
sees it; the review form's spam trap (`lib/formTrap.ts`: hidden field + minimum fill time) is rejected there, so a
bot submission never reaches `apps/api` or any log. Analytics may only load via `components/privacy/AnalyticsLoader`
— consent-gated, public pages only, and switched off while the review form is open (`lib/analyticsPolicy.ts`).

**English / Turkish (`lib/i18n/`, 2026-10-17)**: no library. The English text in the component is the key; `t("...")`
(client: `useT()` / `useI18n()`, server: `await getTranslator()`) looks it up in the Turkish dictionary
(`lib/i18n/tr/*.ts`, one file per area, merged in `tr/index.ts`) and falls back to the English. Variables are
`{name}` placeholders, plurals go through `tp(n, one, many)`, and a word that needs two Turkish wordings gets a
context key (`"Saved@@tab"`, `"Post@@column"` - the part after `@@` is dropped in English). The choice is the
`iwtr-lang` cookie (Edit Profile > Account Options > Language), read in the root layout. Generic pieces (Dropdown,
WordTabs, FilterPillGroup, SettingsNav, SidebarPanel, DashboardBox, PremiumLocked) translate their own labels, so
callers pass English. Plain helpers take a `t: TFn` argument (default `plainT`); dates/numbers use
`intlLocale(locale)`. **A new visible string must be wrapped in `t()` and added to the matching `tr/` file**, with
wording from Turkish job sites (Kariyer.net: "iş ilanı", "başvur", informal "sen"). Left in English on purpose until
the owner translates them: the Questions feature, everything below Rating Breakdown on the company page (Vibe Flags
text, details, reviews list, claim panel), the survey questions/answers, admin pages and the legal pages. User
content and API-built text (captions, company names, narratives) is never translated. Plan names Starter / Pro /
Enterprise stay English; Free is "Ücretsiz".

### Visual design ("Riverbank", 2026-10-12)

All colour, type, radius and shadow tokens live in `apps/web/src/app/globals.css`; never hard-code a brand
colour in a component. Stone/lichen neutrals with a green lean, deep pine text, Wood (`brand-600`) as the one
accent and the one "selected" colour. Headings are Bricolage Grotesque, body Google Sans Flex; the CV document
alone keeps DM Serif Display (`.cv-document`).

- **No outlined boxes for content.** Reviews and company page sections sit straight on the page, separated by
  space and hairlines. Company cards (rating page) and job cards share one look: a soft separated card,
  `rounded-xl bg-surface shadow-xs`, banner flush at the top, no border. Settings panels and owner dashboard
  sections are the same kind of tonal panel (`rounded-2xl bg-surface shadow-xs`). Only form inputs keep a
  1px border. Chips and secondary buttons are tonal (`bg-surface-muted`), not outlined.
- **Colours the owner chose stay as they are:** the work-type collar colours (`lib/collarColors.ts`), the red/green
  Rating and RS sort states (`SortButtons.tsx`), score-band colours, tier ticks, and the gold featured outline.
- Header is one 64px line; the current page is marked by a Wood bar (`components/layout/navItem.ts`). The
  notifications bell is a symbol with no label beside the theme switch, with a red counter that clears (and is
  saved as read) the moment its panel is opened. The sort controls (RS / A-Z / Rating) are plain words with a
  coloured bar under the one in use, right next to the search field (`SearchSortBox`); no "Sort" label.
  Sidebar width and gaps are locked by tests (`SidebarShell`); its order is Work-Type (+ Sector), Location,
  (Jobs: Create job posting, Position), Rating, Risk Score.
- Work-Type is four tiles (`WorkTypeTiles`): the name, and an object for that work in the bottom corner (the
  owner's own art in `public/`: "Office QS" pencil, "Hybrid QS" headset, "Service QS" hands, "Manual-Labour QS"
  hammer) - grey at rest; picked, the tile takes its collar colour as a soft wash plus a short bar (`collarTileTone`).
  The default banners are the owner's too ("Office Banner" etc., `DEFAULT_BANNER_URL_BY_WORKPLACE_TYPE`); these
  files keep the owner's names, so code writes the space as `%20`.
  Same tiles for "What kind of work?" on Edit Profile. Multi-choice lists (Position) are tick rows that turn Wood
  when ticked (`PositionPicker`), inside a soft panel in the sidebar.
- A logged-out visitor sees `AnonGate`'s hero; the homepage adds `LandingSections` under it.

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

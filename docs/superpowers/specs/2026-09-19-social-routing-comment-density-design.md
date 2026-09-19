# Social Routing Consolidation, Comment Density, Company Sidebar — Design

Date: 2026-09-19
Status: Approved by user, ready for implementation plan.

## Summary

Consolidate the duplicated per-company social experience into the existing
`/companies/[slug]?tab=social` tab (deleting only the redundant
`/social/[slug]` route — the cross-company `/social` discovery feed stays
untouched and gains a "Trending Today" section). Give the company Social tab
a sidebar it doesn't have today (Following list, sort controls, external
"See Them on" links). Tighten the comment UI for density and switch its
timestamp to a fully-abbreviated relative format. Close a real gap where the
"claim this company" prompt doesn't hide once a company already has an
approved owner.

## Background / current state

(All paths relative to repo root. Line numbers as of commit `40440c6`,
verified via a recon pass before this design was written.)

- Two routes render a single company's social feed today:
  - `apps/web/src/app/social/[slug]/page.tsx` — standalone route. Server
    Component, `apiGetPublic('/companies/${slug}')`, 404s via `notFound()`.
    Renders `SocialCompanyHero` (a hand-duplicated header — its own doc
    comment admits it "mirrors the top of the rating page"), then
    `SocialComposerSlot` + `SocialFeed scope={{kind:"company", slug}}`.
  - `apps/web/src/components/companies/CompanyProfileTabs.tsx` — the
    "IWT Social" tab (line ~177) on the unified company profile
    (`apps/web/src/app/companies/[slug]/page.tsx`). Renders the *same*
    `SocialFeed`/`SocialComposerSlot` components, scoped identically, but
    with its own already-rendered page header (page.tsx:213-262) instead of
    `SocialCompanyHero` — and no sidebar.
  - `SocialFeed`/`SocialComposerSlot` are genuinely shared; `SocialCompanyHero`
    is the one true duplicate.
- The root `/social` page (`apps/web/src/app/social/page.tsx`) is a separate,
  cross-company discovery feed (`SocialShell`, wrapped in `<AnonGate>`) — not
  scoped to one company. It has its own sidebar, `SocialSidebar.tsx`
  (`FollowingList`, lines 24-48), shown only `{isMember && <FollowingList />}`.
  This page is **not** being removed or restructured beyond one link-target
  change inside its sidebar.
- `SocialSidebar.tsx`'s Following-list links currently point to
  `/social/${c.companySlug}` (lines 36-44) — the route being deleted.
- `SocialComments.tsx` (`CommentRow`, lines 111-224):
  - Outer row has no padding of its own; spacing comes from the parent list
    (`gap-3` between rows, `p-3` block padding at line 535).
  - Byline/timestamp (line 137-139): `shortRelativeTime(createdAt)` from
    `socialTime.ts:2-12` — `"just now"` → `"{m}m"` → `"{h}h"` → `"{d}d"`
    (up to 6 days) → falls back to `toLocaleDateString()` (a full locale
    date, no time) at 7+ days.
  - Like/Dislike thumbs live inside `CommentRow` (lines 144-177, own flex
    row directly under the comment body). Reply/"View N replies" is rendered
    by the **parent** `SocialComments` component in a separate `ml-10` block
    below the row (lines 563-583) — not the same row, not the same component.
  - No rounded-card styling exists today (sharp borders already used) — the
    density request is about padding and button placement, not borders.
- Anonymous/member comment avatars (`apps/api/src/modules/social/social.service.ts`,
  ~lines 580-627, 920-980): identity is locked per `(user, post)` via
  `SocialCommentIdentityLock`. A `PERSONAL_CHOSEN` lock reuses the user's own
  onboarding-chosen `avatarKey`/`avatarGradient` (from the static 16-option
  pool); a `PERSONAL_RANDOM` lock uses one fixed sentinel avatar
  (`RANDOMIZED_IDENTITY_AVATAR_KEY = "randomized_identity"`, rendered as a
  fixed 🎭) shared by everyone in that mode. Company owners get their real
  uploaded photo. **No path queries another user's profile data.** Confirmed
  with the user: this system is correct as-is and is not being changed.
- `Company` (`apps/api/prisma/schema.prisma:522-528`) already has 7
  owner-editable social URL fields: `facebookUrl`, `instagramUrl`,
  `whatsappUrl`, `xUrl`, `linkedinUrl`, `youtubeUrl`, `glassdoorUrl` — all
  validated server-side by `httpUrlSchema`
  (`packages/shared-types/src/schemas/company.ts:43-46`), which already
  restricts to `http(s)://` and rejects `javascript:`/`data:`/etc. Only 4 of
  the 7 (`facebookUrl`, `instagramUrl`, `whatsappUrl`, `xUrl`) are rendered
  anywhere public today (`CompanyDetailsBox`, page.tsx:79-86) — `linkedinUrl`,
  `youtubeUrl`, `glassdoorUrl` are owner-settable but never shown to anyone.
- No `?sort=` URL-param convention exists anywhere in the app. The one
  existing sort UI (`WorkplaceBrowser.tsx`, `JobsBrowser.tsx`) uses local
  React state persisted to `sessionStorage`, rendered as a row of standalone
  toggle-pill buttons (not a dropdown) — explicit design choice per an
  in-code comment ("every option visible and clickable directly").
- `OwnerClaimPanel.tsx` (mounted at company page.tsx:347-349, below all
  three tabs) gates purely on the **viewer's own** claim state
  (`authLoading`/`isAuthenticated`/`onboardingStatus`/`claim === undefined`,
  line 35) and never checks whether the company already has an *approved*
  owner from someone else. There is no `isClaimed`/`ownerId` field on
  `Company` itself — ownership approval lives in a separate
  `CompanyOwnerClaim` model — **but a `hasApprovedOwner: boolean` field
  already exists on the public `companySchema`**
  (`packages/shared-types/src/schemas/company.ts:105`) and is already
  fetched into every `CompanyDetail` the company page loads; it's already
  used elsewhere on that same page (banner greyscale at page.tsx:188, the
  verification tick at page.tsx:236). `OwnerClaimPanel` just isn't passed
  it or checking it. (Correction from the initial brainstorming pass, which
  checked for `isClaimed`/`ownerId` by name and concluded a new backend
  field was needed — `hasApprovedOwner` already covers exactly that need.)

## Decisions made during brainstorming

1. **Avatars: no change.** The described leakage risk doesn't exist in the
   current implementation; the existing per-user lock/reuse system stays.
2. **Sort: client state, not a URL param.** Matches the existing
   `WorkplaceBrowser`/`JobsBrowser` toggle-pill + `sessionStorage` pattern
   rather than introducing a new `?sort=` convention used nowhere else.
3. **Route scope: delete only `/social/[slug]`.** The root `/social`
   discovery feed (`"IWT Social"` in the top nav) stays exactly as-is,
   untouched, as the cross-company explore/discover entry point. It also
   gains a new "Trending Today" section (see below) — new scope added
   during brainstorming, not in the original ticket.
4. **See Them on: all 7 fields.** Not just LinkedIn/X/Instagram — this also
   closes the pre-existing gap where 3 owner-set fields were never
   displayed anywhere.
5. **Top nav "IWT Social" link: unchanged**, still points at the (retained)
   root `/social` feed.
6. **Following-list link target (wherever it appears — root `/social`
   sidebar and the new company-tab sidebar): `/companies/[slug]?tab=social`**,
   replacing the deleted `/social/[slug]`.
7. **Timestamp: fully-abbreviated relative time, always** — extends the
   existing `shortRelativeTime` tiers past its current 6-day/full-date
   cutoff instead of switching to an exact date+time as the original ticket
   requested. Final tier scheme, no "ago" suffix anywhere (matches the
   existing no-suffix style exactly), months disambiguated from minutes:

   | Range | Format |
   |---|---|
   | < 1 minute | `just now` |
   | < 60 minutes | `{m}m` |
   | < 24 hours | `{h}h` |
   | < 7 days | `{d}d` |
   | < ~5 weeks | `{w}w` |
   | < 12 months | `{mo}mo` |
   | ≥ 1 year | `{y}y` |

   No backend change needed for this — `createdAt` is already persisted on
   every comment/reply regardless of display format; only the frontend
   formatting function changes.
8. **Claim banner: hide once the company has any approved owner**, not just
   when the viewer's own claim is non-null. Requires a small backend
   addition (see Component 6) since no such field is exposed today.

## Components

### 1. Routing consolidation

- Delete `apps/web/src/app/social/[slug]/page.tsx` and
  `apps/web/src/components/social/SocialCompanyHero.tsx`.
- `apps/web/src/app/social/page.tsx` (root feed) and its route: unchanged
  except for the Trending addition (Component 3) and no link-target changes
  within itself beyond its sidebar's Following list (Component 2).
- Anywhere in the codebase currently linking to `/social/[slug]` (confirmed
  so far: `SocialSidebar.tsx` Following list) must be updated to
  `/companies/[slug]?tab=social`. The implementation plan must grep for any
  other reference before considering this done (e.g. post-card "visit
  company" links, if any target the old route).
- `CompanyProfileTabs.tsx`'s existing "IWT Social" tab is renamed to
  "Social" (label only, `TabKey` value can stay `"social"`).

### 1a. Composer regression check

`/social/[slug]` (being deleted) renders `SocialComposerSlot` above its feed
— the only way a company owner posts is picking one of their approved
companies from that composer's own dropdown, not something tied to which
route rendered it. `CompanyProfileTabs`'s existing Social tab panel
currently has no composer at all. Deleting the standalone route without
moving `SocialComposerSlot` into the company-tab panel would silently
remove an owner's ability to post from a company-scoped view. The company
Social tab panel gains `<SocialComposerSlot />` above the feed, same as the
route being deleted had.

### 2. Company Social tab sidebar

- `SocialSidebar.tsx` is generalized to take a `mode: "global" | "company"`
  prop (plus, in company mode, the company's `slug` and its 7 social-link
  fields) instead of being root-feed-only. `FollowingList` behavior is
  identical in both modes (same hook, same link target per Decision 6).
- In `"company"` mode, the sidebar additionally renders:
  - **Sort control** (see Component 4) scoped to that company's post list.
  - **See Them on** section (see Component 5).
- `CompanyProfileTabs.tsx`'s social panel gains a two-column layout (feed +
  sidebar) where it currently has none — this is new markup, not a copy of
  the root feed's 3-column ad-rail shell (no ad slots inside a tab panel).

### 3. Trending Today (root `/social` only)

- New backend query on the social module: top posts created since the start
  of the current day (server TZ), ranked separately by like count and by
  comment count, small fixed limit (e.g. top 5 each) — exact endpoint shape
  (new route vs. a param on the existing feed endpoint) is an implementation
  decision, not a product one, deferred to the plan.
- Rendered as a distinct block in the root `/social` feed area (not the
  sidebar) — implementation plan decides exact placement (above the regular
  feed vs. a separate collapsible section).
- Computed live per request; no caching layer, consistent with the rest of
  this app's current scale.

### 4. Comment UI density + Reply placement

- `CommentRow` restructure: Reply / "View N replies" moves from the
  parent `SocialComments` component's separate `ml-10` block into the same
  flex row as the existing Like/Dislike thumbs (currently
  `SocialComments.tsx:144-177`). This requires passing whatever data
  currently drives the parent's reply-toggle/count down into `CommentRow`
  (or lifting the thumbs up to the parent) — the implementation plan picks
  the cleaner direction.
- Row padding tightened (reduce the `gap-3`/`p-3` block spacing per the
  "high density" ask) — sharp borders stay, no rounded-card treatment is
  introduced (none exists today; this is a non-goal, not a removal).
- Timestamp formatting per Decision 7 — extend `socialTime.ts`'s
  `shortRelativeTime`, replacing its `toLocaleDateString()` fallback.
- Font: no change needed — comments already inherit Plus Jakarta Sans from
  the global `<body>` font; no local override exists to remove.

### 5. "See Them on" external links

- All 7 `Company` social fields, each rendered only if non-null, as a
  compact list/grid of monochrome icon links in the company-mode sidebar.
- No new sanitization needed: `httpUrlSchema` already enforces `http(s)://`
  at the point these fields are written (owner dashboard save path), so any
  value reaching the frontend is already scheme-safe. The frontend renders
  `<a href>` directly, as `CompanyDetailsBox` already does for the 4 fields
  it shows today — same trust boundary, now extended to all 7.
- This is a display-only change. The admin-write schema gap (admin can't
  edit `linkedinUrl`/`youtubeUrl`/`glassdoorUrl`) is a pre-existing,
  separate issue and is out of scope here — flagged for a future ticket, not
  fixed by this one.

### 6. Sort control (company mode only)

- Toggle-pill buttons: Oldest → Newest → Most Liked → Most Commented,
  matching `WorkplaceBrowser`/`JobsBrowser`'s existing pill styling and
  `aria-pressed` pattern.
- State: local React state, persisted to `sessionStorage` keyed by company
  slug (so switching tabs/companies doesn't bleed one company's sort choice
  into another's), not a URL query param.
- Whether the sort re-fetches from the API or re-sorts an already-fetched
  page client-side is an implementation decision for the plan, informed by
  however `SocialFeed` currently paginates.

### 7. Claim banner gating fix

- No backend change needed — `hasApprovedOwner: boolean` already exists on
  the public `Company`/`CompanyDetail` type and is already fetched by the
  company page.
- `OwnerClaimPanel.tsx` gains a new prop, `hasApprovedOwner: boolean`,
  passed from `apps/web/src/app/companies/[slug]/page.tsx:348`
  (`<OwnerClaimPanel companySlug={slug} hasApprovedOwner={company.hasApprovedOwner} />`).
- `OwnerClaimPanel.tsx`'s existing gate (line 35) gets one more condition:
  return `null` if `hasApprovedOwner` is true, regardless of the viewer's
  own claim state. The panel's existing per-viewer-claim states
  (PENDING/APPROVED/REJECTED/null) are otherwise unchanged — this only adds
  a new "someone else already owns this, hide entirely" short-circuit above
  them.

## Data flow (company Social tab, end to end)

1. `apps/web/src/app/companies/[slug]/page.tsx` (Server Component) fetches
   `CompanyDetail` via `apiGetPublic`, which already includes the 7
   social-link fields (fetched today, just not all rendered) and
   `hasApprovedOwner` (already fetched and used elsewhere on this page).
2. `CompanyProfileTabs` receives this data, passes the 7 links + slug into
   `SocialSidebar` (mode="company") when the Social tab is active/visited.
3. `SocialSidebar` in company mode renders Following list (shared hook,
   unchanged data source) + Sort pills (local/session state) + See Them On
   (straight from the props, no extra fetch).
4. `SocialFeed scope={{kind:"company", slug}}` — unchanged data source,
   receives the current sort choice to apply (client-side sort of the
   already-fetched page, or a re-fetch with a sort param — plan decides).
5. `OwnerClaimPanel` receives `company.hasApprovedOwner` (already available
   on the same `CompanyDetail` object the page fetched) and applies the new
   short-circuit.

## Error handling

- Deleting `/social/[slug]` means that URL 404s going forward (Next.js
  default for a removed route) — this is the intended behavior per the
  ticket's own acceptance criteria ("old `/social/[slug]` route throws a
  404"), not a regression to guard against.
- Trending query: if it returns zero results (e.g., no posts yet today),
  the section should not render at all rather than show an empty block —
  implementation plan should specify this explicitly.

## Testing

- Routing: `/social/[slug]` 404s; Following-list links (both root-feed and
  company-tab sidebars) resolve to `/companies/[slug]?tab=social`.
- Comment UI: Reply/Like/Dislike sit on one flex row (snapshot or DOM
  structure test); timestamp formatting unit-tested across all 7 tiers
  including the minute/month non-collision (`5m` vs `5mo`).
- Claim banner: unit test `OwnerClaimPanel` with
  `hasApprovedOwner: true` + a non-null own-claim state, confirming it still
  renders nothing.
- See Them on: renders only for non-null fields; confirms no new sanitizer
  is needed by asserting `httpUrlSchema` rejection already covers
  non-http(s) schemes (likely already covered by existing schema tests —
  plan should confirm rather than assume).
- Sort: pill state persists per-company-slug in `sessionStorage` and doesn't
  leak between two different companies' tabs in the same session.
- Trending: query correctly excludes posts from before "start of today" and
  handles the zero-results case per Error Handling above.

## Out of scope

- Admin-write schema gap for `linkedinUrl`/`youtubeUrl`/`glassdoorUrl`
  (pre-existing, unrelated to this ticket).
- Any change to avatar assignment logic (explicitly confirmed unchanged).
- Any change to the root `/social` feed's existing behavior beyond adding
  the Trending Today section and the one Following-list link-target fix.

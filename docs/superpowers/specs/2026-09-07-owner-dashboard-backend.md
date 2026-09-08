# Owner Dashboard — Backend Spec

## Source

This spec transcribes the backend half of a two-part task the user pasted in
chat on 2026-09-07 (a "frontend UI/UX" prompt and a separate "backend
architecture and logic" prompt, each with its own scope fence). The backend
prompt's own `output_format` says: *"wait for approval before proceeding to
any frontend changes."* This spec — and the paired plan,
`docs/superpowers/plans/2026-09-07-owner-dashboard-backend.md` — covers only
that backend half. The frontend half is
`docs/superpowers/specs/2026-09-07-owner-dashboard-frontend.md`, which
depends on this one being implemented first (it consumes fields this plan
adds).

## Original ask (verbatim, 4 items)

> Project: iworkedthere.com — NestJS API, Prisma ORM (monorepo apps/api).
> Target Audience: Workers across all of Türkiye. The platform must remain
> secure, strictly protecting employee anonymity and stopping employer
> tampering.
>
> 1. **Image Storage & Cropping**: Implement an efficient backend storage
>    utility for company banners in the employer-profile module. Ensure
>    server-side compression and resizing so users don't need specific
>    resolutions.
> 2. **Badge Renaming**: Rename all instances of "Gold Tier" and "Gold Badge"
>    in the Prisma schema, admin-companies module, and API responses to
>    "Enterprise Tier" and "Enterprise Badge".
> 3. **Work-Type Locking Logic**: Fix the Work-Types bug by requiring
>    explicit save requests. Create a validation rule: If a company has
>    multiple work-types (e.g., "Office" and "Manual-Labour") and BOTH have
>    received employee reviews in the reviews module, lock these fields. The
>    API must reject any changes to them.
> 4. **Database Integrity & Seeding**: Apply example banners to the test
>    companies via the seeding scripts (e.g., in apps/api/scripts/), but
>    strictly preserve all existing demo and test companies (oil, clothing,
>    market). Do not alter their existing data.
>
> Do not touch or modify the frontend (apps/web) in this phase.

## What research found before planning (corrections to the ask's premises)

A full read of the current codebase (not just the task text) turned up several
places where the ask's framing doesn't match what's actually in the repo.
These are decisions, not just notes — the plan is built on them:

1. **"Gold" is a display string, not a tier.** `OwnerTier` (Prisma enum and
   the matching zod enum) has only ever been `FREE / BLUE / BLUE_PLUS /
   ENTERPRISE` — "Gold" never existed as an enum value, a DB column value, or
   an identifier. A repo-wide case-insensitive grep for `gold` found exactly
   9 hits, and **7 of the 9 live in `apps/web`**, not `apps/api`
   (`pricingTiers.ts`, `PremiumFeaturesPanel.tsx`, `PricingComparisonTable.tsx`,
   `CompanyWorkCard.tsx`) — only 2 are backend, and both are comments
   (`schema.prisma`, `decideBoostAccess.ts`). The ask lists this as backend
   work but scopes backend to "do not touch the frontend" in the same
   breath — those two constraints conflict for 7 of the 9 occurrences.
   **Decision:** this plan renames only the 2 backend comment occurrences.
   The 7 frontend occurrences (the actual user-visible rename: badge label
   copy, a `BADGE_STYLES` map key duplicated in two files, one alt-text
   ternary) are scoped into the *frontend* plan instead, where they belong by
   file location. See that spec's item covering badge sizing, which touches
   the same component.

2. **Banner upload already exists, end-to-end, shipped yesterday
   (commits `991f40c`/`8a0f30e`).** `OwnerService.uploadBanner`,
   `POST my-companies/:companyId/banner`, tier-gated to Blue+/Enterprise,
   writes to local disk, already rendered on browse cards and job cards. So
   item 1 isn't "build this from scratch" — it's two real, narrower gaps:
   - It validates the upload with `validateLogoFile` — the **logo's**
     square-aspect rule — against a banner, which is a 4:1 wide image. A
     square photo would currently be rejected by a rule that was never
     written for banners.
   - There is **no server-side resize or compression at all** (no `sharp`,
     no `jimp` in `apps/api`'s dependencies) — only client-side crop exists
     for logos, and the banner uploader (`BannerUploader.tsx`) has no crop
     step at all today. The task's own wording — *"so users don't need
     specific resolutions"* — is best satisfied by having the server accept
     any reasonably-sized photo and center-crop/resize/compress it to the
     card's fixed 4:1 shape, rather than rejecting non-conforming uploads.
   **Decision:** add `sharp` as a new `apps/api` dependency, replace the
   reused logo validator with a new, looser banner-specific one (format +
   size sanity only, no aspect requirement), and do the crop/resize/encode
   server-side. Storage moves to its own `uploads/company-banners/`
   directory rather than continuing to share `uploads/company-logos/`.

3. **Work-Type editing is currently completely unrestricted — and that was a
   deliberate, recent, documented choice, not an oversight.** The
   `updateCompanyInputSchema` comment in `packages/shared-types` says
   `workplaceTypes` was made owner-editable at the free tier, "superseding
   the earlier 'deferred to a future Plus phase, admin-only' note." There is
   no existing auto-save bug — every General Information field, including
   `workplaceTypes`, already only commits on the shared "Save changes"
   button click. The real, actionable part of item 3 is the **locking rule**
   itself, which genuinely does not exist yet in any form.
   **Decision — lock scope:** the lock applies to the **owner-facing**
   update path (`OwnerService.updateMyCompany`) only. The admin edit path
   (`AdminCompaniesService.update`) is deliberately left unrestricted, so
   staff can still fix a miscategorized company. This reads consistently
   with the product's own stated anonymity/anti-tampering design tension
   (CLAUDE.md) — the threat this rule defends against is an *owner* gaming
   their own classification after bad reviews land, not an admin data-entry
   fix.

4. **Banner tier gate: confirmed to stay as shipped, not narrowed.** The
   frontend half of this task's wording ("gray it out if the user lacks the
   Enterprise Tier membership") would have silently taken banner access away
   from paying Blue+ owners, contradicting the pricing matrix shipped
   yesterday (Blue+ and Enterprise both get it — see `canUseBanner()`,
   `apps/web/src/lib/pricingTiers.ts`). Asked the user directly; confirmed
   to **keep Blue+ and Enterprise**, both here (validation/upload gate is
   unchanged) and in the frontend plan (grey-out condition).

5. **"Oil, clothing, market" test companies are the real, already-seeded
   nationwide brand rows** (`apps/api/scripts/seed-nationwide-brands.ts`) —
   `Fuel & Energy` (TotalEnergies, Petrol Ofisi, Opet, Shell, Türkiye
   Petrolleri), `Clothing Retail` (LC Waikiki, DeFacto, Koton), `Supermarket`
   (A101, BİM, ŞOK, Migros, etc.) — not the 20 fictional placeholder
   companies in `reset-to-demo-companies.ts`, which use an unrelated category
   vocabulary. These are the same real-named rows already visible on the
   live homepage today.
   **Decision:** add a small, new, additive, idempotent script that sets
   `bannerImageUrl` (a generated placeholder banner image, not scraped brand
   photography — avoids any trademark/IP concern) on a handful of these
   already-seeded companies, **and** bumps their `badgeTier` to
   `BLUE_PLUS`/`ENTERPRISE` in the same script run — a banner never renders
   on a `FREE`-tier company regardless of `bannerImageUrl` being set
   (`canUseBanner()` gates on tier), so setting only one of the two fields
   would leave the frontend with nothing visible to test against. No
   existing script's logic changes; no existing company's other fields are
   touched.

## No schema/migration changes

Every item above is satisfied with service-layer code, one new shared-types
file, one new shared-types field on an existing schema, and one new seeding
script. **`schema.prisma` gets two comment edits only — no new columns, no
`prisma db push` needed for this plan.** `workplaceTypesLocked` is computed
per-request from existing `Review` rows, not stored.

## Out of scope (explicitly, per the user's own fence)

No `apps/web` file is touched by this plan. Where a "Gold" occurrence or a
UI-facing consequence of these backend changes needs frontend work, it is
listed in the frontend spec/plan instead, to be executed only after this
backend plan is reviewed and applied.

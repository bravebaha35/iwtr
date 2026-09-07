# Owner Dashboard — Frontend Spec

## Source

This spec transcribes the frontend half of a two-part task the user pasted
in chat on 2026-09-07 (a "frontend UI/UX" prompt and a separate "backend
architecture and logic" prompt, each with its own scope fence). The backend
prompt's `output_format` says *"wait for approval before proceeding to any
frontend changes"* — so this plan executes only after
`docs/superpowers/plans/2026-09-07-owner-dashboard-backend.md` has been
reviewed and applied. It consumes fields that plan adds
(`Company.workplaceTypesLocked`, the reworked `uploadBanner` response shape,
the example-banner-seeded companies).

## Original ask (verbatim, 7 items)

> Project: iworkedthere.com. Stack: Next.js (monorepo apps/web). Typography:
> Plus Jakarta Sans. UI/UX Goal: High accessibility for workers (Manual-Labour,
> Office, Service, Hybrid/Remote). Dark Mode and Light Mode must have absolute
> parity.
>
> Implement the frontend UI/UX updates. Do not modify the NestJS backend
> endpoints or database logic.
>
> 1. **Dashboard UI Fixes**: Remove the blue background bug in the dashboard
>    during dark mode. Ensure it matches light mode perfectly.
> 2. **Navigation Separation**: Extract the side menu from the editing
>    information area. Make it a standalone sidebar similar to the current
>    "Edit Profile" page.
> 3. **General Information Layout**: In the Dashboard, expand the text boxes
>    horizontally to fill the outlined box (horizontal position is the
>    priority). Position the card example at the top right of the box. Add a
>    helper note explaining how it will look to users.
> 4. **Premium Features Menu**: Move all premium feature options (except
>    Banner) out of "General Information" into a new dedicated "Premium
>    Features" side menu item. Leave the Banner option in "General
>    Information", but gray it out if the user lacks the Enterprise Tier
>    membership.
> 5. **Banner & Profile Photo UI**: Build a UI where the company profile
>    photo sits in the bottom left corner with the banner layered
>    behind/on top of it (similar to a Facebook profile layout). Apply this
>    to the employee-facing company rating page, and the job cards on both
>    "rating" and "hiring" pages. Ensure this works dynamically with the
>    newly added test company examples.
> 6. **Badge UI**: Increase the size of the new "Enterprise Badge"
>    components so they are highly visible to users.
> 7. **Work-Type UI**: Require users to explicitly click a "Save" button when
>    changing Work-Types. If the API indicates the work-types are locked
>    (because they have reviews), gray out the selection UI. Add a footnote
>    beneath stating: "Please mail us to change your work-types."

## What research found before planning (corrections to the ask's premises)

A full read of `apps/web/src/app/my/companies/page.tsx`,
`apps/web/src/components/owner/*`, `CompanyWorkCard.tsx`, `JobsBrowser.tsx`,
`apps/web/src/app/companies/[slug]/page.tsx`, `apps/web/src/app/me/page.tsx`,
and `apps/web/src/app/globals.css` turned up several places where the ask's
framing doesn't match the current codebase:

1. **The dark-mode "blue" bug is real, and its exact cause is 5 hardcoded
   Tailwind `gray-*` classes**, not a stray `bg-blue-*`. Every other themed
   surface in the app uses CSS custom-property tokens
   (`bg-surface`/`border-border`, defined in `globals.css`, dark palette is
   Tailwind's neutral zinc scale). The 5 owner-dashboard files built
   yesterday bypass that system with literal `gray-900`/`gray-800` — whose
   dark value (`#111827`) has a visibly blue-navy cast next to the rest of
   the app's neutral zinc dark mode (`#18181b`). Fix is mechanical: swap
   those 5 spots to the same tokens the rest of the app (and the correctly-
   styled `/me` page) already uses.

2. **"Navigation Separation" — the side menu is already its own component**
   (`OwnerDashboardSidePanel.tsx`, separate from `GeneralInfoCategory.tsx`
   etc.) — code-level extraction is already done. What isn't done is the
   *visual* separation the ask is actually describing: the side panel is
   currently wrapped in its own bordered/background box
   (`border-b ... bg-white ... dark:bg-gray-900 ... sm:rounded-xl sm:border`),
   which reads as a tab strip attached to the content, not a standalone
   sidebar. `/me`'s nav (the thing this task asks to match) is a bare `<nav>`
   with no wrapping box and a solid `bg-brand-600 text-white` active pill.
   **Decision:** restyle `OwnerDashboardSidePanel` to drop its box wrapper
   and adopt `/me`'s bare-nav treatment — this both satisfies item 2 and
   folds in that file's share of item 1's dark-mode fix.

3. **"Position the card example at the top right" is already true** — the
   live `CompanyWorkCard` preview is already `sm:absolute sm:right-6
   sm:top-6`. The real gap in item 3 is that the form column is capped at
   `max-w-xl` (576px) even though its `DashboardBox` container is much
   wider, so fields don't fill the available horizontal space the ask wants
   ("horizontal position is the priority") — and there's no explanatory
   caption near the preview yet ("helper note").

4. **Item 4's grey-out condition ("lacks the Enterprise Tier membership")
   was confirmed with the user, during backend planning, to stay as
   currently shipped: Blue+ *and* Enterprise both keep banner access.**
   Don't narrow it to Enterprise-only — see the backend spec's decision log,
   item 4. Separately, today the *entire* Premium Features box (banner
   included) is hidden outright for a non-paying owner
   (`{props.hasActivePaidTier && (...)}`) rather than shown-but-greyed. Item
   4 asks for the Banner field specifically to stay visible-but-greyed in
   General Information regardless of tier — that's a real behavior change
   from "hidden," not just a copy/styling tweak.

5. **The Facebook-style banner+avatar treatment has 3 distinct current
   states to reconcile, not one:**
   - `CompanyWorkCard.tsx` (rating-page browse grid + dashboard live
     preview, same component): banner already renders, logo renders in a
     separate inline row beside the name — no overlap today.
   - `JobsBrowser.tsx`'s `JobCard` (hiring page): has its own, separate
     banner+logo implementation (not the same component as above) — also no
     overlap today.
   - `apps/web/src/app/companies/[slug]/page.tsx` (employee-facing company
     page): has **no banner at all** today — this is net-new, not a
     restyle.
   All three need the overlap treatment; none can be fixed by editing one
   shared component, because they aren't one shared component.

6. **Badge size — only one render site exists.** The tick-image badge
   (`tickSrcForOwnerTier`, blue/blue+/gold `.webp` assets) renders in exactly
   one place in the whole app: `CompanyWorkCard.tsx`, fixed at 18×18px for
   every tier. `JobsBrowser.tsx`'s `JobCard` shows a plain text "· Verified"
   suffix instead (a different, unrelated boolean —
   `company.isVerifiedBadge`), and the company page shows a text pill
   ("{Tier} Badge"), not the tick image. Item 6 asks to enlarge "the new
   Enterprise Badge" specifically — scoped to bumping just the Enterprise
   tick's size at its one existing render site, not adding the tick image to
   new places.

7. **The "Gold" rename's frontend share.** Per the backend spec's decision
   log, 7 of the 9 repo-wide "Gold" occurrences are frontend files:
   `pricingTiers.ts` (a comment and the `PRICING_FEATURE_ROWS` "enterprise"
   badge-label value), `PremiumFeaturesPanel.tsx` and
   `PricingComparisonTable.tsx` (each has its own copy of a `BADGE_STYLES`
   map keyed by the string `"Gold"` — duplicated, not shared, between the
   two files), and `CompanyWorkCard.tsx` (an inline alt-text ternary).
   **Decision — asset filenames stay put.** The physical files
   (`blue tick.webp`, `blue+ tick.webp`, `gold tick.webp` in
   `apps/web/public/`) are not renamed — nobody sees a filename, and copying
   binary assets around for zero user-visible benefit isn't worth the
   risk. Every user-visible string, alt-text, and map key gets the rename;
   the file path a tick image is loaded from does not.

8. **Item 7's "explicit Save button" isn't fixing a missing gate — it's
   adding a dedicated one.** Every General Information field, including
   `workplaceTypes`, already only commits to the server when the box's
   single shared "Save changes" button is clicked; there is no existing
   auto-save bug. What item 7 is really asking for, read together with the
   locking requirement in the same item, is a **separate, dedicated** Save
   action for the Work-Type picker alone — decoupled from the rest of
   General Information's save — since a work-type change can now
   (backend plan, Task 3) become permanently locked, which makes it a
   qualitatively different, higher-stakes edit than renaming the company or
   changing its city. This requires new parent state in
   `apps/web/src/app/my/companies/page.tsx` (a dedicated save handler for
   just this one field) — it is not just a UI-only change confined to one
   component.

## Global grey-out/disabled pattern already in the codebase

Multiple existing, consistent patterns are available to reuse for the
locked-work-type UI rather than inventing a new one — see the plan's Task 6
for the exact one chosen (`SingleSelectDropdown`'s `disabled:` Tailwind
variants, already used in this same form for the District dropdown).

## Out of scope

No `apps/api` file, and no `packages/shared-types` schema file, is touched
by this plan — every field this plan reads (`workplaceTypesLocked`, the
banner upload response shape) already exists once the backend plan lands.
No new automated visual-regression tooling is introduced; verification is
via the dev server in a browser, per this project's existing convention
(CLAUDE.md: "For UI or frontend changes, start the dev server and use the
feature in a browser before reporting the task as complete").

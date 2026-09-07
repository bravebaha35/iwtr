# IWT Social — Frontend Spec

## Source

Pasted by the user mid-session on 2026-09-07, same prompt as
`docs/superpowers/specs/2026-09-07-iwt-social-backend.md` — this covers the
"FRONTEND OPERATIONS" half. Depends on the backend spec/plan being applied
first (every endpoint/field used here is defined there); also depends on
this session's owner-dashboard backend plan having landed, since it adds the
`sharp` dependency this feature's upload pipeline reuses.

## Original ask (verbatim, frontend half)

> CONTEXT: We are building a new "IWT Social" tab for iworkedthere.com. This
> is a dedicated social feed where verified employers can post photos and
> updates under their corporate identity, while employees can interact,
> comment, and like with 100% anonymity.
>
> STRICT RULES: Dual-Mode Isolation (execute sequentially). Design System:
> Plus Jakarta Sans, absolute Light/Dark parity (zinc-950 backgrounds,
> zinc-800 borders). Do not modify the existing "Hiring" page or the main
> "Home" rating feed.
>
> FRONTEND OPERATIONS (UI/UX)
> 1. **Top-Bar Navigation & Layout**: Add a new "IWT Social" tab to the top
>    navigation bar, routing to a completely separated `/social` page. Main
>    Feed: no sorting/filter dropdowns; a search box fixed to the top-left
>    strictly for searching specific company names. Ad Integration: inject
>    `<AdSlot />` after every 7th post as the user scrolls.
> 2. **Rating Page Cross-Promotion**: On a company's Rating page, hide the
>    full comments list past 3 by default, with a "See them all" down-arrow
>    expand button. Below the comments (collapsed or expanded), add a highly
>    visible banner titled "See what they are doing !", with the IWT Social
>    symbol on its top-bar, routing to that company's IWT Social profile.
> 3. **Company IWT Social Profile**: A hero card mirroring the top of the
>    Rating page — Company Icon, Banner, Work-types, Sector, overall
>    numerical rating with the dynamic Beaver face icons — plus a "Back to
>    Rating" button. Below it, the feed of that company's own posts.
>    Anonymous visitors can view the feed but must hit a Sign-in modal to
>    Like or Comment.
> 4. **Employer Posting UX (Old Facebook Style)**: A one-time welcome
>    pop-up when an Employer clicks the "IWT Social" tab: "You can share
>    your projects, photos or posts if you like !", with a 1:1 placeholder
>    box below the text for future design integration. At the top of the
>    feed, a minimalistic post-creation card — a grayed-out "Tell us what
>    you think !" text box that expands on click, with a prominent "+"
>    photo-attach button.

## What research found before planning

1. **"IWT Social" already exists in the top nav — as a disabled placeholder.**
   `GlobalHeader.tsx`:
   ```jsx
   <NavIconLink href="/social" label="IWT Social" title="IWT Social — coming soon" disabled>
   ```
   `disabled` makes it render as an inert `<span aria-disabled>`, not a
   `<Link>` — no navigation happens, and no `apps/web/src/app/social/`
   directory exists yet. Item 1 isn't "add a tab" from scratch — it's
   removing `disabled` (and the "coming soon" title) once the page it
   points at is real, plus building that page.

2. **`AdSlot` takes exactly one prop**, `orientation?: "vertical" |
   "horizontal"` — both variants are static placeholder boxes with no
   per-post/context awareness today. "Inject after every 7th post" is
   satisfied by mapping the feed array and interleaving
   `<AdSlot orientation="horizontal" />` every 7 items — no change to
   `AdSlot` itself needed.

3. **The "employer account" check is duplicated, not shared** —
   `GlobalHeader.tsx` and `JobsBrowser.tsx` each independently compute
   `isAuthenticated && onboardingStatus?.status === "ACTIVE" && role ===
   "COMPANY_OWNER"`. This plan extracts a small `useIsCompanyOwner()` hook
   (one clear reuse opportunity surfaced by research, not scope creep — 3
   call sites is exactly the threshold where a shared hook pays for itself)
   and uses it at all 3 sites (the 2 existing plus this feature's new ones)
   rather than adding a 4th copy of the same expression.

4. **No "anonymous click → sign-in modal" precedent exists.**
   `ReviewsList.tsx`'s existing vote buttons handle the anonymous case by
   `disabled` + a tooltip, not by opening `AuthModal`. `AuthModal` itself
   (globally mounted, controlled via `useAuth()`'s `openAuthModal`/
   `closeAuthModal`) is only ever triggered today from 2 static, top-level
   CTAs (header "Login" button, homepage hero). This plan's Like/Comment
   gate is the first place in the app to call `openAuthModal()` from a deep
   in-context interaction — the plumbing is fully reusable, the trigger
   pattern is new.

5. **The "dynamic Beaver face icons" the ask refers to are not on the
   company rating page today, and are not a shared component.** They live
   only in `WorkplaceBrowser.tsx` (`RATING_TICKS`, 3 static mood images,
   `activeMoodIndex(value)` picks which one is "lit" — scaled up, full
   opacity — vs. the other two, which sit scaled-down/grayscale/dimmed),
   used by the homepage's rating-filter slider. The company page instead
   shows a *different*, workplace-type-specific illustration
   (`ratingImageSrc`, 4 score bands, no "lit zone" animation) — that one
   stays untouched (rule 3 forbids touching the Home feed, and this
   component isn't part of it anyway, but no reason to touch it either).
   **Decision:** extract `RATING_TICKS`/`activeMoodIndex` out of
   `WorkplaceBrowser.tsx` into a small shared component
   (`BeaverRatingIcon`), used by both the (untouched) homepage slider and
   the new IWT Social hero card, rather than copy-pasting the 3-image
   zone-lit logic a second time. This touches `WorkplaceBrowser.tsx` only
   to replace its inline version with an import of the extracted piece —
   its rendered output is unchanged, so this does not violate "don't modify
   the Home rating feed" in effect (no behavior or pixel changes there),
   only in the sense of which file the code physically lives in. Flagging
   this explicitly since the rule is about *behavior*, not *file
   untouchability*, and I want that read on record rather than assumed.

6. **`ReviewsList` renders every review unconditionally today** — no limit,
   no pagination. The 3-then-expand behavior is fully new, added to this
   component (or a thin wrapper around it) rather than duplicating its
   ~180 lines of card-rendering logic elsewhere.

7. **No localStorage-backed "show this once" convention exists anywhere in
   the app.** The one "show once" UI (`ForbiddenBanner`) uses a
   server-set cookie plus in-memory state, not `localStorage`, so its
   dismissal doesn't survive a fresh page load on its own. The only loose
   precedent is `THEME_KEY = "iwtr:theme"`'s naming prefix. This plan
   introduces the first localStorage-backed one-time-popup pattern in the
   app (key: `iwtr:social-welcome-seen`), following that existing prefix
   convention since there's nothing more specific to match.

## Decisions this spec is locking in

- **The feed's company-name search box filters server-side** (see the
  backend spec's `q` param) — the frontend just debounces input and
  refetches, it does not filter an already-loaded page client-side.
- **The welcome pop-up is per-account, shown once ever** (not once per
  session) — `localStorage`, not `sessionStorage`, matching "one-time" in
  the literal task wording. It fires the first time an authenticated
  `COMPANY_OWNER` account clicks the (now-enabled) "IWT Social" nav link,
  checked client-side on mount of `/social`.
- **The 1:1 placeholder box in the welcome pop-up is exactly that — an
  empty bordered square, no content, no functionality** — the task
  explicitly says "for future design integration," so building anything
  more into it now would be building ahead of a spec that doesn't exist
  yet.
- **"See what they are doing !" banner and "Tell us what you think !" box
  keep the task's exact copy, including its spacing before the
  exclamation mark** — not normalized to standard English punctuation,
  since it's given as literal UI copy to use, not a description to
  paraphrase.

## Out of scope (explicit)

- No changes to `apps/web/src/components/JobsBrowser.tsx`'s own rendered
  behavior or `apps/web/src/components/WorkplaceBrowser.tsx`'s rendered
  behavior (per the task's rule 3) — `WorkplaceBrowser.tsx` is touched only
  to extract `BeaverRatingIcon` into its own file, as decided in point 5
  above, with no visible change.
- No comment-level likes, no admin moderation queue for posts/comments —
  see the backend spec's decision log.
- Does not start until `docs/superpowers/plans/2026-09-07-iwt-social-backend.md`
  is reviewed and applied.

# Sidebar Geometry Consistency — Design Spec

## Origin

A pasted brief asked for a "unified global layout" refactor: a persistent
left sidebar + top-bar locked to the Homepage's exact pixel geometry, zero
re-mount on navigation, plus an "Anonymous Mode" that cryptographically
hides nav links for logged-out users.

## Recon findings (why the literal brief doesn't fit this codebase)

- `GlobalHeader` (`apps/web/src/components/GlobalHeader.tsx`) is **already**
  mounted once in `apps/web/src/app/layout.tsx:90`, outside `{children}`. It
  already never re-mounts on navigation — that requirement is already met,
  nothing to build.
- There is no shared "Sidebar" **navigation** component. The left-hand panel
  on the Homepage (`WorkplaceBrowser.tsx`) is a company-filter panel
  (Work-Type / Sector / Rating / Location). The left-hand panel on `/social`
  (`SocialSidebar.tsx`, `mode="global"`) is a *different* component with
  unrelated filters (search / workplace-type / category / saved posts /
  following list). They are page content, not app chrome, and must keep
  their own distinct filter content — the brief's "component cleanup: remove
  duplicated sidebar imports" doesn't mean collapsing them into one
  component.
- There is no "Anonymous Mode" toggle anywhere in the app. This product's
  real anonymity guarantee is structural and server-side (reviewer identity
  hidden from the company and public, PII vault isolation — see root
  `CLAUDE.md`), not a client-side view a logged-in user switches into.
  `AnonGate` gates whole pages behind registration for logged-out visitors;
  it isn't a toggle a user flips.
- **What actually IS duplicated, and actually IS inconsistent** (confirmed
  by grep across `apps/web/src`): four call sites render the same aside
  shell inline, and two of them have already drifted apart:
  - `WorkplaceBrowser.tsx:462` — `flex shrink-0 flex-col gap-6 sm:w-56`
  - `JobsBrowser.tsx:405` — `flex shrink-0 flex-col gap-6 sm:w-56`
  - `SocialSidebar.tsx:243` (mode="company") — `flex shrink-0 flex-col gap-5 sm:w-56`
  - `SocialSidebar.tsx:262` (mode="global") — `flex shrink-0 flex-col gap-5 sm:w-56`

  Same for the row wrapper pairing sidebar + main content
  (`flex flex-col gap-6 sm:flex-row`), duplicated in `WorkplaceBrowser.tsx`,
  `JobsBrowser.tsx`, `SocialShell.tsx`, and `CompanyProfileTabs.tsx`
  (company Social tab).

  Width (`sm:w-56`) already matches everywhere. The one real drift is the
  vertical gap: `gap-6` (Homepage, Jobs) vs `gap-5` (both Social sidebar
  modes) — a genuine, fixable inconsistency.

## Clarified scope (user decision, 2026-09-22)

1. **Design-consistency only.** Lock the Homepage's exact values (`gap-6`,
   `sm:w-56`, `shrink-0`, `flex-col` for the aside; `flex flex-col gap-6
   sm:flex-row` for the row) as the single source of truth. Extract into
   shared shell components. Each page keeps its own distinct filter content
   as children — no merging of WorkplaceBrowser's filters into
   SocialSidebar's or vice versa. No new global nav-link sidebar.
2. **No new "Anonymous Mode" feature.** Any identity-conditional rendering
   inside these sidebars (e.g. `SocialSidebar`'s existing `isMember` gate on
   `FollowingList` / the Saved-Posts button) is preserved exactly as-is. Do
   not add a client-side identity-switch toggle.
3. Outer page containers (`max-w-[1600px]` on Homepage/Jobs vs the
   deliberately narrower, ad-rail-free shell on the Social tab / company
   Social tab — see `CompanyProfileTabs.tsx`'s existing comment explaining
   why that page is narrower on purpose) are **not** unified — only the
   sidebar-shell and sidebar+content row wrapper are.

## Acceptance criteria (translated to what's real)

- One shared component defines the aside shell; all 4 call sites use it;
  `gap-5` no longer appears anywhere for this pattern.
- One shared component defines the sidebar+content row; all 4 call sites
  use it.
- No visual regression on Homepage or Jobs (they already used `gap-6`).
- `/social` and the company profile's Social tab sidebar gain the corrected
  `gap-6` rhythm, verified with a live-browser screenshot comparison against
  the Homepage.
- Grep-verified: none of the 5 touched files use `dangerouslySetInnerHTML`
  or otherwise inject unescaped HTML from user/URL data (React's default
  escaping already covers company names, avatar data, social-link hrefs —
  `SeeThemOn` in `SocialSidebar.tsx` already documents that hrefs are
  scheme-validated at write time). This is a verification step, not new
  sanitization work — no DOMPurify dependency needed unless the grep finds
  an actual gap.

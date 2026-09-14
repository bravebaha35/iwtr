# Job Posting Lifecycle & Risk Score — Frontend Spec

## Source

Frontend half of the combined ask in
`docs/superpowers/specs/2026-09-15-job-lifecycle-risk-score-backend.md` — see
that spec for the full original-ask quote and the brainstorming decisions
(sub-project order A→B→C, the `workType` field, the FILLED-triggered risk
rule, lazy on-read reshare, the 30-day saved-posting grace window). This spec
assumes every endpoint and field listed there already exists and is
verified. Do not start this until that spec's implementation is done and
tested — the user's own stated rule: *"Dual-Mode Isolation: Execute backend
data logic first, verify, then build the frontend UI."*

## Design-system constraints (apply to every item below)

- **Font**: already Plus Jakarta Sans site-wide (`layout.tsx` +
  `globals.css`) — no action needed, just don't introduce a competing
  font-family anywhere in new markup.
- **Dark/light parity**: every new color (badge, greyed-out card, modal,
  button) must use this app's existing CSS custom properties
  (`text-foreground`, `bg-surface`, `border-border`, etc. — the same tokens
  every existing component in this codebase uses) rather than a hardcoded
  hex, so both themes stay in sync automatically. No new one-off colors.
- **Accessibility / no geographic bias**: nothing new here reads or displays
  a city/region, so this mostly just means: no hardcoded "popular cities"
  list, touch targets sized normally for mobile (the existing icon-button
  sizing in `SocialSidebar.tsx`/`SocialComments.tsx`, e.g. `h-4 w-4` icons
  inside a padded button, is the right precedent to copy). The existing
  `CityDistrictPicker` is already location-neutral — no changes needed to
  it.

## 1. Risk Score badge

New component: `src/components/jobs/RiskScoreBadge.tsx`.
`{ riskScore: number }` prop (0-3). Renders `riskScore` small warning-
triangle icons (reuse a simple inline SVG triangle, same style convention as
`ThumbUpIcon`/`ChevronIcon` in `SocialComments.tsx` — `viewBox="0 0 24 24"`,
`stroke="currentColor"`) followed by the text `Risk Score: {riskScore}/3`.
When `riskScore === 0`, render nothing (a clean company shows no badge at
all — avoids cluttering every card with "Risk Score: 0/3").
Color: red-toned (`text-red-600 dark:text-red-400`, same pairing already
used elsewhere in this codebase for warnings, e.g. `ReportedCommentsPanel`).

Mount it in:
- `JobCard.tsx` — small, in the footer row next to the existing work-type
  label/chain-store flag/review-count line.
- Company profile page (the page `apiGetPublic` fetches for
  `app/companies/[slug]/page.tsx`) — near the existing rating/verification
  display.

(`CompanyJobPostings.tsx`'s tab already reaches this for free since it
reuses `JobCard`.)

## 2. Job creation flow changes

**`JobSetupModal.tsx`** — add a required work-type picker. If the posting
company (`company.workplaceTypes`) has exactly one work type, auto-select it
with no visible control (zero added friction for the common case). If it has
more than one, render a simple single-select (radio group or dropdown,
matching this modal's existing field style) so the owner picks which one
this specific posting is for.

**`JobBoostModal.tsx`** — this is the modal whose button actually fires the
create `POST` (`JobBoostModal.tsx:121`), so both new checkboxes belong here,
directly above its existing Publish button, not in `JobSetupModal`:

1. **Mandatory disclaimer checkbox.** Unchecked by default; Publish stays
   disabled until checked. Label text — use this exact English text
   verbatim, per the user's explicit instruction ("use the provided English
   text for the employer agreement logic"):

   > By publishing this job, you accept our Fair Hiring Rules. To prevent
   > job-board spamming and protect workers from high-turnover roles,
   > posting the exact same position and work-type repeatedly will increase
   > your company's public 'Risk Score' up to a maximum of 3. This score is
   > visible to all workers. You cannot simply post and delete jobs to
   > manipulate the system. Furthermore, all worker applications are
   > anonymous by default; we prioritize direct, bias-free contact by
   > providing only candidate emails and phone numbers.

2. **Reshare checkbox**, independent of the disclaimer, optional (does not
   block Publish): label `"Re-share automatically after 30 days"`. Maps
   directly to `autoReshareEnabled` in the create request body.

## 3. Employer job postings dashboard (new)

New page: `src/app/my/companies/[companyId]/job-postings/page.tsx` (the
`/my/companies` flow currently has no per-company sub-routes at all — this
is the first one). Linked from the existing `OwnedCompanyCard`'s side panel
(`OwnerDashboardSidePanel.tsx`), which today only has `general-info` /
`premium-features` / `contact-social` / `reviews-ratings` — add a
`job-postings` category there alongside them, following that file's existing
pattern.

Fetches `GET my-companies/:companyId/job-postings`. Renders each posting
(reuse `JobCard`-style presentation, or a simpler owner-oriented row — the
public `JobCard` assumes a public shape and a "contact this company" framing
that doesn't fit an owner looking at their own listing, so a distinct,
simpler `OwnerJobPostingRow` component is cleaner than forcing `JobCard` to
serve two purposes). Shows `status` and `daysRemaining`. A **Remove** button
appears only on `PUBLISHED` rows.

## 4. Remove confirmation modal (new)

New component: `src/components/jobs/RemoveJobPostingModal.tsx`, styled like
the existing `RivalAnalyticsRequestModal.tsx` overlay pattern (`fixed
inset-0 z-50 flex items-center justify-center bg-black/50`, a centered
`bg-surface` card).

- Header, exact text: `"Are you sure you want to remove this post ?"`
- Button 1 (action) — exact text: `"Yes, already hired someone."`. Highly
  visible green (`bg-green-600 hover:bg-green-700 text-white`, matching how
  this codebase already renders its other clearly-positive action, e.g. the
  Helpful vote's green). Calls
  `POST my-companies/:companyId/job-postings/:jobPostingId/mark-filled`,
  then removes the row from the dashboard list on success.
- Button 2 (cancel) — exact text (with the real number substituted):
  `"No, I will wait until my post expires ({daysRemaining} days left)"`.
  Neutral/secondary styling (same as this codebase's existing Cancel
  buttons, e.g. the Report modal's Cancel). Purely closes the modal — no
  network call, per the ask's own description of it as a no-op cancel.

## 5. Jobs page sidebar — Following + Saved Posts

`JobsBrowser.tsx`'s inline `<aside>` (currently Work-Type / Sector / Rating
/ City filters only) gains, above those filters:

- **Following list** — reuse the existing `useFollowedCompanies` hook
  (already built for `SocialSidebar.tsx`'s `FollowingList`) rather than
  building a second one. Scrollable list, **company names only, no logos**
  per the ask. Single-select: clicking a name filters `JobsBrowser`'s
  results to that one company (client-side filter against the already-
  fetched company list, same as the existing Work-Type/Sector filters do).
  Clicking a different name swaps the filter to the new company. Clicking
  the currently-selected name again deselects it and restores the
  unfiltered, all-companies view — standard single-select toggle behavior,
  matching the ask's "deselecting a company restores the global view."
- **Saved Posts button** — the same bookmark icon used on the card (see
  below), next to the text `"Saved Posts"`, styled as a responsive toggle
  button (copy `SocialSidebar.tsx`'s existing Saved-Posts-toggle pattern).
  When active, `JobsBrowser` switches its data source to
  `GET me/saved-job-postings` instead of the normal company/postings query.

## 6. Job card bookmark icon + expired-card styling

**`JobCard.tsx`** — add a generic bookmark icon (simple inline SVG, same
style convention as the other icon components in this codebase — outline
default, filled when saved) positioned bottom-right of the card (`absolute
bottom-3 right-3` inside the card's existing `relative` container, or
equivalent). Wired to `POST me/saved-job-postings/:jobPostingId` (toggle).
Only shown when `isAuthenticated` (matches how vote buttons already handle
anonymous viewers elsewhere in this codebase — prompt login on click rather
than hiding the icon entirely).

**Expired/removed rendering, Saved-Posts view only**: when a `JobCard` is
rendered inside the Saved Posts view and its posting's `expired` flag is
true (from the `GET me/saved-job-postings` response), render the whole card
at reduced opacity (`opacity-50` or similar) with every interactive
element — contact popovers, the bookmark icon itself, any link — disabled
(`pointer-events-none`, `aria-disabled`). Text content (title, description,
company name) stays fully legible; only interactivity and full-color styling
are suppressed. This needs a new optional prop on `JobCard`, e.g. `expired?:
boolean`, defaulting to `false` everywhere else it's used (the public
browse grid and the company profile tab are unaffected).

## Testing

No automated frontend test suite exists in this repo yet (per CLAUDE.md).
Verification is manual, in a real browser, per this codebase's established
practice for UI work:
- Post a job as the demo owner, confirm the disclaimer text renders exactly
  as specified and Publish is disabled until checked.
- Confirm the Risk Score badge appears (or is absent at 0) in all three
  places (Jobs list card, company profile tab, company profile page) after
  the backend spec's live verification pushes a demo company's score above
  0.
- Remove a posting, confirm the modal's exact copy, confirm the green button
  actually calls mark-filled and the row leaves the public Jobs feed while
  staying in the owner dashboard.
- Save a posting as a different (worker) account, let it lapse or mark it
  filled from the owner side, confirm it shows greyed-out and inert in
  Saved Posts rather than disappearing.
- Toggle both dark and light mode on every new surface.

## Out of scope

- No new i18n/translation framework. The user asked for "Turkish and
  English where applicable" but gave exact English text for the one
  legally-significant string (the disclaimer) — that string is used
  verbatim in English per explicit instruction. Any other new short UI
  labels (button text, headers) follow this app's existing mixed-language
  convention (mostly English chrome, Turkish for Turkey-specific legal/
  cultural terms like the existing "KVKK Aydınlatma Metni" footer link) —
  no new translation infrastructure is being built for this feature.
- The existing public Work-Type filter's semantics are unchanged (see the
  backend spec's matching out-of-scope note).

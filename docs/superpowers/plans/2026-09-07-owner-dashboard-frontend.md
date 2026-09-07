# Owner Dashboard — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the owner dashboard's dark-mode parity bug, give it a
standalone sidebar and a dedicated "Premium Features" category, widen its
form layout, apply a Facebook-style banner+avatar treatment across 3 render
sites, enlarge the Enterprise tick badge, and add a decoupled Save + lock UI
for Work-Type edits — with zero `apps/api` or `packages/shared-types`
changes.

**Architecture:** All changes are Tailwind class fixes and React component
restructuring within `apps/web`. The owner dashboard
(`apps/web/src/app/my/companies/page.tsx` + `apps/web/src/components/owner/`)
gets a 4th sidebar category and its General Information box loses its
Premium Features sub-box (moved to the new category, Banner excepted). The
shared `CompanyWorkCard` component and `JobsBrowser`'s local `JobCard` both
get the same banner+avatar overlap treatment; the company detail page gets a
banner for the first time. Every field this plan reads
(`Company.workplaceTypesLocked`, the banner upload response) comes from the
backend plan — **do not start this plan until
`docs/superpowers/plans/2026-09-07-owner-dashboard-backend.md` has been
reviewed and applied.**

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, Tailwind v4
(CSS custom-property tokens, see `globals.css`), Jest + React Testing
Library (`apps/web` has both configured, though most tasks below are pure
layout/CSS with no new logic to unit-test — verified via dev server instead,
per this project's own convention).

**Spec:** `docs/superpowers/specs/2026-09-07-owner-dashboard-frontend.md` —
read it first. It documents 8 corrections to the original task text
(the sidebar is already its own component; the preview is already
top-right; the banner tier gate stays Blue+/Enterprise per a decision made
during backend planning; the 3 banner+avatar render sites are 3 separate
implementations, not one shared component; etc.).

## Global Constraints

- Do not modify any file under `apps/api` or `packages/shared-types` in
  this plan.
- Dark/light parity: every structural surface uses the CSS-variable tokens
  (`bg-surface`, `bg-background`, `border-border`, `text-muted-foreground`)
  already defined in `apps/web/src/app/globals.css` — never a literal
  `gray-*`/`blue-*` Tailwind shade for a background or border.
- Typography (Plus Jakarta Sans) is already global via `--font-sans` — no
  action needed in this plan, just don't override it.
- Banner tier gate stays `BLUE_PLUS`/`ENTERPRISE` (via the existing
  `canUseBanner()` in `apps/web/src/lib/pricingTiers.ts`) everywhere in this
  plan — do not narrow it to Enterprise-only.
- The 3 static tick-badge asset files (`blue tick.webp`, `blue+ tick.webp`,
  `gold tick.webp` in `apps/web/public/`) keep their current filenames —
  only user-visible copy, alt text, and map keys get the Enterprise rename.
- After each task, run `cd apps/web && pnpm exec tsc --noEmit` and fix any
  type error before moving to the next task — several tasks touch shared
  prop interfaces consumed by `apps/web/src/app/my/companies/page.tsx`.
- Verify visually with the dev server (`cd apps/web && pnpm dev`) in both
  light and dark mode after each task, per CLAUDE.md's own convention for
  UI work in this repo.

---

### Task 1: Dark-mode parity fix (4 files)

**Files:**
- Modify: `apps/web/src/app/my/companies/page.tsx:441`
- Modify: `apps/web/src/components/owner/sections/GeneralInfoCategory.tsx:75-82`
- Modify: `apps/web/src/components/owner/sections/ContactSocialCategory.tsx:57`
- Modify: `apps/web/src/components/owner/sections/ReviewsRatingsCategory.tsx:19`

**Interfaces:** None — pure class-string swap, no props/behavior change.

- [ ] **Step 1: Fix the dashboard card's outer wrapper**

In `apps/web/src/app/my/companies/page.tsx`, replace:

```tsx
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
```

with:

```tsx
    <div className="rounded-xl border border-border bg-surface p-5">
```

- [ ] **Step 2: Fix `GeneralInfoCategory`'s shared `DashboardBox`**

In `apps/web/src/components/owner/sections/GeneralInfoCategory.tsx`, replace:

```tsx
function DashboardBox({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`relative rounded-xl border border-gray-200 p-6 dark:border-gray-800 ${className}`}>
      <h3 className="mb-3 font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}
```

with:

```tsx
function DashboardBox({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`relative rounded-xl border border-border p-6 ${className}`}>
      <h3 className="mb-3 font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Fix `ContactSocialCategory`'s box**

In `apps/web/src/components/owner/sections/ContactSocialCategory.tsx`, replace:

```tsx
      className="rounded-xl border border-gray-200 p-6 dark:border-gray-800"
```

with:

```tsx
      className="rounded-xl border border-border p-6"
```

- [ ] **Step 4: Fix `ReviewsRatingsCategory`'s box**

In `apps/web/src/components/owner/sections/ReviewsRatingsCategory.tsx`, replace:

```tsx
      className="rounded-xl border border-gray-200 p-6 dark:border-gray-800"
```

with:

```tsx
      className="rounded-xl border border-border p-6"
```

- [ ] **Step 5: Verify no hardcoded gray remains in the dashboard**

Run: `grep -rn "gray-2 00\|gray-800\|gray-900" apps/web/src/app/my/companies apps/web/src/components/owner 2>/dev/null || grep -rn "gray-200\|gray-800\|gray-900" apps/web/src/app/my/companies apps/web/src/components/owner`
Expected: no matches (Task 2 will separately clean the same pattern out of
`OwnerDashboardSidePanel.tsx`, the one remaining file with it).

- [ ] **Step 6: Manual dark-mode check**

Start `cd apps/web && pnpm dev`, open `/my/companies` as an owner, toggle
dark mode. Confirm the card background and the 3 content boxes now match
the same neutral zinc dark tone every other card in the app uses (compare
against `/me`), with no blue-navy cast.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/my/companies/page.tsx apps/web/src/components/owner/sections/GeneralInfoCategory.tsx apps/web/src/components/owner/sections/ContactSocialCategory.tsx apps/web/src/components/owner/sections/ReviewsRatingsCategory.tsx
git commit -m "fix(web): dashboard dark-mode parity — replace hardcoded gray with theme tokens"
```

---

### Task 2: Restyle the sidebar to a standalone, bare-nav pattern

**Files:**
- Modify: `apps/web/src/components/owner/OwnerDashboardSidePanel.tsx`

**Interfaces:** None — same `{ active, onChange }` props, styling only.

- [ ] **Step 1: Replace the nav markup**

In `apps/web/src/components/owner/OwnerDashboardSidePanel.tsx`, replace:

```tsx
  return (
    <nav
      aria-label="Company dashboard sections"
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900 sm:w-56 sm:flex-col sm:overflow-visible sm:rounded-xl sm:border sm:p-3"
    >
      {CATEGORIES.map((c) => {
        const isActive = c.key === active;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onChange(c.key)}
            aria-current={isActive ? "page" : undefined}
            className={`shrink-0 rounded-lg px-3 py-2 text-left text-sm font-medium transition sm:shrink ${
              isActive
                ? "bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200"
                : "text-foreground hover:bg-surface-muted"
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </nav>
  );
```

with:

```tsx
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
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
              isActive ? "bg-brand-600 text-white" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </nav>
  );
```

- [ ] **Step 2: Manual check**

In the dev server, confirm the sidebar now reads as a separate floating
column (no box/border around the whole nav) with a solid brand-colored pill
on the active item, visually matching `/me`'s sidebar. Check both light and
dark mode, and the mobile horizontal-scroll layout (narrow viewport).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/owner/OwnerDashboardSidePanel.tsx
git commit -m "style(web): restyle owner dashboard sidebar to match /me's standalone nav"
```

---

### Task 3: Split out "Premium Features" as its own category; widen and annotate General Information

**Files:**
- Modify: `apps/web/src/components/owner/OwnerDashboardSidePanel.tsx` (add
  the 4th category)
- Create: `apps/web/src/components/owner/sections/PremiumFeaturesCategory.tsx`
- Modify: `apps/web/src/components/owner/sections/GeneralInfoCategory.tsx`
  (remove the moved fields, widen the form column, add the helper note, make
  Banner always-visible-but-greyed)
- Modify: `apps/web/src/app/my/companies/page.tsx` (new render case, prop
  re-threading, move `bannerImageUrl` save from `savePremium` into
  `saveGeneralInfo`)

**Interfaces:**
- Produces: `OwnerDashboardCategory` gains a 4th member,
  `"premium-features"`. `PremiumFeaturesCategoryProps` (new) —
  `{ claim, companySlug, companyId, hasActivePaidTier, onStartUpgrade,
  featuredReviewId, setFeaturedReviewId, onSavePremium, premiumSaving,
  premiumStatus, premiumError, showRivalAnalytics, setShowRivalAnalytics,
  hasFreeRivalAnalyticsRequest, rivalAnalyticsFreeRequestUsed,
  onFreeCreditUsed, onOpenPricing }`.
- Consumes (in `page.tsx`): unchanged existing state (`featuredReviewId`,
  `premiumSaving`, `showRivalAnalytics`, etc.) — only re-threaded to a
  different child component, not renamed.

- [ ] **Step 1: Add the 4th category**

In `apps/web/src/components/owner/OwnerDashboardSidePanel.tsx`, replace:

```tsx
export type OwnerDashboardCategory = "general-info" | "contact-social" | "reviews-ratings";

const CATEGORIES: { key: OwnerDashboardCategory; label: string }[] = [
  { key: "general-info", label: "General Information" },
  { key: "contact-social", label: "Contact & Social Media" },
  { key: "reviews-ratings", label: "Reviews & Ratings" },
];
```

with:

```tsx
export type OwnerDashboardCategory = "general-info" | "premium-features" | "contact-social" | "reviews-ratings";

const CATEGORIES: { key: OwnerDashboardCategory; label: string }[] = [
  { key: "general-info", label: "General Information" },
  { key: "premium-features", label: "Premium Features" },
  { key: "contact-social", label: "Contact & Social Media" },
  { key: "reviews-ratings", label: "Reviews & Ratings" },
];
```

- [ ] **Step 2: Create `PremiumFeaturesCategory.tsx`**

Create `apps/web/src/components/owner/sections/PremiumFeaturesCategory.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import type { MyCompanyClaim, PublicReview } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { SingleSelectDropdown } from "@/components/Dropdown";
import { PremiumFeaturesPanel } from "@/components/PremiumFeaturesPanel";
import { RivalAnalyticsRequestModal } from "@/components/RivalAnalyticsRequestModal";
import { tierKeyFromOwnerTier } from "@/lib/pricingTiers";

const PAID_TIER_PRICES: { tier: "BLUE" | "BLUE_PLUS" | "ENTERPRISE"; label: string; price: string }[] = [
  { tier: "BLUE", label: "Blue", price: "299,99₺" },
  { tier: "BLUE_PLUS", label: "Blue+", price: "499,99₺" },
  { tier: "ENTERPRISE", label: "Enterprise", price: "999,99₺" },
];

export interface PremiumFeaturesCategoryProps {
  claim: MyCompanyClaim;
  companySlug: string;
  companyId: string;
  hasActivePaidTier: boolean;
  onStartUpgrade: (tier: "BLUE" | "BLUE_PLUS" | "ENTERPRISE") => void;

  featuredReviewId: string | null;
  setFeaturedReviewId: (v: string | null) => void;
  onSavePremium: () => void;
  premiumSaving: boolean;
  premiumStatus: string | null;
  premiumError: string | null;

  showRivalAnalytics: boolean;
  setShowRivalAnalytics: (v: boolean) => void;
  hasFreeRivalAnalyticsRequest: boolean;
  rivalAnalyticsFreeRequestUsed: boolean;
  onFreeCreditUsed: () => void;
  onOpenPricing: () => void;
}

function DashboardBox({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`relative rounded-xl border border-border p-6 ${className}`}>
      <h3 className="mb-3 font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

// This category is reachable from the sidebar at every tier — a Free-tier
// owner sees an upsell instead of a blank/broken page, same spirit as the
// dashed upsell box General Information already shows for Description/
// Website/Banner on a lower tier.
export function PremiumFeaturesCategory(props: PremiumFeaturesCategoryProps) {
  const [ownReviews, setOwnReviews] = useState<PublicReview[] | null>(null);

  useEffect(() => {
    if (!props.hasActivePaidTier) return;
    let cancelled = false;
    apiGet<PublicReview[]>(`/companies/${props.companySlug}/reviews`)
      .then((rows) => {
        if (!cancelled) setOwnReviews(rows);
      })
      .catch(() => {
        if (!cancelled) setOwnReviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, [props.hasActivePaidTier, props.companySlug]);

  if (!props.hasActivePaidTier) {
    return (
      <DashboardBox title="Premium Features" className="border-amber-300 bg-amber-50/20 dark:border-amber-700/50 dark:bg-amber-950/10">
        <p className="text-sm text-muted-foreground">
          Featured review spotlight, priority response, competitor benchmarking, and more unlock on a paid tier.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PAID_TIER_PRICES.map((t) => (
            <button
              key={t.tier}
              type="button"
              onClick={() => props.onStartUpgrade(t.tier)}
              className="rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-400 dark:hover:bg-brand-950"
            >
              {t.label} — {t.price}
            </button>
          ))}
        </div>
      </DashboardBox>
    );
  }

  const publishedOwnReviews = (ownReviews ?? []).filter((r) => r.status === "PUBLISHED");
  const priorityResponse = props.claim.tier === "ENTERPRISE" || props.claim.tier === "BLUE_PLUS";

  return (
    <DashboardBox title="Premium Features" className="border-amber-300 bg-amber-50/20 dark:border-amber-700/50 dark:bg-amber-950/10">
      <div className="flex flex-col gap-4">
        <label className="text-xs font-medium text-muted-foreground">
          Featured review spotlight
          <div className="mt-1">
            <SingleSelectDropdown
              value={props.featuredReviewId}
              onChange={props.setFeaturedReviewId}
              placeholder="Choose a published review to feature"
              options={publishedOwnReviews.map((r) => ({
                value: r.id,
                label: `${r.generalThoughts ? r.generalThoughts.slice(0, 60) : "(no comment)"}${
                  r.generalThoughts && r.generalThoughts.length > 60 ? "…" : ""
                }`,
              }))}
            />
          </div>
        </label>

        <button
          onClick={props.onSavePremium}
          disabled={props.premiumSaving}
          className="self-start rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Save Premium Features
        </button>
        {props.premiumStatus && <p className="text-sm text-green-700 dark:text-green-400">{props.premiumStatus}</p>}
        {props.premiumError && <p className="text-sm text-red-600 dark:text-red-400">{props.premiumError}</p>}

        <div className="border-t border-border pt-4">
          <h4 className="mb-1 text-sm font-semibold text-foreground">Priority response</h4>
          <span
            className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
              priorityResponse
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-surface-muted text-muted-foreground"
            }`}
          >
            {priorityResponse ? "Priority — 4 hour response" : "Standard"}
          </span>
        </div>

        <div className="border-t border-border pt-4">
          <h4 className="mb-1 text-sm font-semibold text-foreground">Competitor benchmark</h4>
          <p className="mb-3 text-sm text-muted-foreground">
            See how another company compares — overall rating, most agreed/disputed questions, and workplace vibe
            flags, delivered as a PDF to your inbox.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => props.setShowRivalAnalytics(true)}
              className="rounded-lg border border-brand-300 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-400 dark:hover:bg-brand-950"
            >
              Request Rival Analytics
            </button>
            {props.hasFreeRivalAnalyticsRequest && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                1 Free Request available
              </span>
            )}
          </div>
          {props.showRivalAnalytics && (
            <RivalAnalyticsRequestModal
              requestingCompanyId={props.companyId}
              rivalAnalyticsTier={props.claim.rivalAnalyticsTier}
              rivalAnalyticsFreeRequestUsed={props.rivalAnalyticsFreeRequestUsed}
              onClose={() => props.setShowRivalAnalytics(false)}
              onFreeCreditUsed={props.onFreeCreditUsed}
            />
          )}
        </div>

        <PremiumFeaturesPanel tierKey={tierKeyFromOwnerTier(props.claim.tier)} onOpenPricing={props.onOpenPricing} />
      </div>
    </DashboardBox>
  );
}
```

- [ ] **Step 3: Rewrite `GeneralInfoCategory.tsx`**

Replace the entire file `apps/web/src/components/owner/sections/GeneralInfoCategory.tsx` with:

```tsx
"use client";

import type { CompanyDetail, MyCompanyClaim, WorkplaceType } from "@iwtr/shared-types";
import { MultiFilterPillGroup } from "@/components/FilterPillGroup";
import { SingleSelectDropdown } from "@/components/Dropdown";
import { WORKPLACE_TYPES } from "@/lib/workplaceTypes";
import { CompanyLogoUploader } from "@/components/CompanyLogoUploader";
import { BannerUploader } from "@/components/owner/BannerUploader";
import { CompanyWorkCard, type CompanyWorkCardData } from "@/components/company/CompanyWorkCard";
import { canUseBanner } from "@/lib/pricingTiers";

const PAID_TIER_PRICES: { tier: "BLUE" | "BLUE_PLUS" | "ENTERPRISE"; label: string; price: string }[] = [
  { tier: "BLUE", label: "Blue", price: "299,99₺" },
  { tier: "BLUE_PLUS", label: "Blue+", price: "499,99₺" },
  { tier: "ENTERPRISE", label: "Enterprise", price: "999,99₺" },
];

export interface GeneralInfoCategoryProps {
  claim: MyCompanyClaim;
  detail: CompanyDetail | null;
  companySlug: string;
  companyId: string;
  companyName: string;

  name: string;
  setName: (v: string) => void;
  workplaceTypes: WorkplaceType[];
  toggleWorkplaceType: (v: WorkplaceType) => void;
  onResetWorkplaceTypes: () => void;
  onSaveWorkplaceTypes: () => void;
  workplaceTypesSaving: boolean;
  workplaceTypesStatus: string | null;
  workplaceTypesError: string | null;
  category: string | null;
  setCategory: (v: string | null) => void;
  sectorOptions: { value: string; label: string }[];
  mainPhotoUrl: string;
  setMainPhotoUrl: (v: string) => void;
  city: string | null;
  setCity: (v: string | null) => void;
  district: string | null;
  setDistrict: (v: string | null) => void;
  cityOptions: { value: string; label: string }[];
  districtOptions: { value: string; label: string }[];
  isHiring: boolean;
  setIsHiring: (v: boolean) => void;
  description: string;
  setDescription: (v: string) => void;
  website: string;
  setWebsite: (v: string) => void;
  bannerImageUrl: string;
  setBannerImageUrl: (v: string) => void;
  hasActivePaidTier: boolean;
  onSaveGeneralInfo: () => void;
  generalInfoSaving: boolean;
  generalInfoStatus: string | null;
  generalInfoError: string | null;
  onStartUpgrade: (tier: "BLUE" | "BLUE_PLUS" | "ENTERPRISE") => void;
}

function DashboardBox({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`relative rounded-xl border border-border p-6 ${className}`}>
      <h3 className="mb-3 font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

export function GeneralInfoCategory(props: GeneralInfoCategoryProps) {
  const bannerAllowed = canUseBanner(props.claim.tier);
  const workplaceTypesLocked = props.detail?.company.workplaceTypesLocked ?? false;

  const livePreview: CompanyWorkCardData = {
    name: props.name || props.companyName,
    mainPhotoUrl: props.mainPhotoUrl.trim() || null,
    workplaceTypes: props.workplaceTypes.length > 0 ? props.workplaceTypes : (["OFFICE"] as WorkplaceType[]),
    category: props.category ?? "",
    city: props.city,
    district: props.district,
    isHiring: props.isHiring,
    badgeTier: props.claim.tier,
    bannerImageUrl: props.bannerImageUrl.trim() || null,
    overallAvg: props.detail?.aggregate?.overallAvg ?? null,
    reviewCount: props.detail?.aggregate?.reviewCount ?? 0,
  };

  return (
    <div className="flex flex-col gap-6">
      <DashboardBox title="General Information">
        {/* Live Work Card preview, anchored top-right — the exact same
            component the "Rating / Overview" browse grid renders, updating
            instantly as the fields below change. The helper note under it
            tells an owner what this preview actually means (it's easy to
            mistake for decoration otherwise). */}
        <div className="mb-4 flex flex-col items-end gap-1.5 sm:absolute sm:right-6 sm:top-6 sm:mb-0">
          <div className="w-[280px]">
            <CompanyWorkCard company={livePreview} />
          </div>
          <p className="max-w-[280px] text-right text-[11px] leading-snug text-muted-foreground">
            This is how your company will appear to job seekers browsing the site.
          </p>
        </div>

        {/* No max-w here (was max-w-xl) — fields fill the box's actual
            width, capped only by sm:pr-72 so they don't run under the
            preview. */}
        <div className="flex flex-col gap-3 sm:pr-72">
          <label className="text-xs font-medium text-muted-foreground">
            Company name
            <input
              value={props.name}
              onChange={(e) => props.setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
            />
          </label>

          <div>
            <MultiFilterPillGroup
              heading="Workplace types (up to 2)"
              options={WORKPLACE_TYPES}
              selected={props.workplaceTypes}
              onToggle={props.toggleWorkplaceType}
              onReset={props.onResetWorkplaceTypes}
              direction="grid"
              disabled={workplaceTypesLocked}
            />
            <button
              onClick={props.onSaveWorkplaceTypes}
              disabled={props.workplaceTypesSaving || workplaceTypesLocked}
              className="mt-2 self-start rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save work types
            </button>
            {workplaceTypesLocked && (
              <p className="mt-1.5 text-xs text-muted-foreground">Please mail us to change your work-types.</p>
            )}
            {props.workplaceTypesStatus && (
              <p className="mt-1.5 text-xs text-green-700 dark:text-green-400">{props.workplaceTypesStatus}</p>
            )}
            {props.workplaceTypesError && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{props.workplaceTypesError}</p>
            )}
          </div>

          <label className="mt-2 text-xs font-medium text-muted-foreground">
            Sector / Industry <span className="text-muted-foreground/70">(optional)</span>
            <div className="mt-1">
              <SingleSelectDropdown value={props.category} options={props.sectorOptions} placeholder="Sector" onChange={props.setCategory} />
            </div>
          </label>

          <div className="text-xs font-medium text-muted-foreground">
            Company Logo
            <div className="mt-1">
              <CompanyLogoUploader
                uploadPath={`/my-companies/${props.companyId}/logo`}
                companyName={props.companyName}
                value={props.mainPhotoUrl}
                onChange={props.setMainPhotoUrl}
              />
            </div>
          </div>

          <label className="mt-2 text-xs font-medium text-muted-foreground">Headcount Range / Location</label>
          <div className="grid grid-cols-2 gap-2">
            <SingleSelectDropdown
              value={props.city}
              options={props.cityOptions}
              placeholder="City"
              clearable={false}
              onChange={(v) => {
                props.setCity(v);
                props.setDistrict(null);
              }}
            />
            <SingleSelectDropdown
              value={props.district}
              options={props.districtOptions}
              placeholder="District"
              disabled={!props.city}
              clearable={false}
              onChange={props.setDistrict}
            />
          </div>

          <label className="mt-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <input
              type="checkbox"
              checked={props.isHiring}
              onChange={(e) => props.setIsHiring(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            We&apos;re currently hiring (show this company on the Jobs page)
          </label>

          {props.hasActivePaidTier ? (
            <>
              <label className="mt-2 text-xs font-medium text-muted-foreground">
                About / Description
                <textarea
                  value={props.description}
                  onChange={(e) => props.setDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                Website
                <input
                  value={props.website}
                  onChange={(e) => props.setWebsite(e.target.value)}
                  placeholder="https://..."
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
                />
              </label>
            </>
          ) : (
            <div className="mt-2 rounded-lg border border-dashed border-border p-3">
              <p className="text-xs text-muted-foreground">
                Description, website, and the Premium Features menu unlock on a paid tier.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PAID_TIER_PRICES.map((t) => (
                  <button
                    key={t.tier}
                    type="button"
                    onClick={() => props.onStartUpgrade(t.tier)}
                    className="rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-400 dark:hover:bg-brand-950"
                  >
                    {t.label} — {t.price}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stays in General Information per the task's own instruction
              (everything else Premium moved to its own sidebar category) —
              always visible, greyed out below Blue+/Enterprise rather than
              hidden outright, so a lower-tier owner sees what they're
              missing instead of nothing at all. */}
          <label className="mt-2 text-xs font-medium text-muted-foreground">
            Banner image
            <div className="mt-1">
              {bannerAllowed ? (
                <BannerUploader
                  uploadPath={`/my-companies/${props.companyId}/banner`}
                  value={props.bannerImageUrl}
                  onChange={props.setBannerImageUrl}
                />
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-surface-muted/60 p-3 opacity-75">
                  <p className="text-xs text-muted-foreground">Upgrade to Blue+ or Enterprise to add a banner image.</p>
                  <button
                    type="button"
                    onClick={() => props.onStartUpgrade("BLUE_PLUS")}
                    className="mt-2 rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-400 dark:hover:bg-brand-950"
                  >
                    Blue+ — 499,99₺
                  </button>
                </div>
              )}
            </div>
          </label>

          <button
            onClick={props.onSaveGeneralInfo}
            disabled={props.generalInfoSaving}
            className="mt-2 self-start rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Save changes
          </button>
          {props.generalInfoStatus && <p className="mt-2 text-sm text-green-700 dark:text-green-400">{props.generalInfoStatus}</p>}
          {props.generalInfoError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{props.generalInfoError}</p>}
        </div>
      </DashboardBox>
    </div>
  );
}
```

Note: the Work-Type Save button and lock/footnote wiring above depends on
`props.detail?.company.workplaceTypesLocked`, `props.onSaveWorkplaceTypes`,
etc., which Step 5 below adds to `page.tsx`, and on `MultiFilterPillGroup`'s
new `disabled` prop, which Task 6 adds — this task's code will not typecheck
until Task 6 lands. **Do Task 6 either right after this task, or merge its
`FilterPillGroup.tsx` step into this task's commit** — the plan lists them
separately for clarity of review, not because they're independently
shippable.

- [ ] **Step 4: Add the render case in `page.tsx`**

In `apps/web/src/app/my/companies/page.tsx`, replace the import block:

```tsx
import { OwnerDashboardSidePanel, type OwnerDashboardCategory } from "@/components/owner/OwnerDashboardSidePanel";
import { GeneralInfoCategory } from "@/components/owner/sections/GeneralInfoCategory";
import { ContactSocialCategory } from "@/components/owner/sections/ContactSocialCategory";
import { ReviewsRatingsCategory } from "@/components/owner/sections/ReviewsRatingsCategory";
```

with:

```tsx
import { OwnerDashboardSidePanel, type OwnerDashboardCategory } from "@/components/owner/OwnerDashboardSidePanel";
import { GeneralInfoCategory } from "@/components/owner/sections/GeneralInfoCategory";
import { PremiumFeaturesCategory } from "@/components/owner/sections/PremiumFeaturesCategory";
import { ContactSocialCategory } from "@/components/owner/sections/ContactSocialCategory";
import { ReviewsRatingsCategory } from "@/components/owner/sections/ReviewsRatingsCategory";
```

Then replace the `<GeneralInfoCategory ... />` block through the start of
the `contact-social` block:

```tsx
              <GeneralInfoCategory
                claim={claim}
                detail={detail}
                companySlug={claim.companySlug}
                companyId={claim.companyId}
                companyName={claim.companyName}
                name={name}
                setName={setName}
                workplaceTypes={workplaceTypes}
                toggleWorkplaceType={toggleWorkplaceType}
                onResetWorkplaceTypes={() => {
                  setWorkplaceTypes([]);
                  setCategory(null);
                }}
                category={category}
                setCategory={setCategory}
                sectorOptions={sectorOptions}
                mainPhotoUrl={mainPhotoUrl}
                setMainPhotoUrl={setMainPhotoUrl}
                city={city}
                setCity={setCity}
                district={district}
                setDistrict={setDistrict}
                cityOptions={cityOptions}
                districtOptions={districtOptions}
                isHiring={isHiring}
                setIsHiring={setIsHiring}
                description={description}
                setDescription={setDescription}
                website={website}
                setWebsite={setWebsite}
                hasActivePaidTier={hasActivePaidTier}
                onSaveGeneralInfo={saveGeneralInfo}
                generalInfoSaving={generalInfoSaving}
                generalInfoStatus={generalInfoStatus}
                generalInfoError={generalInfoError}
                onStartUpgrade={setPendingUpgradeTier}
                bannerImageUrl={bannerImageUrl}
                setBannerImageUrl={setBannerImageUrl}
                featuredReviewId={featuredReviewId}
                setFeaturedReviewId={setFeaturedReviewId}
                onSavePremium={savePremium}
                premiumSaving={premiumSaving}
                premiumStatus={premiumStatus}
                premiumError={premiumError}
                showRivalAnalytics={showRivalAnalytics}
                setShowRivalAnalytics={setShowRivalAnalytics}
                hasFreeRivalAnalyticsRequest={hasFreeRivalAnalyticsRequest}
                rivalAnalyticsFreeRequestUsed={rivalAnalyticsFreeRequestUsed}
                onFreeCreditUsed={() => setFreeRivalAnalyticsRequestJustUsed(true)}
                onOpenPricing={() => setShowPricing(true)}
              />
              {pendingUpgradeTier && (
                <UpgradeCheckout
                  companyId={claim.companyId}
                  initialTier={pendingUpgradeTier}
                  onClose={() => setPendingUpgradeTier(null)}
                />
              )}
            </>
          )}

          {activeCategory === "contact-social" && (
```

with:

```tsx
              <GeneralInfoCategory
                claim={claim}
                detail={detail}
                companySlug={claim.companySlug}
                companyId={claim.companyId}
                companyName={claim.companyName}
                name={name}
                setName={setName}
                workplaceTypes={workplaceTypes}
                toggleWorkplaceType={toggleWorkplaceType}
                onResetWorkplaceTypes={() => {
                  setWorkplaceTypes([]);
                  setCategory(null);
                }}
                onSaveWorkplaceTypes={saveWorkplaceTypes}
                workplaceTypesSaving={workplaceTypesSaving}
                workplaceTypesStatus={workplaceTypesStatus}
                workplaceTypesError={workplaceTypesError}
                category={category}
                setCategory={setCategory}
                sectorOptions={sectorOptions}
                mainPhotoUrl={mainPhotoUrl}
                setMainPhotoUrl={setMainPhotoUrl}
                city={city}
                setCity={setCity}
                district={district}
                setDistrict={setDistrict}
                cityOptions={cityOptions}
                districtOptions={districtOptions}
                isHiring={isHiring}
                setIsHiring={setIsHiring}
                description={description}
                setDescription={setDescription}
                website={website}
                setWebsite={setWebsite}
                bannerImageUrl={bannerImageUrl}
                setBannerImageUrl={setBannerImageUrl}
                hasActivePaidTier={hasActivePaidTier}
                onSaveGeneralInfo={saveGeneralInfo}
                generalInfoSaving={generalInfoSaving}
                generalInfoStatus={generalInfoStatus}
                generalInfoError={generalInfoError}
                onStartUpgrade={setPendingUpgradeTier}
              />
              {pendingUpgradeTier && (
                <UpgradeCheckout
                  companyId={claim.companyId}
                  initialTier={pendingUpgradeTier}
                  onClose={() => setPendingUpgradeTier(null)}
                />
              )}
            </>
          )}

          {activeCategory === "premium-features" && (
            <PremiumFeaturesCategory
              claim={claim}
              companySlug={claim.companySlug}
              companyId={claim.companyId}
              hasActivePaidTier={hasActivePaidTier}
              onStartUpgrade={setPendingUpgradeTier}
              featuredReviewId={featuredReviewId}
              setFeaturedReviewId={setFeaturedReviewId}
              onSavePremium={savePremium}
              premiumSaving={premiumSaving}
              premiumStatus={premiumStatus}
              premiumError={premiumError}
              showRivalAnalytics={showRivalAnalytics}
              setShowRivalAnalytics={setShowRivalAnalytics}
              hasFreeRivalAnalyticsRequest={hasFreeRivalAnalyticsRequest}
              rivalAnalyticsFreeRequestUsed={rivalAnalyticsFreeRequestUsed}
              onFreeCreditUsed={() => setFreeRivalAnalyticsRequestJustUsed(true)}
              onOpenPricing={() => setShowPricing(true)}
            />
          )}

          {activeCategory === "contact-social" && (
```

- [ ] **Step 5: Add `saveWorkplaceTypes` state + handler, move `bannerImageUrl` out of `savePremium`**

In the same file, replace:

```tsx
  const [pendingUpgradeTier, setPendingUpgradeTier] = useState<PaidOwnerTier | null>(null);

  // Premium Features (Box 2)
```

with:

```tsx
  const [pendingUpgradeTier, setPendingUpgradeTier] = useState<PaidOwnerTier | null>(null);
  const [workplaceTypesSaving, setWorkplaceTypesSaving] = useState(false);
  const [workplaceTypesStatus, setWorkplaceTypesStatus] = useState<string | null>(null);
  const [workplaceTypesError, setWorkplaceTypesError] = useState<string | null>(null);

  // Premium Features (Box 2)
```

Then replace `saveGeneralInfo` and `savePremium`:

```tsx
  async function saveGeneralInfo() {
    setGeneralInfoSaving(true);
    setGeneralInfoError(null);
    setGeneralInfoStatus(null);
    try {
      const body: Record<string, unknown> = {};
      if (name.trim() && name.trim() !== detail?.company.name) body.name = name.trim();
      if (workplaceTypes.length > 0 && !sameWorkplaceTypes(workplaceTypes, detail?.company.workplaceTypes ?? [])) {
        body.workplaceTypes = workplaceTypes;
      }
      if (category && category !== detail?.company.category) body.category = category;
      if (mainPhotoUrl.trim() && mainPhotoUrl.trim() !== detail?.company.mainPhotoUrl) body.mainPhotoUrl = mainPhotoUrl.trim();
      if (city) {
        body.city = city;
        // district is z.string().min(1) server-side — omit rather than send
        // "" so "no district" round-trips as "leave it unset", not a 400.
        if (district) body.district = district;
      }
      if (hasActivePaidTier && description.trim() && description.trim() !== detail?.company.description) {
        body.description = description.trim();
      }
      if (hasActivePaidTier && website.trim() && website.trim() !== detail?.company.website) {
        body.website = website.trim();
      }
      if (isHiring !== (detail?.company.isHiring ?? false)) {
        body.isHiring = isHiring;
      }
      if (Object.keys(body).length === 0) {
        setGeneralInfoError("Change at least one field before saving.");
        return;
      }
      await apiPatch(`/my-companies/${claim.companyId}`, body);
      await loadDetail("general");
      setGeneralInfoStatus("Saved.");
    } catch (err) {
      setGeneralInfoError(err instanceof ApiError ? err.message : "Couldn't save changes.");
    } finally {
      setGeneralInfoSaving(false);
    }
  }

  async function savePremium() {
    setPremiumSaving(true);
    setPremiumError(null);
    setPremiumStatus(null);
    try {
      const body: Record<string, unknown> = {};
      if (bannerImageUrl.trim() && bannerImageUrl.trim() !== detail?.company.bannerImageUrl) {
        body.bannerImageUrl = bannerImageUrl.trim();
      }
      if (featuredReviewId !== (detail?.company.featuredReviewId ?? null)) {
        body.featuredReviewId = featuredReviewId;
      }
      if (Object.keys(body).length === 0) {
        setPremiumError("Change at least one field before saving.");
        return;
      }
      await apiPatch(`/my-companies/${claim.companyId}`, body);
      await loadDetail("premium");
      setPremiumStatus("Saved.");
    } catch (err) {
      setPremiumError(err instanceof ApiError ? err.message : "Couldn't save changes.");
    } finally {
      setPremiumSaving(false);
    }
  }
```

with:

```tsx
  async function saveGeneralInfo() {
    setGeneralInfoSaving(true);
    setGeneralInfoError(null);
    setGeneralInfoStatus(null);
    try {
      const body: Record<string, unknown> = {};
      if (name.trim() && name.trim() !== detail?.company.name) body.name = name.trim();
      if (category && category !== detail?.company.category) body.category = category;
      if (mainPhotoUrl.trim() && mainPhotoUrl.trim() !== detail?.company.mainPhotoUrl) body.mainPhotoUrl = mainPhotoUrl.trim();
      if (city) {
        body.city = city;
        // district is z.string().min(1) server-side — omit rather than send
        // "" so "no district" round-trips as "leave it unset", not a 400.
        if (district) body.district = district;
      }
      if (hasActivePaidTier && description.trim() && description.trim() !== detail?.company.description) {
        body.description = description.trim();
      }
      if (hasActivePaidTier && website.trim() && website.trim() !== detail?.company.website) {
        body.website = website.trim();
      }
      if (isHiring !== (detail?.company.isHiring ?? false)) {
        body.isHiring = isHiring;
      }
      if (bannerImageUrl.trim() && bannerImageUrl.trim() !== detail?.company.bannerImageUrl) {
        body.bannerImageUrl = bannerImageUrl.trim();
      }
      if (Object.keys(body).length === 0) {
        setGeneralInfoError("Change at least one field before saving.");
        return;
      }
      await apiPatch(`/my-companies/${claim.companyId}`, body);
      await loadDetail("general");
      setGeneralInfoStatus("Saved.");
    } catch (err) {
      setGeneralInfoError(err instanceof ApiError ? err.message : "Couldn't save changes.");
    } finally {
      setGeneralInfoSaving(false);
    }
  }

  // Decoupled from saveGeneralInfo's shared button — once submitted, a
  // workplaceTypes change can become permanently locked (both types
  // reviewed), which makes it a higher-stakes, single-purpose edit rather
  // than something to bundle in with routine name/city changes.
  async function saveWorkplaceTypes() {
    setWorkplaceTypesSaving(true);
    setWorkplaceTypesError(null);
    setWorkplaceTypesStatus(null);
    try {
      if (workplaceTypes.length === 0 || sameWorkplaceTypes(workplaceTypes, detail?.company.workplaceTypes ?? [])) {
        setWorkplaceTypesError("Change the workplace types before saving.");
        return;
      }
      await apiPatch(`/my-companies/${claim.companyId}`, { workplaceTypes });
      await loadDetail("general");
      setWorkplaceTypesStatus("Saved.");
    } catch (err) {
      setWorkplaceTypesError(err instanceof ApiError ? err.message : "Couldn't save work types.");
    } finally {
      setWorkplaceTypesSaving(false);
    }
  }

  async function savePremium() {
    setPremiumSaving(true);
    setPremiumError(null);
    setPremiumStatus(null);
    try {
      const body: Record<string, unknown> = {};
      if (featuredReviewId !== (detail?.company.featuredReviewId ?? null)) {
        body.featuredReviewId = featuredReviewId;
      }
      if (Object.keys(body).length === 0) {
        setPremiumError("Change at least one field before saving.");
        return;
      }
      await apiPatch(`/my-companies/${claim.companyId}`, body);
      await loadDetail("premium");
      setPremiumStatus("Saved.");
    } catch (err) {
      setPremiumError(err instanceof ApiError ? err.message : "Couldn't save changes.");
    } finally {
      setPremiumSaving(false);
    }
  }
```

- [ ] **Step 6: Typecheck**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: errors only about `MultiFilterPillGroup`'s missing `disabled` prop
(Task 6) — everything else should be clean. If other errors appear, they
indicate a prop-threading mistake in Step 4/5 above; fix before continuing.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/owner/OwnerDashboardSidePanel.tsx apps/web/src/components/owner/sections/PremiumFeaturesCategory.tsx apps/web/src/components/owner/sections/GeneralInfoCategory.tsx apps/web/src/app/my/companies/page.tsx
git commit -m "feat(web): split Premium Features into its own dashboard category"
```

---

### Task 4: Facebook-style banner + avatar overlap (3 render sites)

**Files:**
- Modify: `apps/web/src/components/company/CompanyWorkCard.tsx`
- Modify: `apps/web/src/components/JobsBrowser.tsx` (the local `JobCard`
  function, around line 304)
- Modify: `apps/web/src/app/companies/[slug]/page.tsx` (header block, around
  line 188)

**Interfaces:** None new — same component props everywhere, JSX/layout only.
This task also folds in item 6 (Enterprise tick size) and the
`CompanyWorkCard` share of item 2's Gold→Enterprise rename, since both touch
the exact same lines this task already rewrites.

**Manual verification for this task** should be done against the 3
companies the backend plan's Task 7 seeded with an example banner + BLUE_PLUS
badge (e.g. Shell, LC Waikiki, Migros) — run that script first if it hasn't
been run yet.

- [ ] **Step 1: Rewrite `CompanyWorkCard`'s banner+logo section**

In `apps/web/src/components/company/CompanyWorkCard.tsx`, replace:

```tsx
      {showBanner && (
        // Bleeds to the card's outer edges (negative margin cancels the
        // card's own p-4) so the banner reaches the rounded top corners
        // instead of sitting inset inside a padded box. 4:1 keeps the file
        // itself light and the strip short relative to the rest of the card.
        <div className="-mx-4 -mt-4 aspect-[4/1] w-[calc(100%+2rem)] overflow-hidden rounded-t-xl">
          {/* eslint-disable-next-line @next/next/no-img-element -- owner-submitted URL, not a known remote host */}
          <img src={company.bannerImageUrl!} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      {/* Single line -> centered against the logo; wrapped 2-line name ->
          top-aligned, so the first line lines up with the logo's top edge
          instead of the whole 2-line block floating centered past it. */}
      <div className={`flex gap-3 ${isWrapped ? "items-start" : "items-center"}`}>
        <CompanyLogo name={company.name} mainPhotoUrl={company.mainPhotoUrl} size="md" />
        <div className="flex min-w-0 flex-1 items-start gap-1.5">
          <p ref={nameRef} className="line-clamp-2 min-w-0 flex-1 font-semibold leading-snug text-foreground">
            {company.name}
          </p>
          {tickSrc && (
            // eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size static badge art
            <img
              src={tickSrc}
              alt={`${company.badgeTier === "ENTERPRISE" ? "Gold" : company.badgeTier === "BLUE_PLUS" ? "Blue+" : "Blue"} verified badge`}
              width={18}
              height={18}
              className="mt-0.5 inline-flex shrink-0 items-center"
            />
          )}
        </div>
      </div>
```

with:

```tsx
      {showBanner && (
        // Facebook-style cover-photo layout: the banner bleeds to the
        // card's outer edges (negative margin cancels the card's own p-4)
        // and the logo overlaps its bottom-left corner by half its own
        // height (top-full + -translate-y-1/2, anchored against this
        // *relative* wrapper) — mb-6 reserves room below the banner for the
        // half of the logo that hangs past it, so the name row below never
        // collides with it. 4:1 keeps the banner file itself light and the
        // strip short relative to the rest of the card.
        <div className="relative -mx-4 -mt-4 mb-6 w-[calc(100%+2rem)]">
          <div className="aspect-[4/1] w-full overflow-hidden rounded-t-xl">
            {/* eslint-disable-next-line @next/next/no-img-element -- owner-submitted URL, not a known remote host */}
            <img src={company.bannerImageUrl!} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="absolute left-4 top-full -translate-y-1/2 rounded-lg ring-4 ring-surface">
            <CompanyLogo name={company.name} mainPhotoUrl={company.mainPhotoUrl} size="md" />
          </div>
        </div>
      )}

      {/* No banner: logo sits inline beside the name (single line centers
          against it, wrapped 2-line name top-aligns so its first line lines
          up with the logo's top edge). With a banner, the logo has already
          been placed above it, overlapping its bottom-left corner, so this
          row is just the name + tick. */}
      <div className={`flex gap-3 ${showBanner || isWrapped ? "items-start" : "items-center"}`}>
        {!showBanner && <CompanyLogo name={company.name} mainPhotoUrl={company.mainPhotoUrl} size="md" />}
        <div className="flex min-w-0 flex-1 items-start gap-1.5">
          <p ref={nameRef} className="line-clamp-2 min-w-0 flex-1 font-semibold leading-snug text-foreground">
            {company.name}
          </p>
          {tickSrc && (
            // eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size static badge art
            <img
              src={tickSrc}
              alt={`${company.badgeTier === "ENTERPRISE" ? "Enterprise" : company.badgeTier === "BLUE_PLUS" ? "Blue+" : "Blue"} verified badge`}
              width={company.badgeTier === "ENTERPRISE" ? 26 : 18}
              height={company.badgeTier === "ENTERPRISE" ? 26 : 18}
              className="mt-0.5 inline-flex shrink-0 items-center"
            />
          )}
        </div>
      </div>
```

- [ ] **Step 2: Rewrite `JobsBrowser.tsx`'s `JobCard` banner+logo section**

In `apps/web/src/components/JobsBrowser.tsx`, replace:

```tsx
      {showBanner && (
        <div className="aspect-[4/1] w-full overflow-hidden rounded-t-xl">
          {/* eslint-disable-next-line @next/next/no-img-element -- owner-submitted URL, not a known remote host */}
          <img src={company.bannerImageUrl!} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div className={`flex aspect-[4/5] flex-col p-4 compact:p-3 ${showBanner ? "rounded-b-xl" : "rounded-xl"}`}>
        {/* Top row: logo + name (top-left) ... rating + info button
            (top-right). Name wraps up to 2 lines (was a single truncated
            line that clipped anything past ~20 chars, e.g. "Örnek Perakende
            M...") rather than cutting a long company name short. */}
        <div className="flex items-start justify-between gap-2">
          <Link href={`/companies/${company.slug}`} className="flex min-w-0 flex-1 items-center gap-2">
            <CompanyLogo name={company.name} mainPhotoUrl={company.mainPhotoUrl} size="sm" />
            <span className="line-clamp-2 min-w-0 font-semibold leading-snug text-foreground">{company.name}</span>
          </Link>
```

with:

```tsx
      {showBanner && (
        // Same Facebook-style overlap as CompanyWorkCard (rating page) —
        // logo overlaps the banner's bottom-left corner by half its own
        // height. Unlike CompanyWorkCard's version, this banner isn't
        // negative-margined (it already sits flush at this card's own top
        // edge), so the content box below gets extra top padding (pt-5,
        // added to the ${showBanner ? ...} branch below) instead of a
        // margin on the banner wrapper, to clear the protruding logo.
        <div className="relative aspect-[4/1] w-full overflow-hidden rounded-t-xl">
          {/* eslint-disable-next-line @next/next/no-img-element -- owner-submitted URL, not a known remote host */}
          <img src={company.bannerImageUrl!} alt="" className="h-full w-full object-cover" />
          <div className="absolute left-3 top-full -translate-y-1/2 rounded-lg ring-4 ring-surface">
            <CompanyLogo name={company.name} mainPhotoUrl={company.mainPhotoUrl} size="sm" />
          </div>
        </div>
      )}
      <div className={`flex aspect-[4/5] flex-col p-4 compact:p-3 ${showBanner ? "rounded-b-xl pt-5" : "rounded-xl"}`}>
        {/* Top row: logo + name (top-left) ... rating + info button
            (top-right). Name wraps up to 2 lines (was a single truncated
            line that clipped anything past ~20 chars, e.g. "Örnek Perakende
            M...") rather than cutting a long company name short. With a
            banner, the logo already sits above (overlapping it), so this
            row is name-only. */}
        <div className="flex items-start justify-between gap-2">
          <Link href={`/companies/${company.slug}`} className="flex min-w-0 flex-1 items-center gap-2">
            {!showBanner && <CompanyLogo name={company.name} mainPhotoUrl={company.mainPhotoUrl} size="sm" />}
            <span className="line-clamp-2 min-w-0 font-semibold leading-snug text-foreground">{company.name}</span>
          </Link>
```

- [ ] **Step 3: Add a banner to the company detail page header**

In `apps/web/src/app/companies/[slug]/page.tsx`, first replace the
`pricingTiers` import:

```tsx
import { badgeLabelForOwnerTier } from "@/lib/pricingTiers";
```

with:

```tsx
import { badgeLabelForOwnerTier, canUseBanner } from "@/lib/pricingTiers";
```

Then replace the header block:

```tsx
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <CompanyLogo name={company.name} mainPhotoUrl={company.mainPhotoUrl} size="lg" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {company.name}
                {badgeLabelForOwnerTier(company.badgeTier) && (
                  <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                    {badgeLabelForOwnerTier(company.badgeTier)} Badge
                  </span>
                )}
              </h1>
              <p className="text-sm text-muted-foreground">
                {company.category} · {company.workplaceTypes.map(workplaceTypeLabel).join(" / ")}
                {company.city ? ` · ${company.city}` : ""}
              </p>
            </div>
          </div>
          <RateButton companySlug={company.slug} />
        </div>
```

with:

```tsx
        {canUseBanner(company.badgeTier) && company.bannerImageUrl && (
          // Same Facebook-style overlap as the browse-grid card, scaled up
          // for a full-width detail-page hero — ring-background (not
          // ring-surface) since this header sits directly on the page's own
          // background, not inside a bg-surface card.
          <div className="relative mb-10 aspect-[4/1] w-full overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element -- owner-submitted URL, not a known remote host */}
            <img src={company.bannerImageUrl} alt="" className="h-full w-full object-cover" />
            <div className="absolute left-6 top-full -translate-y-1/2 rounded-xl ring-4 ring-background">
              <CompanyLogo name={company.name} mainPhotoUrl={company.mainPhotoUrl} size="lg" />
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {!(canUseBanner(company.badgeTier) && company.bannerImageUrl) && (
              <CompanyLogo name={company.name} mainPhotoUrl={company.mainPhotoUrl} size="lg" />
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {company.name}
                {badgeLabelForOwnerTier(company.badgeTier) && (
                  <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                    {badgeLabelForOwnerTier(company.badgeTier)} Badge
                  </span>
                )}
              </h1>
              <p className="text-sm text-muted-foreground">
                {company.category} · {company.workplaceTypes.map(workplaceTypeLabel).join(" / ")}
                {company.city ? ` · ${company.city}` : ""}
              </p>
            </div>
          </div>
          <RateButton companySlug={company.slug} />
        </div>
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: no new errors from this task's 3 files.

- [ ] **Step 5: Manual verification against the seeded example companies**

Start the dev server, visit the browse grid, the Jobs page, and the company
detail page for each of the 3 companies the backend plan's seed script set a
banner on. Confirm: banner renders full-width at the top, logo overlaps its
bottom-left corner by roughly half its own height with a visible ring
separating it from the banner image, name text never collides with the
overlapping logo, and a company with **no** banner (any other company)
renders exactly as it did before this task (inline logo+name row, no
regression). Check both light and dark mode (the `ring-surface`/
`ring-background` tokens should look correct in both).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/company/CompanyWorkCard.tsx apps/web/src/components/JobsBrowser.tsx "apps/web/src/app/companies/[slug]/page.tsx"
git commit -m "feat(web): Facebook-style banner+avatar overlap on cards and company page"
```

---

### Task 5: Gold → Enterprise rename in pricing-copy files

**Files:**
- Modify: `apps/web/src/lib/pricingTiers.ts`
- Modify: `apps/web/src/components/PremiumFeaturesPanel.tsx`
- Modify: `apps/web/src/components/PricingComparisonTable.tsx`

**Interfaces:** None — string/copy changes only. The `BADGE_STYLES` key
rename in the 2 panel files must land together with the value rename in
`pricingTiers.ts` in the same commit — they're coupled (the panels look up
`BADGE_STYLES[value]` where `value` comes from `pricingTiers.ts`'s
`PRICING_FEATURE_ROWS`).

- [ ] **Step 1: Rename the badge-label value and tidy the related comment**

In `apps/web/src/lib/pricingTiers.ts`, replace:

```ts
// The real, DB-backed OwnerTier axis (FREE/BLUE/BLUE_PLUS/ENTERPRISE — see
// its schema.prisma comment) mapped onto this file's free/starter/pro/
// enterprise keys. GOLD isn't a tier name — it's the badge ENTERPRISE grants
// (see the "verified-badge" row below) — so ENTERPRISE alone maps onto the
// matrix's top "enterprise" bucket.
export function tierKeyFromOwnerTier(tier: "FREE" | "BLUE" | "BLUE_PLUS" | "ENTERPRISE"): PricingTierKey {
```

with:

```ts
// The real, DB-backed OwnerTier axis (FREE/BLUE/BLUE_PLUS/ENTERPRISE — see
// its schema.prisma comment) mapped onto this file's free/starter/pro/
// enterprise keys — ENTERPRISE alone maps onto the matrix's top "enterprise"
// bucket (see the "verified-badge" row below for the badge it grants).
export function tierKeyFromOwnerTier(tier: "FREE" | "BLUE" | "BLUE_PLUS" | "ENTERPRISE"): PricingTierKey {
```

Then replace:

```ts
    values: { free: "No", starter: "Blue", pro: "Blue+", enterprise: "Gold" },
```

with:

```ts
    values: { free: "No", starter: "Blue", pro: "Blue+", enterprise: "Enterprise" },
```

- [ ] **Step 2: Rename the `BADGE_STYLES` key in `PremiumFeaturesPanel.tsx`**

In `apps/web/src/components/PremiumFeaturesPanel.tsx`, replace:

```tsx
const BADGE_STYLES: Record<string, string> = {
  Blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Blue+": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Gold: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};
```

with:

```tsx
const BADGE_STYLES: Record<string, string> = {
  Blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Blue+": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Enterprise: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};
```

- [ ] **Step 3: Rename the `BADGE_STYLES` key in `PricingComparisonTable.tsx`, and check the `ROWS` array for any other "Gold" value**

First, replace:

```tsx
const BADGE_STYLES: Record<string, string> = {
  Blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Blue+": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Gold: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};
```

with:

```tsx
const BADGE_STYLES: Record<string, string> = {
  Blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "Blue+": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Enterprise: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};
```

Then run: `grep -n "Gold" apps/web/src/components/PricingComparisonTable.tsx`
This file's `ROWS` array (below the code shown above, not fully captured
during planning) may reference the same "Gold" badge value again directly
rather than via `pricingFeature()` — if the grep finds another hit, replace
that occurrence's `"Gold"` with `"Enterprise"` the same way, matching
whatever surrounding object-literal syntax is actually there.

- [ ] **Step 4: Verify no frontend "Gold" reference remains**

Run: `grep -rn "Gold" apps/web/src --include=*.tsx --include=*.ts`
Expected: no output. (This should also confirm Task 4's
`CompanyWorkCard.tsx` alt-text rename landed — if that task hasn't been done
yet, do it before treating this check as final.)

- [ ] **Step 5: Manual check**

In the dev server, open the owner dashboard's Premium Features category for
an Enterprise-tier test company (or `PricingComparisonTable` from the
homepage) and confirm the badge still renders with the amber "Gold" color
treatment, just labeled "Enterprise" now, in both light and dark mode.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/pricingTiers.ts apps/web/src/components/PremiumFeaturesPanel.tsx apps/web/src/components/PricingComparisonTable.tsx
git commit -m "refactor(web): rename Gold badge references to Enterprise"
```

---

### Task 6: `MultiFilterPillGroup`'s `disabled` prop

**Files:**
- Modify: `apps/web/src/components/FilterPillGroup.tsx`

**Interfaces:**
- Produces: `MultiFilterPillGroup` gains an optional `disabled?: boolean`
  prop (default `false`). Task 3's `GeneralInfoCategory.tsx` already passes
  `disabled={workplaceTypesLocked}` to it — this task is what makes that
  prop exist and take effect.

- [ ] **Step 1: Add the prop and apply it**

In `apps/web/src/components/FilterPillGroup.tsx`, replace the
`MultiFilterPillGroup` function signature:

```tsx
export function MultiFilterPillGroup<T extends string>({
  heading,
  options,
  selected,
  onToggle,
  onReset,
  direction = "wrap",
  pillColorClassName,
  // Hides the heading/reset row entirely — for a consumer that just wants a
  // bare, centered row of pills (e.g. a marketing hero preview) rather than
  // the sidebar-style labeled filter group. Also centers the pill row itself
  // in that case, since there's no heading to balance it against.
  showHeading = true,
  // "track" swaps the pill shape for a borderless segmented-control look
  // inside a dark recessed box (trackWrapperClass/trackSegmentBaseClass) —
  // opt-in only, so every existing consumer (default "pill") is unaffected.
  // Currently used only by the WorkType filter on the homepage/jobs page.
  variant = "pill",
}: {
  heading: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
  onReset: () => void;
  // "grid" lines pills up in a fixed 2-column grid instead of letting them
  // wrap wherever they happen to fit — a narrow sidebar with mixed-length
  // labels (e.g. "Hybrid/Remote") wraps unevenly under plain flex-wrap,
  // leaving a lone pill stranded on its own row. The grid keeps every row
  // the same two-column shape regardless of label length.
  direction?: "wrap" | "column" | "grid";
  // Optional per-option color override (e.g. the collar color map) — lets
  // this specific group render each option in a distinct color instead of
  // the shared default brand color. Omit to keep every other consumer's
  // plain look unchanged.
  pillColorClassName?: (value: T, active: boolean) => string;
  showHeading?: boolean;
  variant?: "pill" | "track";
}) {
```

with:

```tsx
export function MultiFilterPillGroup<T extends string>({
  heading,
  options,
  selected,
  onToggle,
  onReset,
  direction = "wrap",
  pillColorClassName,
  // Hides the heading/reset row entirely — for a consumer that just wants a
  // bare, centered row of pills (e.g. a marketing hero preview) rather than
  // the sidebar-style labeled filter group. Also centers the pill row itself
  // in that case, since there's no heading to balance it against.
  showHeading = true,
  // "track" swaps the pill shape for a borderless segmented-control look
  // inside a dark recessed box (trackWrapperClass/trackSegmentBaseClass) —
  // opt-in only, so every existing consumer (default "pill") is unaffected.
  // Currently used only by the WorkType filter on the homepage/jobs page.
  variant = "pill",
  disabled = false,
}: {
  heading: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
  onReset: () => void;
  // "grid" lines pills up in a fixed 2-column grid instead of letting them
  // wrap wherever they happen to fit — a narrow sidebar with mixed-length
  // labels (e.g. "Hybrid/Remote") wraps unevenly under plain flex-wrap,
  // leaving a lone pill stranded on its own row. The grid keeps every row
  // the same two-column shape regardless of label length.
  direction?: "wrap" | "column" | "grid";
  // Optional per-option color override (e.g. the collar color map) — lets
  // this specific group render each option in a distinct color instead of
  // the shared default brand color. Omit to keep every other consumer's
  // plain look unchanged.
  pillColorClassName?: (value: T, active: boolean) => string;
  showHeading?: boolean;
  variant?: "pill" | "track";
  // Renders every pill inert and muted — used by the owner dashboard's
  // Work-Type picker once Company.workplaceTypesLocked is true. No other
  // existing consumer passes this, so every one is unaffected.
  disabled?: boolean;
}) {
```

Then replace the pill-rendering `map`:

```tsx
      {options.map((o) => {
        const active = selected.includes(o.value);
        let className: string;
        if (isTrack) {
          const colorClass = pillColorClassName
            ? pillColorClassName(o.value, active)
            : active
              ? "bg-zinc-800 text-white"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200";
          const shapeClass = direction === "grid" ? trackSegmentGridBaseClass : trackSegmentBaseClass;
          className = `${shapeClass} ${colorClass}`;
        } else if (pillColorClassName) {
          className = `${direction === "grid" ? gridPillBaseClass : wrapPillBaseClass} ${pillColorClassName(o.value, active)}`;
        } else {
          className = direction === "grid" ? gridPillClass(active) : pillClass(active);
        }
        return (
          <button key={o.value} type="button" onClick={() => onToggle(o.value)} className={className}>
            {o.label}
          </button>
        );
      })}
```

with:

```tsx
      {options.map((o) => {
        const active = selected.includes(o.value);
        let className: string;
        if (isTrack) {
          const colorClass = pillColorClassName
            ? pillColorClassName(o.value, active)
            : active
              ? "bg-zinc-800 text-white"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200";
          const shapeClass = direction === "grid" ? trackSegmentGridBaseClass : trackSegmentBaseClass;
          className = `${shapeClass} ${colorClass}`;
        } else if (pillColorClassName) {
          className = `${direction === "grid" ? gridPillBaseClass : wrapPillBaseClass} ${pillColorClassName(o.value, active)}`;
        } else {
          className = direction === "grid" ? gridPillClass(active) : pillClass(active);
        }
        if (disabled) className += " cursor-not-allowed opacity-50";
        return (
          <button key={o.value} type="button" disabled={disabled} onClick={() => onToggle(o.value)} className={className}>
            {o.label}
          </button>
        );
      })}
```

- [ ] **Step 2: Typecheck the whole app**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: clean — this resolves the `disabled` prop error Task 3 flagged as
expected at its own typecheck step.

- [ ] **Step 3: Manual end-to-end check of the lock UI**

Using a test company where both of its 2 workplaceTypes already have a
published review (or temporarily submit 2 reviews under different types for
a test company to reach this state), open its owner dashboard's General
Information category. Confirm: the Work-Type pills are visibly greyed and
unclickable, the "Save work types" button is disabled, and the "Please mail
us to change your work-types." footnote is visible. Then check a company
below that threshold: pills are clickable, the dedicated Save button works
independently of the main "Save changes" button (change only the work
types, confirm only that field persists after a page reload), and no
footnote shows.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/FilterPillGroup.tsx
git commit -m "feat(web): add disabled state to MultiFilterPillGroup"
```

---

## After all 6 tasks: full verification pass

- [ ] `cd apps/web && pnpm exec tsc --noEmit` — no errors
- [ ] `cd apps/web && pnpm exec jest` — existing suite still passes (no
  test in this plan's scope needed a new one — confirm nothing regressed)
- [ ] `grep -rn "Gold" apps/web/src` — empty
- [ ] `grep -rn "gray-200\|gray-800\|gray-900" apps/web/src/app/my/companies apps/web/src/components/owner` — empty
- [ ] Full manual pass in the browser: `/my/companies` (all 4 sidebar
  categories, light + dark), `/` (browse grid banner cards), `/jobs`
  (job-card banners), a seeded company's `/companies/[slug]` page — using
  both a company with a banner and one without, at every viewport width
  (mobile sidebar scroll included)

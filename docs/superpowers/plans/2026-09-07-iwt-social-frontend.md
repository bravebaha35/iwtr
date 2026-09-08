# IWT Social - Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the IWT Social UI - a separate `/social` feed, per-company `/social/[slug]` profiles, an employer post composer, and a cross-promotion banner + comment-collapse on the rating page - against the endpoints the backend plan added, without changing the Hiring page or the Home rating feed's behavior.

**Architecture:** New App Router routes `app/social/page.tsx` (main feed) and `app/social/[slug]/page.tsx` (company profile). New components under `apps/web/src/components/social/`. Feed data comes from `GET /social/feed` (cursor-paginated) via `apiGet`; posting uses `apiUpload` (multipart). The tier/owner check that's currently duplicated in `GlobalHeader` and `JobsBrowser` is extracted to a `useIsCompanyOwner()` hook and reused. The rating page's "dynamic Beaver face" and the 3-then-expand comment behavior are the only edits to existing files, both minimal.

**Tech Stack:** Next.js App Router (Turbopack), React client components, Tailwind v4 with the app's semantic tokens, `@iwtr/shared-types` for all request/response shapes.

**Spec:** `docs/superpowers/specs/2026-09-07-iwt-social-frontend.md` (read alongside this plan).

## Prerequisites

1. `docs/superpowers/plans/2026-09-07-iwt-social-backend.md` is fully implemented, reviewed, and merged (or on the same branch, earlier). Every endpoint below exists once it lands.
2. Isolated worktree via `superpowers:using-git-worktrees`.
3. Both dev servers running (`apps/api` :3001, `apps/web` :3000) - this plan is verified in a browser per CLAUDE.md.
4. For the visual polish of each new component, the executor should consult the `frontend-design` skill - this plan specifies structure, data wiring, and exact copy, not final pixel design.

## Global Constraints

Copied verbatim from the spec - every task implicitly includes these:

- **Do not modify** `apps/web/src/components/JobsBrowser.tsx`'s rendered behavior or `apps/web/src/components/WorkplaceBrowser.tsx`'s rendered behavior. `JobsBrowser` is edited only to consume the new `useIsCompanyOwner()` hook (same boolean it already computes inline). `WorkplaceBrowser` is edited only to import `RATING_TICKS` / `activeMoodIndex` from their new shared module - byte-identical rendered output.
- **Dual-Mode Isolation:** this is the frontend half; it starts only after the backend plan is applied.
- **Design system:** typography is already Plus Jakarta Sans app-wide (layout.tsx). For Light/Dark parity use the app's **semantic tokens only** - `bg-background`, `bg-surface`, `bg-surface-muted`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-brand-600` etc. Never hardcode `gray-*`, `zinc-*`, `bg-white`, or `#hex` for themed surfaces (this is the exact bug the owner-dashboard dark-mode fix removed; the dark palette already resolves to Tailwind's neutral zinc scale through these tokens).
- **Exact UI copy, spacing included:** `"See what they are doing !"`, `"Tell us what you think !"`, `"You can share your projects, photos or posts if you like !"`, `"Back to Rating"`, `"See them all"`. Do not normalize the space before `!`.
- **Anonymity:** `apps/web/src/components/social/**` renders comment data. It must never display or log a commenter's real identity - only the `displayUsername` / `avatarKey` / `avatarGradient` the API returns. `PublicSocialComment` carries no `userId` (backend guarantee); do not add one.
- **`packages/shared-types` ships compiled JS** - if a task touches `packages/shared-types/src/**`, rebuild `dist/` (`cd packages/shared-types && pnpm exec tsc`). This plan should not need to (all social schemas landed in the backend plan).

---

### Task 1: `useIsCompanyOwner()` hook, enable the IWT Social nav link, `IwtSocialIcon`

**Files:**
- Create: `apps/web/src/lib/useIsCompanyOwner.ts`
- Create: `apps/web/src/components/icons/IwtSocialIcon.tsx`
- Modify: `apps/web/src/components/GlobalHeader.tsx` (use the hook; un-disable + un-gate the nav link; use the icon)
- Modify: `apps/web/src/components/JobsBrowser.tsx` (use the hook - one line)
- Test: `apps/web/src/lib/__tests__/useIsCompanyOwner.test.tsx` (Create)

**Interfaces:**
- Produces: `useIsCompanyOwner(): boolean` - `true` iff `isAuthenticated && onboardingStatus?.status === "ACTIVE" && role === "COMPANY_OWNER"` (the exact expression `GlobalHeader.tsx:68` and `JobsBrowser.tsx:442` already compute). `<IwtSocialIcon className?>` - the globe/meridian SVG currently inlined in `GlobalHeader`'s nav link.

- [ ] **Step 1: Write the failing hook test**

`apps/web/src/lib/__tests__/useIsCompanyOwner.test.tsx`:

```tsx
import { renderHook } from "@testing-library/react";
import { useIsCompanyOwner } from "../useIsCompanyOwner";
import * as authContext from "../auth-context";

jest.mock("../auth-context");

function mockAuth(v: Partial<ReturnType<typeof authContext.useAuth>>) {
  (authContext.useAuth as jest.Mock).mockReturnValue({
    isAuthenticated: false,
    role: null,
    onboardingStatus: null,
    ...v,
  });
}

describe("useIsCompanyOwner", () => {
  it("is false when logged out", () => {
    mockAuth({ isAuthenticated: false });
    expect(renderHook(() => useIsCompanyOwner()).result.current).toBe(false);
  });
  it("is false for an ACTIVE member", () => {
    mockAuth({ isAuthenticated: true, role: "MEMBER", onboardingStatus: { status: "ACTIVE" } as never });
    expect(renderHook(() => useIsCompanyOwner()).result.current).toBe(false);
  });
  it("is false for a COMPANY_OWNER mid-onboarding", () => {
    mockAuth({ isAuthenticated: true, role: "COMPANY_OWNER", onboardingStatus: { status: "PENDING_AVATAR" } as never });
    expect(renderHook(() => useIsCompanyOwner()).result.current).toBe(false);
  });
  it("is true for an ACTIVE COMPANY_OWNER", () => {
    mockAuth({ isAuthenticated: true, role: "COMPANY_OWNER", onboardingStatus: { status: "ACTIVE" } as never });
    expect(renderHook(() => useIsCompanyOwner()).result.current).toBe(true);
  });
});
```

- [ ] **Step 2: Run it (fails)** - `cd apps/web && pnpm exec jest useIsCompanyOwner`. Expected: "Cannot find module '../useIsCompanyOwner'".

- [ ] **Step 3: Write `useIsCompanyOwner.ts`**

```typescript
"use client";

import { useAuth } from "@/lib/auth-context";

// The "is this an active, approved employer account" check - previously
// copy-pasted in GlobalHeader.tsx and JobsBrowser.tsx (and about to be
// needed in 3 more social components). One definition now.
export function useIsCompanyOwner(): boolean {
  const { isAuthenticated, role, onboardingStatus } = useAuth();
  return isAuthenticated && onboardingStatus?.status === "ACTIVE" && role === "COMPANY_OWNER";
}
```

- [ ] **Step 4: Write `IwtSocialIcon.tsx`**

```tsx
// The IWT Social mark - a meridian globe. Extracted from GlobalHeader's nav
// link so the same symbol can sit on the cross-promotion banner and the
// /social page header.
export function IwtSocialIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
```

- [ ] **Step 5: Update `GlobalHeader.tsx`**

- Replace the inline owner expression (`const isCompanyOwner = showAccountControls && role === "COMPANY_OWNER";`) usage that only needs the boolean with `const isCompanyOwner = useIsCompanyOwner();` (keep `showAccountControls` for the other controls that use it; `useIsCompanyOwner()` already folds the ACTIVE check in).
- The IWT Social `NavIconLink` currently sits inside `{showAccountControls && (...)}` and has `disabled` + `title="IWT Social — coming soon"`. Move it **out** of the `showAccountControls` block (place it as a sibling of the always-visible "Home" `NavIconLink`), drop `disabled`, drop the custom `title` (let it default to `"IWT Social"`), and swap the inline `<svg>` for `<IwtSocialIcon className="h-5 w-5" />`:

```tsx
<NavIconLink href="/social" label="IWT Social">
  <IwtSocialIcon className="h-5 w-5" />
</NavIconLink>
```

Rationale: the spec supports anonymous feed viewing, so the tab must be reachable without an account. `NavIconLink`'s non-disabled branch is already a plain `<Link>` - nothing else needs to change.

- [ ] **Step 6: Update `JobsBrowser.tsx`**

Replace `const isCompanyOwner = isAuthenticated && onboardingStatus?.status === "ACTIVE" && role === "COMPANY_OWNER";` (around line 442) with:

```tsx
import { useIsCompanyOwner } from "@/lib/useIsCompanyOwner";
// ...
const isCompanyOwner = useIsCompanyOwner();
```

Remove now-unused destructured `role` / `onboardingStatus` from the `useAuth()` call there **only if** nothing else in the component uses them (check first - `isAuthenticated` is likely still used elsewhere).

- [ ] **Step 7: Run tests + typecheck** - `cd apps/web && pnpm exec jest && pnpm exec tsc --noEmit`. Expected: all green (existing 38 + 4 new).

- [ ] **Step 8: Browser check** - reload any page logged out: the "IWT Social" tab is now visible and not greyed; clicking it navigates to `/social` (which 404s until Task 3 - that's expected). Log in as the dev owner: `/jobs` still shows the "Create job posting !" button (proves the hook swap kept `isCompanyOwner` working).

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/useIsCompanyOwner.ts apps/web/src/lib/__tests__/useIsCompanyOwner.test.tsx apps/web/src/components/icons/IwtSocialIcon.tsx apps/web/src/components/GlobalHeader.tsx apps/web/src/components/JobsBrowser.tsx
git commit -m "feat(web): useIsCompanyOwner hook + enable the IWT Social nav tab"
```

---

### Task 2: `BeaverRatingIcon` - extract the mood art, no behavior change to the Home feed

**Files:**
- Create: `apps/web/src/lib/beaverRating.ts`
- Create: `apps/web/src/components/BeaverRatingIcon.tsx`
- Modify: `apps/web/src/components/WorkplaceBrowser.tsx` (replace the inline `RATING_TICKS` / `activeMoodIndex` definitions with imports - nothing else)
- Test: `apps/web/src/lib/__tests__/beaverRating.test.ts` (Create)

**Interfaces:**
- Produces:
  - `beaverRating.ts`: `RATING_TICKS: { value: number; src: string; alt: string }[]` (the exact 3-entry array currently in `WorkplaceBrowser.tsx:25-29`) and `activeMoodIndex(value: number): 0 | 1 | 2` (the exact function at `WorkplaceBrowser.tsx:35-39`).
  - `<BeaverRatingIcon score={number | null} size?: "sm" | "md" className? />` - renders the single mood image for `activeMoodIndex(score)` at full opacity; renders a neutral placeholder box when `score` is null.

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/__tests__/beaverRating.test.ts`:

```typescript
import { RATING_TICKS, activeMoodIndex } from "../beaverRating";

describe("beaverRating", () => {
  it("has 3 ticks at 0 / 2.5 / 5", () => {
    expect(RATING_TICKS.map((t) => t.value)).toEqual([0, 2.5, 5]);
  });
  it("splits 0-5 into even thirds", () => {
    expect(activeMoodIndex(0)).toBe(0);
    expect(activeMoodIndex(1.6)).toBe(0);
    expect(activeMoodIndex(2.5)).toBe(1);
    expect(activeMoodIndex(3.3)).toBe(1);
    expect(activeMoodIndex(3.4)).toBe(2);
    expect(activeMoodIndex(5)).toBe(2);
  });
});
```

- [ ] **Step 2: Run (fails)** - `cd apps/web && pnpm exec jest beaverRating`.

- [ ] **Step 3: Write `beaverRating.ts`** (copy the two definitions verbatim from `WorkplaceBrowser.tsx`, keep the explanatory comments)

```typescript
// Custom mood art for the 0/2.5/5 rating scale (apps/web/public). Shared
// between the Home rating-filter slider (WorkplaceBrowser) and the IWT
// Social company hero card (BeaverRatingIcon) - one definition so the two
// can't drift.
export const RATING_TICKS: { value: number; src: string; alt: string }[] = [
  { value: 0, src: "/1LowMood.png", alt: "Low rating" },
  { value: 2.5, src: "/3MidMood.png", alt: "Mid rating" },
  { value: 5, src: "/5HighMood.png", alt: "High rating" },
];

// Which of the 3 mood mascots is "live" for a 0-5 value - an even 3-way
// split of the range (not tied to the ticks' anchor values).
export function activeMoodIndex(value: number): 0 | 1 | 2 {
  if (value < 5 / 3) return 0;
  if (value < 10 / 3) return 1;
  return 2;
}
```

- [ ] **Step 4: Write `BeaverRatingIcon.tsx`**

```tsx
import { RATING_TICKS, activeMoodIndex } from "@/lib/beaverRating";

const SIZES = { sm: "h-10 w-10", md: "h-16 w-16" } as const;

// One mood face for a company's overall score. Unlike WorkplaceBrowser's
// slider (which shows all 3 with the inactive two dimmed), this shows just
// the one that matches the score.
export function BeaverRatingIcon({
  score,
  size = "md",
  className = "",
}: {
  score: number | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  if (score === null) {
    return <span className={`${SIZES[size]} shrink-0 rounded-full bg-surface-muted ${className}`} aria-hidden="true" />;
  }
  const tick = RATING_TICKS[activeMoodIndex(score)];
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size static mood art
    <img src={tick.src} alt={tick.alt} className={`${SIZES[size]} shrink-0 object-contain ${className}`} />
  );
}
```

- [ ] **Step 5: Swap `WorkplaceBrowser.tsx` to the imports**

Delete the inline `const RATING_TICKS = [...]` and `function activeMoodIndex(...)` (lines ~23-39, keep the surrounding `SortOption` etc.), and add near the other imports:

```typescript
import { RATING_TICKS, activeMoodIndex } from "@/lib/beaverRating";
```

Nothing else in that file changes. The slider's `RATING_TICKS.map(...)` / `activeMoodIndex(minRating)` calls now resolve to the imported symbols.

- [ ] **Step 6: Run tests + typecheck + browser** - `cd apps/web && pnpm exec jest && pnpm exec tsc --noEmit`, then load the homepage and confirm the rating slider mascots look and behave exactly as before (drag the slider, watch the lit mascot change at the thirds).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/beaverRating.ts apps/web/src/lib/__tests__/beaverRating.test.ts apps/web/src/components/BeaverRatingIcon.tsx apps/web/src/components/WorkplaceBrowser.tsx
git commit -m "refactor(web): extract BeaverRatingIcon / RATING_TICKS to a shared module"
```

---

### Task 3: `/social` route + main feed (search box, infinite scroll, ad every 7th post)

**Files:**
- Create: `apps/web/src/app/social/page.tsx`
- Create: `apps/web/src/components/social/SocialFeed.tsx`
- Create: `apps/web/src/components/social/SocialPostCard.tsx` (post display only - Like/Comment come in Task 4)
- Create: `apps/web/src/components/social/socialTime.ts` (a tiny relative-time helper)
- Test: `apps/web/src/components/social/__tests__/SocialFeed.test.tsx` (Create)

**Interfaces:**
- Consumes: `apiGet<SocialFeedPage>` from `@/lib/api-client`; `PublicSocialPost`, `SocialFeedPage` from `@iwtr/shared-types`.
- Produces: `<SocialFeed scope={{ kind: "all" } | { kind: "company"; slug: string }} />` - owns fetch + pagination + (for `all`) the search box + ad interleaving. `<SocialPostCard post={PublicSocialPost} onChanged={(p) => void} />` (`onChanged` used from Task 4).

- [ ] **Step 1: Write the failing feed test**

`apps/web/src/components/social/__tests__/SocialFeed.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { SocialFeed } from "../SocialFeed";
import * as apiClient from "@/lib/api-client";

jest.mock("@/lib/api-client");
jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ isAuthenticated: false, openAuthModal: jest.fn() }) }));
jest.mock("@/lib/useIsCompanyOwner", () => ({ useIsCompanyOwner: () => false }));

function post(id: string, name = "Acme"): apiClient extends never ? never : import("@iwtr/shared-types").PublicSocialPost {
  return {
    id, companyId: "c1", companySlug: "acme", companyName: name, companyLogoUrl: null, companyBadgeTier: "FREE",
    imageUrl: `/u/${id}.webp`, caption: null, createdAt: new Date().toISOString(),
    likeCount: 0, commentCount: 0, likedByMe: null,
  };
}

describe("SocialFeed (all)", () => {
  it("renders the first page and injects an AdSlot after every 7th post", async () => {
    (apiClient.apiGet as jest.Mock).mockResolvedValueOnce({
      posts: Array.from({ length: 9 }, (_, i) => post(`p${i}`)),
      nextCursor: "p8",
    });
    render(<SocialFeed scope={{ kind: "all" }} />);
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(9));
    // exactly one ad after 9 posts (7th boundary crossed once)
    expect(screen.getAllByText("Ad space")).toHaveLength(1);
  });

  it("has a company-name search box and no sort/filter controls", async () => {
    (apiClient.apiGet as jest.Mock).mockResolvedValue({ posts: [], nextCursor: null });
    render(<SocialFeed scope={{ kind: "all" }} />);
    expect(await screen.findByPlaceholderText(/search .*compan/i)).toBeInTheDocument();
    expect(screen.queryByText(/sort/i)).not.toBeInTheDocument();
  });
});
```

(If the odd `post()` return-type annotation trips the TS test config, just annotate it `: any` - the assertions are what matter.)

- [ ] **Step 2: Run (fails)** - `cd apps/web && pnpm exec jest SocialFeed`.

- [ ] **Step 3: Write `socialTime.ts`**

```typescript
// "3h", "2d", "just now" - compact relative time for feed cards. No library.
export function shortRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString();
}
```

- [ ] **Step 4: Write `SocialPostCard.tsx`** (display only - Like/Comment buttons are inert placeholders replaced in Task 4)

```tsx
"use client";

import Link from "next/link";
import type { PublicSocialPost } from "@iwtr/shared-types";
import { CompanyLogo } from "@/components/CompanyLogo";
import { shortRelativeTime } from "./socialTime";

export function SocialPostCard({ post }: { post: PublicSocialPost; onChanged?: (p: PublicSocialPost) => void }) {
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface">
      <header className="flex items-center gap-3 p-3">
        <Link href={`/social/${post.companySlug}`} className="flex items-center gap-3 min-w-0">
          <CompanyLogo name={post.companyName} mainPhotoUrl={post.companyLogoUrl} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{post.companyName}</p>
            <p className="text-xs text-muted-foreground">{shortRelativeTime(post.createdAt)}</p>
          </div>
        </Link>
      </header>

      {/* eslint-disable-next-line @next/next/no-img-element -- server-produced WebP under our own /uploads */}
      <img src={post.imageUrl} alt={post.caption ?? `${post.companyName} post`} className="w-full bg-surface-muted object-cover" />

      {post.caption && <p className="whitespace-pre-wrap px-3 pt-3 text-sm text-foreground">{post.caption}</p>}

      {/* Like / Comment row - real behavior added in Task 4 */}
      <div className="flex items-center gap-4 p-3 text-sm text-muted-foreground">
        <span>{post.likeCount} likes</span>
        <span>{post.commentCount} comments</span>
      </div>
    </article>
  );
}
```

- [ ] **Step 5: Write `SocialFeed.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicSocialPost, SocialFeedPage } from "@iwtr/shared-types";
import { apiGet, ApiError } from "@/lib/api-client";
import { AdSlot } from "@/components/AdSlot";
import { SocialPostCard } from "./SocialPostCard";

type Scope = { kind: "all" } | { kind: "company"; slug: string };

// Inject one AdSlot after every 7th post as the list grows (spec item 1).
const AD_EVERY = 7;

export function SocialFeed({ scope }: { scope: Scope }) {
  const [posts, setPosts] = useState<PublicSocialPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const sentinelRef = useRef<HTMLDivElement>(null);

  const endpoint = useCallback(
    (nextCursor: string | null, q: string) => {
      const params = new URLSearchParams();
      if (nextCursor) params.set("cursor", nextCursor);
      if (scope.kind === "all" && q.trim()) params.set("q", q.trim());
      const base = scope.kind === "all" ? "/social/feed" : `/social/companies/${scope.slug}/posts`;
      return `${base}${params.toString() ? `?${params}` : ""}`;
    },
    [scope],
  );

  // Reset + reload whenever the debounced search query changes (all-scope only).
  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      setError(null);
      apiGet<SocialFeedPage>(endpoint(null, query))
        .then((page) => {
          setPosts(page.posts);
          setCursor(page.nextCursor);
          setDone(page.nextCursor === null);
        })
        .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load the feed."))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [endpoint, query]);

  const loadMore = useCallback(() => {
    if (loading || done || !cursor) return;
    setLoading(true);
    apiGet<SocialFeedPage>(endpoint(cursor, query))
      .then((page) => {
        setPosts((prev) => [...prev, ...page.posts]);
        setCursor(page.nextCursor);
        setDone(page.nextCursor === null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load more."))
      .finally(() => setLoading(false));
  }, [cursor, done, endpoint, loading, query]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore());
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  return (
    <div className="flex flex-col gap-4">
      {scope.kind === "all" && (
        // Fixed to the top-left of the feed column, company-name search only -
        // NO sort or filter dropdowns (spec item 1).
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a company by name..."
          className="w-full max-w-sm self-start rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground"
        />
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!loading && !error && posts.length === 0 && (
        <p className="text-sm text-muted-foreground">No posts yet.</p>
      )}

      {posts.map((post, i) => (
        <div key={post.id} className="contents">
          <SocialPostCard
            post={post}
            onChanged={(p) => setPosts((prev) => prev.map((x) => (x.id === p.id ? p : x)))}
          />
          {(i + 1) % AD_EVERY === 0 && <AdSlot orientation="horizontal" />}
        </div>
      ))}

      <div ref={sentinelRef} />
      {loading && <p className="text-center text-sm text-muted-foreground">Loading...</p>}
    </div>
  );
}
```

- [ ] **Step 6: Write `app/social/page.tsx`**

```tsx
import type { Metadata } from "next";
import { AdSlot } from "@/components/AdSlot";
import { SocialFeed } from "@/components/social/SocialFeed";
import { SocialComposerSlot } from "@/components/social/SocialComposerSlot";
import { SocialWelcomeDialog } from "@/components/social/SocialWelcomeDialog";

export const metadata: Metadata = { title: "IWT Social - I Worked There" };

// Separate route, its own 3-column shell (ad rail / feed / ad rail) - the
// same shell the homepage and company page use. Not nested under any
// existing layout beyond the root.
export default function SocialPage() {
  return (
    <div className="flex w-full items-start justify-center gap-6 px-4 py-8">
      <AdSlot />
      <div className="w-full max-w-xl">
        <h1 className="mb-4 text-2xl font-bold text-foreground">IWT Social</h1>
        {/* Employer-only: welcome dialog (once ever) + post composer. Both
            no-op for non-owners. Added fully in Task 5 - stub imports now so
            the page compiles; if Task 5 runs first, they are already real. */}
        <SocialWelcomeDialog />
        <SocialComposerSlot />
        <SocialFeed scope={{ kind: "all" }} />
      </div>
      <AdSlot />
    </div>
  );
}
```

If Task 5 has not run yet, create 1-line placeholder components so this compiles: `SocialComposerSlot` / `SocialWelcomeDialog` each `export function X() { return null; }`. Task 5 replaces their bodies.

- [ ] **Step 7: Run tests + typecheck** - `cd apps/web && pnpm exec jest social && pnpm exec tsc --noEmit`. Expected: green.

- [ ] **Step 8: Browser check** - seed at least one post (backend Task 4 smoke test, or the frontend composer once Task 5 lands). Visit `/social`: feed renders newest-first, the search box filters by company name after a short debounce, scrolling to the bottom loads the next page, an "Ad space" strip appears after the 7th post. Check dark + light.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/social apps/web/src/components/social
git commit -m "feat(web): /social main feed - search, infinite scroll, ad every 7th post"
```

---

### Task 4: Like + comment thread on `SocialPostCard`, anonymous sign-in gate

**Files:**
- Modify: `apps/web/src/components/social/SocialPostCard.tsx` (real Like button + comment thread)
- Create: `apps/web/src/components/social/SocialComments.tsx`
- Test: `apps/web/src/components/social/__tests__/SocialPostCard.test.tsx` (Create)

**Interfaces:**
- Consumes: `apiPost<SocialPostLikeResult>`, `apiGet<PublicSocialComment[]>`, `apiPost<PublicSocialComment>`, `apiDelete` (from `@/lib/api-client`); `useAuth()` for `isAuthenticated` + `openAuthModal`.
- Produces: `SocialPostCard` gains working Like (optimistic toggle via `POST /social/posts/:id/like`) and an expandable comment thread (`SocialComments`). Anonymous click on Like or the comment box calls `openAuthModal()` and does nothing else.

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/social/__tests__/SocialPostCard.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { SocialPostCard } from "../SocialPostCard";

const openAuthModal = jest.fn();
jest.mock("@/lib/auth-context", () => ({ useAuth: () => mockAuth }));
jest.mock("@/lib/api-client");
let mockAuth: { isAuthenticated: boolean; openAuthModal: jest.Mock };

const basePost = {
  id: "p1", companyId: "c1", companySlug: "acme", companyName: "Acme", companyLogoUrl: null, companyBadgeTier: "FREE" as const,
  imageUrl: "/u/p1.webp", caption: "hi", createdAt: new Date().toISOString(), likeCount: 2, commentCount: 0, likedByMe: false,
};

beforeEach(() => { openAuthModal.mockClear(); });

it("anonymous Like click opens the auth modal and does not call the API", () => {
  mockAuth = { isAuthenticated: false, openAuthModal };
  const apiPost = require("@/lib/api-client").apiPost as jest.Mock;
  render(<SocialPostCard post={basePost} />);
  fireEvent.click(screen.getByRole("button", { name: /like/i }));
  expect(openAuthModal).toHaveBeenCalledTimes(1);
  expect(apiPost).not.toHaveBeenCalled();
});

it("authenticated Like click toggles optimistically and calls the API", async () => {
  mockAuth = { isAuthenticated: true, openAuthModal };
  const apiPost = require("@/lib/api-client").apiPost as jest.Mock;
  apiPost.mockResolvedValue({ postId: "p1", likeCount: 3, likedByMe: true });
  const onChanged = jest.fn();
  render(<SocialPostCard post={basePost} onChanged={onChanged} />);
  fireEvent.click(screen.getByRole("button", { name: /like/i }));
  expect(await screen.findByText(/3 likes/)).toBeInTheDocument();
  expect(apiPost).toHaveBeenCalledWith("/social/posts/p1/like", {});
});
```

- [ ] **Step 2: Run (fails)** - `cd apps/web && pnpm exec jest SocialPostCard`.

- [ ] **Step 3: Write `SocialComments.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import type { PublicSocialComment } from "@iwtr/shared-types";
import { apiGet, apiPost, apiDelete, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/Avatar";
import { shortRelativeTime } from "./socialTime";

export function SocialComments({ postId, onCountChange }: { postId: string; onCountChange: (n: number) => void }) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [comments, setComments] = useState<PublicSocialComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<PublicSocialComment[]>(`/social/posts/${postId}/comments`)
      .then((rows) => {
        setComments(rows);
        onCountChange(rows.length);
      })
      .catch(() => setComments([]));
  }, [postId, onCountChange]);

  async function submit() {
    if (!isAuthenticated) return openAuthModal();
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await apiPost<PublicSocialComment>(`/social/posts/${postId}/comments`, { body: draft.trim() });
      setComments((prev) => {
        const next = [...(prev ?? []), created];
        onCountChange(next.length);
        return next;
      });
      setDraft("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't post that comment.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await apiDelete(`/social/comments/${id}`);
      setComments((prev) => {
        const next = (prev ?? []).filter((c) => c.id !== id);
        onCountChange(next.length);
        return next;
      });
    } catch {
      /* leave it; a failed delete is non-destructive */
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border p-3">
      {comments?.map((c) => (
        <div key={c.id} className="flex items-start gap-2">
          <Avatar avatarKey={c.avatarKey} avatarGradient={c.avatarGradient} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">
              {c.displayUsername ?? "Anonymous"} - {shortRelativeTime(c.createdAt)}
            </p>
            <p className="whitespace-pre-wrap text-sm text-foreground">{c.body}</p>
          </div>
          {c.mine && (
            <button type="button" onClick={() => remove(c.id)} className="text-xs text-muted-foreground hover:text-foreground">
              Delete
            </button>
          )}
        </div>
      ))}

      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => { if (!isAuthenticated) openAuthModal(); }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Add a comment..."
          maxLength={1000}
          className="flex-1 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          Post
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Rewrite the Like/Comment row in `SocialPostCard.tsx`**

Replace the `<div className="flex items-center gap-4 p-3 ...">` placeholder with real controls:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import type { PublicSocialPost, SocialPostLikeResult } from "@iwtr/shared-types";
import { apiPost, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { CompanyLogo } from "@/components/CompanyLogo";
import { shortRelativeTime } from "./socialTime";
import { SocialComments } from "./SocialComments";

export function SocialPostCard({
  post,
  onChanged,
}: {
  post: PublicSocialPost;
  onChanged?: (p: PublicSocialPost) => void;
}) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  async function toggleLike() {
    if (!isAuthenticated) return openAuthModal();
    if (likeBusy) return;
    setLikeBusy(true);
    // optimistic
    const optimistic: PublicSocialPost = {
      ...post,
      likedByMe: !post.likedByMe,
      likeCount: post.likeCount + (post.likedByMe ? -1 : 1),
    };
    onChanged?.(optimistic);
    try {
      const r = await apiPost<SocialPostLikeResult>(`/social/posts/${post.id}/like`, {});
      onChanged?.({ ...post, likedByMe: r.likedByMe, likeCount: r.likeCount });
    } catch (e) {
      onChanged?.(post); // revert
      if (e instanceof ApiError && e.status === 401) openAuthModal();
    } finally {
      setLikeBusy(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-surface">
      <header className="flex items-center gap-3 p-3">
        <Link href={`/social/${post.companySlug}`} className="flex min-w-0 items-center gap-3">
          <CompanyLogo name={post.companyName} mainPhotoUrl={post.companyLogoUrl} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{post.companyName}</p>
            <p className="text-xs text-muted-foreground">{shortRelativeTime(post.createdAt)}</p>
          </div>
        </Link>
      </header>

      {/* eslint-disable-next-line @next/next/no-img-element -- server-produced WebP under our own /uploads */}
      <img src={post.imageUrl} alt={post.caption ?? `${post.companyName} post`} className="w-full bg-surface-muted object-cover" />

      {post.caption && <p className="whitespace-pre-wrap px-3 pt-3 text-sm text-foreground">{post.caption}</p>}

      <div className="flex items-center gap-4 p-3 text-sm">
        <button
          type="button"
          onClick={toggleLike}
          aria-pressed={post.likedByMe ?? false}
          className={`font-medium transition ${post.likedByMe ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground hover:text-foreground"}`}
        >
          Like ({post.likeCount})
        </button>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="font-medium text-muted-foreground transition hover:text-foreground"
        >
          Comment ({post.commentCount})
        </button>
      </div>

      {showComments && (
        <SocialComments
          postId={post.id}
          onCountChange={(n) => onChanged?.({ ...post, commentCount: n })}
        />
      )}
    </article>
  );
}
```

- [ ] **Step 5: Run tests + typecheck** - `cd apps/web && pnpm exec jest social && pnpm exec tsc --noEmit`. Expected: green (SocialFeed + SocialPostCard).

- [ ] **Step 6: Browser check**
  - Logged out: click "Like" -> AuthModal opens, count does not change. Focus the comment input -> AuthModal opens.
  - Logged in as a member: Like toggles and persists on refresh; open comments, post one, see it appear with your anonymous handle + avatar; a "Delete" link shows only on your own comment and removes it; a profanity/name comment shows the API's 400 message inline.
  - Dark + light parity.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/social
git commit -m "feat(web): social post likes + anonymous comment thread with sign-in gate"
```

---

### Task 5: Employer post composer + one-time welcome dialog

**Files:**
- Create/replace: `apps/web/src/components/social/SocialComposerSlot.tsx`
- Create/replace: `apps/web/src/components/social/SocialWelcomeDialog.tsx`
- Create: `apps/web/src/components/social/SocialComposer.tsx`
- Test: `apps/web/src/components/social/__tests__/SocialComposer.test.tsx` (Create)

**Interfaces:**
- Consumes: `useIsCompanyOwner()` (Task 1); `apiGet<OwnedCompany[]>("/me/owned-companies")`, `apiUpload<{ id: string }>("/social/posts", formData)`; `validateSocialImageUpload` from `@iwtr/shared-types`.
- Produces:
  - `<SocialComposerSlot />` - renders nothing for non-owners; for an owner renders the collapsed "Tell us what you think !" card that expands into `<SocialComposer />`.
  - `<SocialWelcomeDialog />` - renders nothing for non-owners or if `localStorage["iwtr:social-welcome-seen"]` is set; otherwise a one-time modal with the welcome copy + a 1:1 empty placeholder box, and writes the flag on dismiss.
  - `<SocialComposer companies={OwnedCompany[]} onPosted={() => void} onCancel={() => void} />`.

- [ ] **Step 1: Write the failing composer test**

`apps/web/src/components/social/__tests__/SocialComposer.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SocialComposer } from "../SocialComposer";
import * as apiClient from "@/lib/api-client";

jest.mock("@/lib/api-client");

const companies = [{ companyId: "c1", companyName: "Acme", companySlug: "acme", tier: "FREE", planStatus: "NONE", isVerifiedBadge: false }];

it("rejects a non-image file with the shared validator message", async () => {
  render(<SocialComposer companies={companies as never} onPosted={jest.fn()} onCancel={jest.fn()} />);
  const input = screen.getByLabelText(/add a photo/i);
  fireEvent.change(input, { target: { files: [new File(["x"], "a.pdf", { type: "application/pdf" })] } });
  expect(await screen.findByText(/must be a JPEG, PNG, or HEIC/i)).toBeInTheDocument();
});

it("uploads via apiUpload with companyId + caption + file", async () => {
  (apiClient.apiUpload as jest.Mock).mockResolvedValue({ id: "post-1" });
  const onPosted = jest.fn();
  render(<SocialComposer companies={companies as never} onPosted={onPosted} onCancel={jest.fn()} />);
  fireEvent.change(screen.getByLabelText(/add a photo/i), {
    target: { files: [new File(["img"], "a.jpg", { type: "image/jpeg" })] },
  });
  fireEvent.change(screen.getByPlaceholderText("Tell us what you think !"), { target: { value: "new gear" } });
  fireEvent.click(screen.getByRole("button", { name: /post/i }));
  await waitFor(() => expect(onPosted).toHaveBeenCalled());
  const fd = (apiClient.apiUpload as jest.Mock).mock.calls[0][1] as FormData;
  expect(fd.get("companyId")).toBe("c1");
  expect(fd.get("caption")).toBe("new gear");
  expect(fd.get("file")).toBeInstanceOf(File);
});
```

- [ ] **Step 2: Run (fails)** - `cd apps/web && pnpm exec jest SocialComposer`.

- [ ] **Step 3: Write `SocialComposer.tsx`**

```tsx
"use client";

import { useRef, useState } from "react";
import type { OwnedCompany } from "@iwtr/shared-types";
import { validateSocialImageUpload } from "@iwtr/shared-types";
import { apiUpload, ApiError } from "@/lib/api-client";

export function SocialComposer({
  companies,
  onPosted,
  onCancel,
}: {
  companies: OwnedCompany[];
  onPosted: () => void;
  onCancel: () => void;
}) {
  const [companyId, setCompanyId] = useState(companies[0]?.companyId ?? "");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | undefined) {
    if (!f) return;
    const check = validateSocialImageUpload({ mimeType: f.type, sizeBytes: f.size });
    if (!check.valid) {
      setError(check.error);
      return;
    }
    setError(null);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function submit() {
    if (!file) {
      setError("Add a photo to post.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("companyId", companyId);
      if (caption.trim()) fd.set("caption", caption.trim());
      fd.set("file", file);
      await apiUpload<{ id: string }>("/social/posts", fd);
      setCaption("");
      setFile(null);
      setPreviewUrl(null);
      onPosted();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't post that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      {companies.length > 1 && (
        <select
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          className="mb-2 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
        >
          {companies.map((c) => (
            <option key={c.companyId} value={c.companyId}>
              {c.companyName}
            </option>
          ))}
        </select>
      )}

      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Tell us what you think !"
        rows={3}
        maxLength={1000}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
      />

      <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-surface-muted">
        <span className="text-lg leading-none">+</span> Add a photo
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif"
          aria-label="Add a photo"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
      </label>

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
        <img src={previewUrl} alt="" className="mt-2 max-h-64 w-full rounded-lg object-cover" />
      )}

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "Posting..." : "Post"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-muted-foreground hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}
```

If `OwnedCompany` is not exported from `@iwtr/shared-types`, it is - see `packages/shared-types/src/schemas/owner.ts` (`ownedCompanySchema` / `OwnedCompany`). Confirm the field names (`companyId`, `companyName`, `companySlug`) match `OwnerService.myOwnedCompanies`.

- [ ] **Step 4: Write `SocialComposerSlot.tsx`** (the collapsed -> expanded shell)

```tsx
"use client";

import { useEffect, useState } from "react";
import type { OwnedCompany } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { useIsCompanyOwner } from "@/lib/useIsCompanyOwner";
import { SocialComposer } from "./SocialComposer";

export function SocialComposerSlot() {
  const isOwner = useIsCompanyOwner();
  const [companies, setCompanies] = useState<OwnedCompany[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isOwner) return;
    apiGet<OwnedCompany[]>("/me/owned-companies").then(setCompanies).catch(() => setCompanies([]));
  }, [isOwner]);

  if (!isOwner || !companies || companies.length === 0) return null;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mb-4 w-full rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm text-muted-foreground transition hover:bg-surface-muted"
      >
        Tell us what you think !
      </button>
    );
  }
  return (
    <div className="mb-4">
      <SocialComposer
        companies={companies}
        onPosted={() => {
          setExpanded(false);
          // simplest reliable refresh of the feed below
          window.location.reload();
        }}
        onCancel={() => setExpanded(false)}
      />
    </div>
  );
}
```

- [ ] **Step 5: Write `SocialWelcomeDialog.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useIsCompanyOwner } from "@/lib/useIsCompanyOwner";

const SEEN_KEY = "iwtr:social-welcome-seen";

export function SocialWelcomeDialog() {
  const isOwner = useIsCompanyOwner();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isOwner) return;
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      /* private mode - just don't show it */
    }
  }, [isOwner]);

  function dismiss() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={dismiss}>
      <div
        className="w-full max-w-md rounded-xl border border-border bg-surface p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-base font-medium text-foreground">
          You can share your projects, photos or posts if you like !
        </p>
        {/* 1:1 placeholder box - deliberately empty, "for future design
            integration" per the task. */}
        <div className="mx-auto mt-4 aspect-square w-full max-w-[240px] rounded-lg border border-dashed border-border" />
        <button
          type="button"
          onClick={dismiss}
          className="mt-4 rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run tests + typecheck** - `cd apps/web && pnpm exec jest social && pnpm exec tsc --noEmit`. Expected: green.

- [ ] **Step 7: Browser check** (dev owner account)
  - First visit to `/social` after clearing `localStorage`: welcome dialog appears once with the exact copy + empty square; dismiss; reload -> it does not reappear.
  - The collapsed "Tell us what you think !" card shows; click -> expands; attach a JPEG, type a caption, Post -> the new post appears at the top of the feed.
  - A non-image file shows the validator error; a caption naming a person shows the API's 400 inline.
  - Log in as a plain member -> neither the composer nor the dialog renders.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/social apps/web/src/app/social/page.tsx
git commit -m "feat(web): employer post composer + one-time IWT Social welcome dialog"
```

---

### Task 6: `/social/[slug]` company IWT Social profile

**Files:**
- Create: `apps/web/src/app/social/[slug]/page.tsx`
- Create: `apps/web/src/components/social/SocialCompanyHero.tsx`
- Test: none new (covered by the `SocialFeed` company-scope path + a browser check); optional `SocialCompanyHero.test.tsx` if the executor wants one.

**Interfaces:**
- Consumes: `apiGetPublic<CompanyDetail>("/companies/:slug")` (Server Component fetch, same as `app/companies/[slug]/page.tsx`); `<SocialFeed scope={{ kind: "company", slug }} />` (Task 3); `<BeaverRatingIcon />` (Task 2); `<SocialComposerSlot />` (Task 5).
- Produces: the route `/social/[slug]`.

- [ ] **Step 1: Write `SocialCompanyHero.tsx`**

```tsx
import Link from "next/link";
import type { Company } from "@iwtr/shared-types";
import { CompanyLogo } from "@/components/CompanyLogo";
import { BeaverRatingIcon } from "@/components/BeaverRatingIcon";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";
import { IwtSocialIcon } from "@/components/icons/IwtSocialIcon";

// Mirrors the top of the rating page (logo + banner + work-types + sector +
// overall number), plus the mood face and a "Back to Rating" button.
export function SocialCompanyHero({
  company,
  overallAvg,
  reviewCount,
}: {
  company: Company;
  overallAvg: number | null;
  reviewCount: number;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {company.bannerImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- owner-submitted URL
        <img src={company.bannerImageUrl} alt="" className="aspect-[5/1] w-full object-cover" />
      )}
      <div className="flex flex-wrap items-center gap-4 p-4">
        <CompanyLogo name={company.name} mainPhotoUrl={company.mainPhotoUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <IwtSocialIcon className="h-4 w-4 text-muted-foreground" />
            <h1 className="truncate text-xl font-bold text-foreground">{company.name}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {company.category} - {company.workplaceTypes.map(workplaceTypeLabel).join(" / ")}
            {company.city ? ` - ${company.city}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BeaverRatingIcon score={overallAvg} size="sm" />
          <div className="text-right">
            <p className="text-lg font-bold text-foreground">{overallAvg !== null ? overallAvg.toFixed(1) : "-"}</p>
            <p className="text-xs text-muted-foreground">
              {reviewCount} review{reviewCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <Link
          href={`/companies/${company.slug}`}
          className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-surface-muted"
        >
          Back to Rating
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `app/social/[slug]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import type { CompanyDetail } from "@iwtr/shared-types";
import { apiGetPublic, ApiError } from "@/lib/api-client";
import { AdSlot } from "@/components/AdSlot";
import { SocialFeed } from "@/components/social/SocialFeed";
import { SocialCompanyHero } from "@/components/social/SocialCompanyHero";
import { SocialComposerSlot } from "@/components/social/SocialComposerSlot";

export default async function CompanySocialPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let detail: CompanyDetail;
  try {
    detail = await apiGetPublic<CompanyDetail>(`/companies/${slug}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const { company, aggregate } = detail;

  return (
    <div className="flex w-full items-start justify-center gap-6 px-4 py-8">
      <AdSlot />
      <div className="flex w-full max-w-xl flex-col gap-4">
        <SocialCompanyHero
          company={company}
          overallAvg={aggregate && aggregate.reviewCount > 0 ? aggregate.overallAvg : null}
          reviewCount={aggregate?.reviewCount ?? 0}
        />
        {/* The composer here is scoped by the owner's own approved companies,
            same component as the main feed - it posts as whichever company
            the owner picks, not automatically this one. That is acceptable
            for v1; a "post as {this company}" shortcut is a later refinement. */}
        <SocialComposerSlot />
        <SocialFeed scope={{ kind: "company", slug }} />
      </div>
      <AdSlot />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + browser check** - `cd apps/web && pnpm exec tsc --noEmit`. Then visit `/social/i-worked-there`: hero shows logo + banner + work-types + sector + overall number + mood face; "Back to Rating" navigates to `/companies/i-worked-there`; below, only that company's posts render; Like/Comment sign-in gate still works; unknown slug 404s. Dark + light.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/social/\[slug\] apps/web/src/components/social/SocialCompanyHero.tsx
git commit -m "feat(web): /social/[slug] company profile - hero + company feed"
```

---

### Task 7: Rating page cross-promotion - collapse comments to 3, add the banner

**Files:**
- Modify: `apps/web/src/components/ReviewsList.tsx` (add `initialVisibleCount` prop + "See them all" toggle)
- Create: `apps/web/src/components/social/SocialCrossPromoBanner.tsx`
- Modify: `apps/web/src/app/companies/[slug]/page.tsx` (pass `initialVisibleCount={3}`, render the banner below `ReviewsList`)
- Modify: `apps/web/src/app/my/companies/__tests__/page.test.tsx` if it asserts on `ReviewsList` output (check - it references "No reviews yet"); update only if the collapse changes a covered assertion
- Test: `apps/web/src/components/__tests__/ReviewsList.collapse.test.tsx` (Create)

**Interfaces:**
- Produces: `ReviewsList` gains an optional `initialVisibleCount?: number` prop. When set and the filtered list is longer, only the first N render, followed by a `See them all` button (down-arrow) that reveals the rest; a `Show fewer` control collapses again. Default (prop omitted) = today's behavior, render all. `<SocialCrossPromoBanner companySlug={string} companyName={string} />`.

- [ ] **Step 1: Write the failing collapse test**

`apps/web/src/components/__tests__/ReviewsList.collapse.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReviewsList } from "../ReviewsList";
import * as apiClient from "@/lib/api-client";

jest.mock("@/lib/api-client");
jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ isAuthenticated: false, isLoading: false }) }));

function review(id: string) {
  return {
    id, companyId: "c1", workplaceType: "OFFICE", corporateCultureScore: 3, leadershipScore: 3, infrastructureScore: 3,
    workLifeBalanceScore: 3, stabilityScore: 3, generalThoughts: `thought ${id}`, status: "PUBLISHED",
    publishedAt: new Date().toISOString(), likeCount: 0, dislikeCount: 0, myVote: null, contributorBadge: null,
    reply: null, avatarKey: null, avatarGradient: null, displayUsername: null, district: null, city: null,
  };
}

it("shows only initialVisibleCount reviews with a 'See them all' toggle", async () => {
  (apiClient.apiGet as jest.Mock).mockResolvedValue(Array.from({ length: 6 }, (_, i) => review(`r${i}`)));
  render(<ReviewsList companySlug="acme" initialVisibleCount={3} />);
  await waitFor(() => expect(screen.getByText("thought r0")).toBeInTheDocument());
  expect(screen.queryByText("thought r3")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /see them all/i }));
  expect(screen.getByText("thought r3")).toBeInTheDocument();
});

it("renders all reviews when initialVisibleCount is omitted", async () => {
  (apiClient.apiGet as jest.Mock).mockResolvedValue(Array.from({ length: 6 }, (_, i) => review(`r${i}`)));
  render(<ReviewsList companySlug="acme" />);
  await waitFor(() => expect(screen.getByText("thought r5")).toBeInTheDocument());
});
```

- [ ] **Step 2: Run (fails)** - `cd apps/web && pnpm exec jest ReviewsList.collapse`.

- [ ] **Step 3: Add the collapse to `ReviewsList.tsx`**

- Add to the prop type: `initialVisibleCount?: number;` with a doc comment ("When set, only the first N reviews render, behind a 'See them all' toggle - used by the rating page's cross-promotion collapse. Omitted elsewhere = render all.").
- Add state near the other `useState`s: `const [expanded, setExpanded] = useState(false);`
- Where `filteredReviews` is mapped, slice it first:

```tsx
const collapsed = initialVisibleCount !== undefined && !expanded && filteredReviews.length > initialVisibleCount;
const visibleReviews = collapsed ? filteredReviews.slice(0, initialVisibleCount) : filteredReviews;
```

Change `{filteredReviews.map((review) => (` to `{visibleReviews.map((review) => (`.

- After the list `.map(...)` closes (before the outer `</div>`), add the toggle:

```tsx
{initialVisibleCount !== undefined && filteredReviews.length > initialVisibleCount && (
  <button
    type="button"
    onClick={() => setExpanded((v) => !v)}
    className="mx-auto flex items-center gap-1 rounded-full border border-border px-4 py-1.5 text-sm font-medium text-foreground transition hover:bg-surface-muted"
  >
    {collapsed ? (
      <>
        See them all
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </>
    ) : (
      <>
        Show fewer
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </>
    )}
  </button>
)}
```

- [ ] **Step 4: Write `SocialCrossPromoBanner.tsx`**

```tsx
import Link from "next/link";
import { IwtSocialIcon } from "@/components/icons/IwtSocialIcon";

// Sits below the comments on the rating page (collapsed or expanded). Routes
// to that company's IWT Social profile. Exact title copy, including the
// space before "!".
export function SocialCrossPromoBanner({ companySlug }: { companySlug: string; companyName?: string }) {
  return (
    <Link
      href={`/social/${companySlug}`}
      className="mt-6 block overflow-hidden rounded-xl border border-border bg-surface transition hover:border-brand-400"
    >
      <div className="flex items-center gap-2 border-b border-border bg-surface-muted px-4 py-2">
        <IwtSocialIcon className="h-4 w-4 text-brand-600 dark:text-brand-400" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">IWT Social</span>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-4">
        <p className="text-lg font-bold text-foreground">See what they are doing !</p>
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </div>
    </Link>
  );
}
```

- [ ] **Step 5: Wire into `app/companies/[slug]/page.tsx`**

Change the `ReviewsList` render to pass the limit, and add the banner right after its wrapper `<div>`:

```tsx
import { SocialCrossPromoBanner } from "@/components/social/SocialCrossPromoBanner";
// ...
<div className="mt-8">
  <ReviewsList
    companySlug={slug}
    workplaceTypes={company.workplaceTypes}
    companyName={company.name}
    initialVisibleCount={3}
  />
  <SocialCrossPromoBanner companySlug={slug} companyName={company.name} />
</div>
```

- [ ] **Step 6: Run the full web suite + typecheck**

```bash
cd apps/web && pnpm exec jest && pnpm exec tsc --noEmit
```

Expected: all green. If `my/companies/__tests__/page.test.tsx` breaks because its live-preview `ReviewsList` now collapses, note that page passes no `initialVisibleCount` so behavior there is unchanged - a break there means a real regression, investigate.

- [ ] **Step 7: Browser check** - a company with 4+ published reviews (e.g. `demo-finans-holding`): only 3 comments show, "See them all" (with a down-chevron) reveals the rest, "Show fewer" re-collapses; the "See what they are doing !" banner sits below with the IWT Social mark on its top strip and routes to `/social/<slug>`. Dark + light. Confirm the Home rating feed and `/jobs` are visually unchanged.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/ReviewsList.tsx apps/web/src/components/social/SocialCrossPromoBanner.tsx apps/web/src/app/companies/\[slug\]/page.tsx
git commit -m "feat(web): rating page - collapse comments to 3 + IWT Social cross-promo banner"
```

---

### Task 8: Final verification pass

- [ ] **Step 1: Whole-app checks**

```bash
cd apps/web && pnpm exec tsc --noEmit && pnpm exec jest
grep -rn "gray-[0-9]\|zinc-[0-9]\|bg-white\|bg-black[^/]" apps/web/src/components/social apps/web/src/app/social   # expect empty
cd ../.. && pnpm build
```

Expected: tsc clean, jest green, no hardcoded theme colors in the new social code, monorepo build succeeds.

- [ ] **Step 2: Full manual pass** (dark AND light, per the design-parity constraint)
  - `/social` logged out: feed, search, infinite scroll, ad after 7th post; Like/comment -> AuthModal.
  - `/social` as dev owner: welcome dialog once; composer posts; new post appears.
  - `/social/i-worked-there`: hero (logo/banner/work-types/sector/rating/mood face), Back to Rating, company-only feed.
  - `/companies/<slug>` with 4+ reviews: 3-comment collapse + "See them all"; cross-promo banner routes correctly.
  - `/` homepage and `/jobs`: unchanged.
  - Nav bar: "IWT Social" tab visible logged out and logged in, routes to `/social`.

- [ ] **Step 3: Spec self-review** - re-read `docs/superpowers/specs/2026-09-07-iwt-social-frontend.md`, confirm each of items 1-4 maps to a shipped task (see Self-Review below).

- [ ] **Step 4: Commit any final fixups, then the plan is done.**

---

## Self-Review (done while writing this plan)

**Spec coverage:**
- Item 1 - IWT Social tab -> `/social` separate page -> Task 1 (enable tab) + Task 3 (page). No sort/filter dropdowns, top-left company-name search -> Task 3 `SocialFeed`. AdSlot after every 7th post -> Task 3 (`AD_EVERY = 7`).
- Item 2 - rating page: collapse comments to 3 + "See them all" down-arrow -> Task 7 (`initialVisibleCount`). "See what they are doing !" banner with IWT Social symbol on its top-bar, routes to the company's social profile -> Task 7 `SocialCrossPromoBanner`.
- Item 3 - company IWT Social profile: hero mirroring the rating page top (icon, banner, work-types, sector, overall rating + Beaver face) + "Back to Rating" -> Task 6 `SocialCompanyHero` (+ Task 2 `BeaverRatingIcon`). Company-only feed below -> Task 6. Anonymous view OK; Like/Comment -> sign-in modal -> Task 4.
- Item 4 - one-time welcome pop-up with the exact copy + 1:1 placeholder -> Task 5 `SocialWelcomeDialog` (localStorage `iwtr:social-welcome-seen`). Minimalist composer, grayed "Tell us what you think !", expands on click, prominent "+" photo button -> Task 5 `SocialComposerSlot` + `SocialComposer`.
- Research point 3 (extract `useIsCompanyOwner`) -> Task 1. Point 5 (extract `BeaverRatingIcon`, no Home-feed behavior change) -> Task 2. Point 7 (localStorage one-time prefix `iwtr:`) -> Task 5.

**Placeholder scan:** every component and page has full code. The "confirm field names / export" notes point at named existing files (`owner.ts`, `OwnerService.myOwnedCompanies`) - verification steps, not missing logic. The `SocialComposerSlot` / `SocialWelcomeDialog` "stub if Task 5 runs later" note is a build-ordering convenience with the stub body given (`return null`).

**Type consistency:** `PublicSocialPost` / `PublicSocialComment` / `SocialFeedPage` / `SocialPostLikeResult` / `OwnedCompany` all come from `@iwtr/shared-types` (defined in the backend plan Task 2 / existing `owner.ts`) and are used with identical field names across Tasks 3-6. `useIsCompanyOwner()` (Task 1) consumed in Tasks 5-6. `RATING_TICKS` / `activeMoodIndex` / `BeaverRatingIcon` (Task 2) consumed in Task 6. `SocialFeed`'s `scope` discriminated union (Task 3) reused in Task 6. `onChanged?: (p: PublicSocialPost) => void` on `SocialPostCard` - same signature in Tasks 3 and 4.

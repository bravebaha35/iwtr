# Social Routing Consolidation + Comment Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the duplicate `/social/[slug]` route, add a sidebar (Following/Sort/See-Them-On) to the company profile's Social tab, add a "Trending Today" section to the root `/social` feed, tighten the comment UI (inline Reply, always-abbreviated timestamps), and close a gap where the "claim this company" prompt doesn't hide once a company already has an approved owner.

**Architecture:** Backend gains one new query param (`sort`) on the existing company-posts endpoint and one new endpoint (`GET /social/trending`), both reusing the existing `SocialPost`/`SocialPostLike`/`SocialComment` Prisma relations via `_count` ordering — no schema changes. Frontend generalizes `SocialSidebar` into a `mode: "global" | "company"` component reused by both the untouched root `/social` page and the company profile's Social tab (which gains a sidebar it doesn't have today), deletes the standalone `/social/[slug]` route and its duplicate header component, and restructures `SocialComments.tsx`'s per-comment row for density.

**Tech Stack:** NestJS + Prisma (apps/api), Next.js App Router + React (apps/web), zod schemas in packages/shared-types as the shared contract. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-19-social-routing-comment-density-design.md`

## Global Constraints

- No `?sort=` URL param anywhere in the app for the new comment/post sort — client state only, persisted to `sessionStorage`, matching `WorkplaceBrowser`/`JobsBrowser`'s existing pattern (spec Decision 2).
- Timestamp abbreviation tiers, no "ago" suffix anywhere: `just now` / `{m}m` / `{h}h` / `{d}d` (1-6) / `{w}w` / `{mo}mo` / `{y}y` (spec Decision 7). Months use `mo`, never bare `m` (collides with minutes).
- All 7 `Company` social-link fields (`facebookUrl`, `instagramUrl`, `whatsappUrl`, `xUrl`, `linkedinUrl`, `youtubeUrl`, `glassdoorUrl`) are shown in the company-mode sidebar, not just 3 (spec Decision 4).
- Root `/social` (the cross-company feed, "IWT Social" in the top nav) is untouched except for the new Trending Today section — do not restructure or relink anything else on it (spec Decision 3/5).
- No new URL sanitizer needed for the 7 social links — `httpUrlSchema` (`packages/shared-types/src/schemas/company.ts:43-46`) already restricts every one of them to `http(s)://` at write time.
- `hasApprovedOwner: boolean` already exists on the public `Company`/`CompanyDetail` type (`packages/shared-types/src/schemas/company.ts:105`) — no backend change needed for the claim-banner fix, wiring only.

---

### Task 1: Shared types — sort enum + trending schema

**Files:**
- Modify: `packages/shared-types/src/schemas/social.ts`

**Interfaces:**
- Produces: `socialCompanySortSchema` (zod enum), `SocialCompanySort` (TS type: `"newest" | "oldest" | "mostLiked" | "mostCommented"`), `trendingTodaySchema` (zod object), `TrendingToday` (TS type: `{ mostLiked: PublicSocialPost[]; mostCommented: PublicSocialPost[] }`). Every later task that touches sort or trending imports these from `@iwtr/shared-types`.

- [ ] **Step 1: Add the two schemas** — append to the end of `packages/shared-types/src/schemas/social.ts`:

```ts
// The company-scoped Social-tab sidebar's sort control (spec: client state
// only, no ?sort= URL param — this type is shared purely so the frontend's
// sessionStorage value and the backend's query-param parsing agree on the
// same four strings). "newest" is the default/pre-existing behavior.
export const socialCompanySortSchema = z.enum(["newest", "oldest", "mostLiked", "mostCommented"]);
export type SocialCompanySort = z.infer<typeof socialCompanySortSchema>;

// GET /social/trending — today's top posts across all companies, split by
// like count and comment count. Either array can be empty (e.g. nothing
// posted yet today); the frontend renders nothing for an empty section
// rather than an empty block.
export const trendingTodaySchema = z.object({
  mostLiked: z.array(publicSocialPostSchema),
  mostCommented: z.array(publicSocialPostSchema),
});
export type TrendingToday = z.infer<typeof trendingTodaySchema>;
```

- [ ] **Step 2: Rebuild the package**

```bash
cd packages/shared-types && pnpm exec tsc
```
Expected: clean, no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/schemas/social.ts
git commit -m "feat(shared-types): add SocialCompanySort and TrendingToday schemas"
```

---

### Task 2: Backend — company-feed sort support

**Files:**
- Modify: `apps/api/src/modules/social/social.service.ts`
- Modify: `apps/api/src/modules/social/social.controller.ts`
- Test: `apps/api/src/modules/social/__tests__/social.service.test.ts` (check this file's existing name via `ls apps/api/src/modules/social/__tests__/` before writing — if it doesn't exist yet, create it following the same mocked-PrismaService pattern every other `__tests__/*.service.test.ts` in this repo uses, e.g. `apps/api/src/modules/skills/__tests__/skills.service.test.ts`)

**Interfaces:**
- Consumes: `SocialCompanySort` from `@iwtr/shared-types` (Task 1).
- Produces: `SocialService.companyFeed(viewerUserId, slug, opts: { cursor?: string; sort?: SocialCompanySort })` (signature extended, backward compatible — omitting `sort` keeps today's behavior). `SocialController`'s `GET companies/:slug/posts` now accepts `?sort=`.

- [ ] **Step 1: Extend `pageFromWhere` to accept a sort param**

In `apps/api/src/modules/social/social.service.ts`, find `private async pageFromWhere` (around line 338) and replace it:

```ts
  private async pageFromWhere(
    viewerUserId: string | undefined,
    where: Prisma.SocialPostWhereInput,
    cursor: string | undefined,
    sort: SocialCompanySort = "newest",
  ): Promise<SocialFeedPage> {
    // "newest" (default) and "oldest" sort on the post's own createdAt;
    // "mostLiked"/"mostCommented" sort on the live count of its relations
    // via Prisma's relation-count orderBy — no denormalized counter column
    // needed. id is always the tie-breaker for the same reason the default
    // order already used one: createdAt alone isn't unique.
    const orderBy: Prisma.SocialPostOrderByWithRelationInput[] =
      sort === "oldest"
        ? [{ createdAt: "asc" }, { id: "asc" }]
        : sort === "mostLiked"
          ? [{ likes: { _count: "desc" } }, { id: "desc" }]
          : sort === "mostCommented"
            ? [{ comments: { _count: "desc" } }, { id: "desc" }]
            : [{ createdAt: "desc" }, { id: "desc" }];
    const rows = await this.prisma.socialPost.findMany({
      where,
      orderBy,
      take: SOCIAL_FEED_PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { company: { select: { slug: true, name: true, mainPhotoUrl: true, badgeTier: true, workplaceTypes: true } } },
    });
    const hasMore = rows.length > SOCIAL_FEED_PAGE_SIZE;
    const pageRows = hasMore ? rows.slice(0, SOCIAL_FEED_PAGE_SIZE) : rows;
    const posts = await this.serializePosts(pageRows, viewerUserId);
    return { posts, nextCursor: hasMore ? pageRows[pageRows.length - 1].id : null };
  }
```

Add the import at the top of the file (alongside the existing `@iwtr/shared-types` import list):

```ts
import type { SocialCompanySort } from "@iwtr/shared-types";
```

- [ ] **Step 2: Thread `sort` through `companyFeed`**

Replace the `companyFeed` method (around line 176):

```ts
  // One company's feed, addressed by slug. 404s on an unknown — or hidden — slug.
  async companyFeed(
    viewerUserId: string | undefined,
    slug: string,
    opts: { cursor?: string; sort?: SocialCompanySort },
  ): Promise<SocialFeedPage> {
    const company = await this.prisma.company.findUnique({
      where: { slug },
      select: { id: true, hiddenAt: true },
    });
    assertCompanyVisibleOrThrow(company);
    return this.pageFromWhere(viewerUserId, { companyId: company.id }, opts.cursor, opts.sort);
  }
```

- [ ] **Step 3: Accept `?sort=` on the controller**

In `apps/api/src/modules/social/social.controller.ts`, add the import:

```ts
import { socialCompanySortSchema, type SocialCompanySort } from "@iwtr/shared-types";
```

(add `socialCompanySortSchema` and `SocialCompanySort` into the existing multi-line `@iwtr/shared-types` import block rather than a second import statement)

Add this helper near the existing `parseWorkplaceTypes`/`parseCategoryGroup` helpers:

```ts
// Same tolerant-parsing rule as parseWorkplaceTypes/parseCategoryGroup — an
// unrecognized or missing value falls back to "newest" rather than 400ing.
function parseSocialCompanySort(raw: string | undefined): SocialCompanySort {
  const result = socialCompanySortSchema.safeParse(raw);
  return result.success ? result.data : "newest";
}
```

Replace the `companyPosts` handler (around line 104):

```ts
  // Public per-company feed, addressed by slug. Same optional-auth rule.
  // `sort` defaults to "newest" (today's only behavior) when omitted or
  // unrecognized.
  @Get("companies/:slug/posts")
  @UseGuards(OptionalJwtAuthGuard)
  companyPosts(
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
    @Param("slug") slug: string,
    @Query("cursor") cursor?: string,
    @Query("sort") sort?: string,
  ) {
    return this.social.companyFeed(user?.id, slug, { cursor, sort: parseSocialCompanySort(sort) });
  }
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/api && pnpm exec tsc --noEmit
```
Expected: clean.

- [ ] **Step 5: Write the failing test** — this file already exists with a `makePrisma(overrides)` helper and a module-scope `moderationPass` mock (used as the constructor's second arg everywhere else in this file). Append a new `describe` block using the same conventions:

```ts
describe("SocialService.companyFeed sort", () => {
  function makeFeedPrisma(overrides: Record<string, unknown> = {}) {
    return makePrisma({
      company: { findUnique: jest.fn().mockResolvedValue({ id: "c1", hiddenAt: null }) },
      socialPost: { findMany: jest.fn().mockResolvedValue([]) },
      socialPostLike: { groupBy: jest.fn().mockResolvedValue([]) },
      socialComment: { groupBy: jest.fn().mockResolvedValue([]) },
      savedPost: { findMany: jest.fn().mockResolvedValue([]) },
      ...overrides,
    });
  }

  it("orders by likes count desc when sort is mostLiked", async () => {
    const prisma = makeFeedPrisma();
    await new SocialService(prisma, moderationPass).companyFeed(undefined, "some-slug", { sort: "mostLiked" });
    expect((prisma as any).socialPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ likes: { _count: "desc" } }, { id: "desc" }] }),
    );
  });

  it("orders by comments count desc when sort is mostCommented", async () => {
    const prisma = makeFeedPrisma();
    await new SocialService(prisma, moderationPass).companyFeed(undefined, "some-slug", { sort: "mostCommented" });
    expect((prisma as any).socialPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ comments: { _count: "desc" } }, { id: "desc" }] }),
    );
  });

  it("orders oldest-first when sort is oldest", async () => {
    const prisma = makeFeedPrisma();
    await new SocialService(prisma, moderationPass).companyFeed(undefined, "some-slug", { sort: "oldest" });
    expect((prisma as any).socialPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    );
  });

  it("defaults to newest-first when sort is omitted", async () => {
    const prisma = makeFeedPrisma();
    await new SocialService(prisma, moderationPass).companyFeed(undefined, "some-slug", {});
    expect((prisma as any).socialPost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
    );
  });
});
```

- [ ] **Step 6: Run it, confirm it fails for the right reason first if `sort` isn't wired yet, then passes**

```bash
cd apps/api && pnpm test -- social.service.test.ts
```
Expected: PASS (Steps 1-3 already implemented the behavior; this step is confirming it, not doing TDD-red-first for an already-built change — if you're implementing this task fresh, write Step 5's test before Steps 1-3 instead).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/social/social.service.ts apps/api/src/modules/social/social.controller.ts apps/api/src/modules/social/__tests__/social.service.test.ts
git commit -m "feat(api): add sort param (newest/oldest/mostLiked/mostCommented) to company social feed"
```

---

### Task 3: Backend — trending endpoint

**Files:**
- Modify: `apps/api/src/modules/social/social.service.ts`
- Modify: `apps/api/src/modules/social/social.controller.ts`
- Test: `apps/api/src/modules/social/__tests__/social.service.test.ts`

**Interfaces:**
- Consumes: `TrendingToday` from `@iwtr/shared-types` (Task 1), `PUBLIC_COMPANY_WHERE` (already imported in this file), `this.serializePosts` (existing private method).
- Produces: `SocialService.trendingToday(viewerUserId: string | undefined): Promise<TrendingToday>`. `GET /social/trending`.

- [ ] **Step 1: Add the service method** — insert into `apps/api/src/modules/social/social.service.ts`, directly after the `companyFeed` method:

```ts
  // Top 5 posts today (server UTC midnight cutoff, matching how createdAt
  // is stored), split by like count and by comment count, across every
  // publicly-visible company. Computed live on each request — no caching
  // layer, matching this app's current scale. A post with zero of the
  // relevant metric is filtered out even if it filled an empty slot in the
  // top-5 query (e.g. only 2 posts exist today and neither has been liked
  // yet) — see this method's callers in the controller for why an empty
  // array is valid and expected, not an error.
  async trendingToday(viewerUserId: string | undefined): Promise<TrendingToday> {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const where: Prisma.SocialPostWhereInput = {
      createdAt: { gte: startOfToday },
      company: PUBLIC_COMPANY_WHERE,
    };
    const include = {
      company: { select: { slug: true, name: true, mainPhotoUrl: true, badgeTier: true, workplaceTypes: true } },
    } as const;

    const [mostLikedRows, mostCommentedRows] = await Promise.all([
      this.prisma.socialPost.findMany({
        where,
        orderBy: [{ likes: { _count: "desc" } }, { id: "desc" }],
        take: TRENDING_POST_LIMIT,
        include,
      }),
      this.prisma.socialPost.findMany({
        where,
        orderBy: [{ comments: { _count: "desc" } }, { id: "desc" }],
        take: TRENDING_POST_LIMIT,
        include,
      }),
    ]);

    const [mostLiked, mostCommented] = await Promise.all([
      this.serializePosts(mostLikedRows, viewerUserId),
      this.serializePosts(mostCommentedRows, viewerUserId),
    ]);

    return {
      mostLiked: mostLiked.filter((p) => p.likeCount > 0),
      mostCommented: mostCommented.filter((p) => p.commentCount > 0),
    };
  }
```

Add near the top of the file, alongside the existing `SOCIAL_FEED_PAGE_SIZE`-style constant (find it with a quick search for `SOCIAL_FEED_PAGE_SIZE` in this file and place this next to it):

```ts
const TRENDING_POST_LIMIT = 5;
```

Add `TrendingToday` to the existing `@iwtr/shared-types` import list in this file.

- [ ] **Step 2: Add the controller endpoint** — insert into `apps/api/src/modules/social/social.controller.ts`, directly after the `feed` handler:

```ts
  // Today's top posts across every company, split by like count and by
  // comment count. Same optional-auth rule as `feed`/`companyPosts`.
  @Get("trending")
  @UseGuards(OptionalJwtAuthGuard)
  trending(@OptionalCurrentUser() user: AuthenticatedUser | undefined) {
    return this.social.trendingToday(user?.id);
  }
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/api && pnpm exec tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Write the failing test first** (or confirm-after, same note as Task 2 Step 6) — append to `apps/api/src/modules/social/__tests__/social.service.test.ts`, reusing the `makePrisma` helper already in this file:

```ts
describe("SocialService.trendingToday", () => {
  it("excludes a post that made the top-5 query but has zero of that metric", async () => {
    const zeroLikedPost = {
      id: "p1", companyId: "c1", imageUrls: ["x"], caption: null, createdAt: new Date(),
      company: { slug: "s", name: "N", mainPhotoUrl: null, badgeTier: "FREE", workplaceTypes: ["OFFICE"] },
    };
    const prisma = makePrisma({
      socialPost: { findMany: jest.fn().mockResolvedValue([zeroLikedPost]) },
      socialPostLike: { groupBy: jest.fn().mockResolvedValue([]) }, // no likes at all -> likeCount 0
      socialComment: { groupBy: jest.fn().mockResolvedValue([]) },
      savedPost: { findMany: jest.fn().mockResolvedValue([]) },
    });

    const result = await new SocialService(prisma, moderationPass).trendingToday(undefined);

    expect(result.mostLiked).toEqual([]);
    expect(result.mostCommented).toEqual([]);
  });
});
```

- [ ] **Step 5: Run it**

```bash
cd apps/api && pnpm test -- social.service.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/social/social.service.ts apps/api/src/modules/social/social.controller.ts apps/api/src/modules/social/__tests__/social.service.test.ts
git commit -m "feat(api): add GET /social/trending (top posts today by likes and comments)"
```

---

### Task 4: Frontend — abbreviated-always relative timestamps

**Files:**
- Modify: `apps/web/src/components/social/socialTime.ts`
- Test: `apps/web/src/components/social/__tests__/socialTime.test.ts` (create — check `apps/web/src/components/social/__tests__/` for an existing naming convention first)

**Interfaces:**
- Produces: `shortRelativeTime(iso: string): string` (signature unchanged, only its output range extends). Consumed by `SocialComments.tsx`'s `CommentRow` (Task 5) and `SocialPostCard.tsx` (already imports it, unchanged call site).

- [ ] **Step 1: Write the failing tests**

```ts
import { shortRelativeTime } from "../socialTime";

function isoMinutesAgo(min: number): string {
  return new Date(Date.now() - min * 60_000).toISOString();
}

describe("shortRelativeTime", () => {
  it("returns 'just now' under 1 minute", () => {
    expect(shortRelativeTime(isoMinutesAgo(0))).toBe("just now");
  });
  it("abbreviates minutes with no suffix", () => {
    expect(shortRelativeTime(isoMinutesAgo(5))).toBe("5m");
  });
  it("abbreviates hours with no suffix", () => {
    expect(shortRelativeTime(isoMinutesAgo(3 * 60))).toBe("3h");
  });
  it("abbreviates days with no suffix, up to 6 days", () => {
    expect(shortRelativeTime(isoMinutesAgo(5 * 24 * 60))).toBe("5d");
  });
  it("abbreviates weeks with no suffix starting at 7 days", () => {
    expect(shortRelativeTime(isoMinutesAgo(9 * 24 * 60))).toBe("1w");
  });
  it("abbreviates months, disambiguated from minutes", () => {
    expect(shortRelativeTime(isoMinutesAgo(60 * 24 * 60))).toBe("2mo");
  });
  it("abbreviates years", () => {
    expect(shortRelativeTime(isoMinutesAgo(400 * 24 * 60))).toBe("1y");
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd apps/web && pnpm test -- socialTime.test.ts
```
Expected: FAIL (weeks/months/years cases fall through to `toLocaleDateString()` today, not the new tiers).

- [ ] **Step 3: Implement**

Replace the entire contents of `apps/web/src/components/social/socialTime.ts`:

```ts
// "3h", "2d", "1w", "3mo", "1y", "just now" - compact relative time for
// feed cards and comments, always abbreviated (never a bare date). No
// "ago" suffix on any tier - matches the shortest, most-compact existing
// style. Months use "mo" (not "m") specifically so they never collide with
// the minutes tier below - "5m" is always 5 minutes, never 5 months.
export function shortRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  const week = Math.floor(day / 7);
  if (day < 30) return `${week}w`;
  const month = Math.floor(day / 30);
  if (day < 365) return `${month}mo`;
  const year = Math.floor(day / 365);
  return `${year}y`;
}
```

- [ ] **Step 4: Run to confirm it passes**

```bash
cd apps/web && pnpm test -- socialTime.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/social/socialTime.ts apps/web/src/components/social/__tests__/socialTime.test.ts
git commit -m "feat(web): extend relative-time formatting through weeks/months/years"
```

---

### Task 5: Frontend — comment row density + inline Reply

**Files:**
- Modify: `apps/web/src/components/social/SocialComments.tsx`

**Interfaces:**
- Consumes: `shortRelativeTime` (Task 4, unchanged import path).
- Produces: `CommentRow` now also takes `replyCount`, `repliesExpanded`, `onToggleReplies` props (new — the parent `SocialComments` component already tracks this state, it's just not passed down today). No change to any prop consumed by code outside this file — `CommentRow`/`Composer` aren't exported.

- [ ] **Step 1: Move Reply into `CommentRow`'s own flex row**

In `apps/web/src/components/social/SocialComments.tsx`, replace the `CommentRow` function signature and its vote-row block (currently lines 111-178):

```tsx
function CommentRow({
  comment,
  isAuthenticated,
  votingId,
  menuOpen,
  reported,
  replyCount,
  repliesExpanded,
  onVote,
  onDelete,
  onReport,
  onToggleMenu,
  onToggleReplies,
}: {
  comment: PublicSocialComment;
  isAuthenticated: boolean;
  votingId: string | null;
  menuOpen: boolean;
  reported: boolean;
  // undefined for a reply row (replies can't have replies - see
  // parentCommentId's schema comment) - Reply/View-replies never renders
  // in that case.
  replyCount?: number;
  repliesExpanded?: boolean;
  onVote: (id: string, value: 1 | -1) => void;
  onDelete: (id: string) => void;
  onReport: (id: string) => void;
  onToggleMenu: (id: string) => void;
  onToggleReplies?: (id: string) => void;
}) {
  const c = comment;
  return (
    <div className="flex items-start gap-2 py-1">
      <Avatar avatarKey={c.avatarKey} avatarGradient={c.avatarGradient} photoUrl={c.avatarPhotoUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">
          {c.displayUsername ?? "Anonymous"} · {shortRelativeTime(c.createdAt)}
        </p>
        <p className="whitespace-pre-wrap text-sm text-foreground">{c.body}</p>

        {/* Same red/green as ReviewsList's Helpful/Not Helpful, icon-only,
            shown for every comment by default - Reply now sits in this same
            flex row instead of a separate block the parent used to render
            below (see SocialComments' render, which no longer owns this). */}
        <div className="mt-1 flex items-center gap-3">
          <button
            type="button"
            onClick={() => onVote(c.id, 1)}
            disabled={votingId === c.id}
            aria-label="Helpful"
            aria-pressed={c.myVote === 1}
            title={!isAuthenticated ? "Log in to vote" : "Helpful"}
            className={`flex items-center gap-1 text-xs transition disabled:opacity-40 ${
              c.myVote === 1
                ? "text-green-600 dark:text-green-400"
                : "text-muted-foreground hover:text-green-600 dark:hover:text-green-400"
            }`}
          >
            <ThumbUpIcon className="h-4 w-4" />
            {c.helpfulCount}
          </button>
          <button
            type="button"
            onClick={() => onVote(c.id, -1)}
            disabled={votingId === c.id}
            aria-label="Not Helpful"
            aria-pressed={c.myVote === -1}
            title={!isAuthenticated ? "Log in to vote" : "Not Helpful"}
            className={`flex items-center gap-1 text-xs transition disabled:opacity-40 ${
              c.myVote === -1
                ? "text-red-600 dark:text-red-400"
                : "text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
            }`}
          >
            <ThumbDownIcon className="h-4 w-4" />
            {c.notHelpfulCount}
          </button>
          {replyCount !== undefined && onToggleReplies && (
            replyCount > 0 ? (
              <button
                type="button"
                onClick={() => onToggleReplies(c.id)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronIcon direction={repliesExpanded ? "up" : "down"} className="h-3 w-3" />
                {repliesExpanded ? "Hide replies" : `View ${replyCount} repl${replyCount === 1 ? "y" : "ies"}`}
              </button>
            ) : (
              !repliesExpanded && (
                <button
                  type="button"
                  onClick={() => onToggleReplies(c.id)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Reply
                </button>
              )
            )
          )}
        </div>
      </div>

      {/* "..." menu: Delete for the caller's own comment, Report for
          anyone else's - never both on the same comment. */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => onToggleMenu(c.id)}
          aria-label="Comment options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="rounded p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
        >
          <KebabIcon className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-10 mt-1 min-w-28 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-md"
          >
            {c.mine ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => onDelete(c.id)}
                className="block w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-surface-muted dark:text-red-400"
              >
                Delete
              </button>
            ) : reported ? (
              <span className="block px-3 py-1.5 text-left text-xs text-muted-foreground">Reported</span>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => onReport(c.id)}
                className="block w-full px-3 py-1.5 text-left text-xs text-foreground hover:bg-surface-muted"
              >
                Report
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

(Note what changed from the original: outer `<div>` gains `py-1` for tighter row padding; the vote-row `<div>` gains the `replyCount`/`repliesExpanded`/`onToggleReplies` block at the end, moved in verbatim from where the parent used to render it separately.)

- [ ] **Step 2: Update the parent render to pass the new props and drop its own separate Reply block**

Replace the `SocialComments` component's map-over-`visibleComments` block (currently lines 546-614):

```tsx
      {visibleComments.map((c) => (
        <div key={c.id} className="flex flex-col gap-2">
          <CommentRow
            comment={c}
            isAuthenticated={isAuthenticated}
            votingId={votingId}
            menuOpen={openMenuFor === c.id}
            reported={reportedIds.has(c.id)}
            replyCount={c.replyCount}
            repliesExpanded={!!expandedReplies[c.id]}
            onVote={(id, value) => vote(id, value)}
            onDelete={(id) => remove(id)}
            onReport={openReportModal}
            onToggleMenu={(id) => setOpenMenuFor((cur) => (cur === id ? null : id))}
            onToggleReplies={toggleReplies}
          />

          {/* Replies: hidden by default, left-below the comment. The
              Reply/"View N replies" toggle itself now renders inside
              CommentRow's own flex row (next to Like/Dislike) - this block
              only holds the expanded replies + reply composer once opened. */}
          {expandedReplies[c.id] && (
            <div className="ml-10 flex flex-col gap-2">
              {(repliesByComment[c.id] ?? []).map((r) => (
                <CommentRow
                  key={r.id}
                  comment={r}
                  isAuthenticated={isAuthenticated}
                  votingId={votingId}
                  menuOpen={openMenuFor === r.id}
                  reported={reportedIds.has(r.id)}
                  onVote={(id, value) => vote(id, value, c.id)}
                  onDelete={(id) => remove(id, c.id)}
                  onReport={openReportModal}
                  onToggleMenu={(id) => setOpenMenuFor((cur) => (cur === id ? null : id))}
                />
              ))}
              <Composer
                isAuthenticated={isAuthenticated}
                openAuthModal={openAuthModal}
                identityContext={identityContext}
                selectedMode={selectedMode}
                onToggleMode={toggleMode}
                onSubmit={(body) => submitReply(c.id, body)}
                placeholder="Write a reply..."
                autoFocus
              />
            </div>
          )}
        </div>
      ))}
```

- [ ] **Step 3: Tighten the overall list spacing**

In the same file, the comments block's outer container (currently line 535):

```tsx
    <div className="flex flex-col gap-3 border-t border-border p-3">
```

Change `gap-3` to `gap-2` and `p-3` to `p-2` (tighter block padding and inter-row spacing, per the density request — borders stay, no rounded-card treatment is introduced):

```tsx
    <div className="flex flex-col gap-2 border-t border-border p-2">
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```
Expected: clean.

- [ ] **Step 5: Run the existing social test suite** (this file's behavior is covered indirectly by existing social component tests — check `apps/web/src/components/social/__tests__/` for what already exists and run it)

```bash
cd apps/web && pnpm test -- social
```
Expected: PASS (no existing test should assert on the old separate-block Reply placement in a way that breaks — if one does, update it to assert Reply is inside the same row as Like/Dislike instead of removing the assertion).

- [ ] **Step 6: Live-browser check** — start `apps/api`/`apps/web` dev servers, open a company's Social tab (or root `/social`) with a comment that has 0 replies and one with replies, confirm: Reply/Like/Dislike sit on one visible row, "View N replies" expands in place, row spacing looks visibly tighter than before.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/social/SocialComments.tsx
git commit -m "feat(web): move comment Reply into the Like/Dislike row, tighten row spacing"
```

---

### Task 6: Frontend — claim banner hides once a company has an approved owner

**Files:**
- Modify: `apps/web/src/components/OwnerClaimPanel.tsx`
- Modify: `apps/web/src/app/companies/[slug]/page.tsx`

**Interfaces:**
- Produces: `OwnerClaimPanel` gains a required `hasApprovedOwner: boolean` prop.

- [ ] **Step 1: Add the prop and the gate**

In `apps/web/src/components/OwnerClaimPanel.tsx`, change the function signature (line 9):

```tsx
export function OwnerClaimPanel({ companySlug, hasApprovedOwner }: { companySlug: string; hasApprovedOwner: boolean }) {
```

Change the existing early-return gate (line 35):

```tsx
  if (authLoading || !isAuthenticated || onboardingStatus?.status !== "ACTIVE" || claim === undefined || hasApprovedOwner) {
    return null;
  }
```

- [ ] **Step 2: Pass the prop from the page**

In `apps/web/src/app/companies/[slug]/page.tsx`, change the mount site (line 348):

```tsx
        <div className="mt-8">
          <OwnerClaimPanel companySlug={slug} hasApprovedOwner={company.hasApprovedOwner} />
        </div>
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Live-browser check** — open a company page that already has an approved owner (per project memory, `demo-finans-holding` has an owner in the dev DB) and confirm "Is this your company?" is absent from the DOM regardless of your own login's claim state; open an unclaimed company and confirm the panel still behaves exactly as before.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/OwnerClaimPanel.tsx "apps/web/src/app/companies/[slug]/page.tsx"
git commit -m "fix(web): hide claim-company banner once the company already has an approved owner"
```

---

### Task 7: Frontend — generalize SocialSidebar into global/company modes

**Files:**
- Modify: `apps/web/src/components/social/SocialSidebar.tsx`
- Modify: `apps/web/src/components/social/SocialShell.tsx`

**Interfaces:**
- Consumes: `SocialCompanySort` from `@iwtr/shared-types` (Task 1).
- Produces: `SocialSidebar` now takes a discriminated-union prop (`mode: "global" | "company"`). `SocialShell.tsx`'s call site updates to pass `mode: "global"` plus its existing props, unchanged behavior otherwise. A new `mode: "company"` branch (Following list + Sort pills + See Them On) is added but not yet wired to any page — Task 8 does that.

- [ ] **Step 1: Replace `SocialSidebar.tsx`'s props and add the company-mode UI**

Replace the entire file:

```tsx
"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { Company, SocialCompanySort, WorkplaceType } from "@iwtr/shared-types";
import { WORKPLACE_TYPES } from "@/lib/workplaceTypes";
import { collarSegmentClassName } from "@/lib/collarColors";
import { MultiFilterPillGroup } from "@/components/FilterPillGroup";
import { CategoryGroupFilter, type CategoryGroup } from "@/lib/categoryGroups";
import { CompanyLogo } from "@/components/CompanyLogo";
import { useFollowedCompanies } from "@/lib/useFollowedCompanies";

function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4-7 4V4.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

// The caller's own followed companies - scrollable, fixed-height so it
// can't push the rest of the sidebar down as the list grows. Same
// data/toggle source (useFollowedCompanies) the post-card Follow button
// uses, so unfollowing a company from a post immediately drops it here too.
// Links into that company's own profile Social tab - there is no more
// standalone /social/[slug] route to point at.
function FollowingList() {
  const { companies, loading } = useFollowedCompanies();

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Following</h3>
      <div className="flex h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-1.5">
        {loading && <p className="p-1.5 text-xs text-muted-foreground">Loading...</p>}
        {!loading && companies.length === 0 && (
          <p className="p-1.5 text-xs text-muted-foreground">You&apos;re not following any companies yet.</p>
        )}
        {companies.map((c) => (
          <Link
            key={c.companyId}
            href={`/companies/${c.companySlug}?tab=social`}
            className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 transition hover:bg-surface-muted"
          >
            <CompanyLogo name={c.companyName} mainPhotoUrl={c.mainPhotoUrl} size="sm" />
            <span className="min-w-0 truncate text-sm text-foreground">{c.companyName}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

const SORT_OPTIONS: { value: SocialCompanySort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "mostLiked", label: "Most Liked" },
  { value: "mostCommented", label: "Most Commented" },
];

// Same standalone-toggle-pill-tray look as WorkplaceBrowser/JobsBrowser's
// sort control (not a dropdown - every option visible and clickable
// directly), adapted to 4 mutually-exclusive options instead of that page's
// independent toggles.
function SortPills({ value, onChange }: { value: SocialCompanySort; onChange: (v: SocialCompanySort) => void }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sort</h3>
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800/60 dark:bg-zinc-950/80">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-200 ${
              value === opt.value
                ? "bg-zinc-800 text-white"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Small monochrome glyphs for the 7 possible social links - deliberately
// simple line/shape icons rather than exact brand marks, since the goal is
// "distinct and recognizable at a glance", not logo-accurate reproduction.
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 8.5h2V5.5h-2c-2 0-3.5 1.5-3.5 3.5v2H8v3h2.5V21h3v-7h2.3l.7-3h-3v-1.5c0-.6.4-1 1-1Z" />
    </svg>
  );
}
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="17" cy="7" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}
function WhatsappIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 11.5A8 8 0 1 1 8.3 4.4 8 8 0 0 1 20 11.5Z" />
      <path d="M4 20l1.3-3.8" />
      <path d="M9 9.3c.3 1.8 1.9 3.4 3.7 3.7.8.1 1-.5.7-1l-.6-1" />
    </svg>
  );
}
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 5l14 14" />
      <path d="M19 5 5 19" />
    </svg>
  );
}
function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path d="M8 10.5V17" />
      <circle cx="8" cy="7.3" r="0.9" fill="currentColor" stroke="none" />
      <path d="M12 17v-4c0-1.4 1-2.3 2.3-2.3 1.2 0 1.7.9 1.7 2.3v4" />
    </svg>
  );
}
function YoutubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="12" rx="3.5" />
      <path d="M10.5 9.5v5l4.3-2.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
function GlassdoorIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3v14a2 2 0 0 0 2 2h1" />
      <path d="M17 21V7a2 2 0 0 0-2-2h-1" />
    </svg>
  );
}

type CompanySocialLinks = Pick<
  Company,
  "facebookUrl" | "instagramUrl" | "whatsappUrl" | "xUrl" | "linkedinUrl" | "youtubeUrl" | "glassdoorUrl"
>;

// All 7 owner-editable social fields, shown only when set - including
// linkedinUrl/youtubeUrl/glassdoorUrl, which existed on Company already but
// were never rendered publicly anywhere before this. No sanitization
// happens here: httpUrlSchema already restricts every one of these fields
// to http(s):// at write time (owner dashboard save path), so any value
// reaching this component is already scheme-safe - same trust boundary the
// 4-field "Contact & Social Media" box on the rating tab already relies on.
function SeeThemOn({ links }: { links: CompanySocialLinks }) {
  // Icons precomputed as elements (not stored as component references) so
  // this array needs no function-component type of its own - just ReactNode,
  // already imported above the same way CompanyProfileTabs.tsx imports it.
  const entries: { label: string; href: string; icon: ReactNode }[] = [
    links.facebookUrl ? { label: "Facebook", href: links.facebookUrl, icon: <FacebookIcon className="h-4 w-4" /> } : null,
    links.instagramUrl ? { label: "Instagram", href: links.instagramUrl, icon: <InstagramIcon className="h-4 w-4" /> } : null,
    links.whatsappUrl ? { label: "WhatsApp", href: links.whatsappUrl, icon: <WhatsappIcon className="h-4 w-4" /> } : null,
    links.xUrl ? { label: "X", href: links.xUrl, icon: <XIcon className="h-4 w-4" /> } : null,
    links.linkedinUrl ? { label: "LinkedIn", href: links.linkedinUrl, icon: <LinkedinIcon className="h-4 w-4" /> } : null,
    links.youtubeUrl ? { label: "YouTube", href: links.youtubeUrl, icon: <YoutubeIcon className="h-4 w-4" /> } : null,
    links.glassdoorUrl ? { label: "Glassdoor", href: links.glassdoorUrl, icon: <GlassdoorIcon className="h-4 w-4" /> } : null,
  ].filter((v): v is { label: string; href: string; icon: ReactNode } => v !== null);

  if (entries.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">See Them On</h3>
      {/* Tight, asymmetrical wrap - not a fixed grid - so a company with 2
          links doesn't leave a row of empty cells and one with 7 wraps
          naturally. */}
      <div className="flex flex-wrap gap-2">
        {entries.map(({ label, href, icon }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={label}
            aria-label={label}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:border-foreground hover:text-foreground"
          >
            {icon}
          </a>
        ))}
      </div>
    </div>
  );
}

type SocialSidebarProps =
  | {
      mode: "global";
      query: string;
      onQueryChange: (q: string) => void;
      workplaceType: WorkplaceType | null;
      onWorkplaceTypeChange: (v: WorkplaceType | null) => void;
      categoryGroup: CategoryGroup | null;
      onCategoryGroupChange: (v: CategoryGroup | null) => void;
      savedView: boolean;
      onToggleSavedView: () => void;
      isMember: boolean;
    }
  | {
      mode: "company";
      isMember: boolean;
      sort: SocialCompanySort;
      onSortChange: (v: SocialCompanySort) => void;
      socialLinks: CompanySocialLinks;
    };

export function SocialSidebar(props: SocialSidebarProps) {
  if (props.mode === "company") {
    return (
      <aside className="flex shrink-0 flex-col gap-5 sm:w-56">
        {props.isMember && <FollowingList />}
        <SortPills value={props.sort} onChange={props.onSortChange} />
        <SeeThemOn links={props.socialLinks} />
      </aside>
    );
  }

  const { query, onQueryChange, workplaceType, onWorkplaceTypeChange, categoryGroup, onCategoryGroupChange, savedView, onToggleSavedView, isMember } = props;

  // "Only show me:" is single-select (unlike the rating/jobs pages' up-to-2
  // Work-Type filter), so this wraps MultiFilterPillGroup's onToggle contract
  // (one value in/out at a time) into a plain replace-or-clear toggle -
  // same track/segmented-control look and colors (collarSegmentClassName) as
  // those two pages, just one selection instead of two.
  function toggleWorkplaceType(value: WorkplaceType) {
    onWorkplaceTypeChange(workplaceType === value ? null : value);
  }

  return (
    <aside className="flex shrink-0 flex-col gap-5 sm:w-56">
      {/* Same search-a-company-by-name box the feed used to render inline -
          moved here, sized down to fit the panel. */}
      <input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search a company by name..."
        className="w-full rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-foreground"
      />

      {isMember && <FollowingList />}

      {/* Same visual language as the rating/jobs pages' Work-Type filter -
          straight segmented pills, not a dropdown (see MultiFilterPillGroup's
          variant="track" + collarSegmentClassName). */}
      <MultiFilterPillGroup
        heading="Only Show Me"
        options={WORKPLACE_TYPES}
        selected={workplaceType ? [workplaceType] : []}
        onToggle={toggleWorkplaceType}
        onReset={() => onWorkplaceTypeChange(null)}
        direction="grid"
        variant="track"
        pillColorClassName={collarSegmentClassName}
      />

      {isMember && (
        <button
          type="button"
          onClick={onToggleSavedView}
          aria-pressed={savedView}
          className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition ${
            savedView
              ? "border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-950 dark:text-brand-300"
              : "border-border text-foreground hover:bg-surface-muted"
          }`}
        >
          <BookmarkIcon className="h-4 w-4" />
          Saved Posts
        </button>
      )}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick Select</h3>
        {/* The exact same icon-pill row as the rating homepage/jobs page
            (CategoryGroupFilter) - all 7 buckets, same icons/tooltips. */}
        <CategoryGroupFilter value={categoryGroup} onChange={onCategoryGroupChange} />
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Update `SocialShell.tsx`'s call site**

In `apps/web/src/components/social/SocialShell.tsx`, change the `<SocialSidebar>` invocation (currently lines 33-43):

```tsx
        <SocialSidebar
          mode="global"
          query={query}
          onQueryChange={setQuery}
          workplaceType={workplaceType}
          onWorkplaceTypeChange={setWorkplaceType}
          categoryGroup={categoryGroup}
          onCategoryGroupChange={setCategoryGroup}
          savedView={savedView}
          onToggleSavedView={() => setSavedView((v) => !v)}
          isMember={isMember}
        />
```

(only the added `mode="global"` line is new — everything else is unchanged)

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Run the existing social test suite**

```bash
cd apps/web && pnpm test -- social
```
Expected: PASS — root `/social`'s behavior is unchanged (only `mode="global"` was added to an existing, already-correct call site).

- [ ] **Step 5: Live-browser check** — open root `/social`, confirm the sidebar (search box, Following, Work-Type filter, Saved Posts, Quick Select) renders and behaves exactly as before this change.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/social/SocialSidebar.tsx apps/web/src/components/social/SocialShell.tsx
git commit -m "refactor(web): generalize SocialSidebar into global/company modes, add company-mode Sort + See Them On"
```

---

### Task 8: Frontend — SocialFeed sort param support

**Files:**
- Modify: `apps/web/src/components/social/SocialFeed.tsx`

**Interfaces:**
- Consumes: `SocialCompanySort` from `@iwtr/shared-types` (Task 1).
- Produces: `SocialFeed` gains an optional `sort?: SocialCompanySort` prop, only meaningful when `scope.kind === "company"`.

- [ ] **Step 1: Add the prop and thread it into the endpoint + effect deps**

In `apps/web/src/components/social/SocialFeed.tsx`, change the type import (line 4):

```tsx
import type { PublicSocialPost, SocialCompanySort, SocialFeedPage, WorkplaceType } from "@iwtr/shared-types";
```

Change the component signature (lines 20-30):

```tsx
export function SocialFeed({
  scope,
  q,
  workplaceType,
  categoryGroup,
  sort,
}: {
  scope: Scope;
  q?: string;
  workplaceType?: WorkplaceType | null;
  categoryGroup?: CategoryGroup | null;
  // Only read when scope.kind === "company" - the global/saved feeds have
  // no sort control (see SocialSidebar's mode split).
  sort?: SocialCompanySort;
}) {
```

Change the `endpoint` callback (lines 38-52):

```tsx
  const endpoint = useCallback(
    (nextCursor: string | null) => {
      const params = new URLSearchParams();
      if (nextCursor) params.set("cursor", nextCursor);
      if (scope.kind === "all") {
        if (q?.trim()) params.set("q", q.trim());
        if (workplaceType) params.set("workplaceTypes", workplaceType);
        if (categoryGroup) params.set("categoryGroup", categoryGroup);
      }
      if (scope.kind === "company" && sort) params.set("sort", sort);
      const base =
        scope.kind === "all" ? "/social/feed" : scope.kind === "saved" ? "/me/saved-posts" : `/social/companies/${scope.slug}/posts`;
      return `${base}${params.toString() ? `?${params}` : ""}`;
    },
    [scope, q, workplaceType, categoryGroup, sort],
  );
```

(`sort` is now in the dependency array — the existing "reset + reload whenever scope or any filter changes" effect below already depends on `endpoint`, so changing `sort` correctly triggers a fresh fetch with no other change needed)

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```
Expected: clean.

- [ ] **Step 3: Run the existing social test suite**

```bash
cd apps/web && pnpm test -- social
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/social/SocialFeed.tsx
git commit -m "feat(web): thread sort param through SocialFeed for company-scoped feeds"
```

---

### Task 9: Frontend — wire the company Social tab (sidebar, composer, sort, tab rename)

**Files:**
- Modify: `apps/web/src/components/companies/CompanyProfileTabs.tsx`

**Interfaces:**
- Consumes: `SocialSidebar` (Task 7, `mode="company"` branch), `SocialFeed`'s new `sort` prop (Task 8), `SocialComposerSlot` (existing, unmodified), `SocialCompanySort` from `@iwtr/shared-types`.

- [ ] **Step 1: Rename the tab label and add sort state + sessionStorage persistence**

In `apps/web/src/components/companies/CompanyProfileTabs.tsx`, change the imports (lines 3-6):

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Company, CompanyAggregateScore, SocialCompanySort } from "@iwtr/shared-types";
import { SocialFeed } from "@/components/social/SocialFeed";
import { SocialSidebar } from "@/components/social/SocialSidebar";
import { SocialComposerSlot } from "@/components/social/SocialComposerSlot";
import { useAuth } from "@/lib/auth-context";
import { CompanyJobPostings } from "./CompanyJobPostings";
```

Change the `TABS` label (line 31):

```tsx
const TABS: { key: TabKey; label: string }[] = [
  { key: "ratings", label: "Ratings" },
  { key: "social", label: "Social" },
  { key: "jobs", label: "Job Postings" },
];
```

Inside the `CompanyProfileTabs` function, add sort state right after the existing `visited` state (after line 58):

```tsx
  // Sort choice for this company's own post list - client state only, no
  // ?sort= URL param (matches WorkplaceBrowser/JobsBrowser's existing
  // convention), persisted per-company-slug so switching between two
  // companies' Social tabs in the same session doesn't bleed one's sort
  // choice into the other's.
  const sortStorageKey = `iwtr:companySocialSort:${slug}`;
  const [sort, setSort] = useState<SocialCompanySort>(() => {
    if (typeof window === "undefined") return "newest";
    const raw = window.sessionStorage.getItem(sortStorageKey);
    return raw === "newest" || raw === "oldest" || raw === "mostLiked" || raw === "mostCommented" ? raw : "newest";
  });
  const handleSortChange = useCallback(
    (next: SocialCompanySort) => {
      setSort(next);
      try {
        window.sessionStorage.setItem(sortStorageKey, next);
      } catch {
        /* private mode / storage unavailable - sort still works for this render, just doesn't persist */
      }
    },
    [sortStorageKey],
  );
  const { isAuthenticated, role } = useAuth();
  const isMember = isAuthenticated && role === "MEMBER";
```

- [ ] **Step 2: Replace the Social tab panel's contents**

Replace the social tabpanel block (currently lines 171-178):

```tsx
        <div
          role="tabpanel"
          id={panelId.social}
          aria-labelledby={tabId.social}
          hidden={active !== "social"}
        >
          {visited.has("social") && (
            <div className="flex flex-col gap-6 sm:flex-row">
              <SocialSidebar
                mode="company"
                isMember={isMember}
                sort={sort}
                onSortChange={handleSortChange}
                socialLinks={{
                  facebookUrl: company.facebookUrl,
                  instagramUrl: company.instagramUrl,
                  whatsappUrl: company.whatsappUrl,
                  xUrl: company.xUrl,
                  linkedinUrl: company.linkedinUrl,
                  youtubeUrl: company.youtubeUrl,
                  glassdoorUrl: company.glassdoorUrl,
                }}
              />
              {/* Feed column centered in the remaining space, same
                  Instagram-style fixed max-width as the root /social feed -
                  not a copy of that page's 3-column ad-rail shell, since a
                  tab panel has no ad slots of its own. */}
              <div className="flex min-w-0 flex-1 flex-col items-center gap-4">
                {/* Posts as whichever of the owner's own approved companies
                    they pick - not automatically locked to this one (same
                    component/behavior the deleted /social/[slug] route had). */}
                <div className="w-full max-w-xl">
                  <SocialComposerSlot />
                </div>
                <div className="w-full max-w-xl">
                  <SocialFeed scope={{ kind: "company", slug }} sort={sort} />
                </div>
              </div>
            </div>
          )}
        </div>
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Run the existing web test suite**

```bash
cd apps/web && pnpm test
```
Expected: PASS.

- [ ] **Step 5: Live-browser check** — open a company page, click the "Social" tab (confirm the label says "Social", not "IWT Social"), confirm the sidebar appears (Following/Sort/See Them On — See Them On only shows if that company has any of the 7 links set), click each Sort pill and confirm the post list order visibly changes / re-fetches, confirm a composer is present and posting still works for a company-owner test login.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/companies/CompanyProfileTabs.tsx
git commit -m "feat(web): add sidebar + composer to company profile's Social tab, rename tab label"
```

---

### Task 10: Frontend — delete the duplicate `/social/[slug]` route

**Files:**
- Delete: `apps/web/src/app/social/[slug]/page.tsx`
- Delete: `apps/web/src/components/social/SocialCompanyHero.tsx`

**Interfaces:**
- None — this is pure removal. Task 7 already repointed `SocialSidebar`'s `FollowingList` links to `/companies/[slug]?tab=social`, so nothing still links to the route being deleted.

- [ ] **Step 1: Grep for any remaining reference before deleting**

```bash
cd apps/web && grep -rn "SocialCompanyHero\|/social/\${" src/ --include="*.tsx" --include="*.ts"
```
Expected: only the two files being deleted themselves show up (the `page.tsx` importing `SocialCompanyHero`, and `SocialCompanyHero.tsx` itself). If anything else matches, stop and investigate before deleting — do not delete a route something else still depends on.

- [ ] **Step 2: Delete both files**

```bash
git rm "apps/web/src/app/social/[slug]/page.tsx"
git rm apps/web/src/components/social/SocialCompanyHero.tsx
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```
Expected: clean (confirms nothing else imported `SocialCompanyHero`).

- [ ] **Step 4: Build check** — Next.js route deletion is otherwise invisible to `tsc`; confirm the dev server actually drops the route:

```bash
cd apps/web && pnpm dev
```
Then in a browser, visit a URL that used to be a valid company slug under `/social/<slug>` and confirm it 404s. Stop the dev server after confirming.

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(web): delete the standalone /social/[slug] route, superseded by /companies/[slug]?tab=social"
```

---

### Task 11: Frontend — Trending Today on root `/social`

**Files:**
- Create: `apps/web/src/components/social/TrendingToday.tsx`
- Modify: `apps/web/src/components/social/SocialShell.tsx`

**Interfaces:**
- Consumes: `TrendingToday` type + `GET /social/trending` (Task 3), `apiGet` (existing), `SocialPostCard` (existing, reused as-is — no new compact card variant).
- Produces: `TrendingToday()` component (default export or named — match this file's own choice, named to match every other component in this directory), renders nothing if both `mostLiked` and `mostCommented` come back empty.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useEffect, useState } from "react";
import type { TrendingToday as TrendingTodayData } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { SocialPostCard } from "./SocialPostCard";

// Fetched once on mount - a lightweight teaser above the regular
// chronological feed, not paginated, not refetched on scroll. Renders
// nothing at all if neither list has anything today (e.g. very early in
// the day) rather than an empty "Trending" heading with nothing under it.
export function TrendingToday() {
  const [data, setData] = useState<TrendingTodayData | null>(null);

  useEffect(() => {
    apiGet<TrendingTodayData>("/social/trending")
      .then(setData)
      .catch(() => setData({ mostLiked: [], mostCommented: [] }));
  }, []);

  if (!data || (data.mostLiked.length === 0 && data.mostCommented.length === 0)) return null;

  return (
    <div className="mb-6 flex flex-col gap-6">
      {data.mostLiked.length > 0 && (
        <div>
          <h2 className="mb-3 font-grotesk text-sm font-bold uppercase tracking-wide text-foreground">
            Most Liked Today
          </h2>
          <div className="flex flex-col gap-4">
            {data.mostLiked.map((post) => (
              <SocialPostCard
                key={post.id}
                post={post}
                onChanged={(p) =>
                  setData((prev) =>
                    prev ? { ...prev, mostLiked: prev.mostLiked.map((x) => (x.id === p.id ? p : x)) } : prev,
                  )
                }
              />
            ))}
          </div>
        </div>
      )}
      {data.mostCommented.length > 0 && (
        <div>
          <h2 className="mb-3 font-grotesk text-sm font-bold uppercase tracking-wide text-foreground">
            Most Commented Today
          </h2>
          <div className="flex flex-col gap-4">
            {data.mostCommented.map((post) => (
              <SocialPostCard
                key={post.id}
                post={post}
                onChanged={(p) =>
                  setData((prev) =>
                    prev ? { ...prev, mostCommented: prev.mostCommented.map((x) => (x.id === p.id ? p : x)) } : prev,
                  )
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Mount it above the regular feed in `SocialShell.tsx`**

In `apps/web/src/components/social/SocialShell.tsx`, add the import:

```tsx
import { TrendingToday } from "./TrendingToday";
```

Change the feed column (currently lines 48-56):

```tsx
        <div className="flex min-w-0 flex-1 justify-center">
          <div className="w-full max-w-xl">
            {/* Only in the default explore view - Saved Posts is a
                personal list, trending doesn't belong there. */}
            {!savedView && <TrendingToday />}
            {savedView ? (
              <SocialFeed scope={{ kind: "saved" }} />
            ) : (
              <SocialFeed scope={{ kind: "all" }} q={query} workplaceType={workplaceType} categoryGroup={categoryGroup} />
            )}
          </div>
        </div>
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Run the web test suite**

```bash
cd apps/web && pnpm test
```
Expected: PASS.

- [ ] **Step 5: Live-browser check** — open root `/social`, confirm a "Most Liked Today"/"Most Commented Today" section appears above the regular feed when today has qualifying posts (like/comment a post via a dev test login first if the dev DB has nothing from today yet), and confirm the section is entirely absent (not an empty heading) when neither list has anything.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/social/TrendingToday.tsx apps/web/src/components/social/SocialShell.tsx
git commit -m "feat(web): add Trending Today section to the root /social feed"
```

---

### Task 12: Full-branch verification

**Files:** none — verification only.

- [ ] **Step 1: Rebuild shared-types and regenerate the Prisma client** (schema.prisma wasn't touched by this plan, but run this anyway to catch anything missed)

```bash
cd packages/shared-types && pnpm exec tsc
cd ../../apps/api && pnpm exec prisma generate
```

- [ ] **Step 2: Typecheck both apps**

```bash
cd apps/api && pnpm exec tsc --noEmit
cd ../web && pnpm exec tsc --noEmit
```
Expected: both clean.

- [ ] **Step 3: Run both full test suites**

```bash
cd apps/api && pnpm test
cd ../web && pnpm test
```
Expected: all pass except the pre-existing, unrelated `workplace-classifier` failures documented in project memory (not touched by this plan) — if any *other* test fails, investigate before proceeding.

- [ ] **Step 4: Lint both apps**

```bash
cd apps/api && pnpm lint
cd ../web && pnpm lint
```
Expected: 0 errors in both (warnings at or below this branch's starting baseline).

- [ ] **Step 5: Routing acceptance test** — start both dev servers. Follow a company from `/social`'s (or the company-tab's) Following list and confirm the URL lands on exactly `/companies/[slug]?tab=social`. Manually navigate to the old `/social/<any-slug>` pattern and confirm a 404.

- [ ] **Step 6: Sort persistence non-leak test** — open Company A's Social tab, set Sort to "Most Liked". Navigate to Company B's Social tab (different slug) and confirm its Sort control shows "Newest" (the default), not "Most Liked" — confirms the `iwtr:companySocialSort:${slug}` sessionStorage key is correctly scoped per company rather than shared. Navigate back to Company A and confirm its Sort control still shows "Most Liked".

- [ ] **Step 7: UI density acceptance test** — open a post's comment section with at least one existing comment. Confirm Reply, Like, and Dislike buttons sit on the same horizontal row (visually and in the DOM — `CommentRow`'s vote-row `<div>`). Confirm a comment posted more than a week/month/year ago (adjust a seeded row's `createdAt` via a throwaway `prisma studio` edit if the dev DB has nothing old enough) renders as `Xw`/`Xmo`/`Xy` with no "ago" suffix.

- [ ] **Step 8: Anonymity verification** — confirm no code path was changed in this plan for avatar assignment (Task list has no `social.service.ts` avatar-related edits) — this is a documentation check, not a new test: diff `social.service.ts` against `main` and confirm the only changes are the `pageFromWhere`/`companyFeed`/`trendingToday` additions from Tasks 2-3, nothing under the identity-lock/avatar logic.

```bash
git diff main -- apps/api/src/modules/social/social.service.ts
```

- [ ] **Step 9: Claim prompt test** — already covered live in Task 6 Step 4; re-confirm here against the final merged state on a company with an approved owner.

- [ ] **Step 10: No further commit** — this task is verification only. If any step fails, return to the relevant task above and fix before considering the branch done.

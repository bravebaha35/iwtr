# AI company descriptions, rating-band relabel, fixed-height rating boxes

Date: 2026-08-30
Status: approved (design), pending implementation plan

## Context

The company page (`apps/web/src/app/companies/[slug]/page.tsx`) shows a "rating narrative"
box: an illustration picked from the company's overall score, plus a paragraph. Today that
paragraph is generated deterministically in `apps/web/src/lib/ratingNarrative.ts` from the
company's resolved Workplace Vibe Flags, via an 80-entry phrasing table. The output is
repetitive ("X is a genuine strength here, thanks to ..." five times), frequently over
900 characters, and reads identically in structure for every company.

This spec replaces that paragraph with a per-company summary written by Claude from the
company's own survey results, and folds in two smaller company-page changes the same
request carried: a rating-band relabel + an on-page overall rating number, and fixed
heights for the three lower boxes so none of them scroll.

## Goals

1. Each company page shows a description that is specific to that company, written from its
   real survey answers (not its flags), tone-matched to its star rating, plain-language,
   and at most 600 characters.
2. The system is cheap at the scale of thousands of companies: generation cost is incurred
   only for companies people actually look at, and only when their data has moved enough to
   matter.
3. Reviewer anonymity is preserved — nothing that could single out one reviewer's answers
   leaves the server.
4. The feature degrades cleanly: with no API key configured, no calls are made and the box
   still renders sensible text.
5. Band labels and the on-page overall rating match the product's new wording.
6. The rating-narrative, Workplace Vibe Flags, and Company Details boxes are all fixed
   height — no scrollbars, aligned, and the narrative box reserves its space even for a
   company with zero reviews (a placeholder slot for future design work).

## Non-goals

- No change to the Dual-Opposite Flag Aggregation Engine or its endpoint.
- No LLM involvement in moderation, trust scoring, or anything outside this one description.
- No admin UI to view/edit/regenerate descriptions (can be added later).
- No background job runner — generation happens inline on the page's server-side fetch.
- No streaming, no per-viewer personalization.

---

## Task 1 — AI company descriptions

### 1.1 Behaviour by published-review count

The narrative box (`RatingNarrativeBox` in `page.tsx`) always renders, at a fixed height.
"Reviews" below means **published reviews for the company's primary work-type**
(`company.workplaceTypes[0]`).

| Published reviews | Illustration | Description text |
| --- | --- | --- |
| 0 | none (no score yet) | none — empty placeholder box at fixed height |
| 1–2 | picked from overall score | short status line: `"{n} review{s} so far — a full summary appears once 3 people have rated this workplace."` |
| 3+, API key set, data fresh or stale-then-regenerated | picked from overall score | Claude-written, ≤600 chars |
| 3+, API key set, data fresh (already generated) | picked from overall score | stored text served, no API call |
| 3+, API key **not** set, or the call fails/times out | picked from overall score | server-built numbers-only line, e.g. `"Across 12 reviews this workplace averages 3.6/5. Work-life balance (3.9) rates highest and leadership (3.1) lowest."` — no flags, no AI |

The illustration and the Workplace Vibe Flags box are unchanged: both already render for
1+ reviews and are unaffected by the 3-review gate.

### 1.2 When generation runs

Generation is **lazy and throttled**:

- Nothing is generated when a review is submitted or approved. `ReviewsService` /
  `recomputeAggregate` are not touched.
- Generation is attempted only when `GET /companies/:slug/narrative` is served (i.e. a
  company page is rendered).
- It actually calls Claude only when **all** of:
  - primary-work-type published review count `N >= 3`;
  - `ANTHROPIC_API_KEY` is set;
  - no stored row exists, **or** `N - row.reviewCountAtGen >= 3`, **or**
    `row.generatedAt` is older than 30 days, **or** `row.promptVersion` / `row.model`
    differ from the current constants.
- Otherwise the stored row (if any) is served as-is; below `N >= 3` the row is ignored and
  the status line / numbers line is used.

Rationale: a single new review does not move a 600-character summary. A company nobody
visits costs nothing. A busy, frequently-viewed company refreshes roughly every third
review.

Concurrency: two simultaneous first-views can both generate; the write is an upsert keyed
`@@unique([companyId, workplaceType])`, so the worst case is two wasted calls and
last-write-wins. No lock is added.

Timeout: the Claude call is capped (8s). On timeout or any error the endpoint returns the
stored row if present, else the numbers-only line for `N >= 3`. The endpoint never throws
for a generation failure (it still 404s for an unknown slug).

### 1.3 Data model

New model, `public` schema, derived-cache style (compare `CompanyAggregateScore`):

```prisma
model CompanyNarrative {
  id               String        @id @default(uuid())
  companyId        String
  company          Company       @relation(fields: [companyId], references: [id], onDelete: Cascade)
  workplaceType    WorkplaceType
  description      String        // Postgres text; ≤600 chars enforced in app code
  reviewCountAtGen Int
  model            String        // e.g. "claude-haiku-4-5-20251001"
  promptVersion    Int           // bumped when the prompt changes materially
  generatedAt      DateTime      @default(now())

  @@unique([companyId, workplaceType])
  @@index([companyId])
  @@schema("public")
}
```

`Company` gains `companyNarratives CompanyNarrative[]`. Migration via `prisma db push`
(the project's working pattern — see CLAUDE.md). No data backfill: rows are created lazily.

### 1.4 Backend module

New self-contained module `apps/api/src/modules/company-narrative/`:

- **`anthropic.client.ts`** — thin wrapper over `@anthropic-ai/sdk`.
  - `createAnthropicClient(): Anthropic | null` — returns `null` when `ANTHROPIC_API_KEY`
    is unset (read via a new `getAnthropicApiKey()` in `apps/api/src/config/`, **not**
    `requireSecret` — this is not a security secret and the feature is built to no-op
    without it, same posture as `GOOGLE_CLIENT_ID` / `IYZICO_*`).
  - `generateDescription(client, input): Promise<string>` — one `messages.create` call,
    model `claude-haiku-4-5-20251001`, `max_tokens` ~320, 8s timeout. Returns the text
    content, trimmed.
- **`company-narrative.service.ts`**
  - `getNarrative(slug: string): Promise<CompanyNarrative | null>` where the returned
    shape is `{ workplaceType, reviewCount, description: string | null }`
    (`shared-types`; see 1.6). 404 (via `NotFoundException`) only for an unknown slug.
  - Loads the company (`id`, `slug`, `name`, `workplaceTypes`), takes
    `primaryType = workplaceTypes[0]`, loads that type's published reviews
    (`select: { surveyAnswers, corporateCultureScore, leadershipScore, infrastructureScore,
    workLifeBalanceScore, stabilityScore }`), `N = reviews.length`.
  - `N < 3` → `{ workplaceType: primaryType, reviewCount: N, description: null }`.
  - `N >= 3`:
    - compute per-type category averages + overall from the loaded review scores;
    - compute per-question tallies with `tallyQuestions` (reused from
      `apps/api/src/modules/reviews/survey-tally.util.ts`) against
      `getQuestionsFor(primaryType)`;
    - decide fresh vs stale (1.2). Fresh → return the stored row's description.
    - Stale/absent + client available → build the model input (1.5), call
      `generateDescription`, enforce the 600-char backstop (truncate at the last
      sentence boundary `<= 600`, else hard cut at 600), `upsert` the row, return it.
    - Stale/absent + no client, or the call failed → return the stored description if any,
      else `buildNumbersLine(averages, N, primaryType)` (a pure helper in this module).
- **`company-narrative.controller.ts`** — `GET /companies/:slug/narrative`, public, no
  guard, mirrors the `vibe-flags` endpoint. Registered in `CompaniesController` **or** its
  own controller wired through `CompaniesModule` — implementation plan picks one; it must
  sit under the same `companies/:slug/*` prefix and load order (after `companies/filters`,
  fine alongside the other `:slug` sub-routes).
- **`company-narrative.module.ts`** — provides the service + client factory; imported by
  `CompaniesModule`. Depends on `PrismaService` only (plus the survey helpers it imports
  directly). It does **not** inject `ReviewsService` (keeps blast radius off the two
  pre-existing `ReviewsService` construction tests — same reasoning the flags module used).

### 1.5 Model input and prompt

**System prompt** — the user-supplied "core analytical engine" prompt, adapted:

- Keep: deep letter-by-letter read of the Q&A; adaptive tone driven by the 1–5 rating
  (1 reads as a direct warning, 5 highlights concrete proven benefits); zero repetition /
  no generic AI phrasing (explicitly ban "is a genuine strength", "fosters a culture of",
  "a testament to"); plain everyday language a manual labourer in a rural city
  understands; hard limit **under 600 characters**.
- Remove: the `Green Flags:` / `Red Flags:` output sections. Output is **only** the
  description paragraph, plain text, no label, no preamble, no markdown.
- Add: "Write about this workplace in general terms; do not invent a company name."

**User message** — structured, no prose from us:

- work-type (e.g. "Manual-Labour");
- overall rating to one decimal, and the five category averages;
- total published review count;
- for each of the 25 questions: the question text and the counts
  `agreed / disagreed / preferred not to answer`.

**Explicitly not sent:** individual review rows, `surveyAnswers` maps, `generalThoughts`
free text, reviewer identifiers or avatars/usernames, the answer key
(`correctAnswer`), the company name, anything from `PiiVault`.

`promptVersion` constant starts at `1`; bump it in the same commit as any wording change so
existing rows regenerate.

### 1.6 shared-types

`packages/shared-types/src/schemas/company.ts`:

```ts
export const companyNarrativeSchema = z.object({
  workplaceType: workplaceTypeSchema,
  reviewCount: z.number().int().min(0),
  description: z.string().max(600).nullable(),
});
export type CompanyNarrative = z.infer<typeof companyNarrativeSchema>;
```

Rebuild `packages/shared-types` (`pnpm exec tsc`) so both apps see it.

### 1.7 Web integration

- `page.tsx` server component: fetch `GET /companies/:slug/narrative` with the same
  `apiGetPublic` + try/catch → `null` pattern already used for `vibe-flags`.
- `RatingNarrativeBox`:
  - always rendered now (remove the `aggregate && aggregate.reviewCount > 0` guard around
    it); the box owns its own empty/1–2/3+ states.
  - props: `score: number | null`, `workplaceType`, `narrative: CompanyNarrative | null`.
  - illustration: shown when `score != null` (i.e. `aggregate?.reviewCount` > 0), via
    `ratingImageSrc(score, workplaceType)`.
  - text: `narrative?.description` if non-null; else if `narrative?.reviewCount` in 1..2
    the status line; else (0) nothing.
- `apps/web/src/lib/ratingNarrative.ts` is reduced to illustration selection only:
  - keep `WORKPLACE_IMAGE_PREFIX`;
  - `imageNumber(score)`: `>=4.0 → 4`, `>=3.0 → 3`, `>=2.0 → 2`, else `1`
    (Highly Effective **and** Exemplary both use illustration 4 — there is no 5th asset,
    and Exemplary is now a 0.5-wide band, not just a perfect score, so the old
    "Image coming soon" placeholder path is removed);
  - `export function ratingImageSrc(score: number, workplaceType: WorkplaceType): string`.
  - **Delete**: `ScoreTier`, `scoreTier`, `TIER_IMAGE_NUMBER`, `TIER_OPENING`,
    `CATEGORY_ORDER`, `CATEGORY_LABELS`, `FLAG_PARAPHRASE`, `paraphrase`, `categoryClause`,
    `generateText`, `RatingNarrative`, `ratingNarrative`. These exist only to build the
    flag-based prose this spec removes. Confirm no other importers first
    (`page.tsx` is the only current one).

### 1.8 Config / dependencies

- `apps/api/package.json`: add `@anthropic-ai/sdk` (pin an exact version).
- `apps/api/.env.example`: add

  ```
  # Optional. When set, company pages show an AI-written summary of each
  # company's survey results (apps/api/src/modules/company-narrative). Unset =
  # feature off, no API calls, a plain numeric summary is shown instead.
  ANTHROPIC_API_KEY=""
  ```
- `apps/api/src/config/` gains `getAnthropicApiKey(): string | null`.

### 1.9 Cost

- Model: Claude Haiku 4.5. Per call ≈ 1.5k input + ~250 output tokens ≈ US$0.0003.
- Lazy (viewed companies only) + throttled (≥3 new reviews, or 30 days) + stored.
- Order-of-magnitude: 10,000 companies, ~30% ever viewed, ~2 refreshes/year each →
  ~6,000 calls/year → a few dollars per year.
- `ANTHROPIC_API_KEY` unset → exactly zero calls.

### 1.10 Anonymity / REVIEW.md

This introduces the first code path that sends review-derived data to a third party
(Anthropic). Mitigations, to be recorded as a new numbered rule in `REVIEW.md`:

- Only aggregate, already-anonymised data is sent: per-question agree/disagree/prefer-not
  **counts**, category averages, overall, count, work-type. This is the same data class
  `FlagCalculatorService` already consumes; the flag endpoint's own doc comment describes
  why counts can't be reversed into individuals or the rubric.
- Hard floor of `N >= 3` published reviews for the work-type before any external call —
  below that, aggregate counts sit close enough to one person's answers that the exposure
  isn't worth it.
- `generalThoughts` free text is **never** included (it is per-review, and although the
  moderation pipeline runs on it, sub-0.9-confidence PII can still pass).
- No reviewer identifiers, avatars, usernames, employment dates, or `PiiVault` data.
- The stored `description` is public anyway (it renders on the public company page), so the
  new table carries no additional exposure at rest.

### 1.11 Testing

Unit (`company-narrative.service` with `PrismaService` and the Anthropic client both
mocked):

- `N < 3` → `description: null`, `reviewCount` correct, no client call.
- `N >= 3`, no client → numbers-only line, no call, shape matches
  `companyNarrativeSchema`.
- `N >= 3`, client, no existing row → calls once, upserts, returns model text.
- `N >= 3`, client, fresh row (Δcount < 3, age < 30d, same model+promptVersion) →
  returns stored text, no call.
- stale by count (Δ ≥ 3) → regenerates.
- stale by age (> 30d) → regenerates.
- stale by `promptVersion` bump → regenerates.
- client throws / times out, existing row present → returns stored text.
- client throws, no row → numbers-only line.
- 600-char backstop: model returns 800 chars → truncated at a sentence boundary ≤ 600.
- unknown slug → `NotFoundException`.

`buildNumbersLine` pure test: correct highest/lowest category, correct rounding, ≤ 600.

Integration / manual:

- `pnpm --filter @iwtr/shared-types exec tsc`, then `pnpm typecheck && pnpm build` clean
  across all three packages; `pnpm --filter @iwtr/api exec jest` green (no regressions to
  the current suite count).
- With a real `ANTHROPIC_API_KEY` and a seeded company with ≥3 primary-type published
  reviews: hit `/companies/:slug/narrative`, confirm a specific ≤600-char paragraph; hit
  again, confirm the stored row is served (no second call — check the dev log / add a
  temporary counter); point a 2-review company at it, confirm `description: null` +
  `reviewCount: 2`.
- Load the page in a browser (chrome-devtools MCP), light + dark, for: 0-review company
  (empty fixed box), 1–2 review company (status line), ≥3 with a key (AI text), ≥3 with
  the key unset (numbers line). No console errors; no layout shift between them.

---

## Task 2 — rating-band relabel + on-page overall rating

### 2.1 Bands

`packages/shared-types/src/schemas/company.ts` `scoreBands` — only the top cut-point moves
(`2.0` / `3.0` / `4.0` unchanged):

```ts
export const scoreBands = [
  { min: 0,   max: 2.0,  label: "Unsatisfactory" },
  { min: 2.0, max: 3.0,  label: "Developing" },
  { min: 3.0, max: 4.0,  label: "Effective" },
  { min: 4.0, max: 4.5,  label: "Highly Effective" },
  { min: 4.5, max: 5.01, label: "Exemplary" },
] as const;
```

Update the block comment above it (the current text describes the old 4.0–5.0 "Superb" /
perfect-5.0 "Exemplary" split). Rebuild `shared-types`.

### 2.2 Colours

`apps/web/src/lib/scoreBandColors.ts` — rename the `Superb` key to `Highly Effective` in
both `SCORE_BAND_COLORS` and `SCORE_BAND_TEXT_COLORS`; keep the colour values
(`bg-lime-500` / `text-lime-700 dark:text-lime-400` for Highly Effective, green for
Exemplary).

### 2.3 On-page overall rating

Company page "Rating Breakdown" box, below the "{n} reviews" line, when
`aggregate.reviewCount > 0`: a top divider, then the overall average
(`aggregate.overallAvg.toFixed(1)`) as a large number with a muted `/ 5.0`, and the band
label right-aligned, colour-coded via `scoreTextColor`. Imports `scoreBandLabel` +
`scoreTextColor`.

### 2.4 "Everywhere"

`scoreBandLabel()` is the single source of the label; the browse-grid card
(`WorkplaceBrowser.tsx`) and the owner dashboard (`app/my/companies/page.tsx`) already call
it and update automatically. No place in the app renders a numeric band range as text, so
changing the band table is the whole of "change it everywhere". `apps/api` does not
reference band labels. Grep `Superb` after the change → zero hits outside historical
comments.

---

## Task 3 — fixed-height boxes (done last, after Task 1)

Three boxes in the lower company-page area become fixed height, no scrollbars:

- **Workplace Vibe Flags** + **Company Details** (currently `h-[545px] overflow-y-auto`,
  and the Manual-Labour all-green case overflows). Boot the dev server, seed a
  single-colour 10-flag company for each of the four work-types, DOM-measure each true
  rendered height (`evaluate_script`, with `overflow:visible; height:auto` temporarily),
  take the max + a small buffer, apply that one value to both boxes. Keep
  `overflow-y-auto` only as an inert safety net.
- **RatingNarrativeBox** — now that its text is capped at 600 chars, give it a fixed
  height too (measure the tallest realistic render: `imageSrc` present + a full-600-char
  paragraph at `text-sm` in the box width). It keeps that height in the 0-review empty
  state so the slot is reserved for future design.
- The illustration in `RatingNarrativeBox` is enlarged so it "stands out more" — bump from
  `h-56 w-56` to roughly `h-64 w-64` (or widen the image column and drop `object-contain`
  slack); final size chosen during the live measure pass so it balances the fixed box.

All three measurements happen against the real running dev app, not by eyeballing — same
method the box's prior iterations used.

---

## Rollout

1. `shared-types` change + rebuild (bands, `companyNarrativeSchema`).
2. Prisma model + `prisma db push` + `prisma generate`.
3. Backend module + endpoint + config + `@anthropic-ai/sdk`.
4. Web: narrative fetch, `RatingNarrativeBox` rewrite, `ratingNarrative.ts` slim-down,
   band colour key rename, on-page overall rating.
5. `REVIEW.md` new rule.
6. Fixed-height measurement pass for all three boxes + illustration size.
7. `.env.example`; leave `ANTHROPIC_API_KEY` unset locally unless live-testing (the
   numbers-line fallback is the default experience until a key is added).

No user data migration. Shipping with the key unset is a no-op rollout: every company shows
the numbers-line (3+ reviews) or the status line (1–2) or an empty slot (0); adding the key
later turns on real generation lazily as pages are viewed.

## Open questions

None outstanding — all resolved in design discussion:

- Cost model: lazy + throttled + stored (confirmed "whatever is cheaper for now").
- Description must not use flags (confirmed).
- 3+ review gate applies to the description only; illustration + flags stay at 1+
  (confirmed, with the worked 3.5/one-reviewer example).
- Zero-review companies keep the fixed-height narrative slot (confirmed).

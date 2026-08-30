# AI Company Descriptions, Rating-Band Relabel & Fixed-Height Boxes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the company page's flag-derived rating paragraph with a Claude-written, per-company survey summary (lazily generated, cheaply cached), relabel the score bands and surface an overall rating number, and make the three lower company-page boxes fixed height with no scrollbars.

**Architecture:** A new NestJS module `company-narrative` reads a company's aggregated survey tallies, asks Claude Haiku for a ≤600-char summary, stores it in a new `CompanyNarrative` table, and serves it from a public `GET /companies/:slug/narrative` endpoint. Generation is attempted only on page view and only when the work-type has 3+ published reviews and the stored copy has gone stale. The web app fetches this server-side and renders it; with no API key configured the endpoint returns a plain numbers-only sentence instead. Band changes are a `shared-types` data edit that every existing `scoreBandLabel()` caller picks up automatically.

**Tech Stack:** pnpm workspace + Turborepo; NestJS 10 + Prisma 5 (`apps/api`); Next.js 16 App Router (`apps/web`); zod schemas in `packages/shared-types`; `@anthropic-ai/sdk`; jest + ts-jest (api, shared-types), jest + next/jest + jsdom (web).

**Spec:** `docs/superpowers/specs/2026-08-30-ai-company-descriptions-and-rating-bands.md`

## Global Constraints

- **`packages/shared-types` ships compiled JS.** After editing anything under `packages/shared-types/src/`, rebuild: `cd packages/shared-types && pnpm exec tsc`. Both apps consume `dist/`, not source. **`dist/` is a gitignored build artifact (`.gitignore` line 3) — rebuild it locally so the running dev servers pick up the change, but NEVER `git add` it.** No dist file has ever been tracked in this repo.
- **Prisma schema changes use `pnpm exec prisma db push`**, never `prisma migrate dev` (fails non-interactively in this environment).
- **Stop the API dev server before `prisma generate` / `prisma db push`** (Windows `EPERM` if the query-engine DLL is loaded), then restart it.
- **Model id:** `claude-haiku-4-5-20251001` (exact string, no aliasing).
- **Description hard limit: 600 characters.** Enforced in code as a backstop even though the prompt also states it.
- **Review-count gate:** Claude is called only when the company's *primary work-type* (`company.workplaceTypes[0]`) has **≥ 3 published reviews**.
- **Staleness:** regenerate when there is no stored row, OR `currentReviewCount - row.reviewCountAtGen >= 3`, OR `row.generatedAt` is older than 30 days, OR `row.model !== NARRATIVE_MODEL`, OR `row.promptVersion !== PROMPT_VERSION`.
- **Never sent to Anthropic:** individual review rows, raw `surveyAnswers` maps, `generalThoughts` free text, any reviewer identifier / avatar / username, employment dates, the answer key (`correctAnswer`), the company name, anything from `PiiVault`. Only aggregate per-question counts + category averages + overall + count + work-type label.
- **Banned filler phrases (stated in the system prompt):** "is a genuine strength", "fosters a culture of", "a testament to".
- **New score bands (only the top cut-point moves; 2.0 / 3.0 / 4.0 unchanged):** `0–2.0` Unsatisfactory · `2.0–3.0` Developing · `3.0–4.0` Effective · `4.0–4.5` Highly Effective · `4.5–5.01` Exemplary.
- **Commits:** one per task, straight to `main` (this project's established workflow — every prior session commits and pushes to `origin/main`). `git push` after each task. End commit messages with:
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- **Illustration assets:** `apps/web/public/{office,hybrid,service,manuallabour}{1,2,3,4}.png` — 4 per work-type, no 5th. Prefix map: `OFFICE→office`, `HYBRID_REMOTE→hybrid`, `SERVICE→service`, `MANUAL_LABOUR→manuallabour`.

---

## File Structure

**`packages/shared-types/src/schemas/company.ts`** (modify) — `scoreBands` relabel; add `companyNarrativeSchema` + `CompanyNarrative`.
**`packages/shared-types/src/schemas/__tests__/scoreBands.test.ts`** (create) — band-boundary assertions.
**`packages/shared-types/src/schemas/__tests__/companyNarrative.test.ts`** (create) — contract assertions.

**`apps/api/prisma/schema.prisma`** (modify) — `CompanyNarrative` model + `Company.companyNarratives` back-relation.

**`apps/api/src/modules/company-narrative/company-narrative.prompt.ts`** (create) — `PROMPT_VERSION`, `NARRATIVE_MODEL`, `MAX_DESCRIPTION_CHARS`, `SYSTEM_PROMPT`, `CATEGORY_LABELS`, `buildUserMessage`, `buildNumbersLine`, `clampToLimit`. Pure, no NestJS, no I/O.
**`apps/api/src/modules/company-narrative/narrative-generator.service.ts`** (create) — `NarrativeGeneratorService` (injectable): owns the `@anthropic-ai/sdk` client + `ANTHROPIC_API_KEY` read; `available` getter; `generate(userMessage)`.
**`apps/api/src/modules/company-narrative/company-narrative.service.ts`** (create) — `CompanyNarrativeService.getNarrative(slug)`: the lazy+throttled read/generate/store logic.
**`apps/api/src/modules/company-narrative/company-narrative.module.ts`** (create) — wires both services; exports `CompanyNarrativeService`.
**`apps/api/src/modules/company-narrative/__tests__/company-narrative.prompt.test.ts`** (create).
**`apps/api/src/modules/company-narrative/__tests__/narrative-generator.service.test.ts`** (create).
**`apps/api/src/modules/company-narrative/__tests__/company-narrative.service.test.ts`** (create).
**`apps/api/src/modules/companies/companies.controller.ts`** (modify) — add `GET companies/:slug/narrative`.
**`apps/api/src/modules/companies/companies.module.ts`** (modify) — import `CompanyNarrativeModule`.
**`apps/api/.env.example`** (modify) — add `ANTHROPIC_API_KEY=""` block.
**`apps/api/package.json`** (modify) — add `@anthropic-ai/sdk`.
**`REVIEW.md`** (modify) — new numbered rule for the external-data boundary.

**`apps/web/src/lib/ratingNarrative.ts`** (modify) — reduce to `ratingImageSrc(score, workplaceType)`; delete all flag-prose code.
**`apps/web/src/lib/__tests__/ratingNarrative.test.ts`** (create).
**`apps/web/src/lib/scoreBandColors.ts`** (modify) — rename `Superb` key → `Highly Effective`.
**`apps/web/src/lib/__tests__/scoreBandColors.test.ts`** (create).
**`apps/web/src/app/companies/[slug]/page.tsx`** (modify) — fetch narrative; rewrite `RatingNarrativeBox`; add overall-rating block; remove now-dead server-side vibe-flags fetch; fixed heights (Task 10).
**`apps/web/src/components/WorkplaceVibeFlags.tsx`** (modify) — fixed-height value (Task 10).

---

## Task 1: Score-band relabel (`shared-types`)

**Files:**
- Modify: `packages/shared-types/src/schemas/company.ts:214-231`
- Test: `packages/shared-types/src/schemas/__tests__/scoreBands.test.ts`

**Interfaces:**
- Produces: `scoreBands` (unchanged shape: `readonly { min:number; max:number; label:string }[]`) with labels `Unsatisfactory | Developing | Effective | Highly Effective | Exemplary`; `scoreBandLabel(avg: number): string` (unchanged signature).

- [ ] **Step 1: Write the failing test**

Create `packages/shared-types/src/schemas/__tests__/scoreBands.test.ts`:

```ts
import { scoreBandLabel } from "../company";

describe("scoreBandLabel — 2026-08-30 relabel", () => {
  it.each([
    [0, "Unsatisfactory"],
    [1.9, "Unsatisfactory"],
    [2.0, "Developing"],
    [2.9, "Developing"],
    [3.0, "Effective"],
    [3.9, "Effective"],
    [4.0, "Highly Effective"],
    [4.49, "Highly Effective"],
    [4.5, "Exemplary"],
    [4.8, "Exemplary"],
    [5.0, "Exemplary"],
  ])("maps %p to %p", (avg, label) => {
    expect(scoreBandLabel(avg)).toBe(label);
  });

  it("no longer produces the old labels", () => {
    const labels = new Set([0, 2, 3, 4, 4.5, 5].map(scoreBandLabel));
    expect(labels.has("Superb")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `cd packages/shared-types && pnpm exec jest scoreBands`
Expected: FAIL — `4.0` currently maps to `"Superb"`, `4.5` to `"Superb"`, `5.0` to `"Exemplary"`.

- [ ] **Step 3: Update `scoreBands`**

In `packages/shared-types/src/schemas/company.ts`, replace the comment block and array at lines ~215–226 with:

```ts
// 1.0-5.0 average maps to a fixed label band shown on every company page and
// browse card. 2026-08-30 relabel: the top of the scale is now split at 4.5
// ("Highly Effective" 4.0-4.5, "Exemplary" 4.5-5.0) rather than reserving
// "Exemplary" for a literal perfect 5.0. The 2.0/3.0/4.0 cut points are
// unchanged. scoreBandLabel() is the single source of these strings — the
// browse card (WorkplaceBrowser.tsx) and owner dashboard already call it.
export const scoreBands = [
  { min: 0, max: 2.0, label: "Unsatisfactory" },
  { min: 2.0, max: 3.0, label: "Developing" },
  { min: 3.0, max: 4.0, label: "Effective" },
  { min: 4.0, max: 4.5, label: "Highly Effective" },
  { min: 4.5, max: 5.01, label: "Exemplary" },
] as const;
```

Leave `scoreBandLabel` unchanged.

- [ ] **Step 4: Run the test, expect pass**

Run: `cd packages/shared-types && pnpm exec jest scoreBands`
Expected: PASS.

- [ ] **Step 5: Rebuild dist + full shared-types check**

Run: `cd packages/shared-types && pnpm exec tsc && pnpm exec jest`
Expected: clean build, all tests pass.

- [ ] **Step 6: Commit & push**

```bash
git add packages/shared-types/src/schemas/company.ts packages/shared-types/src/schemas/__tests__/scoreBands.test.ts
git commit -m "$(cat <<'EOF'
Score bands: split the top tier at 4.5 (Highly Effective / Exemplary)

Renames "Superb" to "Highly Effective" (4.0-4.5) and lowers Exemplary's
floor from a literal 5.0 to 4.5. 2.0/3.0/4.0 cut points unchanged. Every
scoreBandLabel() caller picks this up automatically.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 2: `CompanyNarrative` response contract (`shared-types`)

**Files:**
- Modify: `packages/shared-types/src/schemas/company.ts` (append near the other company schemas, before `companyAggregateScoreSchema`)
- Test: `packages/shared-types/src/schemas/__tests__/companyNarrative.test.ts`

**Interfaces:**
- Consumes: `workplaceTypeSchema` (already in this file).
- Produces:
  - `companyNarrativeSchema` — `z.object({ workplaceType: workplaceTypeSchema, reviewCount: z.number().int().min(0), description: z.string().max(600).nullable() })`
  - `type CompanyNarrative = z.infer<typeof companyNarrativeSchema>`

- [ ] **Step 1: Write the failing test**

Create `packages/shared-types/src/schemas/__tests__/companyNarrative.test.ts`:

```ts
import { companyNarrativeSchema } from "../company";

describe("companyNarrativeSchema", () => {
  it("accepts a generated description", () => {
    const parsed = companyNarrativeSchema.parse({
      workplaceType: "OFFICE",
      reviewCount: 12,
      description: "Across 12 reviews this workplace is steady but slow to fix known problems.",
    });
    expect(parsed.description).toContain("steady");
  });

  it("accepts a null description (under 3 reviews / feature off)", () => {
    const parsed = companyNarrativeSchema.parse({ workplaceType: "SERVICE", reviewCount: 2, description: null });
    expect(parsed.description).toBeNull();
  });

  it("rejects a description over 600 characters", () => {
    expect(() =>
      companyNarrativeSchema.parse({ workplaceType: "OFFICE", reviewCount: 5, description: "x".repeat(601) }),
    ).toThrow();
  });

  it("rejects a negative review count", () => {
    expect(() =>
      companyNarrativeSchema.parse({ workplaceType: "OFFICE", reviewCount: -1, description: null }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `cd packages/shared-types && pnpm exec jest companyNarrative`
Expected: FAIL — `companyNarrativeSchema` is not exported.

- [ ] **Step 3: Add the schema**

In `packages/shared-types/src/schemas/company.ts`, immediately above `export const companyAggregateScoreSchema`:

```ts
// GET /companies/:slug/narrative — the company page's rating-narrative box.
// `description` is: the Claude-written ≤600-char summary when the primary
// work-type has 3+ published reviews and generation succeeded; a plain
// numbers-only sentence when 3+ reviews but no API key / a failed call;
// null when under 3 reviews (the box then shows a short "summary appears at
// 3 reviews" line built from reviewCount). See
// apps/api/src/modules/company-narrative and the 2026-08-30 spec.
export const companyNarrativeSchema = z.object({
  workplaceType: workplaceTypeSchema,
  reviewCount: z.number().int().min(0),
  description: z.string().max(600).nullable(),
});
export type CompanyNarrative = z.infer<typeof companyNarrativeSchema>;
```

- [ ] **Step 4: Run the test, expect pass**

Run: `cd packages/shared-types && pnpm exec jest companyNarrative`
Expected: PASS.

- [ ] **Step 5: Rebuild dist**

Run: `cd packages/shared-types && pnpm exec tsc && pnpm exec jest`
Expected: clean.

- [ ] **Step 6: Commit & push**

```bash
git add packages/shared-types/src/schemas/company.ts packages/shared-types/src/schemas/__tests__/companyNarrative.test.ts
git commit -m "$(cat <<'EOF'
shared-types: add companyNarrativeSchema for GET /companies/:slug/narrative

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 3: `CompanyNarrative` Prisma model

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (new model after `CompanyAggregateScore`, ~line 523; add back-relation to `model Company`)

**Interfaces:**
- Produces: `prisma.companyNarrative` client delegate with fields `id, companyId, workplaceType, description, reviewCountAtGen, model, promptVersion, generatedAt`; unique `[companyId, workplaceType]`.

- [ ] **Step 1: Add the model**

In `apps/api/prisma/schema.prisma`, directly after the `CompanyAggregateScore` model:

```prisma
// Lazily-generated, cached rating-narrative text for one company + work-type.
// Derived-cache style like CompanyAggregateScore: never authoritative, safe
// to delete, rebuilt on demand. Written only by CompanyNarrativeService when
// a company page is viewed and the stored copy is missing/stale (see the
// 2026-08-30 spec). One row per (company, workplaceType) — a 2-tag company
// can have two.
model CompanyNarrative {
  id               String        @id @default(uuid())
  companyId        String
  company          Company       @relation(fields: [companyId], references: [id], onDelete: Cascade)
  workplaceType    WorkplaceType
  description      String        // Postgres text; <=600 chars enforced in app code
  reviewCountAtGen Int
  model            String        // e.g. "claude-haiku-4-5-20251001" — mismatch forces regen
  promptVersion    Int           // bumped in-repo when the prompt changes materially
  generatedAt      DateTime      @default(now())

  @@unique([companyId, workplaceType])
  @@index([companyId])
  @@schema("public")
}
```

- [ ] **Step 2: Add the back-relation on `Company`**

In `model Company`, in the relations block (near `aggregate CompanyAggregateScore?`), add:

```prisma
  companyNarratives    CompanyNarrative[]
```

- [ ] **Step 3: Validate the schema**

Run: `cd apps/api && pnpm exec prisma validate`
Expected: "The schema at prisma/schema.prisma is valid 🚀".

- [ ] **Step 4: Stop the API dev server, push schema, regenerate**

```bash
# Windows: the running `nest start --watch` holds the Prisma query-engine DLL.
# Stop that background process first (Ctrl-C its terminal, or kill the node pid).
cd apps/api && pnpm exec prisma db push && pnpm exec prisma generate
```
Expected: "Your database is now in sync with your Prisma schema." + "Generated Prisma Client".

- [ ] **Step 5: Verify the client delegate exists**

Run:
```bash
cd apps/api && node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();console.log(typeof p.companyNarrative.findUnique, typeof p.companyNarrative.upsert)"
```
Expected: `function function`

- [ ] **Step 6: Restart the API dev server**

Run (in its own terminal): `cd apps/api && pnpm dev`
Expected: boots, "Nest application successfully started".

- [ ] **Step 7: Commit & push**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "$(cat <<'EOF'
Prisma: CompanyNarrative table (lazily-cached rating-narrative text)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 4: Prompt & pure helpers (`company-narrative.prompt.ts`)

**Files:**
- Create: `apps/api/src/modules/company-narrative/company-narrative.prompt.ts`
- Test: `apps/api/src/modules/company-narrative/__tests__/company-narrative.prompt.test.ts`

**Interfaces:**
- Consumes: `CategoryKey`, `WorkplaceType` from `@iwtr/shared-types`; `SurveyQuestionStats` from `@iwtr/shared-types`.
- Produces:
  - `export const PROMPT_VERSION = 1`
  - `export const NARRATIVE_MODEL = "claude-haiku-4-5-20251001"`
  - `export const MAX_DESCRIPTION_CHARS = 600`
  - `export const SYSTEM_PROMPT: string`
  - `export interface NarrativeInput { workplaceType: WorkplaceType; overall: number; categories: Record<CategoryKey, number>; reviewCount: number; questions: SurveyQuestionStats[] }`
  - `export function buildUserMessage(input: NarrativeInput): string`
  - `export function buildNumbersLine(input: Omit<NarrativeInput, "questions">): string`
  - `export function clampToLimit(text: string, limit?: number): string`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/modules/company-narrative/__tests__/company-narrative.prompt.test.ts`:

```ts
import type { SurveyQuestionStats } from "@iwtr/shared-types";
import {
  SYSTEM_PROMPT,
  MAX_DESCRIPTION_CHARS,
  buildUserMessage,
  buildNumbersLine,
  clampToLimit,
  type NarrativeInput,
} from "../company-narrative.prompt";

const CATEGORIES = {
  corporateCulture: 3.2,
  leadership: 3.1,
  infrastructure: 3.5,
  workLifeBalance: 3.9,
  stability: 4.1,
};

const QUESTIONS: SurveyQuestionStats[] = [
  { questionId: "OFFICE.leadership.1", category: "leadership", text: "Does management micromanage?", agreeCount: 8, disagreeCount: 2, preferNotCount: 1 },
  { questionId: "OFFICE.stability.4", category: "stability", text: "Are promotions predictable?", agreeCount: 3, disagreeCount: 6, preferNotCount: 0 },
];

const INPUT: NarrativeInput = {
  workplaceType: "OFFICE",
  overall: 3.56,
  categories: CATEGORIES,
  reviewCount: 11,
  questions: QUESTIONS,
};

describe("SYSTEM_PROMPT", () => {
  it("states the 600-character limit and bans the filler phrases", () => {
    expect(SYSTEM_PROMPT).toContain("600");
    expect(SYSTEM_PROMPT).toContain("is a genuine strength");
    expect(SYSTEM_PROMPT).toContain("fosters a culture of");
    expect(SYSTEM_PROMPT).toContain("a testament to");
  });
});

describe("buildUserMessage", () => {
  it("includes the work-type label, overall rating, review count and every question with its counts", () => {
    const msg = buildUserMessage(INPUT);
    expect(msg).toContain("Office");
    expect(msg).toContain("3.6 out of 5");
    expect(msg).toContain("11 published employee reviews");
    expect(msg).toContain("Does management micromanage? — 8 / 2 / 1");
    expect(msg).toContain("Are promotions predictable? — 3 / 6 / 0");
  });

  it("never contains a company name field or free-text comments (none are passed in)", () => {
    const msg = buildUserMessage(INPUT);
    expect(msg.toLowerCase()).not.toContain("company name");
    expect(msg.toLowerCase()).not.toContain("generalthoughts");
  });
});

describe("buildNumbersLine", () => {
  it("names the highest and lowest category and rounds to one decimal", () => {
    const line = buildNumbersLine({ workplaceType: "OFFICE", overall: 3.56, categories: CATEGORIES, reviewCount: 11 });
    expect(line).toBe(
      "Across 11 reviews this workplace scores 3.6 out of 5. Job stability (4.1) is the strongest area and leadership (3.1) the weakest.",
    );
    expect(line.length).toBeLessThanOrEqual(MAX_DESCRIPTION_CHARS);
  });

  it("collapses to a single clause when every category is equal", () => {
    const flat = { corporateCulture: 3, leadership: 3, infrastructure: 3, workLifeBalance: 3, stability: 3 };
    const line = buildNumbersLine({ workplaceType: "SERVICE", overall: 3, categories: flat, reviewCount: 4 });
    expect(line).toBe("Across 4 reviews this workplace scores 3.0 out of 5, with all five areas rating about the same.");
  });
});

describe("clampToLimit", () => {
  it("returns short text unchanged (trimmed)", () => {
    expect(clampToLimit("  A short summary.  ")).toBe("A short summary.");
  });

  it("truncates at the last sentence boundary at or under the limit", () => {
    const text = "First sentence is fine. Second sentence pushes well past the limit and must be dropped entirely.";
    const out = clampToLimit(text, 30);
    expect(out).toBe("First sentence is fine.");
  });

  it("hard-cuts without a trailing partial word when there is no sentence boundary", () => {
    const out = clampToLimit("wordone wordtwo wordthree wordfour wordfive", 20);
    expect(out).toBe("wordone wordtwo");
    expect(out.length).toBeLessThanOrEqual(20);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `cd apps/api && pnpm exec jest company-narrative.prompt`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `company-narrative.prompt.ts`**

Create `apps/api/src/modules/company-narrative/company-narrative.prompt.ts`:

```ts
import type { CategoryKey, SurveyQuestionStats, WorkplaceType } from "@iwtr/shared-types";

// Bump when the wording below changes in a way that should invalidate every
// stored description (CompanyNarrativeService compares row.promptVersion).
export const PROMPT_VERSION = 1;
export const NARRATIVE_MODEL = "claude-haiku-4-5-20251001";
export const MAX_DESCRIPTION_CHARS = 600;

const WORKPLACE_LABELS: Record<WorkplaceType, string> = {
  OFFICE: "Office",
  HYBRID_REMOTE: "Hybrid / Remote",
  SERVICE: "Service",
  MANUAL_LABOUR: "Manual-Labour",
};

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  corporateCulture: "corporate culture",
  leadership: "leadership",
  infrastructure: "infrastructure",
  workLifeBalance: "work-life balance",
  stability: "job stability",
};

const CATEGORY_ORDER: CategoryKey[] = [
  "corporateCulture",
  "leadership",
  "infrastructure",
  "workLifeBalance",
  "stability",
];

export const SYSTEM_PROMPT = [
  "You are the analytical engine for iworkedthere.com, an employee-first workplace-review platform.",
  "You receive one company's anonymised, aggregated employee survey results for a single type of work, plus its 1-to-5 star rating.",
  "Write one paragraph that sums up what it is actually like to work there right now.",
  "",
  'For each question you get three counts: "agreed" (the employee\'s answer indicated a healthy workplace), "disagreed" (it indicated a problem), and "preferred not to say".',
  "",
  "Rules:",
  "- Base the summary only on what the counts show. Ignore any positive or negative spin.",
  "- The star rating sets the tone. 1-2 stars: a plain, direct warning about the real problems. 3 stars: even-handed, the good and the bad. 4-5 stars: point to the concrete things employees confirm are done well.",
  "- Use plain, everyday words a manual worker in a small town would understand immediately. No corporate or HR jargon.",
  "- Every sentence must carry new information. Never repeat a point. Never use filler phrases such as \"is a genuine strength\", \"fosters a culture of\", \"a testament to\", \"when it comes to\".",
  '- Write about "this workplace" or "the company". Do not invent or guess a company name.',
  "- One paragraph. Hard limit: 600 characters. Plain text only: no headings, no bullet points, no line breaks, no preamble. Output only the paragraph.",
].join("\n");

export interface NarrativeInput {
  workplaceType: WorkplaceType;
  overall: number;
  categories: Record<CategoryKey, number>;
  reviewCount: number;
  questions: SurveyQuestionStats[];
}

export function buildUserMessage(input: NarrativeInput): string {
  const cat = (k: CategoryKey) => input.categories[k].toFixed(1);
  const lines = [
    `Work type: ${WORKPLACE_LABELS[input.workplaceType]}`,
    `Overall rating: ${input.overall.toFixed(1)} out of 5`,
    `Category averages (0-5): corporate culture ${cat("corporateCulture")}, leadership ${cat("leadership")}, infrastructure ${cat("infrastructure")}, work-life balance ${cat("workLifeBalance")}, job stability ${cat("stability")}`,
    `Based on ${input.reviewCount} published employee reviews.`,
    "",
    "Survey results (question — agreed / disagreed / preferred not to say):",
    ...input.questions.map(
      (q) => `${q.text} — ${q.agreeCount} / ${q.disagreeCount} / ${q.preferNotCount}`,
    ),
  ];
  return lines.join("\n");
}

export function buildNumbersLine(input: Omit<NarrativeInput, "questions">): string {
  const entries = CATEGORY_ORDER.map((k) => ({ k, v: input.categories[k] }));
  const max = entries.reduce((a, b) => (b.v > a.v ? b : a));
  const min = entries.reduce((a, b) => (b.v < a.v ? b : a));
  const head = `Across ${input.reviewCount} reviews this workplace scores ${input.overall.toFixed(1)} out of 5`;

  if (max.v - min.v < 0.05) {
    return `${head}, with all five areas rating about the same.`;
  }

  const label = (k: CategoryKey) => {
    const l = CATEGORY_LABELS[k];
    return l.charAt(0).toUpperCase() + l.slice(1);
  };
  return `${head}. ${label(max.k)} (${max.v.toFixed(1)}) is the strongest area and ${CATEGORY_LABELS[min.k]} (${min.v.toFixed(1)}) the weakest.`;
}

export function clampToLimit(text: string, limit: number = MAX_DESCRIPTION_CHARS): string {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;

  const window = trimmed.slice(0, limit);
  const lastSentenceEnd = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "));
  if (lastSentenceEnd > 0) {
    return window.slice(0, lastSentenceEnd + 1).trim();
  }
  // Also accept a sentence that ends exactly at the window edge.
  if (/[.!?]$/.test(window)) return window.trim();

  return window.replace(/\s+\S*$/, "").trim();
}
```

- [ ] **Step 4: Run the tests, expect pass**

Run: `cd apps/api && pnpm exec jest company-narrative.prompt`
Expected: PASS (all).

- [ ] **Step 5: Commit & push**

```bash
git add apps/api/src/modules/company-narrative/company-narrative.prompt.ts apps/api/src/modules/company-narrative/__tests__/company-narrative.prompt.test.ts
git commit -m "$(cat <<'EOF'
company-narrative: prompt + numbers-line + 600-char clamp helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 5: `NarrativeGeneratorService` + `@anthropic-ai/sdk` + `.env.example`

**Files:**
- Modify: `apps/api/package.json` (add dependency)
- Modify: `apps/api/.env.example` (add `ANTHROPIC_API_KEY` block)
- Create: `apps/api/src/modules/company-narrative/narrative-generator.service.ts`
- Test: `apps/api/src/modules/company-narrative/__tests__/narrative-generator.service.test.ts`

**Interfaces:**
- Consumes: `SYSTEM_PROMPT`, `NARRATIVE_MODEL` from `./company-narrative.prompt`.
- Produces:
  - `class NarrativeGeneratorService`
  - `get available(): boolean` — true iff `ANTHROPIC_API_KEY` was set at construction
  - `async generate(userMessage: string): Promise<string>` — one Haiku call, 8s timeout, returns concatenated text blocks trimmed; throws on no-key or API/timeout error (caller catches)

- [ ] **Step 1: Add the dependency**

Run: `cd apps/api && pnpm add @anthropic-ai/sdk`
Expected: added to `apps/api/package.json` dependencies with a resolved version.

- [ ] **Step 2: Write the failing tests**

Create `apps/api/src/modules/company-narrative/__tests__/narrative-generator.service.test.ts`:

```ts
const createMock = jest.fn();

jest.mock("@anthropic-ai/sdk", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({ messages: { create: createMock } })),
  };
});

import { NarrativeGeneratorService } from "../narrative-generator.service";

describe("NarrativeGeneratorService", () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules();
    createMock.mockReset();
    process.env = { ...OLD_ENV };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  it("is unavailable when ANTHROPIC_API_KEY is unset", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(new NarrativeGeneratorService().available).toBe(false);
  });

  it("is available when the key is set", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    expect(new NarrativeGeneratorService().available).toBe(true);
  });

  it("generate() rejects when unavailable and never calls the SDK", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(new NarrativeGeneratorService().generate("hi")).rejects.toThrow();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("generate() returns the concatenated text blocks, trimmed", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    createMock.mockResolvedValue({
      content: [
        { type: "text", text: "This workplace " },
        { type: "text", text: "is steady.  " },
      ],
    });
    const out = await new NarrativeGeneratorService().generate("some user message");
    expect(out).toBe("This workplace is steady.");
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-haiku-4-5-20251001" }),
      expect.objectContaining({ timeout: 8000 }),
    );
  });

  it("generate() propagates an SDK error", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    createMock.mockRejectedValue(new Error("overloaded"));
    await expect(new NarrativeGeneratorService().generate("x")).rejects.toThrow("overloaded");
  });
});
```

- [ ] **Step 3: Run, expect failure**

Run: `cd apps/api && pnpm exec jest narrative-generator`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `narrative-generator.service.ts`**

Create `apps/api/src/modules/company-narrative/narrative-generator.service.ts`:

```ts
import { Injectable } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { NARRATIVE_MODEL, SYSTEM_PROMPT } from "./company-narrative.prompt";

/**
 * Thin wrapper around the Anthropic SDK for the one call this app makes.
 * Reads ANTHROPIC_API_KEY once at construction. When it is unset the service
 * reports `available === false` and callers skip generation entirely — the
 * feature is designed to no-op without a key (same posture as GOOGLE_CLIENT_ID
 * / IYZICO_*). Never routed through requireSecret(): this is not a security
 * secret and its absence must not block boot.
 */
@Injectable()
export class NarrativeGeneratorService {
  private readonly client: Anthropic | null;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  get available(): boolean {
    return this.client !== null;
  }

  async generate(userMessage: string): Promise<string> {
    if (!this.client) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }

    const message = await this.client.messages.create(
      {
        model: NARRATIVE_MODEL,
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      },
      { timeout: 8000 },
    );

    return message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
  }
}
```

- [ ] **Step 5: Run the tests, expect pass**

Run: `cd apps/api && pnpm exec jest narrative-generator`
Expected: PASS (all).

- [ ] **Step 6: Add the `.env.example` block**

In `apps/api/.env.example`, append:

```
# Company descriptions (apps/api/src/modules/company-narrative). When set,
# company pages show a Claude-written summary of each company's survey
# results, generated lazily on page view and cached in the CompanyNarrative
# table. Unset = feature off: no API calls, a plain numeric sentence is shown
# instead. Uses the claude-haiku-4-5 model; cost is a fraction of a cent per
# company per refresh.
ANTHROPIC_API_KEY=""
```

- [ ] **Step 7: Typecheck + commit & push**

Run: `cd apps/api && pnpm exec tsc --noEmit`
Expected: clean.

```bash
git add apps/api/package.json apps/api/pnpm-lock.yaml pnpm-lock.yaml apps/api/.env.example apps/api/src/modules/company-narrative/narrative-generator.service.ts apps/api/src/modules/company-narrative/__tests__/narrative-generator.service.test.ts
git commit -m "$(cat <<'EOF'
company-narrative: Anthropic generator service (no-op without ANTHROPIC_API_KEY)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

(If only the root `pnpm-lock.yaml` changed, adjust the `git add` accordingly.)

---

## Task 6: `CompanyNarrativeService` + module

**Files:**
- Create: `apps/api/src/modules/company-narrative/company-narrative.service.ts`
- Create: `apps/api/src/modules/company-narrative/company-narrative.module.ts`
- Test: `apps/api/src/modules/company-narrative/__tests__/company-narrative.service.test.ts`

**Interfaces:**
- Consumes: `PrismaService` (`apps/api/src/prisma/prisma.service`); `NarrativeGeneratorService` (Task 5); `buildUserMessage`, `buildNumbersLine`, `clampToLimit`, `NARRATIVE_MODEL`, `PROMPT_VERSION`, `NarrativeInput` (Task 4); `tallyQuestions` (`apps/api/src/modules/reviews/survey-tally.util`); `getQuestionsFor` (`apps/api/src/modules/reviews/survey-questions.data`); `CompanyNarrative`, `CategoryKey`, `WorkplaceType` from `@iwtr/shared-types`.
- Produces:
  - `class CompanyNarrativeService`
  - `async getNarrative(slug: string): Promise<CompanyNarrative>` — `{ workplaceType, reviewCount, description }`. Throws `NotFoundException` for an unknown slug. Never throws for a generation failure.
  - `const MIN_REVIEWS_FOR_AI = 3`, `const STALE_AFTER_DAYS = 30`, `const STALE_REVIEW_DELTA = 3` (module-level consts).
  - `class CompanyNarrativeModule` (exports `CompanyNarrativeService`).

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/modules/company-narrative/__tests__/company-narrative.service.test.ts`:

```ts
import { NotFoundException } from "@nestjs/common";
import { CompanyNarrativeService } from "../company-narrative.service";

type PrismaMock = {
  company: { findUnique: jest.Mock };
  review: { findMany: jest.Mock };
  companyNarrative: { findUnique: jest.Mock; upsert: jest.Mock };
};

function makePrisma(overrides: Partial<PrismaMock> = {}): PrismaMock {
  return {
    company: { findUnique: jest.fn().mockResolvedValue({ id: "c1", slug: "acme", workplaceTypes: ["OFFICE"] }) },
    review: { findMany: jest.fn().mockResolvedValue([]) },
    companyNarrative: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
    ...overrides,
  };
}

// 5 published OFFICE reviews, all category scores = 4 -> overall 4.0.
function reviewRows(n: number) {
  return Array.from({ length: n }, () => ({
    surveyAnswers: {},
    corporateCultureScore: 4,
    leadershipScore: 4,
    infrastructureScore: 4,
    workLifeBalanceScore: 4,
    stabilityScore: 4,
  }));
}

const generatorOff = { available: false, generate: jest.fn() };
function generatorOn(text = "This workplace is steady but slow to fix problems.") {
  return { available: true, generate: jest.fn().mockResolvedValue(text) };
}

describe("CompanyNarrativeService.getNarrative", () => {
  it("throws NotFoundException for an unknown slug", async () => {
    const prisma = makePrisma({ company: { findUnique: jest.fn().mockResolvedValue(null) } });
    const svc = new CompanyNarrativeService(prisma as any, generatorOff as any);
    await expect(svc.getNarrative("nope")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns description null and does not call the generator under 3 reviews", async () => {
    const prisma = makePrisma({ review: { findMany: jest.fn().mockResolvedValue(reviewRows(2)) } });
    const gen = generatorOn();
    const svc = new CompanyNarrativeService(prisma as any, gen as any);
    const out = await svc.getNarrative("acme");
    expect(out).toEqual({ workplaceType: "OFFICE", reviewCount: 2, description: null });
    expect(gen.generate).not.toHaveBeenCalled();
  });

  it("with 3+ reviews and no generator, returns the numbers-only line and stores nothing", async () => {
    const prisma = makePrisma({ review: { findMany: jest.fn().mockResolvedValue(reviewRows(6)) } });
    const svc = new CompanyNarrativeService(prisma as any, generatorOff as any);
    const out = await svc.getNarrative("acme");
    expect(out.description).toBe(
      "Across 6 reviews this workplace scores 4.0 out of 5, with all five areas rating about the same.",
    );
    expect(prisma.companyNarrative.upsert).not.toHaveBeenCalled();
  });

  it("with 3+ reviews, a generator and no stored row, generates once, clamps, upserts and returns", async () => {
    const prisma = makePrisma({ review: { findMany: jest.fn().mockResolvedValue(reviewRows(4)) } });
    const gen = generatorOn("A specific summary.");
    const svc = new CompanyNarrativeService(prisma as any, gen as any);
    const out = await svc.getNarrative("acme");
    expect(gen.generate).toHaveBeenCalledTimes(1);
    expect(out.description).toBe("A specific summary.");
    expect(prisma.companyNarrative.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId_workplaceType: { companyId: "c1", workplaceType: "OFFICE" } },
        create: expect.objectContaining({ description: "A specific summary.", reviewCountAtGen: 4, promptVersion: 1 }),
      }),
    );
  });

  it("serves a fresh stored row without calling the generator", async () => {
    const prisma = makePrisma({
      review: { findMany: jest.fn().mockResolvedValue(reviewRows(5)) },
      companyNarrative: {
        findUnique: jest.fn().mockResolvedValue({
          description: "Stored copy.",
          reviewCountAtGen: 5,
          model: "claude-haiku-4-5-20251001",
          promptVersion: 1,
          generatedAt: new Date(),
        }),
        upsert: jest.fn(),
      },
    });
    const gen = generatorOn();
    const svc = new CompanyNarrativeService(prisma as any, gen as any);
    const out = await svc.getNarrative("acme");
    expect(out.description).toBe("Stored copy.");
    expect(gen.generate).not.toHaveBeenCalled();
  });

  it("regenerates when the review count has moved by 3+ since the stored row", async () => {
    const prisma = makePrisma({
      review: { findMany: jest.fn().mockResolvedValue(reviewRows(9)) },
      companyNarrative: {
        findUnique: jest.fn().mockResolvedValue({
          description: "Old.", reviewCountAtGen: 5, model: "claude-haiku-4-5-20251001", promptVersion: 1, generatedAt: new Date(),
        }),
        upsert: jest.fn().mockResolvedValue({}),
      },
    });
    const gen = generatorOn("Fresh.");
    const svc = new CompanyNarrativeService(prisma as any, gen as any);
    const out = await svc.getNarrative("acme");
    expect(out.description).toBe("Fresh.");
    expect(gen.generate).toHaveBeenCalledTimes(1);
  });

  it("regenerates when the stored row is older than 30 days", async () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const prisma = makePrisma({
      review: { findMany: jest.fn().mockResolvedValue(reviewRows(5)) },
      companyNarrative: {
        findUnique: jest.fn().mockResolvedValue({
          description: "Old.", reviewCountAtGen: 5, model: "claude-haiku-4-5-20251001", promptVersion: 1, generatedAt: old,
        }),
        upsert: jest.fn().mockResolvedValue({}),
      },
    });
    const gen = generatorOn("Fresh.");
    const svc = new CompanyNarrativeService(prisma as any, gen as any);
    expect((await svc.getNarrative("acme")).description).toBe("Fresh.");
    expect(gen.generate).toHaveBeenCalledTimes(1);
  });

  it("regenerates when the stored promptVersion differs", async () => {
    const prisma = makePrisma({
      review: { findMany: jest.fn().mockResolvedValue(reviewRows(5)) },
      companyNarrative: {
        findUnique: jest.fn().mockResolvedValue({
          description: "Old.", reviewCountAtGen: 5, model: "claude-haiku-4-5-20251001", promptVersion: 0, generatedAt: new Date(),
        }),
        upsert: jest.fn().mockResolvedValue({}),
      },
    });
    const gen = generatorOn("Fresh.");
    const svc = new CompanyNarrativeService(prisma as any, gen as any);
    expect((await svc.getNarrative("acme")).description).toBe("Fresh.");
  });

  it("falls back to the stored row when generation throws", async () => {
    const prisma = makePrisma({
      review: { findMany: jest.fn().mockResolvedValue(reviewRows(20)) },
      companyNarrative: {
        findUnique: jest.fn().mockResolvedValue({
          description: "Stale but usable.", reviewCountAtGen: 5, model: "claude-haiku-4-5-20251001", promptVersion: 1, generatedAt: new Date(),
        }),
        upsert: jest.fn(),
      },
    });
    const gen = { available: true, generate: jest.fn().mockRejectedValue(new Error("overloaded")) };
    const svc = new CompanyNarrativeService(prisma as any, gen as any);
    const out = await svc.getNarrative("acme");
    expect(out.description).toBe("Stale but usable.");
    expect(prisma.companyNarrative.upsert).not.toHaveBeenCalled();
  });

  it("falls back to the numbers line when generation throws and there is no stored row", async () => {
    const prisma = makePrisma({ review: { findMany: jest.fn().mockResolvedValue(reviewRows(7)) } });
    const gen = { available: true, generate: jest.fn().mockRejectedValue(new Error("overloaded")) };
    const svc = new CompanyNarrativeService(prisma as any, gen as any);
    const out = await svc.getNarrative("acme");
    expect(out.description).toContain("Across 7 reviews this workplace scores 4.0 out of 5");
  });

  it("clamps an over-long model response to 600 characters at a sentence boundary", async () => {
    const long = "First short sentence. " + "This second sentence is padded out. ".repeat(30);
    const prisma = makePrisma({ review: { findMany: jest.fn().mockResolvedValue(reviewRows(4)) } });
    const gen = generatorOn(long);
    const svc = new CompanyNarrativeService(prisma as any, gen as any);
    const out = await svc.getNarrative("acme");
    expect(out.description!.length).toBeLessThanOrEqual(600);
    expect(out.description!.endsWith(".")).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `cd apps/api && pnpm exec jest company-narrative.service`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `company-narrative.service.ts`**

Create `apps/api/src/modules/company-narrative/company-narrative.service.ts`:

```ts
import { Injectable, NotFoundException } from "@nestjs/common";
import type { CategoryKey, CompanyNarrative, WorkplaceType } from "@iwtr/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { getQuestionsFor } from "../reviews/survey-questions.data";
import { tallyQuestions } from "../reviews/survey-tally.util";
import { NarrativeGeneratorService } from "./narrative-generator.service";
import {
  NARRATIVE_MODEL,
  PROMPT_VERSION,
  buildNumbersLine,
  buildUserMessage,
  clampToLimit,
} from "./company-narrative.prompt";

export const MIN_REVIEWS_FOR_AI = 3;
export const STALE_AFTER_DAYS = 30;
export const STALE_REVIEW_DELTA = 3;

type ReviewScoreRow = {
  surveyAnswers: unknown;
  corporateCultureScore: number;
  leadershipScore: number;
  infrastructureScore: number;
  workLifeBalanceScore: number;
  stabilityScore: number;
};

@Injectable()
export class CompanyNarrativeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly generator: NarrativeGeneratorService,
  ) {}

  async getNarrative(slug: string): Promise<CompanyNarrative> {
    const company = await this.prisma.company.findUnique({
      where: { slug },
      select: { id: true, slug: true, workplaceTypes: true },
    });
    if (!company) {
      throw new NotFoundException("Company not found");
    }

    const workplaceType = company.workplaceTypes[0] as WorkplaceType;

    const reviews = (await this.prisma.review.findMany({
      where: { companyId: company.id, status: "PUBLISHED", workplaceType },
      select: {
        surveyAnswers: true,
        corporateCultureScore: true,
        leadershipScore: true,
        infrastructureScore: true,
        workLifeBalanceScore: true,
        stabilityScore: true,
      },
    })) as ReviewScoreRow[];

    const reviewCount = reviews.length;
    if (reviewCount < MIN_REVIEWS_FOR_AI) {
      return { workplaceType, reviewCount, description: null };
    }

    const categories = this.categoryAverages(reviews);
    const overall =
      (categories.corporateCulture +
        categories.leadership +
        categories.infrastructure +
        categories.workLifeBalance +
        categories.stability) /
      5;

    const stored = await this.prisma.companyNarrative.findUnique({
      where: { companyId_workplaceType: { companyId: company.id, workplaceType } },
    });

    if (stored && !this.isStale(stored, reviewCount)) {
      return { workplaceType, reviewCount, description: stored.description };
    }

    if (this.generator.available) {
      try {
        const questions = tallyQuestions(
          reviews.map((r) => ({ surveyAnswers: r.surveyAnswers })),
          getQuestionsFor(workplaceType),
        );
        const raw = await this.generator.generate(
          buildUserMessage({ workplaceType, overall, categories, reviewCount, questions }),
        );
        const description = clampToLimit(raw);
        if (description.length > 0) {
          await this.prisma.companyNarrative.upsert({
            where: { companyId_workplaceType: { companyId: company.id, workplaceType } },
            create: {
              companyId: company.id,
              workplaceType,
              description,
              reviewCountAtGen: reviewCount,
              model: NARRATIVE_MODEL,
              promptVersion: PROMPT_VERSION,
            },
            update: {
              description,
              reviewCountAtGen: reviewCount,
              model: NARRATIVE_MODEL,
              promptVersion: PROMPT_VERSION,
              generatedAt: new Date(),
            },
          });
          return { workplaceType, reviewCount, description };
        }
      } catch {
        // fall through to stored copy / numbers line
      }
    }

    if (stored) {
      return { workplaceType, reviewCount, description: stored.description };
    }
    return {
      workplaceType,
      reviewCount,
      description: buildNumbersLine({ workplaceType, overall, categories, reviewCount }),
    };
  }

  private categoryAverages(reviews: ReviewScoreRow[]): Record<CategoryKey, number> {
    const n = reviews.length;
    const sum = (pick: (r: ReviewScoreRow) => number) => reviews.reduce((acc, r) => acc + pick(r), 0);
    return {
      corporateCulture: sum((r) => r.corporateCultureScore) / n,
      leadership: sum((r) => r.leadershipScore) / n,
      infrastructure: sum((r) => r.infrastructureScore) / n,
      workLifeBalance: sum((r) => r.workLifeBalanceScore) / n,
      stability: sum((r) => r.stabilityScore) / n,
    };
  }

  private isStale(
    row: { reviewCountAtGen: number; model: string; promptVersion: number; generatedAt: Date },
    currentReviewCount: number,
  ): boolean {
    if (row.model !== NARRATIVE_MODEL) return true;
    if (row.promptVersion !== PROMPT_VERSION) return true;
    if (currentReviewCount - row.reviewCountAtGen >= STALE_REVIEW_DELTA) return true;
    const ageDays = (Date.now() - row.generatedAt.getTime()) / (1000 * 60 * 60 * 24);
    return ageDays > STALE_AFTER_DAYS;
  }
}
```

- [ ] **Step 4: Run the tests, expect pass**

Run: `cd apps/api && pnpm exec jest company-narrative.service`
Expected: PASS (all).

- [ ] **Step 5: Create the module**

Create `apps/api/src/modules/company-narrative/company-narrative.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { CompanyNarrativeService } from "./company-narrative.service";
import { NarrativeGeneratorService } from "./narrative-generator.service";

@Module({
  providers: [CompanyNarrativeService, NarrativeGeneratorService],
  exports: [CompanyNarrativeService],
})
export class CompanyNarrativeModule {}
```

- [ ] **Step 6: Typecheck**

Run: `cd apps/api && pnpm exec tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit & push**

```bash
git add apps/api/src/modules/company-narrative/company-narrative.service.ts apps/api/src/modules/company-narrative/company-narrative.module.ts apps/api/src/modules/company-narrative/__tests__/company-narrative.service.test.ts
git commit -m "$(cat <<'EOF'
company-narrative: lazy + throttled getNarrative (3+ review gate, 30d/Δ3 staleness)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 7: Endpoint wiring + `REVIEW.md` rule

**Files:**
- Modify: `apps/api/src/modules/companies/companies.controller.ts` (constructor + one route)
- Modify: `apps/api/src/modules/companies/companies.module.ts` (import `CompanyNarrativeModule`)
- Modify: `REVIEW.md` (new numbered rule)

**Interfaces:**
- Consumes: `CompanyNarrativeService.getNarrative(slug)` (Task 6); `CompanyNarrativeModule` (Task 6).
- Produces: `GET /v1/companies/:slug/narrative` → `CompanyNarrative` JSON (200), or 404 for an unknown slug.

- [ ] **Step 1: Add the module import**

In `apps/api/src/modules/companies/companies.module.ts`, add `CompanyNarrativeModule` to `imports`:

```ts
import { CompanyNarrativeModule } from "../company-narrative/company-narrative.module";
// ...
  imports: [AuthModule, ReviewsModule, FlagsModule, CompanyNarrativeModule],
```

- [ ] **Step 2: Inject the service + add the route**

In `apps/api/src/modules/companies/companies.controller.ts`:

- add the import: `import { CompanyNarrativeService } from "../company-narrative/company-narrative.service";`
- add to the constructor params: `private readonly companyNarrative: CompanyNarrativeService,`
- add this route immediately after the `vibe-flags` handler:

```ts
  // Lazily-generated ≤600-char rating-narrative summary for the company's
  // primary work-type. See CompanyNarrativeService: an external (Anthropic)
  // call happens only on a stale/absent row with 3+ published reviews for
  // that type and a configured key — otherwise this is a single indexed
  // SELECT. Never returns individual answers or reviewer data.
  @Get("companies/:slug/narrative")
  narrative(@Param("slug") slug: string) {
    return this.companyNarrative.getNarrative(slug);
  }
```

- [ ] **Step 3: Typecheck + build**

Run: `cd apps/api && pnpm exec tsc --noEmit && pnpm build`
Expected: clean.

- [ ] **Step 4: Restart the API dev server and curl the endpoint**

With `apps/api` running (`pnpm dev`) and the local DB seeded (`test-perfect-score-company` exists — OFFICE, 5.0, 3 reviews):

```bash
curl -s http://localhost:3001/v1/companies/test-perfect-score-company/narrative
```
Expected JSON (key unset locally → numbers line):
```json
{"workplaceType":"OFFICE","reviewCount":3,"description":"Across 3 reviews this workplace scores 5.0 out of 5, with all five areas rating about the same."}
```

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/v1/companies/does-not-exist/narrative
```
Expected: `404`

Pick a company with 1–2 published reviews for its primary type (query the DB if unsure) and confirm `"description":null` with the right `reviewCount`.

- [ ] **Step 5: Add the `REVIEW.md` rule**

In `REVIEW.md`, add a new numbered rule in the anonymity section (use the next number in sequence). Text:

```
N. **AI company descriptions send only aggregate survey data off-platform.**
   `apps/api/src/modules/company-narrative` is the one code path that sends
   review-derived data to a third party (Anthropic). It may send ONLY: the
   per-question agree/disagree/prefer-not COUNTS, the five category averages,
   the overall rating, the published-review count, and the work-type label —
   the same data class the flag engine already consumes. It must NEVER send
   individual review rows, raw `surveyAnswers`, `generalThoughts` free text,
   any reviewer identifier/avatar/username, employment dates, the answer key,
   the company name, or anything from `PiiVault`. A hard floor of 3 published
   reviews for the work-type gates every external call. A PR that widens this
   input set, lowers the floor, or adds a second off-platform sink of
   review data is critical-severity by default.
```

- [ ] **Step 6: Commit & push**

```bash
git add apps/api/src/modules/companies/companies.controller.ts apps/api/src/modules/companies/companies.module.ts REVIEW.md
git commit -m "$(cat <<'EOF'
company-narrative: public GET /companies/:slug/narrative + REVIEW.md rule

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 8: Web — `scoreBandColors` label rename

**Files:**
- Modify: `apps/web/src/lib/scoreBandColors.ts:6-20`
- Test: `apps/web/src/lib/__tests__/scoreBandColors.test.ts`

**Interfaces:**
- Produces: `scoreBarColor(avg)` / `scoreTextColor(avg)` unchanged signatures; internal maps keyed by the new labels (`Highly Effective` instead of `Superb`).

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/__tests__/scoreBandColors.test.ts`:

```ts
import { scoreBarColor, scoreTextColor } from "../scoreBandColors";

describe("scoreBandColors — post-relabel", () => {
  it("colours the 4.0-4.5 band (Highly Effective) lime", () => {
    expect(scoreBarColor(4.2)).toBe("bg-lime-500");
    expect(scoreTextColor(4.2)).toBe("text-lime-700 dark:text-lime-400");
  });

  it("colours the 4.5-5.0 band (Exemplary) green", () => {
    expect(scoreBarColor(4.7)).toBe("bg-green-600");
    expect(scoreTextColor(5.0)).toBe("text-green-700 dark:text-green-400");
  });

  it("still colours the low bands", () => {
    expect(scoreBarColor(1.0)).toBe("bg-red-500");
    expect(scoreBarColor(3.4)).toBe("bg-amber-500");
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `cd apps/web && pnpm exec jest scoreBandColors`
Expected: FAIL — `scoreBarColor(4.2)` currently returns `bg-foreground` (the `Superb` key no longer matches the label `Highly Effective` returned by the rebuilt shared-types).

- [ ] **Step 3: Rename the keys**

In `apps/web/src/lib/scoreBandColors.ts`, change the `Superb:` key to `"Highly Effective":` in **both** `SCORE_BAND_COLORS` and `SCORE_BAND_TEXT_COLORS` (values unchanged):

```ts
const SCORE_BAND_COLORS: Record<string, string> = {
  Unsatisfactory: "bg-red-500",
  Developing: "bg-orange-500",
  Effective: "bg-amber-500",
  "Highly Effective": "bg-lime-500",
  Exemplary: "bg-green-600",
};

const SCORE_BAND_TEXT_COLORS: Record<string, string> = {
  Unsatisfactory: "text-red-700 dark:text-red-400",
  Developing: "text-orange-700 dark:text-orange-400",
  Effective: "text-amber-700 dark:text-amber-400",
  "Highly Effective": "text-lime-700 dark:text-lime-400",
  Exemplary: "text-green-700 dark:text-green-400",
};
```

- [ ] **Step 4: Run the test, expect pass**

Run: `cd apps/web && pnpm exec jest scoreBandColors`
Expected: PASS.

- [ ] **Step 5: Commit & push**

```bash
git add apps/web/src/lib/scoreBandColors.ts apps/web/src/lib/__tests__/scoreBandColors.test.ts
git commit -m "$(cat <<'EOF'
web: scoreBandColors — rename Superb key to "Highly Effective"

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 9: Web — company page narrative + overall rating; retire flag prose

**Files:**
- Modify: `apps/web/src/lib/ratingNarrative.ts` (reduce to image selection)
- Create: `apps/web/src/lib/__tests__/ratingNarrative.test.ts`
- Modify: `apps/web/src/app/companies/[slug]/page.tsx`

**Interfaces:**
- Consumes: `CompanyNarrative` from `@iwtr/shared-types` (Task 2); `GET /companies/:slug/narrative` (Task 7); `scoreBandLabel` from `@iwtr/shared-types`; `scoreTextColor` from `@/lib/scoreBandColors` (Task 8).
- Produces: `ratingImageSrc(score: number, workplaceType: WorkplaceType): string` — the only remaining export of `ratingNarrative.ts`.

- [ ] **Step 1: Write the failing test for `ratingImageSrc`**

Create `apps/web/src/lib/__tests__/ratingNarrative.test.ts`:

```ts
import { ratingImageSrc } from "../ratingNarrative";

describe("ratingImageSrc", () => {
  it.each([
    [1.0, "OFFICE", "/office1.png"],
    [2.0, "OFFICE", "/office2.png"],
    [3.5, "MANUAL_LABOUR", "/manuallabour3.png"],
    [4.0, "SERVICE", "/service4.png"],
    [4.7, "OFFICE", "/office4.png"],
    [5.0, "HYBRID_REMOTE", "/hybrid4.png"],
    [1.9, "SERVICE", "/service1.png"],
  ])("maps score %p / %s to %s", (score, workplaceType, expected) => {
    expect(ratingImageSrc(score, workplaceType as any)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `cd apps/web && pnpm exec jest ratingNarrative`
Expected: FAIL — `ratingImageSrc` is not exported (current export is `ratingNarrative`).

- [ ] **Step 3: Rewrite `ratingNarrative.ts`**

Replace the entire contents of `apps/web/src/lib/ratingNarrative.ts` with:

```ts
import type { WorkplaceType } from "@iwtr/shared-types";

// Illustration picker for the company page's rating-narrative box. The
// descriptive text itself is now produced server-side
// (GET /companies/:slug/narrative — apps/api/src/modules/company-narrative);
// this file is only the deterministic score -> image mapping.
//
// Assets: apps/web/public/{office,hybrid,service,manuallabour}{1,2,3,4}.png.
// There is no 5th image — "Highly Effective" (4.0-4.5) and "Exemplary"
// (4.5-5.0) both use image 4.
const WORKPLACE_IMAGE_PREFIX: Record<WorkplaceType, string> = {
  OFFICE: "office",
  HYBRID_REMOTE: "hybrid",
  SERVICE: "service",
  MANUAL_LABOUR: "manuallabour",
};

function imageNumber(score: number): 1 | 2 | 3 | 4 {
  if (score >= 4.0) return 4;
  if (score >= 3.0) return 3;
  if (score >= 2.0) return 2;
  return 1;
}

export function ratingImageSrc(score: number, workplaceType: WorkplaceType): string {
  return `/${WORKPLACE_IMAGE_PREFIX[workplaceType]}${imageNumber(score)}.png`;
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `cd apps/web && pnpm exec jest ratingNarrative`
Expected: PASS.

- [ ] **Step 5: Update `page.tsx` imports**

In `apps/web/src/app/companies/[slug]/page.tsx`:

- Change the shared-types import line to drop `CompanyVibeFlags`/`VibeFlag` and add `CompanyNarrative` + `scoreBandLabel`:

```ts
import type { Company, CompanyDetail, CompanyNarrative } from "@iwtr/shared-types";
import { scoreBandLabel } from "@iwtr/shared-types";
```

(Keep the existing `apiGetPublic, ApiError` import.)

- Change the scoreBandColors import to add `scoreTextColor`:

```ts
import { scoreBarColor, scoreTextColor } from "@/lib/scoreBandColors";
```

- Change the ratingNarrative import:

```ts
import { ratingImageSrc } from "@/lib/ratingNarrative";
```

- [ ] **Step 6: Replace `RatingNarrativeBox`**

Replace the whole `RatingNarrativeBox` function (and its doc comment) with:

```tsx
// Illustration (from the overall score) + a short summary. The summary text
// is whatever GET /companies/:slug/narrative returned: the AI paragraph, a
// plain numbers sentence, or null. When null and there are 1-2 reviews we
// show a "summary appears at 3 reviews" line; with 0 reviews the box is an
// empty fixed-size slot (reserved for future design). Fixed height is set in
// a later step so 600 chars of text and the empty state render identically.
function RatingNarrativeBox({
  score,
  workplaceType,
  narrative,
}: {
  score: number | null;
  workplaceType: Company["workplaceTypes"][number];
  narrative: CompanyNarrative | null;
}) {
  const imageSrc = score !== null ? ratingImageSrc(score, workplaceType) : null;
  const waitingLine =
    narrative && narrative.description === null && narrative.reviewCount >= 1 && narrative.reviewCount <= 2
      ? `${narrative.reviewCount} review${narrative.reviewCount === 1 ? "" : "s"} so far — a full summary appears once 3 people have rated this workplace.`
      : null;

  return (
    <div className="flex flex-col items-center gap-6 rounded-xl border border-border bg-surface p-6 font-sans sm:flex-row sm:items-center lg:max-w-2xl lg:shrink-0">
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small fixed
        // set of local /public illustrations, not a remote/arbitrary URL.
        <img src={imageSrc} alt="" className="h-56 w-56 shrink-0 object-contain" />
      ) : (
        <div className="h-56 w-56 shrink-0" aria-hidden="true" />
      )}
      {narrative?.description ? (
        <p className="text-center text-sm text-foreground sm:text-left">{narrative.description}</p>
      ) : waitingLine ? (
        <p className="text-center text-sm text-muted-foreground sm:text-left">{waitingLine}</p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 7: Replace the server-side vibe-flags fetch with the narrative fetch**

In the `CompanyPage` function body, delete the block that fetches `vibeFlags` and computes `narrativeWorkplaceType` / `narrativeFlags` (the `let vibeFlags` try/catch and the two `const narrative*` lines). Replace with:

```tsx
  // Server-side fetch purely for RatingNarrativeBox. The endpoint always
  // returns 200 with { workplaceType, reviewCount, description } for a valid
  // slug; a network error just falls back to null (box shows the illustration
  // + nothing, same as the 0-review state).
  let narrative: CompanyNarrative | null = null;
  try {
    narrative = await apiGetPublic<CompanyNarrative>(`/companies/${slug}/narrative`);
  } catch {
    narrative = null;
  }
```

- [ ] **Step 8: Update the `RatingNarrativeBox` render site**

In the JSX, replace the guarded block:

```tsx
{aggregate && aggregate.reviewCount > 0 && (
  <RatingNarrativeBox
    score={aggregate.overallAvg}
    workplaceType={narrativeWorkplaceType}
    flags={narrativeFlags}
  />
)}
```

with (always rendered):

```tsx
<RatingNarrativeBox
  score={aggregate && aggregate.reviewCount > 0 ? aggregate.overallAvg : null}
  workplaceType={company.workplaceTypes[0]}
  narrative={narrative}
/>
```

- [ ] **Step 9: Add the overall-rating block to the Rating Breakdown box**

Inside the Rating Breakdown box, in the `aggregate && aggregate.reviewCount > 0` branch, immediately after the `<p className="mt-2 text-xs text-muted-foreground">{aggregate.reviewCount} review…</p>`:

```tsx
                <div className="mt-3 flex items-baseline gap-2 border-t border-border pt-3">
                  <span className="text-3xl font-bold text-foreground">{aggregate.overallAvg.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">/ 5.0</span>
                  <span className={`ml-auto text-sm font-semibold ${scoreTextColor(aggregate.overallAvg)}`}>
                    {scoreBandLabel(aggregate.overallAvg)}
                  </span>
                </div>
```

- [ ] **Step 10: Typecheck, build, lint**

Run: `cd apps/web && pnpm exec tsc --noEmit && pnpm build && pnpm lint`
Expected: `tsc`/`build` clean. `pnpm lint` shows the **same** pre-existing `react-hooks/set-state-in-effect` count as before this task and no new errors (compare against `git stash && pnpm lint` if unsure). If `VibeFlag`/`CompanyVibeFlags` are now reported as unused imports, remove them.

- [ ] **Step 11: Manual check in the browser**

With both dev servers running, open `http://localhost:3000/companies/test-perfect-score-company`:
- narrative box shows illustration `/office4.png` + the numbers sentence (no key set);
- Rating Breakdown box shows `5.0 / 5.0` and `Exemplary` (green) under the bars.

Open a company with 0 reviews (e.g. create one via the admin dashboard or pick a seeded unrated one): narrative box renders as an empty bordered box, no illustration, no text; page does not error.

- [ ] **Step 12: Commit & push**

```bash
git add apps/web/src/lib/ratingNarrative.ts apps/web/src/lib/__tests__/ratingNarrative.test.ts apps/web/src/app/companies/[slug]/page.tsx
git commit -m "$(cat <<'EOF'
web: company page renders server-generated narrative + overall rating point

Replaces the flag-derived paragraph (ratingNarrative.ts flag-prose + 80-entry
paraphrase table, all deleted) with the text from GET /companies/:slug/narrative.
Adds the overall score + band label under the Rating Breakdown bars. The
narrative box now always renders, at 0 reviews as an empty reserved slot.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 10: Fixed-height boxes (live-measured)

**Files:**
- Modify: `apps/web/src/components/WorkplaceVibeFlags.tsx` (2 occurrences of `h-[545px]`)
- Modify: `apps/web/src/app/companies/[slug]/page.tsx` (`CompanyDetailsBox` `h-[545px]`; `RatingNarrativeBox` container — add fixed height; illustration size)

**Interfaces:** none (visual only).

- [ ] **Step 1: Ensure both dev servers are running and pick measurement targets**

Confirm `http://localhost:3000` and `http://localhost:3001/v1` respond. Targets:
- **Vibe Flags worst case (single colour, 10 flags):** `test-perfect-score-company` (OFFICE, all 10 GREEN, one column). Also identify one MANUAL_LABOUR company whose flags are all one colour (the case in the user's screenshot) — query the DB / browse the site; if none exists, use the computed fallback in Step 3.
- **RatingNarrative 600-char case:** any company page; you'll inject a 600-char string via `evaluate_script` to measure.

- [ ] **Step 2: Measure the Vibe Flags content height**

Using chrome-devtools MCP, navigate to `http://localhost:3000/companies/test-perfect-score-company`, then `evaluate_script`:

```js
const box = document.querySelector('.h-\\[545px\\]'); // the Vibe Flags box
const inner = box.firstElementChild.parentElement; // the padded content
box.style.height = 'auto'; box.style.overflow = 'visible';
const h = box.getBoundingClientRect().height;
box.style.height = ''; box.style.overflow = '';
JSON.stringify({ trueContentHeight: h });
```

Record the number. Repeat for the MANUAL_LABOUR all-one-colour company if found. Repeat in **dark mode** (`emulate` or toggle the theme) — fonts can differ slightly.

- [ ] **Step 3: Compute the target height**

Take `ceil(max(measured) + 16)`. If a work-type had no live all-one-colour company, sanity-check against:
`10 * (2-line chip height) + 9 * 10px gap + header(≈28px) + mb-4(16px) + p-6(48px)`.
Measure a real 2-line chip height on the page (`document.querySelector('span.rounded-full').getBoundingClientRect().height` on a wrapping chip). Use whichever is larger. Call the result `H_FLAGS`.

- [ ] **Step 4: Measure the RatingNarrative box at 600 chars**

Navigate to any company page with the narrative box visible. `evaluate_script`:

```js
const p = document.querySelector('div.lg\\:max-w-2xl p') || (() => {
  const box = document.querySelector('div.lg\\:max-w-2xl');
  const el = document.createElement('p');
  el.className = 'text-center text-sm text-foreground sm:text-left';
  el.textContent = 'x'.repeat(600);
  box.appendChild(el);
  return el;
})();
p.textContent = 'A'.repeat(600);
const box = document.querySelector('div.lg\\:max-w-2xl');
JSON.stringify({ boxHeight: box.getBoundingClientRect().height });
```

Do this at the desktop `lg` width and again at a 390px mobile width (`resize_page`) — mobile stacks image above text so it's taller. Record the max, add 16px → `H_NARRATIVE`. Also try `h-64 w-64` for the illustration (`document.querySelector('div.lg\\:max-w-2xl img').className = ...`) and see whether it balances the box; note the size that looks right → `IMG_SIZE` (`h-64 w-64` is the starting proposal).

- [ ] **Step 5: Apply `H_FLAGS` to both flag-row boxes**

In `apps/web/src/components/WorkplaceVibeFlags.tsx`, replace both `h-[545px]` with `h-[<H_FLAGS>px]` (the load-failed box and the main box). Update the explanatory comment's measured numbers.

In `apps/web/src/app/companies/[slug]/page.tsx`, `CompanyDetailsBox`: replace `h-[545px]` with the same `h-[<H_FLAGS>px]`. Update its comment.

- [ ] **Step 6: Apply `H_NARRATIVE` + `IMG_SIZE` to `RatingNarrativeBox`**

In `RatingNarrativeBox`'s container `div`, add `h-[<H_NARRATIVE>px]` and keep the flex layout (add `justify-center` so short text still centres). Change both the `<img>` and the empty placeholder `<div>` from `h-56 w-56` to `IMG_SIZE` (e.g. `h-64 w-64`). Add a one-line comment noting the height was measured against a 600-char description at mobile width.

- [ ] **Step 7: Re-verify every state, both themes**

With chrome-devtools, load and eyeball (no console errors, no vertical scrollbar inside any of the three boxes, the two grid boxes bottom-aligned):
- `test-perfect-score-company` (10 green flags; 5.0 Exemplary; numbers-line narrative) — light + dark, desktop + 390px.
- a 1–2 review company (waiting line).
- a 0-review company (empty narrative slot at full height).
- a mid-rating multi-flag company (mixed green/red).

- [ ] **Step 8: Typecheck + build**

Run: `cd apps/web && pnpm exec tsc --noEmit && pnpm build`
Expected: clean.

- [ ] **Step 9: Commit & push**

```bash
git add apps/web/src/components/WorkplaceVibeFlags.tsx apps/web/src/app/companies/[slug]/page.tsx
git commit -m "$(cat <<'EOF'
web: fixed heights for the three company-page boxes (live-measured), bigger illustration

Vibe Flags + Company Details sized to the true single-column 10-flag worst
case; the rating-narrative box sized to a full 600-char summary at mobile
width and keeps that height at 0 reviews. Illustration enlarged.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

---

## Final verification (after all tasks)

- [ ] `cd packages/shared-types && pnpm exec tsc && pnpm exec jest` — clean.
- [ ] `cd apps/api && pnpm exec tsc --noEmit && pnpm build && pnpm exec jest` — clean; test count up by the new suites (`company-narrative.prompt`, `narrative-generator.service`, `company-narrative.service`), zero regressions.
- [ ] `cd apps/web && pnpm exec tsc --noEmit && pnpm build && pnpm exec jest` — clean; new suites `ratingNarrative`, `scoreBandColors` pass; `pnpm lint` at the same baseline problem count.
- [ ] `pnpm build` from the repo root (Turbo, all three packages) — clean.
- [ ] Live smoke with a **real** `ANTHROPIC_API_KEY` set in `apps/api/.env`: restart the API, load a company page with 3+ published reviews for its primary type, confirm a specific ≤600-char paragraph renders; reload and confirm the stored copy is served (add a temporary `console.log` in `NarrativeGeneratorService.generate` to prove it's called once, then remove it); check the `CompanyNarrative` row exists with the right `reviewCountAtGen` / `model` / `promptVersion`.
- [ ] Unset the key again (local default state) and confirm the numbers-line still renders.
- [ ] `git status` clean, everything pushed to `origin/main`.

---

## Self-Review

**Spec coverage:**
- AI description specific per company, from survey answers not flags, tone by rating, plain language, ≤600 — Tasks 4 (prompt/system), 6 (service), 9 (render). ✅
- Cost: lazy + throttled + stored + Haiku + key-gated — Tasks 5, 6. ✅
- Anonymity: aggregate-only input, ≥3-review floor, no `generalThoughts`/name — Tasks 4 (buildUserMessage only receives tallies), 6 (`getNarrative` selects only score fields + `surveyAnswers` for the tally, never passes name), 7 (REVIEW.md rule). ✅
- Degrades with no key — Tasks 5 (`available`), 6 (numbers line), 9 (waiting line / empty box). ✅
- Bands relabel + "everywhere" — Task 1 (single source `scoreBandLabel`), Task 8 (colour keys). ✅
- On-page overall rating — Task 9 Step 9. ✅
- 0-review fixed slot — Task 9 (always render) + Task 10 (`H_NARRATIVE`). ✅
- Fixed heights, measured, no scrollbars, illustration enlarged — Task 10. ✅
- Delete the flag paraphrase table — Task 9 Step 3. ✅
- `CompanyNarrative` model / `db push` — Task 3. ✅
- shared-types contract + rebuild — Task 2. ✅
- `.env.example`, `@anthropic-ai/sdk` — Task 5. ✅
- Exemplary illustration uses image 4 (no "coming soon") — Task 9 Step 3 (`imageNumber`). ✅

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to". `H_FLAGS`/`H_NARRATIVE`/`IMG_SIZE` in Task 10 are measured values the executor records in-step, not deferred work — the measurement procedure and the fallback computation are both spelled out. ✅

**Type consistency:**
- `getNarrative` returns `{ workplaceType, reviewCount, description }` — matches `companyNarrativeSchema` (Task 2) and the web `CompanyNarrative` usage (Task 9). ✅
- Prisma composite-unique accessor `companyId_workplaceType` (Task 6) matches `@@unique([companyId, workplaceType])` (Task 3). ✅
- `NarrativeGeneratorService` — `available` getter + `generate(userMessage): Promise<string>` used identically in Task 6 tests and impl. ✅
- `ratingImageSrc(score, workplaceType)` — Task 9 Step 3 defines it, Steps 6 uses it, test Step 1 pins it. ✅
- `NARRATIVE_MODEL` / `PROMPT_VERSION` — defined Task 4, imported by Tasks 5 and 6, compared in `isStale`. ✅

# Sector Benchmark Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enterprise owners order an async, k-anonymous PDF benchmark of their sector, fed by a new consent-gated salary/benefits step in the review form.

**Architecture:** Salary lives in its own `SalarySubmission` table (1:1 with Review). A `SectorBenchmarkService` in the rival-analytics module runs raw-SQL `COUNT(DISTINCT)` locks and `percentile_cont` bands; a DB-backed `BenchmarkReportJob` queue is drained by an in-process worker that renders the PDF with pdfkit and stores it; readiness surfaces as a derived notification.

**Tech Stack:** NestJS + Prisma (Postgres, `db push`), zod (shared-types), pdfkit, Next.js App Router, framer-motion, Jest.

**Spec:** `docs/superpowers/specs/2026-09-24-sector-benchmark-report-design.md`

## Global Constraints

- K-anonymity: fewer than 5 distinct users OR fewer than 3 distinct companies → `ForbiddenException("Insufficient Data to Ensure Anonymity")`.
- Salary output: only `bottom25`, `median`, `top75` integers, rounded to the nearest 500 TL, partitioned by `salaryYear`. No `AVG`, no `average`/`mean` keys.
- Consent flag name: `hasConsentedToCommercialBenchmarking`; unchecked by default; not `true` → salary + benefits dropped in the zod transform.
- Consent text (verbatim, `text-xs text-muted-foreground`): "Maaş verimin KVKK kapsamında tamamen anonimleştirilerek sektörel istatistik oluşturulması ve ticari amaçlarla işlenip üçüncü taraflara raporlanması için Açık Rızamı veriyorum."
- Access: approved `CompanyOwner` with `tier === "ENTERPRISE"`; max 3 requests per company per UTC day; PDF downloadable for 7 days.
- Easing for the generating-report progress: `cubic-bezier(0.25, 1, 0.5, 1)` (`SETTLE_EASE` in `apps/web/src/lib/motion/easings.ts`).
- PDF: white background, black text, Plus Jakarta Sans embedded from `apps/api/assets/fonts/`.
- Colours: site tokens only (Beaver Habitat), square corners — no slate-950.
- Rebuild shared-types (`pnpm exec tsc` in `packages/shared-types`) after every schema change. Stop the API dev server before `prisma db push` (Windows EPERM).
- Files containing non-ASCII text are edited via Node (LF-normalise, replace, restore CRLF) or the Edit tool — never hand-retyped through a Write fallback.

---

### Task 1: Shared types

**Files:**
- Create: `packages/shared-types/src/schemas/benchmark.ts`
- Modify: `packages/shared-types/src/schemas/review.ts` (create/update review inputs)
- Modify: `packages/shared-types/src/schemas/notification.ts`
- Modify: `packages/shared-types/src/index.ts` (export)

**Interfaces (produces):**
- `BENEFIT_KEYS` (tuple of the 10 keys), `benefitKeySchema`, `BenefitKey`, `BENEFIT_LABELS: Record<BenefitKey, string>`.
- `compensationInputSchema` → output type `CompensationInput = { monthlyNetSalary: number; benefits: BenefitKey[] } | null` (null = no consent / nothing to store). Input: `{ hasConsentedToCommercialBenchmarking: boolean; monthlyNetSalary?: string; benefits?: BenefitKey[] }`. Salary string → digits only → int in [1000, 10_000_000], else zod error "Enter your monthly net salary as a number.". Consent true with no salary and no benefits → null.
- `createReviewInputSchema.compensation: compensationInputSchema.optional()` (inherited by update).
- `sectorBenchmarkRequestSchema = z.object({ scope: z.enum(["TURKEY", "CITY"]) })`.
- `benchmarkReportJobSchema = { id, status: "QUEUED"|"RUNNING"|"READY"|"FAILED", sectorCategory, city: string|null, createdAt, completedAt: string|null, expiresAt: string|null, errorMessage: string|null }`.
- `SalaryBand = { salaryYear: number; bottom25: number; median: number; top75: number; respondentCount: number }`.
- `notificationTypeSchema` + `"BENCHMARK_REPORT_READY"`; `notificationSchema.href: z.string().optional()`.

- [ ] Write `benchmark.ts` tests-by-typecheck: add a Jest test in `apps/api/src/modules/reviews/__tests__/compensation-input.test.ts` asserting: consent false + salary "₺45.000" → `null`; consent true + "₺45.000" → `{ monthlyNetSalary: 45000, benefits: [] }`; consent true + "abc" → parse fails; consent true + benefits ["MEAL_CARD"] only → `{ monthlyNetSalary: … }` fails (salary required when benefits given? no — benefits alone allowed, salary null) → expect `{ monthlyNetSalary: null, benefits: ["MEAL_CARD"] }`. (Final shape: `monthlyNetSalary: number | null`.)
- [ ] Implement, rebuild shared-types, run the test, commit.

### Task 2: Prisma models

**Files:** Modify `apps/api/prisma/schema.prisma`.

```prisma
enum BenefitKey { MEAL_CARD TRANSPORT PRIVATE_HEALTH_INSURANCE BONUS PRIVATE_PENSION REMOTE_WORK_ALLOWANCE TRAINING_BUDGET COMPANY_CAR GYM PHONE  @@schema("public") }
enum BenchmarkReportStatus { QUEUED RUNNING READY FAILED  @@schema("public") }

model SalarySubmission {
  id String @id @default(uuid())
  reviewId String @unique
  review Review @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  userId String
  companyId String
  monthlyNetSalary Int?
  benefits BenefitKey[]
  salaryYear Int
  kvkkCommercialConsent Boolean
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([companyId, salaryYear])
  @@schema("public")
}

model BenchmarkReportJob {
  id String @id @default(uuid())
  requestedByUserId String
  companyId String
  company Company @relation(fields: [companyId], references: [id])
  sectorCategory String
  city String?
  status BenchmarkReportStatus @default(QUEUED)
  pdf Bytes?
  errorMessage String?
  createdAt DateTime @default(now())
  completedAt DateTime?
  expiresAt DateTime?
  @@index([status, createdAt])
  @@index([companyId, createdAt])
  @@schema("public")
}
```
Back-relations: `Review.salarySubmission SalarySubmission?`, `Company.benchmarkReportJobs BenchmarkReportJob[]`.

- [ ] Stop API dev server, `pnpm exec prisma db push`, restart, commit.

### Task 3: Reviews persist compensation

**Files:** Modify `apps/api/src/modules/reviews/reviews.service.ts`; test `apps/api/src/modules/reviews/__tests__/reviews.service.test.ts`.

- submit: inside the existing transaction, when `input.compensation` is non-null, `tx.salarySubmission.create({ data: { reviewId, userId, companyId, monthlyNetSalary, benefits, salaryYear: new Date().getUTCFullYear(), kvkkCommercialConsent: true } })`.
- update: when non-null, `tx.salarySubmission.upsert` keyed on `reviewId` (resetting `salaryYear` to the current UTC year); when null/undefined, untouched.
- Tests: consent-dropped input (compensation null) never calls `salarySubmission.create`; consenting input creates with `salaryYear` = current UTC year.

### Task 4: Sector aggregation + locks

**Files:** Create `apps/api/src/modules/rival-analytics/sector-benchmark.util.ts`, `sector-benchmark.service.ts`; modify `turnover-risk/turnover-prediction.service.ts` (+ `assessSectorRisk`), `rival-analytics.module.ts` (import TurnoverRiskModule); tests in `rival-analytics/__tests__/sector-benchmark.*.test.ts`.

**Interfaces (produces):**
- `MIN_DISTINCT_USERS = 5`, `MIN_DISTINCT_COMPANIES = 3`, `assertKAnonymity(counts: { distinctUsers: number; distinctCompanies: number }): void`.
- `roundToBand(n: number): number` (nearest 500).
- `topAgreedAndDisagreed(stats: SurveyQuestionStats[], limit = 10): { mostAgreed: QuestionRatio[]; mostDisagreed: QuestionRatio[] }`, `QuestionRatio = { text: string; category: string; agreePercent: number; disagreePercent: number }`.
- `SectorBenchmarkService.assertEligibleScope(scope: SectorScope): Promise<void>` and `.buildReportData(scope, requestingCompanyName): Promise<SectorBenchmarkReportData>`, `SectorScope = { sectorCategory: string; city: string | null }`.
- `SectorBenchmarkReportData = { sectorCategory; city; requestingCompanyName; generatedAt: Date; reviewCount; companyCount; salaryBands: SalaryBand[]; benefits: { benefit: BenefitKey; label: string; percent: number }[]; benefitRespondentCount: number; mostAgreed: QuestionRatio[]; mostDisagreed: QuestionRatio[]; turnover: SectorTurnoverRisk }`.
- `TurnoverPredictionService.assessSectorRisk(reviews: { workplaceType; surveyAnswers; publishedAt }[]): SectorTurnoverRisk` → `{ turnoverRiskPercentage: number; spikeDetected: boolean; sampleSizeWarning: boolean; explanation: string }`.

SQL (via `prisma.$queryRaw` tagged templates, parameters only):
- Scope counts: `SELECT COUNT(DISTINCT r."userId")::int AS "distinctUsers", COUNT(DISTINCT r."companyId")::int AS "distinctCompanies", COUNT(*)::int AS "reviewCount" FROM "public"."Review" r JOIN "public"."Company" c ON c.id = r."companyId" WHERE r.status = 'PUBLISHED' AND c."hiddenAt" IS NULL AND c.category = ${category} AND (${city}::text IS NULL OR c.city = ${city})`.
- Salary bands: same joins through `"SalarySubmission" s`, `WHERE s."monthlyNetSalary" IS NOT NULL`, `GROUP BY s."salaryYear"`, selecting distinct user/company counts and `percentile_cont(0.25|0.5|0.75) WITHIN GROUP (ORDER BY s."monthlyNetSalary")`. Years failing the 5/3 rule are dropped; survivors rounded with `roundToBand`.
- Benefits: per-row benefits of submitters in scope, only if the scope's benefit submitters pass 5/3.

Tests (brief acceptance):
- `assertKAnonymity({ distinctUsers: 4, distinctCompanies: 2 })` throws `ForbiddenException` with message "Insufficient Data to Ensure Anonymity"; service with mocked `$queryRaw` returning 4 users / 2 companies rejects `assertEligibleScope`.
- Service with mocked salary rows (with p25/p50/p75 values like 31234.5) returns bands rounded to 500; `JSON.stringify(result)` matches none of `/avg|average|mean/i`; each band has exactly the keys `salaryYear, bottom25, median, top75, respondentCount`.
- A year partition with 4 users is omitted.

### Task 5: PDF

**Files:** Create `apps/api/assets/fonts/PlusJakartaSans-{Regular,Bold}.ttf` + `OFL.txt`; modify `rival-analytics/pdf-report.builder.ts` (`buildSectorBenchmarkPdf(data: SectorBenchmarkReportData): Promise<Buffer>`, shared `registerBrandFonts(doc)` used by both builders); test in `__tests__/pdf-report.builder.test.ts`.

- Test: returns a Buffer starting `%PDF-` for full data and for data with zero salary bands.

### Task 6: Job queue, worker, endpoints

**Files:** Create `rival-analytics/benchmark-report.service.ts` (request/list/download), `benchmark-report.worker.ts` (OnModuleInit/OnModuleDestroy, 3 s poll), `benchmark-report.controller.ts`; register in module; tests `__tests__/benchmark-report.*.test.ts`.

**Interfaces (produces):**
- `BenchmarkReportService.request(userId, companyId, input: SectorBenchmarkRequest): Promise<BenchmarkReportJob>`; `.list(userId, companyId)`; `.download(userId, companyId, jobId): Promise<{ filename: string; pdf: Buffer }>`.
- `BenchmarkReportWorker.processNext(): Promise<boolean>` (true when it handled a job) — exposed for tests.
- Routes: `POST /my-companies/:companyId/sector-benchmark` (202), `GET /my-companies/:companyId/sector-benchmark`, `GET /my-companies/:companyId/sector-benchmark/:jobId/download` (`application/pdf`, `Content-Disposition: attachment`).

Tests: non-Enterprise → 403; 4th request in a day → 429 (`HttpException` 429); worker claims a QUEUED job, stores a `%PDF-` buffer and READY status with `expiresAt` 7 days out, and the data passed to the builder includes a non-empty `turnover.explanation`; failure path stores FAILED with message.

### Task 7: Notification

**Files:** Modify `notifications/notifications.service.ts` + its test.

- Add query `benchmarkReportJob.findMany({ where: { requestedByUserId: userId, status: "READY", expiresAt: { gt: now } }, select: { id, companyId, completedAt, company: { select: { name, slug } } } })` → `{ id: "benchmark-<id>", type: "BENCHMARK_REPORT_READY", companyName, companySlug, createdAt: completedAt, href: "/api/proxy/my-companies/<companyId>/sector-benchmark/<id>/download" }`.
- Test: a READY job yields that event with the href.

### Task 8: Review form step

**Files:** Modify `apps/web/src/components/RateButton.tsx`; create `apps/web/src/components/review/CompensationFields.tsx` + test.

- `CompensationFields({ value, onChange })` with `value: { consent: boolean; salary: string; benefits: BenefitKey[] }`: ₺ prefix, `inputMode="numeric"`, benefits as toggle chips, consent checkbox (unchecked default), consent text under the salary input.
- RateButton sends `compensation` only when consent is ticked and salary or benefits given.
- Test: consent box starts unchecked; consent text present; toggling a benefit calls onChange.

### Task 9: Dashboard bento + Sector Benchmark tile + notification menu

**Files:** Modify `components/owner/sections/PremiumFeaturesCategory.tsx`; create `components/owner/SectorBenchmarkTile.tsx` (+ test); modify `components/NotificationsMenu.tsx` for the new type/href.

- Tile: Enterprise gate, scope picker, Generate, job list (READY → download link, FAILED → message), polling every 3 s while any job is QUEUED/RUNNING, framer-motion progress bar with `SETTLE_EASE`.
- Test: renders upsell for non-Enterprise; READY job renders a download link to the proxy route.

### Task 10: End-to-end verification

- Seed script `apps/api/scripts/dev-seed-benchmark.ts` (dev only) that adds consenting salary rows to published reviews in one category so the lock passes; run the real endpoint → worker → download; confirm the PDF opens and the notification appears; run all tests, typecheck, lint; commit + push.

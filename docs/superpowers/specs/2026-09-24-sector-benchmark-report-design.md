# Sector Benchmark Report — Design

Status: approved by the user 2026-09-24 (in chat), built the same day.

## Goal

Enterprise-tier company owners can order a PDF "Sector Benchmark Report"
about their own company's sector (Company.category), for the whole of Turkey
or their own city. The report pools anonymous review data across every
company in that sector, plus a new, optional, consent-gated salary/benefits
question at the end of the review form.

## 1. Collecting salary and benefits (review form)

- New optional final-step block in `RateButton.tsx`:
  - Monthly net salary text field with a fixed `₺` prefix. Free text; the
    API strips everything except digits.
  - Benefits multi-select (fixed enum, see `BENEFIT_KEYS` in shared-types):
    MEAL_CARD, TRANSPORT, PRIVATE_HEALTH_INSURANCE, BONUS, PRIVATE_PENSION,
    REMOTE_WORK_ALLOWANCE, TRAINING_BUDGET, COMPANY_CAR, GYM, PHONE.
  - `hasConsentedToCommercialBenchmarking` checkbox, unchecked by default,
    with the brief's Turkish consent text in small muted type directly
    under the salary input.
- Payload: `compensation?: { hasConsentedToCommercialBenchmarking: boolean;
  monthlyNetSalary?: string; benefits?: BenefitKey[] }` on both create and
  update review inputs.
- API rule: if consent is not literally `true`, the salary and benefits are
  discarded by the zod schema's transform before the service ever sees them
  (the "gateway" drop). Nothing is written.
- Salary validation: after stripping non-digits, must be an integer between
  1,000 and 10,000,000 TL, otherwise 400.
- On edit: consent + data given → replaces the stored row. Omitted or no
  consent → the stored row is left alone. The stored salary is never sent
  back to any client (edit form starts empty).

## 2. Storage — separate table, not on Review

`SalarySubmission` (1:1 with Review, cascade delete): `reviewId @unique`,
`userId`, `companyId`, `monthlyNetSalary Int`, `benefits BenefitKey[]`,
`salaryYear Int` (defaults to the current UTC year at insert),
`kvkkCommercialConsent Boolean` (always true — rows only exist with
consent, kept as an explicit audit field), `createdAt`.

Deviation from the brief (which asked for columns on Review), approved by
the user: reviews are served publicly, so keeping salary on a different
table means no review query can ever accidentally carry a salary. The
brief's field names are kept: `salaryYear`, `kvkkCommercialConsent`,
`benefits`; the brief's `incomeBand` is the exact `monthlyNetSalary` (bands
are computed at read time, never stored per person).

Only salaries attached to PUBLISHED reviews count in reports.

## 3. Aggregation and privacy locks (`SectorBenchmarkService`)

Scope = PUBLISHED reviews of non-hidden companies whose `category` equals
the requester's company category, optionally also `city` equals theirs.

- **K-anonymity hard lock** (whole scope): `COUNT(DISTINCT userId) < 5` or
  `COUNT(DISTINCT companyId) < 3` → `403 "Insufficient Data to Ensure
  Anonymity"`. Checked before a job is queued and again inside the job.
- **Salary lock per year**: the same 5-user / 3-company rule is applied per
  `salaryYear` partition; failing years are omitted from the report.
- **Range-only output**: Postgres `percentile_cont(0.25 / 0.5 / 0.75)
  WITHIN GROUP (ORDER BY "monthlyNetSalary") ... GROUP BY "salaryYear"`,
  each rounded to the nearest 500 TL, returned as integers `bottom25`,
  `median`, `top75`. No AVG anywhere in the query or payload.
- **Benefits distribution**: % of consenting salary submitters (that pass
  the lock) who ticked each benefit.
- **Survey highlights**: every question answered in scope; "agree" means
  the answer matched the healthy-workplace answer — the same definition the
  public company pages and the rival-analytics PDF use — so agree % =
  healthy / (healthy + unhealthy + prefer-not). Top 10 by agree % ("Where
  the sector does best") and top 10 by disagree % ("Where the sector
  struggles"). A question is only listed when at least 5 people answered
  it, so no line can be one person's answer.
- **Turnover risk**: `TurnoverPredictionService.assessSectorRisk` pools the
  scope's reviews per workplaceType, runs the existing
  `computeTurnoverRisk`, and returns a review-count-weighted average
  percentage plus a plain-language explanation string.

## 4. Async generation

- `BenchmarkReportJob` table: `id`, `requestedByUserId`, `companyId`,
  `sectorCategory`, `city?`, `status QUEUED|RUNNING|READY|FAILED`,
  `pdf Bytes?`, `errorMessage?`, `createdAt`, `completedAt?`, `expiresAt?`.
- `POST /my-companies/:companyId/sector-benchmark` (approved owner,
  `CompanyOwner.tier === ENTERPRISE`, max 3 requests per company per UTC
  day, k-anonymity pre-check) → creates a QUEUED job and returns it (202).
- `BenchmarkReportWorker` (in-process, no Redis): polls every 3 s,
  atomically claims one QUEUED job (`updateMany where status=QUEUED`),
  builds the data + PDF, stores READY with a 7-day `expiresAt`, or FAILED.
  Jobs left RUNNING by a crashed process are re-queued at startup.
- `GET /my-companies/:companyId/sector-benchmark` → the company's jobs
  (no PDF bytes). `GET .../sector-benchmark/:jobId/download` → the PDF, only
  for approved owners of that company and only before `expiresAt`.
- Notification: derived (like every other notification) — a new
  `BENCHMARK_REPORT_READY` type from READY, unexpired jobs the user
  requested, with an `href` to the download route. The owner dashboard
  also polls the job list every 3 s while a job is QUEUED/RUNNING.

## 5. PDF

`buildSectorBenchmarkPdf` in `pdf-report.builder.ts`: white background,
black text, Plus Jakarta Sans embedded (TTF in
`apps/api/assets/fonts/`, OFL). Sections: header, scope + sample sizes,
salary bands per year, benefits distribution, top 10 agreed / disagreed,
turnover risk + explanation, anonymity note. The existing rival-analytics
PDF also switches to the embedded font (fixes Turkish glyphs).

## 6. Dashboard UI

Premium Features (paid view) becomes a bento grid of square, bordered
tiles in the site's Beaver Habitat tokens (per the user's brief-1 choice —
not slate-950). New "Sector Benchmark" tile (Enterprise only; upsell text
otherwise): scope picker (Turkey / own city), Generate button, job list
with download links, and a framer-motion progress bar using
`cubic-bezier(0.25, 1, 0.5, 1)` while a job is running.

## 7. Tests (brief acceptance criteria)

- 4 users from 2 companies → k-anonymity lock rejects (403).
- Aggregation payload contains only `bottom25/median/top75` bands, no
  average/mean keys and no raw salary values.
- Worker processes a job end-to-end: PDF buffer is a valid PDF, report data
  includes the risk explanation, and the READY job surfaces as a
  `BENCHMARK_REPORT_READY` notification.
- Consent false → salary dropped before the DB.

## Open item before launch

The consent text authorises commercial transfer to third parties. A lawyer
must approve it and the KVKK Aydınlatma Metni needs a matching paragraph
before real users see this step.

# Backend/Frontend Audit & Bug-Fix Sweep — 2026-09-21

Full audit of `apps/api` and `apps/web`, done with four parallel specialist passes (security, database/performance, API↔frontend contract alignment, async/payment-flow correctness), followed by direct fixes, then full verification (typecheck, lint, all 470+94 automated tests, a live reload of the running site).

**Bottom line: no findings required a judgment call from you. Everything below was either fixed outright, or explicitly held back with a note on why.** The one thing I did *not* do is the visual/typography redesign requested in the original brief (see "What I deliberately skipped" at the end) — that's a design decision, not a bug, and your project notes say you want to make that call yourself.

---

## 1. Security — what was found and patched

**PII vault isolation was quietly broken (Medium).** Your project rule is that only one file in the whole codebase (`pii-vault.service.ts`) is allowed to touch the encrypted identity-document table. Account deletion (`profile.service.ts`) had a direct line into that table instead of going through the proper gateway — not a data leak, but exactly the kind of thing that turns into one later, since it bypassed the one place PII writes are supposed to be logged. Fixed by adding a proper `deleteForUser` method to the vault service and routing the deletion through it.

**Login tokens didn't pin their signing algorithm (Low).** Your login tokens (JWTs) were being signed and checked without explicitly stating which cryptographic algorithm to use. The library's default is safe today, but "safe because of a default" is one library upgrade away from not being safe. Now explicitly pinned to HS256 on both signing and verification.

**Everything else checked out clean.** Full detail from the dedicated security pass: every one of your ~24 API controllers correctly requires login where it should; admin-only routes are all properly role-gated; the three payment-callback endpoints are correctly treated as untrustworthy until confirmed server-to-server with iyzico's own API; refresh tokens are properly invalidated on use (not just replaced); the "Market Investor API" key is hashed at rest and compared safely; cookies are HttpOnly/SameSite=Lax/Secure-in-production as they should be; IP addresses are always encrypted before storage; the account-recovery admin OTP flow has rate-limiting, timing-safe comparison, and doesn't leak whether an email is an admin account. This is a well-hardened auth layer — I didn't have to invent problems to report on it.

---

## 2. A critical bug: deleting your account could crash

This is the most serious thing the audit found, and it's a correctness bug, not a security one.

Every table in your database that references a user (their reviews, their job applications, their comments, etc.) has to say what happens to that row when the user is deleted. Most of yours do. **Eight of them didn't** — including job applications, company replies, and the newer Skills feature. That means if a real user with, say, an applied-to job posting or a saved skill tried to delete their account, the deletion would fail outright with a database error instead of completing.

This was invisible until now because the automated tests use fake/mocked databases that don't enforce this rule — only a real Postgres database does, so it would have surfaced the first time a real user with real activity hit "Delete my account."

**Fixed**: each of the eight relationships now has an explicit rule — either "this row disappears with the user" (a job application makes no sense without the applicant) or "this row survives, only the author link is cleared" (a company reply or job posting stays live even if the account that made it is gone — same pattern your Social posts already used). Pushed to the database and verified against the full test suite.

## 3. A critical bug: a paid report could be charged and never delivered

In **Rival Analytics** (the paid competitor-analysis report), the purchase was being marked "PAID" *before* the PDF was built and emailed. If report generation or email delivery failed for any reason — a temporary email outage, a PDF-building error, a missing contact email — the customer's money was already marked collected, and because of how the payment-confirmation logic worked, there was **no way to ever retry sending that report**. It would just silently vanish.

**Fixed**: the order is now build-and-send-first, mark-as-paid-second. If delivery fails, the purchase stays in a retryable state instead of a permanent dead end.

Related: the three places that handle a payment provider's callback (Plus subscriptions, job boosts, Rival Analytics) were all swallowing failures completely silently — not even a log line. If a real payment ever failed to process correctly, there would have been no trace of it anywhere to investigate a "customer says they paid but nothing happened" report. All three now log the failure.

## 4. Reliability: review publishing had a few "stuck forever" traps

A handful of related issues in how reviews get published and approved, all in the same family:

- Submitting or editing a review wrote two related database rows as two separate steps. If the app crashed between them, a review could end up flagged for admin review with no actual entry in the admin queue — invisible, permanently.
- Once a review is published, two follow-up steps run (recalculating the company's star rating, and purging the reviewer's ID document once their first review goes live). These weren't wrapped in error handling — a hiccup in either one would report the *entire* review submission as failed to the user, even though it had actually gone through, leading to a confusing "you already reviewed this company" error on retry.
- Worse, in the admin-approval path specifically, a failure in that same follow-up step could never be retried at all — the system doesn't allow re-approving something already marked approved.

**Fixed**: the two-step writes are now atomic (both happen or neither does), and the follow-up steps are logged rather than allowed to make a successful action look like a failure.

## 5. Performance

- Two admin/owner listing screens (a company's own job postings dashboard, and the job-posting admin queue) were doing one database write per row in a loop instead of one batched write — same fix already applied elsewhere in your codebase, just missed here.
- Added a couple of safety caps to endpoints with no upper limit on how many rows they could return (the public reviews list, and three IWT Social comment-listing endpoints) — a precaution against a popular company or post eventually growing large enough to slow its own page down. Not full pagination (that would need a frontend change too), just a ceiling.
- Trimmed a few database queries that were pulling entire related records (e.g. a company's full ~25 columns) when only one or two fields were ever actually used.
- Added two missing database indexes (on job-posting status, and on the review table's location fields) that a couple of existing queries were running without.

## 6. A real, pre-existing product bug I found and fixed along the way

While running your test suite as part of verification, I found that **job titles like "Backend Developer" or "Veri Bilimci" (Data Scientist) were being misclassified as office jobs instead of hybrid/remote** — every tech-sector job title was affected. The cause: the classifier's keyword list for tech roles was deliberately duplicated between the "Office" and "Hybrid/Remote" categories (intentionally, per the code's own comments), but the tie-breaking rule always favored "Office" first, so "Hybrid/Remote" could never actually win for a tech title. This affects the risk-score/work-type classification used across job postings and company categorization. Fixed by correcting the tie-break order; all previously-passing tests still pass, and the four tests that were failing because of this now pass too.

## 7. API/frontend contract check — clean

A dedicated pass cross-referenced every shared data shape between `apps/api` and `apps/web` (auth, reviews, companies, job postings, social, notifications, and more) field by field. **No mismatches found** — this codebase is unusually disciplined about keeping the two sides in sync. One real bug *was* found in this area via the test suite rather than the audit pass itself: the job-posting creation form was supposed to require picking a work type (the code comments said so), but the actual validation rule allowed it to be skipped — fixed, and a related "public job posting" schema was tightened to always return a real value instead of sometimes silently omitting a field.

---

## What I deliberately did NOT do, and why

- **The visual/typography redesign** requested in the original brief (custom fonts, sharp-border "bento grid" layouts, custom transition easing). This is a design decision — your project notes are explicit that you want to choose colors/fonts/branding yourself later, so I didn't impose new defaults while "fixing bugs." Happy to do a real design pass separately if you want one.
- **A job-posting payment edge case** (Medium severity): if a boost payment fails to initiate *after* the job posting itself was already created, the posting is left stuck in a "payment pending" state with no clean way for the owner to retry just the boost. The clean fix changes what the API returns on that error path, which is a small contract change worth you signing off on rather than me deciding unilaterally.
- **Full pagination** for the public reviews list and social comment feeds. I added safety caps (see Performance section) rather than real pagination, since real pagination would require a coordinated frontend change (a "load more" control) that's a feature, not a bug fix.

## Verification performed

- `tsc --noEmit` on both `apps/api` and `apps/web`: clean.
- `pnpm lint`: 0 errors (39 pre-existing warnings, all "avoid setState in an effect" style notices unrelated to this work, left alone).
- Full test suite (`pnpm test`): **all 564 tests passing** (94 in shared-types, 470 in the API — up from 3 and 13 failures respectively before this session's fixes).
- Database schema changes applied via `prisma db push` and confirmed against the live dev database.
- Both dev servers restarted clean; live-reloaded the running site in a browser with zero console errors.

---

Audit and alignment routine complete. Awaiting your review.

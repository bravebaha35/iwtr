# System Audit Report — I Worked There (iworkedthere.com)

**Date:** 2026-08-23
**Type:** Read-only diagnostic audit. No code was changed, no files were deleted, no UI was touched.
**Scope:** Backend (NestJS API), database schema (Prisma/Postgres), frontend (Next.js), and legal/security compliance (KVKK Law 6698, Law 5651).

---

## Update — first round of fixes applied

You said to start with whatever made sense first, so I picked off the cheap, high-value items. **Fixed and verified (tests written first, then passing; typecheck clean; confirmed live against the running dev server):**

- **#1 (OTP rate limit)** — both phone-OTP endpoints now capped at 5 requests/minute per IP, same pattern as the existing login/register limiter. Confirmed live: the 6th rapid request now gets HTTP 429.
- **#3 (password change doesn't revoke sessions)** — changing your password now kills every other live login session in the same step, mirroring the existing "freeze account" behavior.
- **#5 (double-submit race → raw error page)** — both the duplicate-review race and the duplicate-registration race now return the polite existing message instead of a raw database error, for real concurrent double-clicks.
- **#2 (disposable email)** — turned out not to be a bug at all; see the correction below. No code change needed.

Everything else in this report (items #4, #6-#12) is still open — untouched, exactly as found. Say the word for the next batch.

## The short version

The site's single most important promise — **a reviewer's real identity can never be traced by an employer, an admin, or the public** — is intact. I specifically re-checked every code path that can publish a review, and none of them leak the author's real identity. The national-ID purge rule (deleting the sensitive ID number once someone's first review goes live) also fires correctly everywhere it needs to.

Outside of that, I found **12 issues**, none of which are actively being exploited today, but three of them are the kind of thing that either costs real money or creates a security exposure if left alone, and they're cheap to fix. The rest are "will hurt later as you grow" performance issues, or small, low-risk frontend rough edges.

Both dev servers (web on :3000, API on :3001) are currently running and the site is open in a browser tab for you to look at.

---

## 🔴 High priority — fix soon

### 1. The phone-verification (OTP) endpoints have no spending limit — ✅ FIXED
**The bug:** Every other sensitive endpoint (login, registration, submitting a review) has a rate limit — a cap on how many times one IP address can hit it per minute. The two endpoints that send a real text message through Twilio (`POST /onboarding/phone/request-otp` and `POST /me/phone/request-otp`) don't have that cap. The only protection is a 60-second "wait before resending" rule per account.

**What a normal user experiences:** Nothing — this doesn't affect anyone using the site normally.

**What a malicious user could do:** Registration is allowed up to 10 times per minute per IP. Nothing stops someone from scripting "register a new throwaway account, immediately request an OTP" over and over. Each OTP is a real text message you pay Twilio for. This is a direct path to draining your SMS budget — potentially thousands of fake texts sent to real or fake phone numbers before anyone notices.

---

### 2. ~~Anyone can register with a throwaway/disposable email address~~ — correction: this is not actually a bug
**Update:** My first pass of this audit flagged this as missing. On closer inspection (and after confirming by hand against the running site), it isn't — registration is already locked to a short allowlist of four major consumer providers (Gmail, Hotmail, Outlook, Windows Live) at `packages/shared-types/src/schemas/auth.ts:19-25`, which is stronger than a disposable-email denylist: no Mailinator-style throwaway domain could ever get through it. My automated first-pass scan searched only the `apps/api` folder and missed this because the rule lives in the shared validation package instead. Flagging the correction explicitly rather than quietly dropping it, since I'd rather you catch me being wrong than trust the first draft blindly. No action needed here.

---

### 3. Changing your password doesn't log out other devices/sessions — ✅ FIXED
**The bug:** If a user changes their password (say, because they suspect someone else has access), the system does not invalidate that other person's existing login session. The equivalent "freeze my account" feature *does* do this correctly — password change just doesn't.

**What a normal user experiences:** They change their password thinking they've locked out an intruder, and haven't.

**What a malicious user could do:** If an attacker has already stolen a session (e.g. a leaked refresh token, a shared/public computer), changing the password does not evict them. They stay logged in and can keep acting as that user — reading their account, submitting reviews under their identity — until that session separately expires (up to 30 days).

---

## 🟠 Medium priority — worth scheduling

### 4. Two rapid "refresh my login" requests can create two valid sessions from one
**The bug:** The login-refresh mechanism reads "is this token still valid," then separately writes "mark it used" and "issue a new one" — as two separate steps rather than one atomic step. If two refresh requests land at almost the same instant (which happens with flaky mobile networks retrying a request), both can slip through the check before either one updates the record.

**What a normal user experiences:** Usually nothing; on a bad connection, could very rarely end up with an extra active session they didn't expect.

**What a malicious user could do:** This is a narrow window and hard to exploit deliberately, but in theory it weakens the "one old token can only ever be redeemed once" guarantee that's supposed to catch token theft. Low real-world risk, but it undermines a safety net that exists specifically to detect stolen sessions.

---

### 5. Double-clicking "submit review" or "register" at the exact same time shows a broken error page instead of a friendly message — ✅ FIXED
**The bug:** Both "submit a review" and "create an account" first check "does this already exist?" and then create the record — as two separate steps. If a user's device fires the request twice in the same instant (double-click, page refresh during submit, flaky network retry), both checks can pass before either write lands, and the second write crashes with a raw database error instead of the polite "you've already reviewed this company" / "that email is taken" message.

**What a normal user experiences:** A confusing generic error screen instead of a clear message, on an unlucky double-click. Rare but jarring, and looks unprofessional/broken.

**What a malicious user could do:** Not really an attack vector — this is a reliability/polish bug, not a security hole.

---

### 6. Several admin screens will get slower and slower as data grows
**The bug:** The admin moderation queue, the "pending company ownership claims" list, and the "messages from company owners" list all load *every single row* with no page limit and no database index on the columns they filter by (their status). Right now, with a small amount of data, this is invisible. As the platform grows — more reviews, more moderation activity, more owner claims — these screens will get progressively slower to load, and eventually could time out.

**What a normal user experiences:** No effect on regular site visitors — this only affects your internal admin dashboard.

**What a malicious user could do:** Not directly exploitable by an outside attacker, but it's a "your own team will feel this pain first" problem, and at scale a flood of spam submissions could be used to deliberately bloat these queues and slow down your moderators' tools.

---

### 7. One admin screen loads every verified employer's *decrypted* personal data in a single response, with no limit
**The bug:** The internal admin tool that lists verified employer profiles (`employer-profile` module) decrypts and returns *all* of them in one go — no pagination, no cap.

**What a normal user experiences:** No effect on regular users.

**What a malicious user could do:** This isn't reachable by outside users (it's an admin-only, authenticated endpoint) — but it means a single admin-panel request holds a large batch of decrypted personal data in memory and in the network response at once. As your employer count grows, that's a bigger blast radius if that specific admin account or that specific network request is ever compromised, and a bigger single point of exposure for accidental logging or a browser extension on the admin's machine. Worth tightening before you have hundreds of employer profiles, not after.

---

### 8. The just-redesigned owner dashboard cards briefly show blank/placeholder data before the real numbers load
**The bug:** In the recently redesigned "my companies" owner dashboard, each company card starts empty (blank name, blank city, blank contact email, etc.) and only fills in once its data finishes loading — with no spinner or "loading..." placeholder shown in between.

**What a normal user experiences:** A company owner opens their dashboard and, for a fraction of a second, sees empty/default-looking fields before the real data pops in. On a slow connection this could last long enough to look like the page is broken or like their data got wiped, right after you just redesigned this exact screen.

**What a malicious user could do:** Nothing — this is a pure polish/trust issue, not a security issue. But it's worth knowing about specifically because it's in the area you just shipped.

---

## 🟡 Low priority — cleanup, not urgent

### 9. A few admin-facing database lookups don't have the index they should
Same root cause as #6 but for smaller, lower-traffic tables (company-ownership status, unresolved owner-contact-messages). Will only matter at meaningfully larger scale.

### 10. A couple of "loop through a list and save each one individually" patterns in the backend
When someone completes onboarding with multiple past jobs, or deletes their account after reviewing several companies, the backend processes each item one at a time in a loop instead of in a single batch. At today's typical list sizes (a handful of past jobs) this is unnoticeable; it would only become a real slowdown if users routinely had dozens of employment history entries.

### 11. Company search is capped at 5,000 results as a temporary safety valve, not real pagination
This was clearly an intentional stopgap (there's a comment in the code saying so), not an oversight. Worth replacing with real pagination before your company directory (spanning all 81 provinces) gets large enough for 5,000 to matter, but it's not urgent today.

### 12. Several pages can try to update the screen after a user has already navigated away
This is a common, low-severity React pattern issue: pages like the reviews list, the "rate this company" button, the owner-claim panel, and a few admin pages don't cancel their in-flight data request if the user clicks away before it finishes. In practice this produces a harmless developer-console warning, not something a real visitor would ever notice, but it's worth cleaning up as part of general code hygiene.

---

## ✅ What I checked and found solid (good news, not just absence of bad news)

- **Anonymity guarantee**: I read every function that can publish a review (`reviews.service.ts`, `admin-queue.service.ts`) and the company-owner module end to end. None of them expose a reviewer's real identity, email, or account details to a company, an owner, or the public. The one deliberate exception (a self-chosen anonymous avatar + a permanent anonymous member number) is scoped exactly as documented and isn't a leak.
- **National ID (T.C. Kimlik No) purge policy**: confirmed it fires on all three paths that can make a review go live (auto-publish, edit-triggered re-publish, and manual admin approval).
- **No hardcoded secrets or API keys** found anywhere in the codebase.
- **Rate limiting exists and works correctly** on login, registration, and review submission — just missing on the two OTP endpoints (#1).
- **Frontend error handling is largely solid**: no unhandled crashes were found anywhere, and almost every data-loading screen correctly shows both a loading state and an error message when something fails — the owner-dashboard card in #8 was the one exception found.
- **The "share login across simultaneous requests" logic (single-flight refresh)** in the web app was specifically checked for the classic bug where multiple tabs fight over refreshing a login token — it's implemented correctly.

---

## Appendix — technical detail for engineering follow-up

*(File:line references, for whoever implements the fixes. Not needed for a business read of this report.)*

**Security / compliance**
- ~~OTP rate limiting~~ — **fixed**: `@Throttle({ default: { limit: 5, ttl: 60_000 } })` added to `onboarding.controller.ts` (`phone/request-otp`) and `profile.controller.ts` (`me/phone/request-otp`). Verified live with repeated curl calls (429 on the 6th).
- ~~Disposable email~~ — not a bug; allowlist already exists at `packages/shared-types/src/schemas/auth.ts:19-25` (`ALLOWED_REGISTRATION_EMAIL_DOMAINS`), enforced by the `ZodValidationPipe` before the controller body runs.
- ~~Password change session revocation~~ — **fixed**: `profile.service.ts` `changePassword` now wraps the password update in the same `$transaction` pattern as `freezeAccount`, revoking all live refresh tokens and writing a `PASSWORD_CHANGED` audit log entry. Test: `profile/__tests__/profile.service.test.ts`.
- ~~Concurrent double-submit/registration race~~ — **fixed**: both `reviews.service.ts` `submitReview` and `auth.service.ts` `registerWithEmail` now catch the Prisma `P2002` unique-constraint error from a true concurrent race and rethrow the same friendly `ConflictException` the upfront check already gives. Tests: `reviews/__tests__/reviews.service.test.ts`, `auth/__tests__/auth.service.test.ts`.
- Refresh-token race: `auth.service.ts:73-111`, specifically the non-transactional revoke-then-issue at lines 105-110.
- Traffic-log retention: `schema.prisma:483-486` already contains a code comment acknowledging no purge job exists yet pending a confirmed retention window (KVKK storage-limitation principle) — flagging here so it isn't lost, not a newly discovered gap.

**Database / performance**
- Missing indexes: `ModerationQueueItem.status`/`createdAt` (`schema.prisma:414-427`), `CompanyOwner.claimStatus` (`schema.prisma:304` area), `OwnerContactMessage.resolvedAt` (`schema.prisma:321` area).
- N+1 loops: `onboarding.service.ts:100-133` (`submitHistory`), `profile.service.ts:277-279` (`deleteAccount`).
- Check-then-create races: `reviews.service.ts:241-298` (`submitReview`), `auth.service.ts:28-43` (`registerWithEmail`).
- Unbounded lists: `admin-queue.service.ts:16-20`, `owner.service.ts:54-58,63-67,167-171,210-213`, `employer-profile.service.ts:159-162`, `reviews.service.ts:572-580`.

**Frontend**
- Missing loading state: `apps/web/src/app/my/companies/page.tsx:199-278` (`OwnedCompanyCard`).
- Missing unmount-guard on data fetches: `ReviewsList.tsx:43-51`, `RateButton.tsx:157-172`, `OwnerClaimPanel.tsx:21-33`, `SurveyHighlights.tsx:112-120`, `WorkplacePicker.tsx:87-94`, `my/companies/page.tsx:245-278,640-652`, `me/page.tsx:152-175`, `admin/moderation/page.tsx:22-34`, `admin/owner-claims/page.tsx:15-31`.
- Correct reference pattern to copy from: `WorkplaceBrowser.tsx:258-284`, `CompanySearch.tsx:17-46`.

---

**Next step:** items #1, #3, and #5 are fixed, tested, and confirmed live (see "Update" section at top). Say the word and I'll move on to the next batch (#4, #6-#12).

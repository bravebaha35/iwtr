# Review Policy — Anonymous Routing Logic

This repository has one non-negotiable architectural rule: **a reviewer's real
identity must never become reachable from anything a company, a company
owner, or the public can see.** See `CLAUDE.md` for the full product
rationale. This file exists to make sure that rule survives every future PR,
including ones written by an AI assistant that wasn't in the room when the
rule was decided.

## What counts as "anonymous routing logic"

Any change that touches how a `Review` (or a vote on one, or a moderation/
admin-queue item derived from one) is read, joined, serialized, or exposed.
Concretely, a PR is in scope if it touches any of:

- `apps/api/src/modules/reviews/**` (especially `reviews.service.ts`
  `listForCompany` and any other function that returns review data to a
  caller)
- `apps/api/src/modules/admin-queue/**`
- `apps/api/src/modules/moderation/**`
- `apps/api/src/modules/owner/**` (specifically anything that would let an
  owner query `Review`, `ReviewVote`, or `ModerationQueueItem` — today it
  does not, and it must not gain that ability)
- `apps/api/src/modules/pii-vault/**`, or any new module that imports
  `PrismaService` and calls `.piiVault.*` directly
- `apps/api/prisma/schema.prisma` — any change to the `Review`, `User`,
  `PiiVault`, `ReviewVote`, or `ModerationQueueItem` models, or to the
  `pii`/`public` schema split
- `packages/shared-types/src/schemas/review.ts`,
  `packages/shared-types/src/schemas/moderation.ts` — the public/admin DTO
  contracts
- `apps/web/src/components/ReviewsList.tsx` and any other frontend
  component that renders review data

## Severity

**Any PR touching the files/areas above is CRITICAL / HIGH SEVERITY by
default**, regardless of how small the diff looks. A one-line change here
(e.g. widening a Prisma `select`, adding a field to a response DTO, spreading
an object instead of listing fields) is exactly the kind of change that has
historically caused identity leaks in systems like this one. Do not downgrade
the severity because the diff is short.

## Specific red flags — block the PR if you see these

1. **`include: { user: true }` (or `user: { select: ... }`) added to any
   `prisma.review.*` / `prisma.moderationQueueItem.*` query.** The `Review`
   model has a real `user` relation (required for writes), so Prisma will
   happily let you pull back `User.email`/`city`/`district` on a read query.
   Nothing at the schema layer stops this — the manual field-by-field
   mapping in `reviews.service.ts` and `admin-queue.service.ts` is the *only*
   thing currently preventing it. Treat any new `include`/`select` that
   touches `user` on a review-shaped query as a leak until proven otherwise.
2. **`...review` / `...r` object spreads** replacing an explicit field list
   when building a response DTO. Explicit allowlists are the whole defense
   here; spreads silently forward whatever the query returned, including
   `userId`.
3. **`userId` (or any FK back to `User`) added to a shared-types schema**
   that is used for a public or owner-facing response
   (`publicReviewSchema`, `adminQueueItemSchema`, anything under
   `owner.ts`).
4. **A new relation from `PiiVault` to `User`** in `schema.prisma`, or any
   code outside `pii-vault/pii-vault.service.ts` that queries
   `prisma.piiVault`.
5. **A new decrypt path** in `pii-vault/crypto.util.ts` or elsewhere that
   returns plaintext PII to a caller. Today no such function exists on
   purpose.
6. **Any endpoint under `apps/api/src/modules/owner/`** gaining the ability
   to query `Review`, `ReviewVote`, or `ModerationQueueItem`, in any form —
   aggregated, filtered, or otherwise. The one-way owner→admin contact
   channel (`OwnerContactMessage`) is the only sanctioned owner-side data
   path near reviews, and it has no reply/reverse-lookup mechanism by
   design.
7. **Removal or weakening of `purgeTcKimlikNoIfPresent`** (currently called
   from `reviews.service.ts` on auto-publish and `admin-queue.service.ts` on
   manual approval) — every new code path that can move a `Review` to
   `PUBLISHED` must call this purge check.
8. **A new avatar/badge/display field on a review** that is derived from
   more than the review author's own aggregate review count — anything that
   could function as a fingerprint (exact join date, exact employment dates,
   free-text company name before backfill, etc.) narrows the anonymity set
   even without naming the user directly.

   **Explicit, approved exception (2026-08):** `PublicReview.avatarKey` /
   `avatarGradient` / `memberNumber` — the author's own self-chosen
   anonymous avatar, and their system-generated, immutable 11-digit member
   number (`User.memberNumber`, digits 1-9 only) — are a deliberate product
   decision, not an oversight, made knowing that the same avatar/number
   repeating across a reviewer's other reviews narrows the anonymity set
   somewhat (someone could notice "member 583947261" posted at two different
   companies, without learning who that is). `ReviewsService.listForCompany`
   sources all three from one batched `prisma.user.findMany({select: {id,
   avatarKey, avatarGradient, memberNumber}})` — never `include: { user:
   true }` on the review query itself. `memberNumber` is never user-settable
   (generated once at registration, not part of `UpdateProfileInput`) and is
   never paired with `displayName`/`email`/anything else. Do not let this
   exception justify adding any *other* User field (displayName, city, join
   date, etc.) to a review response without an equally explicit, separate
   decision — this is a narrow carve-out for exactly these three columns,
   not a precedent for review-author fields in general.

9. **AI company descriptions send only aggregate survey data off-platform.**
   `apps/api/src/modules/company-narrative` is the one code path that sends
   review-derived data to a third party (Anthropic). It may send ONLY: the
   per-question agree/disagree/prefer-not COUNTS, the five category averages,
   the overall rating, the published-review count, the work-type label, and the
   static survey question text —
   the same data class the flag engine already consumes. It must NEVER send
   individual review rows, raw `surveyAnswers`, `generalThoughts` free text,
   any reviewer identifier/avatar/username, employment dates, the answer key,
   the company name, or anything from `PiiVault`. A hard floor of 3 published
   reviews for the work-type gates every external call. A PR that widens this
   input set, lowers the floor, or adds a second off-platform sink of
   review data is critical-severity by default.

## What reviewers must do for an in-scope PR

- Read the full diff, not just the hunk — leaks in this codebase come from
  what a query *includes*, which is often outside the changed lines.
  `git diff -U20` or open the full file.
- Trace every new or changed field in a response DTO back to its source
  query and confirm it isn't sourced from `User` (except the viewer's own
  identity in viewer-scoped endpoints like `myVote`/`myEmploymentHistory`,
  which are fine).
- If the PR adds a new way for a `Review` to reach `PUBLISHED` status,
  confirm it calls the T.C. Kimlik No purge check.
- When in doubt, block and ask — do not approve on the assumption that "it's
  probably fine because the rest of the module is careful." Every review
  endpoint added so far has depended on hand-maintained field allowlists,
  not a structural guarantee, so carefulness does not automatically
  transfer to new code.

## Non-goals of this file

This file is scoped to the anonymity boundary only. It is not a general
code-review checklist — normal correctness/style/performance review still
applies via CodeRabbit (see `.coderabbit.yaml` if present) on top of this,
not instead of it.

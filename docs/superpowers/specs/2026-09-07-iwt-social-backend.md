# IWT Social — Backend Spec

## Source

Pasted by the user mid-session on 2026-09-07, as a "CONTEXT" + "STRICT RULES"
+ "YOUR TASK" prompt covering both frontend and backend work, with rule 1:
*"Dual-Mode Isolation: Execute the frontend and backend tasks sequentially."*
This spec covers only the "BACKEND OPERATIONS" half. The paired frontend
spec is `docs/superpowers/specs/2026-09-07-iwt-social-frontend.md`, and it
depends on this one — every endpoint/field the frontend reads is defined
here.

## Original ask (verbatim, backend half)

> CONTEXT: We are building a new "IWT Social" tab for iworkedthere.com. This
> is a dedicated social feed where verified employers can post photos and
> updates under their corporate identity, while employees can interact,
> comment, and like with 100% anonymity.
>
> STRICT RULES: Dual-Mode Isolation (execute sequentially). Design System:
> Plus Jakarta Sans, absolute Light/Dark parity (zinc-950 backgrounds,
> zinc-800 borders). Do not modify the existing "Hiring" page or the main
> "Home" rating feed.
>
> BACKEND OPERATIONS (Data & Storage)
> 1. **Media Storage Efficiency pipeline**: Create an interceptor for the
>    employer photo upload endpoint. Accept all standard image formats
>    (JPEG, PNG, HEIC). Immediately process and convert all uploads into
>    highly compressed WebP formats on the server before saving them to the
>    storage bucket. Ensure the quality threshold is lowered enough to be
>    cost-effective for mass storage without becoming illegible.
> 2. **Moderation Enforcement**: Route the employer's text from the "Tell us
>    what you think !" box through the existing profanity and PII
>    (Personally Identifiable Information) name-filtering utility before
>    saving it to the database.

## What research found before planning

Unlike the owner-dashboard task, this is genuinely net-new: **no Post,
Comment, Like, or Feed model exists anywhere in `schema.prisma`** (confirmed
by reading the full 967-line file). This plan requires real schema
additions and a `prisma db push` — the first schema change either of this
session's two feature plans has needed.

What *does* already exist and is directly reusable:

1. **Anonymity engine.** `User.reviewUsername` (schema.prisma) is a
   permanent, once-assigned handle set at onboarding
   (`OnboardingService.submitAvatar`) via
   `pickRandomDisplayUsername(workTypeFromAvatarKey(avatarKey))`
   (`apps/api/src/modules/reviews/randomized-identity.util.ts`). Reviews
   already show this instead of a real name; comments/likes reuse the exact
   same field rather than inventing a second identity system. Reviews also
   support a per-review *randomized* override (`isRandomizedIdentity` +
   `displayUsername`) — this spec does **not** add that opt-in to comments
   (out of scope; the task never asked for it, and adding it would be scope
   creep the user didn't request).

2. **Moderation.** `ModerationService.checkContent(texts: string[])`
   (`apps/api/src/modules/moderation/moderation.service.ts`) is already a
   plain `string[] → result` function with zero coupling to `Review` —
   directly callable on a post caption or a comment body with no adapter
   needed. This is exactly the "existing profanity and PII name-filtering
   utility" item 2 refers to.

3. **Owner-verification gate.** `OwnerService.requireApprovedOwnership`
   throws unless `CompanyOwner.claimStatus === "APPROVED"` for the calling
   user + company — every existing owner-mutation endpoint
   (`updateMyCompany`, `uploadLogo`, `uploadBanner`) calls it first. The new
   post-creation endpoint uses the identical check — this is what "verified
   employers" (from the CONTEXT paragraph) cashes out to concretely.

4. **Notifications have no table.** `NotificationsService.list(userId)`
   computes results live on each call from the caller's own `ReviewVote`/
   `CompanyReply`/`JobPosting` rows — no stored `Notification` model. This
   plan follows the same pattern rather than adding one: a company's
   post-like/comment notifications are derived from `SocialPostLike`/
   `SocialComment` rows joined against the owner's `CompanyOwner` rows, at
   read time.

5. **No image-processing library exists, and HEIC support is genuinely
   new work.** `apps/api/package.json` has only `image-size` (dimension
   *reading*, not decoding/compression) — no `sharp`, no HEIC library
   anywhere in the repo (confirmed by `git log -S`/dependency grep). The
   owner-dashboard backend plan (this same session,
   `docs/superpowers/plans/2026-09-07-owner-dashboard-backend.md`) adds
   `sharp` for banner resize/compression — that plan should land first so
   this one can depend on the same `sharp` dependency rather than adding it
   twice. **Decision — HEIC decoding:** `sharp`'s prebuilt binaries do not
   include HEIC/HEIF decoding by default (a well-known licensing
   restriction on the underlying `libheif`), so `sharp` alone cannot read a
   `.heic` upload. This plan adds `heic-convert` (pure-JS/WASM libheif
   build, no native-binary licensing issue, the standard Node solution for
   this exact gap) to decode HEIC → JPEG buffer, then hands that buffer to
   `sharp` for the same resize/compress-to-WebP step JPEG/PNG uploads go
   through directly. This is a genuinely new dependency the user should
   know about, even though it's an implementation detail I'm deciding
   myself per your standing instruction to make these calls.

6. **`multer`'s existing upload path uses memory storage** (buffer
   available directly in `file.buffer`, confirmed from `owner.controller.ts`'s
   `FileInterceptor` usage) — the new upload endpoint reuses this, so "create
   an interceptor" (item 1's wording) is satisfied by reusing
   `FileInterceptor("file")` the same way logo/banner uploads already do,
   not by writing a custom NestJS interceptor class from scratch.

## Decisions this spec is locking in (product-shape calls made without
asking, per your standing "make the call yourself" preference — flagged
here so they're visible and reversible)

- **Comment likes are out of scope.** The task says employees can "comment,
  and like" — read as two capabilities on a *post* (like a post, comment on
  a post), not "like a comment." No `CommentLike` model. If you actually
  want comment-level likes, say so and this gets added as a follow-up
  task — small addition, not a rearchitecture.
- **A comment that fails moderation is rejected outright (400), not queued
  for admin review.** The review pipeline has a whole `PENDING_ADMIN_REVIEW`
  state + `admin-queue` module; building an equivalent for social comments
  is real additional scope the task didn't ask for ("route through the
  existing... utility before saving" reads as a pass/fail gate, not a queue).
  Same for post captions.
- **Feed pagination is cursor-based**, matching how a scrolling feed with
  "inject an ad every 7th post" naturally works (the frontend needs to know
  how many real posts it has rendered so far, which a cursor-based, fixed
  page size makes straightforward — an offset/limit scheme would work too,
  but cursor avoids skipped/duplicated posts if new posts are created while
  someone is scrolling).
- **The feed's `q` company-name search is server-side**, a `WHERE company.name
  ILIKE` filter on the same feed-list query, not a client-side filter over
  an already-fetched page (the feed can span every company on the platform;
  filtering only the loaded page would silently miss most matches).

## Out of scope (explicit)

- No changes to the "Hiring" page (`JobsBrowser.tsx`) or the main "Home"
  rating feed (`WorkplaceBrowser.tsx`) — per the task's own rule 3. (The
  frontend plan reads score-band icon logic *from* `WorkplaceBrowser.tsx`
  for reuse elsewhere, but does not modify that file.)
- No `apps/web` changes in this plan — see the frontend spec/plan for those,
  gated to start only after this backend plan is reviewed and applied
  (mirrors the same sequencing this session already used for the owner
  dashboard, and matches this task's own "Dual-Mode Isolation" rule).

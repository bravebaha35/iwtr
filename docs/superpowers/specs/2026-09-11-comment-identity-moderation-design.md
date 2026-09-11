# IWT Social comment identity, thread lock, and moderation/reporting — design

Status: draft, pending user review
Supersedes: the "comment-as-company" sketch discussed earlier in the same session (folded in below)

## Goals

1. Let a comment be posted as one of several identities: an employee's normal
   anonymous handle, a fresh one-off anonymous handle, a company the
   commenter owns, or (per explicit product decision, see Decisions below)
   a company owner's real name.
2. Once someone has commented on a post, lock which identity they used for
   any further replies on that same post.
3. Redesign the comment composer UI: narrower input, circular avatar,
   1250-char cap, an identity toggle, a "..." menu (delete own / report
   others'), relative timestamps.
4. Add a report system for comments: 1-2 reports surface in the admin
   queue; 3+ reports also runs an automated content check and, if it
   trips, fast-tracks the comment into the same human-reviewed queue
   (not an instant, unreviewed delete — see Decisions).
5. Extend the moderation filter to catch real-name+title combinations and
   obfuscated Turkish profanity/phone numbers, without blocking ordinary
   words like "HR" or "CEO" on their own.

## Decisions made during brainstorming (binding — read before changing scope)

- **Owner identity toggle shows the owner's real, decrypted name**
  (`EmployerProfile.encFirstName`/`encLastName`), not the anonymous
  `reviewUsername`. This was flagged twice as a reversal of the
  anonymity guarantee and as the first public, non-PiiVault use of
  currently-encrypted legal-contact data — confirmed deliberate by the
  user both times. Do not "fix" this back to anonymous without asking
  first; it is intentional, not an oversight.
- **3+ reports do not auto-delete.** They fast-track the comment into
  `PENDING_ADMIN_REVIEW`-equivalent human review, pre-flagged with
  whatever the automated check found. A human always confirms before a
  comment disappears via the report path (author-initiated delete is
  unaffected — that already exists and needs no review).
- **The position/name filter flags name+title combinations, not bare
  keywords.** "the CEO announced layoffs" or "I wish HR handled this
  better" must NOT be flagged. "CEO Ahmet Yılmaz is..." should be.
- **Not "flawless."** No keyword/pattern filter can reliably detect an
  arbitrary real name with no name database to check against. This
  spec builds the strongest realistic heuristic (capitalized
  First+Last shape adjacent to a title/possessive pattern, obfuscation
  stripping, a maintained profanity list) and documents the limitation
  in code, the way `ModerationService`'s existing class comment already
  documents its own.
- **"Thread" = a post's flat comment list.** Comments have no reply/nesting
  structure today (confirmed absent from the schema) and this spec does
  not add one. "Lock identity for the thread" means: per (userId, postId)
  pair, once set, reused for every later comment that same user adds to
  that same post.
- **"Randomized Username" (employee's second toggle option) — my
  interpretation, called out for correction on read:** a one-off pick
  from the same anonymous-name pool used at onboarding
  (`ANONYMOUS_USERNAMES_BY_WORKPLACE_TYPE`), generated the first time a
  user chooses it on a given post and then locked (reused, not
  re-rolled) for that post same as any other identity choice — never
  written back to the user's permanent `reviewUsername`. If this isn't
  what you meant, say so before implementation starts.

## Data model changes (`apps/api/prisma/schema.prisma`)

```prisma
enum CommentIdentityMode {
  PERSONAL_CHOSEN   // their permanent reviewUsername
  PERSONAL_RANDOM   // one-off pool pick, locked per (user, post)
  COMPANY           // posting as an owned company
  OWNER_REAL_NAME   // posting as the company's real, verified owner name
}

model SocialComment {
  // ...existing fields unchanged...
  identityMode        CommentIdentityMode @default(PERSONAL_CHOSEN)
  // Only set when identityMode is COMPANY or OWNER_REAL_NAME.
  authorCompanyId     String?
  authorCompany       Company?            @relation(fields: [authorCompanyId], references: [id])
  // Only set when identityMode is PERSONAL_RANDOM — the locked one-off
  // handle/avatar for this (user, post) pair, so replies reuse it instead
  // of re-rolling.
  randomUsername       String?
  randomAvatarKey      String?
  randomAvatarGradient String?

  reports SocialCommentReport[]
}

// One row per (postId, userId) — the identity lock. Looked up before
// accepting a new comment; if present, the new comment's identityMode/
// authorCompanyId/random* fields must match it exactly (or the request
// is rejected) rather than silently overwritten.
model SocialCommentIdentityLock {
  id                   String              @id @default(uuid())
  postId               String
  post                 SocialPost          @relation(fields: [postId], references: [id], onDelete: Cascade)
  userId               String
  user                 User                @relation(fields: [userId], references: [id])
  identityMode         CommentIdentityMode
  authorCompanyId      String?
  randomUsername       String?
  randomAvatarKey      String?
  randomAvatarGradient String?
  createdAt            DateTime            @default(now())

  @@unique([postId, userId])
  @@schema("public")
}

model SocialCommentReport {
  id          String        @id @default(uuid())
  commentId   String
  comment     SocialComment @relation(fields: [commentId], references: [id], onDelete: Cascade)
  reporterId  String?
  reporter    User?         @relation(fields: [reporterId], references: [id], onDelete: SetNull)
  reason      String?
  createdAt   DateTime      @default(now())

  @@unique([commentId, reporterId])   // one report per user per comment
  @@index([commentId])
  @@schema("public")
}
```

`Company` and `User` both need the inverse relations added
(`authoredComments`, `commentIdentityLocks`, `commentReports`) — mechanical,
listed in the plan rather than spelled out here.

## Backend behavior (`apps/api/src/modules/social/`)

**Posting a comment** (`SocialService.addComment`):
1. Validate `body` length ≤ 1250 (shared-types schema `max(1250)`, replacing
   whatever the current cap is).
2. Run the moderation filter (see below); hard-reject on a match exactly
   like post captions already do via `ModerationService.checkContent`.
3. Look up `SocialCommentIdentityLock` for `(postId, userId)`.
   - No lock yet: this comment's `identityMode`/`authorCompanyId`/random*
     fields establish the lock (insert both rows in one transaction).
   - Lock exists: the request's identity fields must match it exactly, or
     `ForbiddenException` ("You already commented on this post as
     [X] — replies stay under that identity.").
4. If `identityMode` is `COMPANY` or `OWNER_REAL_NAME`: verify the caller
   has *approved* ownership of `authorCompanyId` (reuse the
   `hasApprovedOwner` check already used for banner-tier gating).
5. If `identityMode` is `PERSONAL_RANDOM` and no lock existed yet: generate
   the one-off username/avatar server-side (never trust a client-supplied
   random pick) from the same pool `OnboardingService` already draws from.

**Serialization** (`serializeComments`): resolve display name/avatar per
`identityMode` — `PERSONAL_CHOSEN` → `reviewUsername`/`avatarKey` (today's
behavior, unchanged); `PERSONAL_RANDOM` → the locked random fields;
`COMPANY` → live company name/logo (same as `SocialPost` already does);
`OWNER_REAL_NAME` → decrypt `EmployerProfile.encFirstName`/`encLastName`
live at read time (never cached/stored in plaintext on the comment row).

**Reporting** (new `SocialCommentReport` flow):
- `POST /social/comments/:id/report` — any authenticated member except the
  comment's own author; upserts by `(commentId, reporterId)` so repeat
  reports from the same person don't inflate the count.
- After insert, count reports for that comment:
  - 1-2: nothing further automated — visible via a new admin-queue list
    endpoint (`GET /admin/social/comments/reported`), sorted by report
    count.
  - 3+ (first time crossing the threshold only, not every report after):
    run the moderation filter against the comment body. If it matches
    anything, set a `flaggedForReview` marker (simplest: reuse
    `AdminQueue`'s existing pattern if it's comment-shaped, otherwise a
    boolean + `flagReason` column on `SocialCommentReport`'s parent
    comment — exact shape decided in the implementation plan) so the
    admin queue surfaces it as high-priority with the match reason shown.
    No deletion happens automatically.

**Moderation filter additions** (`apps/api/src/modules/moderation/`):
- Extend the existing profanity list with the supplied Turkish terms
  (`aptal`, `salak`, `orospu`, `piç`, `ibne`, `yavşak`, plus common
  leetspeak/spacing variants).
- Before matching: strip internal whitespace between single characters
  (`"o r o s p u"` → `"orospu"`) and normalize common substitutions
  (0→o, 1→i, 3→e, etc.) — applied to a *comparison copy* of the text,
  never altering what's actually stored/displayed.
- Phone-number obfuscation: after whitespace-stripping, run the existing
  (or a new) digit-sequence check for 10-11 consecutive digits.
- Name+title heuristic: match a title word (CEO, HR, Genel Müdür, etc. —
  list TBD in the plan) only when immediately adjacent to a
  capitalized-word pair that looks like a First+Last name shape,
  per the "combinations, not bare keywords" decision above.

## Frontend (`apps/web/src/components/social/`)

- **Composer**: narrow the input, circular avatar aligned over the
  outline's edge, 1250-char counter, natural text wrap (`textarea` with
  `resize-none` + auto-grow, not a single-line input).
- **Identity toggle**: a small dual-arrow icon left-below the avatar,
  only rendered for users who have ≥1 approved-owned company (matches
  the "Comment as:" picker from the earlier design) or who want the
  personal-random option; cycles through the identities available to
  that user and updates the avatar/label live. Once a lock exists for
  this post (returned alongside the comment list / post detail), the
  toggle is replaced by a static label — no further switching, matching
  the backend's rejection of a mismatched identity.
- **"..." menu**: per comment, "Delete" when `comment.authorUserId` (or
  resolved identity) belongs to the viewer, otherwise "Report" — calls
  the existing delete endpoint or the new report endpoint respectively.
- **Timestamps**: reuse `shortRelativeTime` (`components/social/socialTime.ts`)
  — already exists, already club-tested this session for hydration safety
  (client-fetched data only, never SSR'd).

## Testing

- Backend: identity-lock enforcement (matching vs. mismatched follow-up
  comment), approved-ownership check on `COMPANY`/`OWNER_REAL_NAME`,
  moderation filter unit tests (obfuscated profanity, phone numbers,
  name+title combos, and explicit *non-matches* for bare "HR"/"CEO"
  sentences), report threshold behavior (1-2 vs. 3+ paths).
- Frontend: composer char-limit enforcement, identity toggle only shown
  to eligible users, locked-identity static state after a post's first
  comment, delete/report menu gating by ownership.

## Explicitly out of scope

- Nested reply-threading (not requested once "thread" was clarified to
  mean "a post's comment list").
- Any change to how `SocialPost` itself is authored (already
  company-only, untouched).
- The earlier-session rating-restriction / profile-username-restriction
  features — separate, independent change, not bundled into this spec.

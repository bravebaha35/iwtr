# Reviewer ↔ Company Messaging — Design

Date: 2026-09-25
Status: design approved in conversation (questions answered 2026-09-24, "go ahead" 2026-09-25); awaiting written-spec review

## Goal

Once a company has publicly replied to a review, the person who wrote that review can open a private
conversation with the company, without ever revealing who they are. Today the only channel is the
company's one public reply, so a reviewer can't follow up and a company can't learn more about a
problem it wants to fix.

Success means:

- a reviewer can start one conversation per replied-to review, and only that reviewer can;
- the company can never start a conversation, and can only write after the reviewer has written first;
- the company only ever sees the name already shown on the public review — no account, email, exact
  times, or anything else that could identify the reviewer;
- either side can end the conversation permanently with one click;
- every message goes through the same content check as reviews, and a flagged message is blocked
  with a request to rephrase.

## Decisions (from the user, 2026-09-24)

1. **Who can start:** only the author of that review, and only on a review that has a `CompanyReply`.
2. **Shape:** the reviewer sends one opening message. Once the company answers, it becomes a normal
   back-and-forth conversation. Until the company answers, the reviewer can't send a second message.
3. **Ending:** both sides get an "End conversation" button. Ending takes effect immediately and is
   permanent; the conversation can't be reopened and no new conversation can be started for that review.
4. **Moderation:** every message runs through `ModerationService.checkContent`. A message that
   violates it is **not saved**; the sender sees the reason and is asked to rephrase (no admin queue).
5. **Where the company reads them:** a new "Messages" category in the owner dashboard
   (`/my/companies`, `OwnerDashboardSidePanel`).
6. **Where the reviewer reads them:** a new "Messages" tab on My Profile (`/me`).
7. **Anonymity:** the reviewer is shown to the company only by the review's public display name.

## Assumptions (not explicitly decided — flag if wrong)

- Available to every approved owner, including the Free tier (not a paid feature).
- An ended conversation stays visible to both sides as read-only history.
- Any approved owner of the company can read and answer; company messages are shown as coming from the
  company, never from an individual owner account (same rule as `CompanyReply`).
- No admin inbox in this version. "End conversation" is the anti-abuse tool. Rows remain in the
  database for audit.
- Message length: 1–2000 characters.

## Data model (`apps/api/prisma/schema.prisma`, `public` schema)

```prisma
enum ConversationSide {
  REVIEWER
  COMPANY
  @@schema("public")
}

model ReviewConversation {
  id             String            @id @default(uuid())
  reviewId       String            @unique           // one conversation per review, ever
  review         Review            @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  companyId      String                              // denormalized for the owner inbox query
  company        Company           @relation(fields: [companyId], references: [id])
  reviewerUserId String                              // = Review.userId; never sent to the company
  reviewer       User              @relation(fields: [reviewerUserId], references: [id])
  endedAt        DateTime?
  endedBy        ConversationSide?
  reviewerLastReadSeq Int          @default(0)
  companyLastReadSeq  Int          @default(0)
  createdAt      DateTime          @default(dbgenerated("date_trunc('day', (now() AT TIME ZONE 'UTC'))"))
  messages       ReviewConversationMessage[]

  @@index([companyId])
  @@index([reviewerUserId])
  @@schema("public")
}

model ReviewConversationMessage {
  id             String             @id @default(uuid())
  seq            Int                @default(autoincrement())   // ordering + unread tracking
  conversationId String
  conversation   ReviewConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  side           ConversationSide
  authorUserId   String?            // audit only, never returned to the other side
  authorUser     User?              @relation(fields: [authorUserId], references: [id], onDelete: SetNull)
  content        String
  createdAt      DateTime           @default(dbgenerated("date_trunc('day', (now() AT TIME ZONE 'UTC'))"))

  @@index([conversationId, seq])
  @@schema("public")
}
```

**Day-precision timestamps.** The same rule as `Review.createdAt`: an exact send time is a
re-identification risk, because an employer could match "10:14 on Tuesday" against who was at their
desk. Timestamps are cut to the UTC day in the database default, so no code path can store more.
Ordering and unread state use `seq` (a global auto-increment), never time.

A partial unique index is not needed: `reviewId @unique` already means "one conversation per review,
ever", which also enforces "an ended conversation can't be reopened or replaced".

## API — new module `apps/api/src/modules/messaging/`

`messaging.controller.ts`, `messaging.service.ts`, `messaging.module.ts`. It imports `ModerationModule`.
The approved-owner check is duplicated as a small private method, as `reviews.service.ts` does, so this
module doesn't depend on the owner module. All routes use `JwtAuthGuard`. Bodies are validated with
`ZodValidationPipe(schema, { strict: true })` on the specific `@Body()` parameter.

**Side resolution.** For every conversation-level call, the server decides which side the caller is on:

- `REVIEWER` if `conversation.reviewerUserId === user.id`;
- `COMPANY` if the caller has an `APPROVED` `CompanyOwner` row for `conversation.companyId`;
- otherwise `404` (not `403`, so outsiders can't probe whether a conversation exists).

If a user is both (they own the company *and* wrote the review), the reviewer side wins. Owners can't
rate their own company today, so this is only a safety net.

| Method + path | Who | What |
|---|---|---|
| `POST /reviews/:reviewId/conversation` `{ content }` | review author | Starts a conversation with its first message. `404` unless the review exists, is `PUBLISHED`, belongs to the caller and has a `CompanyReply`. `409` if a conversation already exists for this review (including an ended one). |
| `GET /me/conversations` | any member | The caller's conversations as reviewer: summary list. |
| `GET /owner/companies/:companyId/conversations` | approved owner | That company's conversations: summary list. `403` if not an approved owner. |
| `GET /conversations/:id` | either side | Full thread. |
| `POST /conversations/:id/messages` `{ content }` | either side | Adds a message (see rules). |
| `POST /conversations/:id/end` | either side | Sets `endedAt`/`endedBy`. Ending an already-ended conversation does nothing. |
| `POST /conversations/:id/read` | either side | Sets the caller side's `lastReadSeq` to the latest message's `seq`. |

**Sending rules** (`POST /conversations/:id/messages`), checked in this order:

1. Conversation ended → `409 "This conversation has ended."`
2. Side `REVIEWER` and the company has not sent any message yet → `409 "Wait for the company to answer
   before sending another message."`
3. Side `COMPANY`: always allowed if not ended. A conversation only exists because the reviewer wrote
   first, so the company can never initiate.
4. `checkContent([content])` violates → `400` with the violation types and the message "Your message
   couldn't be sent: … Please remove any names, contact details or offensive words and try again."
   Nothing is saved. The same check applies to the opening message in
   `POST /reviews/:reviewId/conversation`, and to both sides with no skipped categories.
5. Save the message, then set the sender side's `lastReadSeq` to the new `seq`, both in one transaction.

**Response shapes** (new `packages/shared-types/src/schemas/messaging.ts`):

- `ConversationSummary`: `id`, `reviewId`, `counterpartName`, `companySlug` (reviewer view only),
  `lastMessagePreview` (first 120 chars), `lastMessageDay`, `unread` (boolean), `ended`,
  `endedBy` (`"YOU" | "THEM" | null`).
  - The counterpart name for the **company** view is the review's public display name
    (`displayUsername` when `isRandomizedIdentity`, otherwise the reviewer's `reviewUsername`), resolved
    by the same rule `ReviewsService.listForCompany` uses. Pull that rule into a shared helper so the
    two can't drift apart.
  - The counterpart name for the **reviewer** view is the company name.
- `ConversationThread`: the summary fields, plus the review's company name and a short excerpt of the
  review's `generalThoughts` for context, plus `messages[]` of `{ id, fromMe: boolean, day, content }`,
  plus `canSend: boolean` and `cannotSendReason` (`"ENDED" | "AWAITING_COMPANY" | null`).
- No response ever includes `reviewerUserId`, `authorUserId`, email, avatar or exact timestamps.

## Notifications

`NotificationsService.list` derives notifications from existing tables and stores none. Add two derived
types to `NotificationType`:

- `CONVERSATION_MESSAGE_FROM_COMPANY`: for the reviewer, from company-side messages in their
  conversations with `seq > reviewerLastReadSeq`. Text: "{Company} sent you a message." Links to
  `/me?tab=messages&c={id}`.
- `CONVERSATION_MESSAGE_FROM_REVIEWER`: for owners, from reviewer-side messages in conversations of
  companies they own (approved) with `seq > companyLastReadSeq`. Text: "New message about a review of
  {Company}." Links to `/my/companies?category=messages&c={id}`.

"Conversation ended" gets no notification. The other side sees it the next time they open the thread.

## Web (`apps/web`)

- **Start button:** `app/me/reviews/page.tsx`, inside the existing "Response from {company}" box. A
  "Message {company}" button opens an inline composer that posts to
  `POST /reviews/:id/conversation`. If a conversation already exists, the button becomes
  "Open conversation" and links to the Messages tab. Next to the button, one line explains: "Your
  name and account stay hidden. {Company} only sees '{review display name}'."
- **Reviewer inbox:** new `messages` tab in `/me` (`TABS` in `app/me/page.tsx`), rendered by a new
  `components/messaging/ConversationInbox.tsx` (list on the left, thread on the right, stacked on
  mobile). It honours `?tab=messages&c=` like the existing `?tab=cv` deep link.
- **Owner inbox:** new `"messages"` category in `OwnerDashboardSidePanel` ("Messages"), rendered for the
  selected company with the same `ConversationInbox` component in company mode. It honours
  `?category=messages&c=`.
- **Thread view:** bubbles aligned by `fromMe`, a day label per day group, and a composer that is
  disabled with a reason when `canSend` is false. "End conversation" sits behind a confirm dialog
  ("You won't be able to send or receive messages here again"). A moderation `400` keeps the draft and
  shows the reason inline.
- Opening a thread calls `POST /conversations/:id/read`.
- All calls go through `apiGet`/`apiPost` (the proxy). No polling: the thread refreshes on open and
  after each send.
- Styling follows the current Beaver Habitat tokens and square-corner conventions, with no new palette.

## Error handling summary

| Situation | Result |
|---|---|
| Review not published / not yours / no company reply | `404` |
| Conversation already exists for the review | `409` (UI links to the existing one) |
| Outsider requests a conversation | `404` |
| Non-owner requests a company inbox | `403` |
| Send after end | `409` |
| Reviewer sends a second message before any company answer | `409` |
| Content check violation | `400` with reason, nothing saved |
| Owner's claim revoked later | loses access on the next call (checked on every request) |

## Testing

- **API unit tests** (`apps/api/src/modules/messaging/__tests__/messaging.service.test.ts`, with Prisma
  mocked as in `reviews.service.test.ts`). Cover:
  - start allowed and denied cases (not the author, not published, no reply, duplicate);
  - side resolution, including outsider → `404`;
  - the reviewer's second message before a company answer → `409`;
  - the company answering, then free back-and-forth;
  - send after end → `409`;
  - a content violation saves nothing;
  - the company view never contains `reviewerUserId`/`authorUserId` and uses the display name
    (including the randomized-identity case);
  - unread flag and read marking.
- **Endpoint security test**, modelled on `review-endpoint-security.test.ts`: strict body rejects extra
  fields, and every route requires auth.
- **Manual browser check** with dev fast-logins. A member with a replied-to review starts a
  conversation. The owner (Demo Finans Holding) sees it, answers and ends it. Both inboxes show the
  right state, and both notifications appear.

## Out of scope

- Admin reading or moderation queue for messages.
- Attachments, editing or deleting messages, typing indicators, real-time push or polling.
- Messaging on reviews without a company reply, and company-initiated contact of any kind.
- Email notifications.

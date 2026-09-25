# Reviewer ↔ Company Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the author of a review that a company has publicly replied to open one private, anonymous,
moderated, endable conversation with that company.

**Architecture:** Two new Prisma models (`ReviewConversation`, `ReviewConversationMessage`) with
day-precision timestamps and a global `seq` for ordering and unread tracking. A new self-contained Nest
module `messaging/` resolves the caller's side (REVIEWER / COMPANY) on every request and never returns
reviewer identity. Two derived notification types are added. The web app gets one reusable
`ConversationInbox` component, mounted in the `/me` "Messages" tab and in a new owner-dashboard
"Messages" category, plus a start button on `/me/reviews`.

**Tech Stack:** NestJS 10, Prisma 5 (multiSchema, `db push`), zod (shared-types), Jest + ts-jest,
Next.js App Router, Tailwind.

**Spec:** `docs/superpowers/specs/2026-09-25-reviewer-company-messaging-design.md`

## Global Constraints

- Message content: 1–2000 characters. Validated by zod, with `ZodValidationPipe(schema, { strict: true })`
  scoped to `@Body()`.
- Timestamps are day-precision via the DB default `date_trunc('day', (now() AT TIME ZONE 'UTC'))`. Order
  only by `seq`.
- No response ever contains `reviewerUserId`, `authorUserId`, email, avatar, or an exact timestamp.
- Company-side counterpart name = the review's public display name (`displayUsername` if
  `isRandomizedIdentity`, else the author's `reviewUsername`).
- A moderation violation saves nothing and returns `400` with `violationTypes`.
- Outsider access to a conversation → `404`. A non-owner asking for a company inbox → `403`.
- After a schema push, rerun `pnpm exec ts-node scripts/setup-db-roles.ts` so `iwtr_app` gets grants on
  the new tables.
- Rebuild `packages/shared-types` (`pnpm exec tsc`) after editing it.

## Review Focus

- Reviewer is also an approved owner of the company → must be treated as REVIEWER (test in Task 2).
- Randomized-identity review → the company sees `displayUsername`, not the real `reviewUsername` (test in Task 2).
- Two tabs starting a conversation at once → the second gets `409`, not `500` (P2002 handled; test in Task 2).
- Owner claim revoked after the conversation started → `404` on the thread (test in Task 2).
- Marking read on an empty or ended thread must not throw (test in Task 3).

---

### Task 1: Shared types + Prisma schema

**Files:**
- Create: `packages/shared-types/src/schemas/messaging.ts`
- Modify: `packages/shared-types/src/index.ts` (add export)
- Modify: `packages/shared-types/src/schemas/notification.ts` (2 new enum values)
- Modify: `apps/api/prisma/schema.prisma` (enum + 2 models + back-relations on Review, Company, User)
- Create: `apps/api/src/modules/reviews/display-name.util.ts` (shared display-name rule)

**Interfaces — Produces:**
- `sendMessageInputSchema` / `SendMessageInput` `{ content: string }`
- `ConversationSummary`, `ConversationThread`, `ConversationMessage`, `CannotSendReason`
- `publicReviewerName(review: { isRandomizedIdentity: boolean; displayUsername: string | null }, author: { reviewUsername: string | null } | null): string | null`

- [ ] **Step 1: Write `messaging.ts`**

```ts
import { z } from "zod";

export const sendMessageInputSchema = z.object({ content: z.string().trim().min(1).max(2000) });
export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;

export const cannotSendReasonSchema = z.enum(["ENDED", "AWAITING_COMPANY"]);
export type CannotSendReason = z.infer<typeof cannotSendReasonSchema>;

export const conversationSummarySchema = z.object({
  id: z.string().uuid(),
  reviewId: z.string().uuid(),
  counterpartName: z.string(),
  companySlug: z.string().nullable(),
  lastMessagePreview: z.string(),
  lastMessageDay: z.string(), // YYYY-MM-DD
  unread: z.boolean(),
  ended: z.boolean(),
  endedBy: z.enum(["YOU", "THEM"]).nullable(),
});
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;

export const conversationMessageSchema = z.object({
  id: z.string().uuid(),
  fromMe: z.boolean(),
  day: z.string(),
  content: z.string(),
});
export type ConversationMessage = z.infer<typeof conversationMessageSchema>;

export const conversationThreadSchema = conversationSummarySchema.extend({
  companyName: z.string(),
  reviewExcerpt: z.string().nullable(),
  messages: z.array(conversationMessageSchema),
  canSend: z.boolean(),
  cannotSendReason: cannotSendReasonSchema.nullable(),
});
export type ConversationThread = z.infer<typeof conversationThreadSchema>;
```

- [ ] **Step 2:** Add `export * from "./schemas/messaging";` to `index.ts`. Add
  `"CONVERSATION_MESSAGE_FROM_COMPANY"` and `"CONVERSATION_MESSAGE_FROM_REVIEWER"` to
  `notificationTypeSchema`.
- [ ] **Step 3:** Add the Prisma enum and models exactly as in the spec's Data model section. Add
  `conversation ReviewConversation?` on `Review`, `reviewConversations ReviewConversation[]` on
  `Company`, and `reviewConversations ReviewConversation[] @relation(...)` plus
  `conversationMessages ReviewConversationMessage[]` on `User`.
- [ ] **Step 4:** Create `display-name.util.ts` with `publicReviewerName` and use it in
  `ReviewsService.listForCompany` (line ~900) instead of the inline ternary.
- [ ] **Step 5:** Stop the API dev server. Run `pnpm exec tsc` in shared-types, then
  `pnpm exec prisma db push` and `pnpm exec ts-node scripts/setup-db-roles.ts` in apps/api. Expected: no
  errors.
- [ ] **Step 6:** Run `pnpm exec tsc --noEmit -p .` in apps/api and `pnpm test -- reviews` → PASS.
- [ ] **Step 7:** Commit `feat: messaging schema and shared types`.

### Task 2: MessagingService — start, side resolution, read thread

**Files:**
- Create: `apps/api/src/modules/messaging/messaging.service.ts`
- Test: `apps/api/src/modules/messaging/__tests__/messaging.service.test.ts`

**Interfaces — Produces:**
- `startConversation(userId, reviewId, input): Promise<ConversationThread>`
- `getThread(userId, conversationId): Promise<ConversationThread>`
- `listMine(userId): Promise<ConversationSummary[]>`
- `listForCompany(userId, companyId): Promise<ConversationSummary[]>`
- private `resolveSide(userId, conversation): Promise<"REVIEWER" | "COMPANY">` (throws NotFound)

- [ ] **Step 1: Failing tests.** Cover:
  - start → `404` for not the author, not published, or no reply;
  - start → `409` on P2002;
  - start → `400` on a moderation hit, and `create` is not called;
  - `getThread` by an outsider → `404`;
  - by an owner whose claim is revoked → `404`;
  - an author who is also an owner → reviewer view;
  - the company view uses `displayUsername` for a randomized review and has no `userId` keys anywhere
    in the JSON (`JSON.stringify(result)` does not contain the reviewer id).
- [ ] **Step 2:** Run `pnpm test -- messaging` → FAIL (module missing).
- [ ] **Step 3:** Implement. The thread query includes
  `review: { select: { userId, isRandomizedIdentity, displayUsername, generalThoughts, user: { select: { reviewUsername } } } }`,
  `company: { select: { name, slug } }` and `messages: { orderBy: { seq: "asc" } }`. Map it through a
  pure `toThread(conv, side)` function. Create the conversation and first message in one nested create
  inside `$transaction`, then set `reviewerLastReadSeq` to the message's `seq`.
- [ ] **Step 4:** `pnpm test -- messaging` → PASS.
- [ ] **Step 5:** Commit `feat(api): start and read review conversations`.

### Task 3: MessagingService — send, end, mark read

**Interfaces — Produces:** `sendMessage(userId, id, input)`, `endConversation(userId, id)`,
`markRead(userId, id)`, each returning `ConversationThread`, except `markRead` which returns `void`.

- [ ] **Step 1: Failing tests.** Cover:
  - send after end → `409`;
  - the reviewer's second message with no company message → `409`;
  - the company sends → OK, then the reviewer sends → OK;
  - a moderation hit → `400`, nothing saved;
  - ending twice is idempotent (`update` called once);
  - `markRead` with no messages leaves the seq at 0 and doesn't throw.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement the rules in the spec's order.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(api): send, end and mark-read for conversations`.

### Task 4: Controller, module wiring, notifications

**Files:**
- Create: `messaging.controller.ts`, `messaging.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/modules/notifications/notifications.service.ts`
- Test: `apps/api/src/modules/messaging/__tests__/messaging-endpoint-security.test.ts`,
  `notifications/__tests__` (extend)

Routes (all `@UseGuards(JwtAuthGuard)`, `ParseUUIDPipe` on ids, `@Throttle({ default: { limit: 10, ttl: 60_000 } })`
on the write routes):
`POST reviews/:id/conversation`, `GET me/conversations`, `GET owner/companies/:companyId/conversations`,
`GET conversations/:id`, `POST conversations/:id/messages`, `POST conversations/:id/end`,
`POST conversations/:id/read`.

- [ ] **Step 1:** Write the failing endpoint-security test: a strict body rejects `{ content, extra }`
  with `400`, following the pattern in `review-endpoint-security.test.ts`.
- [ ] **Step 2:** Write the failing notification test. A company message with
  `seq > reviewerLastReadSeq` produces `CONVERSATION_MESSAGE_FROM_COMPANY` with
  `href: /me?tab=messages&c={id}`. A reviewer message for an owned company produces
  `CONVERSATION_MESSAGE_FROM_REVIEWER` with `href: /my/companies?category=messages&c={id}`.
- [ ] **Step 3:** Implement the controller, module and `AppModule` registration. In
  `NotificationsService.list`, add two queries to the `Promise.all`:
  - `reviewConversationMessage.findMany({ where: { side: "COMPANY", conversation: { reviewerUserId: userId } } })`,
    then filter in memory by `seq > conversation.reviewerLastReadSeq`;
  - an owned approved `companyId`s lookup, then `side: "REVIEWER", conversation: { companyId: { in } }`,
    filtered by `companyLastReadSeq`.

  Each query uses `take: MAX_NOTIFICATIONS` and includes the `conversation` read-seq and company
  name/slug.
- [ ] **Step 4:** Run `pnpm test` in apps/api → all PASS.
- [ ] **Step 5:** Commit `feat(api): messaging endpoints and message notifications`.

### Task 5: Web — ConversationInbox component

**Files:**
- Create: `apps/web/src/components/messaging/ConversationInbox.tsx`
- Create: `apps/web/src/components/messaging/ConversationThreadView.tsx`

Props: `ConversationInbox({ mode: "reviewer" } | { mode: "company"; companyId: string }, initialConversationId?: string)`.
The list is loaded from `/me/conversations` or `/owner/companies/{companyId}/conversations`. Selecting
a conversation loads `/conversations/{id}` and posts `/conversations/{id}/read`. The thread view renders
day-grouped bubbles, a composer (disabled with copy per `cannotSendReason`) and an "End conversation"
button behind `window.confirm`. An `ApiError` from sending keeps the draft and shows `err.message` inline.

- [ ] **Step 1:** Implement both components.
- [ ] **Step 2:** `pnpm exec tsc --noEmit` and `pnpm lint` in apps/web → clean.
- [ ] **Step 3:** Commit `feat(web): conversation inbox component`.

### Task 6: Web — mount points + notifications menu

**Files:**
- Modify: `apps/web/src/app/me/page.tsx` (tab `messages` / "Messages"; read `c` search param)
- Modify: `apps/web/src/components/owner/OwnerDashboardSidePanel.tsx` (category `messages`)
- Modify: `apps/web/src/app/my/companies/page.tsx` (render the inbox; honour `?category=messages&c=`)
- Modify: `apps/web/src/app/me/reviews/page.tsx` (start button + composer inside the reply box)
- Modify: `apps/web/src/components/NotificationsMenu.tsx` (2 kinds: category `SOCIAL` for
  FROM_COMPANY, `EMPLOYER` for FROM_REVIEWER; copy per the spec; href = `n.href`)
- Modify: `apps/api` `GET me/reviews` response to include `conversationId: string | null` per review
  (and its shared-types `myReview` schema), so the button knows whether to show "Open conversation".

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Typecheck + lint on both apps, and `pnpm test` on the API.
- [ ] **Step 3:** Commit `feat(web): messages tab, owner messages category, start-conversation button`.

### Task 7: End-to-end browser verification

- [ ] Restart the API cleanly (kill stale watchers). Log in with a dev fast-login as a member who has a
  replied-to review; if none exists, create one with a dev script. Start a conversation, then confirm
  that a second message is blocked and that a moderation hit is rejected.
- [ ] Log in as the dev owner and open Messages: the reviewer's display name is shown, the answer
  sends, and the notification appears on the other side.
- [ ] End the conversation from one side and confirm both sides see it read-only.
- [ ] Commit any fixes, push, and update memory.

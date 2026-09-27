import { z } from "zod";

// Reviewer <-> company private conversations (see
// docs/superpowers/specs/2026-09-25-reviewer-company-messaging-design.md).
// Only a review's own author can open one, and only on a review the company
// has publicly replied to. Nothing here ever carries a user id or an exact
// time: days only (YYYY-MM-DD). The company only ever sees the review's
// public display name and avatar - exactly what the published review already
// shows, including its randomized stand-ins - never the account's own.

export const sendMessageInputSchema = z.object({ content: z.string().trim().min(1).max(2000) });
export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;

export const cannotSendReasonSchema = z.enum(["ENDED", "AWAITING_COMPANY"]);
export type CannotSendReason = z.infer<typeof cannotSendReasonSchema>;

export const conversationSummarySchema = z.object({
  id: z.string().uuid(),
  reviewId: z.string().uuid(),
  // Company name for the reviewer; the review's public display name for the company.
  counterpartName: z.string(),
  // Reviewer view only (links to the company page); always null for the company.
  companySlug: z.string().nullable(),
  companyName: z.string(),
  companyLogoUrl: z.string().nullable(),
  // The review's public identity (randomized stand-ins when the review was
  // posted with "randomize my identity") - same on both sides.
  reviewerName: z.string(),
  reviewerAvatarKey: z.string().nullable(),
  reviewerAvatarGradient: z.string().nullable(),
  // Reviewer view only: the real name of the company owner answering (the
  // latest owner to write, else the company's first approved owner), from
  // their employer profile. Null for the company, or when no owner has
  // filled in their employer profile name yet.
  ownerName: z.string().nullable(),
  lastMessagePreview: z.string(),
  lastMessageDay: z.string(),
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
  // Short excerpt of the review's general thoughts, for context.
  reviewExcerpt: z.string().nullable(),
  messages: z.array(conversationMessageSchema),
  canSend: z.boolean(),
  cannotSendReason: cannotSendReasonSchema.nullable(),
});
export type ConversationThread = z.infer<typeof conversationThreadSchema>;

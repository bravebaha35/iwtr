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
  // Reviewer view only: the real name of the company owner who wrote the
  // company's latest message, if they ticked "Show company owner's name
  // during messaging" - otherwise null (shown as "Company representative").
  // Always null before the company's first message, and for the company side.
  ownerName: z.string().nullable(),
  // Whether the company has written in this conversation yet. Until it has,
  // the reviewer sees no name at all for the other side.
  companyReplied: z.boolean(),
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
  // The message has a Turkish phone number in it: both sides see
  // PHONE_SHARING_NOTE under it (numbers are allowed, not blocked).
  sharesPhoneNumber: z.boolean(),
});
export type ConversationMessage = z.infer<typeof conversationMessageSchema>;

// The owner dashboard's "Show company owner's name during messaging"
// tick-box (one per owner per company). ownerName is the legal name
// reviewers would see when it's ticked.
export const ownerMessagingNameSchema = z.object({
  showNameInMessages: z.boolean(),
  ownerName: z.string().nullable(),
});
export type OwnerMessagingName = z.infer<typeof ownerMessagingNameSchema>;

export const updateOwnerMessagingNameInputSchema = z.object({ showNameInMessages: z.boolean() });
export type UpdateOwnerMessagingNameInput = z.infer<typeof updateOwnerMessagingNameInputSchema>;

export const conversationThreadSchema = conversationSummarySchema.extend({
  // Short excerpt of the review's general thoughts, for context.
  reviewExcerpt: z.string().nullable(),
  messages: z.array(conversationMessageSchema),
  canSend: z.boolean(),
  cannotSendReason: cannotSendReasonSchema.nullable(),
});
export type ConversationThread = z.infer<typeof conversationThreadSchema>;

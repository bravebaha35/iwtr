import { z } from "zod";

// Derived, not stored — GET /me/notifications computes this list on demand
// from ReviewVote and CompanyReply rows attached to the caller's own
// reviews (see NotificationsService.list). No read/unread tracking yet;
// it's just the most recent events, newest first.
export const notificationTypeSchema = z.enum([
  "VOTE_HELPFUL",
  "VOTE_NOT_HELPFUL",
  "COMPANY_REPLY",
  "JOB_POSTING_PUBLISHED",
]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationSchema = z.object({
  id: z.string(),
  type: notificationTypeSchema,
  companyName: z.string(),
  companySlug: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type Notification = z.infer<typeof notificationSchema>;

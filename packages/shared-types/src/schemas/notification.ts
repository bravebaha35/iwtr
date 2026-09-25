import { z } from "zod";

// Derived, not stored — GET /me/notifications computes this list on demand
// from ReviewVote and CompanyReply rows attached to the caller's own
// reviews (see NotificationsService.list). No read/unread tracking yet;
// it's just the most recent events, newest first.
//
// The 3 COMPANY_* kinds below are derived the same way — see
// NotificationsService.list's "followed companies" block — from
// CompanyFollow joined against CompanyAggregateScore/SocialPost/JobPosting.
// No frontend renders these yet: NotificationsMenu.tsx's own
// NotificationKind union and describe/href switches are frontend-owned and
// were explicitly out of scope for this change (backend/DB only). Intended
// copy + link for whoever wires the frontend up next:
//   COMPANY_STATUS_UPDATE   -> "See how {companyName} doing!"            -> /companies/{companySlug}
//   COMPANY_NEW_SOCIAL_POST -> "{companyName} just posted a new post !"  -> /social/{companySlug}
//   COMPANY_HIRING          -> "{companyName} hiring now check it out !" -> /jobs
export const notificationTypeSchema = z.enum([
  "VOTE_HELPFUL",
  "VOTE_NOT_HELPFUL",
  "COMPANY_REPLY",
  "JOB_POSTING_PUBLISHED",
  "COMPANY_STATUS_UPDATE",
  "COMPANY_NEW_SOCIAL_POST",
  "COMPANY_HIRING",
  // A Sector Benchmark Report the user ordered finished generating (see
  // NotificationsService.list — derived from READY, unexpired
  // BenchmarkReportJob rows). Carries `href`: the PDF download route.
  "BENCHMARK_REPORT_READY",
  // A private review conversation has a message the recipient hasn't read
  // yet (see NotificationsService.list). Carries `href`: the right inbox.
  "CONVERSATION_MESSAGE_FROM_COMPANY",
  "CONVERSATION_MESSAGE_FROM_REVIEWER",
  // The caller's own review reached PUBLISHED / was REJECTED.
  "REVIEW_PUBLISHED",
  "REVIEW_NOT_PUBLISHED",
  // The caller's company claim was resolved by an admin.
  "CLAIM_APPROVED",
  "CLAIM_REJECTED",
  // Owner-only: a CV application arrived for one of their job postings
  // (carries jobTitle), and a new review was published on their company
  // (timestamp is day-precision so its timing can't single out a reviewer).
  "JOB_APPLICATION_RECEIVED",
  "COMPANY_REVIEWED",
]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationSchema = z.object({
  id: z.string(),
  type: notificationTypeSchema,
  companyName: z.string(),
  companySlug: z.string().nullable(),
  createdAt: z.string().datetime(),
  // Where clicking the notification goes, when the type can't be derived
  // from companySlug alone.
  href: z.string().optional(),
  // JOB_APPLICATION_RECEIVED only: the posting that was applied to.
  jobTitle: z.string().optional(),
});
export type Notification = z.infer<typeof notificationSchema>;

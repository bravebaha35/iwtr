"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationSchema = exports.notificationTypeSchema = void 0;
const zod_1 = require("zod");
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
exports.notificationTypeSchema = zod_1.z.enum([
    "VOTE_HELPFUL",
    "VOTE_NOT_HELPFUL",
    "COMPANY_REPLY",
    "JOB_POSTING_PUBLISHED",
    "COMPANY_STATUS_UPDATE",
    "COMPANY_NEW_SOCIAL_POST",
    "COMPANY_HIRING",
]);
exports.notificationSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: exports.notificationTypeSchema,
    companyName: zod_1.z.string(),
    companySlug: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string().datetime(),
});

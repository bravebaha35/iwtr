"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.savedJobPostingSchema = exports.savedJobPostingToggleResultSchema = void 0;
const zod_1 = require("zod");
// Toggle result mirrors savedPostToggleResultSchema's shape/convention
// exactly (see follow.ts).
exports.savedJobPostingToggleResultSchema = zod_1.z.object({
    jobPostingId: zod_1.z.string(),
    saved: zod_1.z.boolean(),
});
// One row of the caller's own saved-postings list (GET me/saved-job-postings).
// Deliberately thin, same minimalism as publicJobPostingSchema — `expired`
// is the one extra bit the Saved Posts view needs to grey a card out and
// make it inert.
exports.savedJobPostingSchema = zod_1.z.object({
    id: zod_1.z.string(),
    companyId: zod_1.z.string(),
    jobTitle: zod_1.z.string(),
    description: zod_1.z.string(),
    expired: zod_1.z.boolean(),
});

import { z } from "zod";

// Toggle result mirrors savedPostToggleResultSchema's shape/convention
// exactly (see follow.ts).
export const savedJobPostingToggleResultSchema = z.object({
  jobPostingId: z.string(),
  saved: z.boolean(),
});
export type SavedJobPostingToggleResult = z.infer<typeof savedJobPostingToggleResultSchema>;

// One row of the caller's own saved-postings list (GET me/saved-job-postings).
// Deliberately thin, same minimalism as publicJobPostingSchema — `expired`
// is the one extra bit the Saved Posts view needs to grey a card out and
// make it inert.
export const savedJobPostingSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  jobTitle: z.string(),
  description: z.string(),
  expired: z.boolean(),
});
export type SavedJobPosting = z.infer<typeof savedJobPostingSchema>;

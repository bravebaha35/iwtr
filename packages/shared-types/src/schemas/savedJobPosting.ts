import { z } from "zod";
import { companyListItemSchema } from "./company";

// Toggle result mirrors savedPostToggleResultSchema's shape/convention
// exactly (see follow.ts).
export const savedJobPostingToggleResultSchema = z.object({
  jobPostingId: z.string(),
  saved: z.boolean(),
});
export type SavedJobPostingToggleResult = z.infer<typeof savedJobPostingToggleResultSchema>;

// One row of the caller's own saved-postings list (GET me/saved-job-postings).
// Carries the full company shape (not just companyId) so the frontend can
// render this with the exact same JobCard component the public Jobs feed
// and company-profile tab already use, with zero adaptation — see
// JobCard.tsx's `{company, posting}` prop pair. `jobTitles`/`jobPostings` on
// `company` are always [] here (unused by JobCard's own rendering, which
// never reads them — only the caller-side `postingsForCard` helper does,
// and this endpoint already knows exactly which one posting to show per
// row, so that helper is never needed on this path). `expired` is the one
// extra bit the Saved Posts view needs to grey a card out and make it inert.
export const savedJobPostingSchema = z.object({
  company: companyListItemSchema,
  posting: z.object({
    id: z.string().uuid(),
    jobTitle: z.string(),
    description: z.string(),
  }),
  expired: z.boolean(),
});
export type SavedJobPosting = z.infer<typeof savedJobPostingSchema>;

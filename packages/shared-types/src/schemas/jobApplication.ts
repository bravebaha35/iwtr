import { z } from "zod";

// Returned by POST job-postings/:jobPostingId/apply once the PDF is stored.
export const submitJobApplicationResponseSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string(),
});
export type SubmitJobApplicationResponse = z.infer<typeof submitJobApplicationResponseSchema>;

// One row in an owner's Applications inbox (GET my-companies/:companyId/job-applications).
export const jobApplicationListItemSchema = z.object({
  id: z.string().uuid(),
  jobPostingId: z.string().uuid(),
  jobTitle: z.string(),
  // The applicant's own displayName if they set one, else "Anonymous
  // applicant" — never the applicant's PiiVault real name or userId. See
  // this plan's Global Constraints.
  applicantDisplayName: z.string(),
  pdfUrl: z.string(),
  createdAt: z.string(),
  viewedAt: z.string().nullable(),
});
export type JobApplicationListItem = z.infer<typeof jobApplicationListItemSchema>;

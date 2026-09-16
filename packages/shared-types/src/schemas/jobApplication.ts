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
  // NOT a public, directly-downloadable URL. This is a relative apps/api
  // path (`/my-companies/:companyId/job-applications/:id/pdf`) that
  // requires an authenticated, ownership-checked request to resolve — the
  // PDF is no longer served from the app-wide public static mount. The
  // frontend must fetch it the same way it fetches any other authenticated
  // resource (through apps/web's same-origin proxy, which attaches the
  // caller's Bearer token server-side), not link to it as a bare <a href>.
  pdfUrl: z.string(),
  createdAt: z.string(),
  viewedAt: z.string().nullable(),
});
export type JobApplicationListItem = z.infer<typeof jobApplicationListItemSchema>;

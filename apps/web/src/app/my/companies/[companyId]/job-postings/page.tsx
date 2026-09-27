import { redirect } from "next/navigation";

// Job Postings is now a section of the owner dashboard itself; this old
// standalone page only forwards any saved link to it.
export default async function OwnerJobPostingsPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  redirect(`/my/companies?company=${encodeURIComponent(companyId)}&category=job-postings`);
}

import { OwnerJobPostingsView } from "@/components/jobs/OwnerJobPostingsView";

export default async function OwnerJobPostingsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  return <OwnerJobPostingsView companyId={companyId} />;
}

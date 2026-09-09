import { notFound } from "next/navigation";
import type { CompanyDetail } from "@iwtr/shared-types";
import { apiGetPublic, ApiError } from "@/lib/api-client";
import { AdSlot } from "@/components/AdSlot";
import { SocialFeed } from "@/components/social/SocialFeed";
import { SocialCompanyHero } from "@/components/social/SocialCompanyHero";
import { SocialComposerSlot } from "@/components/social/SocialComposerSlot";

export default async function CompanySocialPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let detail: CompanyDetail;
  try {
    detail = await apiGetPublic<CompanyDetail>(`/companies/${slug}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const { company, aggregate } = detail;

  return (
    <div className="flex w-full items-start justify-center gap-6 px-4 py-8">
      <AdSlot />
      <div className="flex w-full max-w-xl flex-col gap-4">
        <SocialCompanyHero
          company={company}
          overallAvg={aggregate && aggregate.reviewCount > 0 ? aggregate.overallAvg : null}
          reviewCount={aggregate?.reviewCount ?? 0}
        />
        {/* The composer here is scoped by the owner's own approved companies,
            same component as the main feed - it posts as whichever company
            the owner picks, not automatically this one. That is acceptable
            for v1; a "post as {this company}" shortcut is a later refinement. */}
        <SocialComposerSlot />
        <SocialFeed scope={{ kind: "company", slug }} />
      </div>
      <AdSlot />
    </div>
  );
}

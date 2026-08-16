import { notFound } from "next/navigation";
import { scoreBandLabel, type CompanyDetail } from "@iwtr/shared-types";
import { apiGetPublic, ApiError } from "@/lib/api-client";
import { ReviewsList } from "@/components/ReviewsList";
import { SurveyHighlights } from "@/components/SurveyHighlights";
import { OwnerClaimPanel } from "@/components/OwnerClaimPanel";
import { CompanyLogo } from "@/components/CompanyLogo";
import { RateButton } from "@/components/RateButton";
import { AdSlot } from "@/components/AdSlot";
import { scoreBarColor } from "@/lib/scoreBandColors";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";

const CATEGORIES = [
  { key: "corporateCultureAvg" as const, label: "Corporate Culture" },
  { key: "leadershipAvg" as const, label: "Leadership & Management" },
  { key: "infrastructureAvg" as const, label: "Infrastructure & Resources" },
  { key: "workLifeBalanceAvg" as const, label: "Work-Life Balance" },
  { key: "stabilityAvg" as const, label: "Organizational Stability" },
];

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
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
    // Same 3-column shell as the homepage (ad rail / content / ad rail) —
    // this page used to be a narrow, centered max-w-3xl column regardless
    // of viewport width, which read as a mobile layout stretched onto a
    // desktop screen instead of using the space.
    <div className="flex w-full items-start justify-center gap-6 px-4 py-8">
      <AdSlot />

      <div className="w-full max-w-6xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <CompanyLogo name={company.name} mainPhotoUrl={company.mainPhotoUrl} size="lg" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {company.name}
                {company.isVerifiedBadge && (
                  <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                    Verified Company
                  </span>
                )}
              </h1>
              <p className="text-sm text-muted-foreground">
                {company.category} · {company.workplaceTypes.map(workplaceTypeLabel).join(" / ")}
                {company.city ? ` · ${company.city}` : ""}
              </p>
            </div>
          </div>
          <RateButton companyId={company.id} companyName={company.name} workplaceTypes={company.workplaceTypes} />
        </div>

        {/* Score breakdown (left) and "What reviewers said" (right) sit side
            by side on wide screens instead of stacking — they're both
            summary/at-a-glance content, not competing for the same reading
            column the way the full review list below does. */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-6">
            {aggregate && aggregate.reviewCount > 0 ? (
              <>
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-bold text-foreground">
                    {aggregate.overallAvg.toFixed(1)}
                  </span>
                  <span className="text-lg font-medium text-foreground/80">
                    {scoreBandLabel(aggregate.overallAvg)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    ({aggregate.reviewCount} review{aggregate.reviewCount === 1 ? "" : "s"})
                  </span>
                </div>
                <div className="mt-6 flex flex-col gap-2">
                  {CATEGORIES.map((c) => (
                    <div key={c.key} className="flex items-center gap-3">
                      <span className="w-56 text-sm text-muted-foreground">{c.label}</span>
                      <div className="h-2 flex-1 rounded-full bg-surface-muted">
                        <div
                          className={`h-2 rounded-full ${scoreBarColor(aggregate[c.key])}`}
                          style={{ width: `${(aggregate[c.key] / 5) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-sm text-muted-foreground">
                        {aggregate[c.key].toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No reviews yet. Be the first to rate this workplace if it&apos;s in your work history.
              </p>
            )}
          </div>

          <SurveyHighlights companySlug={slug} />
        </div>

        {/* Full column width, not squeezed into the grid above — this is
            the actual review text people are here to read, so it gets the
            most room. */}
        <div className="mt-8">
          <ReviewsList companySlug={slug} />
        </div>

        <div className="mt-8">
          <OwnerClaimPanel companySlug={slug} />
        </div>
      </div>

      <AdSlot />
    </div>
  );
}

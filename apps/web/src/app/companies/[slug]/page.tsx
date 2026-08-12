import Link from "next/link";
import { notFound } from "next/navigation";
import { scoreBandLabel, type CompanyDetail } from "@iwtr/shared-types";
import { apiGetPublic, ApiError } from "@/lib/api-client";
import { ReviewsList } from "@/components/ReviewsList";
import { SurveyHighlights } from "@/components/SurveyHighlights";
import { OwnerClaimPanel } from "@/components/OwnerClaimPanel";
import { CompanyLogo } from "@/components/CompanyLogo";
import { RateButton } from "@/components/RateButton";
import { scoreBarColor } from "@/lib/scoreBandColors";
import { MIN_REVIEWS_FOR_EXACT_COUNT, scoreAsPercent } from "@/lib/reviewCount";
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
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        &larr; Back
      </Link>

      <div className="mt-4 flex items-center justify-between gap-4">
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

      <div className="mt-8 rounded-xl border border-border bg-surface p-6">
        {aggregate && aggregate.reviewCount > 0 ? (
          <>
            <div className="flex items-baseline gap-3">
              {aggregate.reviewCount >= MIN_REVIEWS_FOR_EXACT_COUNT ? (
                <>
                  <span className="text-4xl font-bold text-foreground">
                    {aggregate.overallAvg.toFixed(1)}
                  </span>
                  <span className="text-lg font-medium text-foreground/80">
                    {scoreBandLabel(aggregate.overallAvg)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    ({aggregate.reviewCount} review{aggregate.reviewCount === 1 ? "" : "s"})
                  </span>
                </>
              ) : (
                // Fewer than MIN_REVIEWS_FOR_EXACT_COUNT reviews — showing the
                // exact count (or an X.X/5 average with that few data points)
                // risks reverse-identifying a reviewer at a small company, so
                // show the score as a rounded percentage with no count at all.
                <>
                  <span className="text-lg font-medium text-foreground/80">
                    {scoreBandLabel(aggregate.overallAvg)}
                  </span>
                  <span className="text-4xl font-bold text-foreground">
                    {scoreAsPercent(aggregate.overallAvg)}%
                  </span>
                </>
              )}
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
      <ReviewsList companySlug={slug} />
      <OwnerClaimPanel companySlug={slug} />
    </div>
  );
}

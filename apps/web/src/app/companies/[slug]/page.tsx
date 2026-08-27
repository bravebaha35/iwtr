import { notFound } from "next/navigation";
import { scoreBandLabel, type CompanyDetail } from "@iwtr/shared-types";
import { apiGetPublic, ApiError } from "@/lib/api-client";
import { ReviewsList } from "@/components/ReviewsList";
import { WorkplaceVibeFlags } from "@/components/WorkplaceVibeFlags";
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

        {/* Score breakdown + Information (left) and Workplace Vibe Flags
            (right) sit side by side on wide screens instead of stacking —
            they're both summary/at-a-glance content, not competing for the
            same reading column the way the full review list below does.
            "What reviewers said" (SurveyHighlights, the old Q&A detail box)
            is intentionally not rendered on this page any more — the
            component itself is untouched and still available to reuse
            elsewhere later, it's just not shown here. */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-full rounded-xl border border-border bg-surface p-6">
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

            {/* Free-text company info — only a Plus-tier owner can set
                description/website (see owner.service.ts's edit allowlist),
                so a null description here is itself the reliable "no Plus
                subscription, or hasn't filled it in yet" signal; no
                separate tier check needed. Lives in the same card as the
                score breakdown (a divider, not a second box) so the left
                column reads as one connected panel. */}
            <div className="mt-6 border-t border-border pt-6">
              <h2 className="mb-2 text-lg font-semibold text-foreground">Information</h2>
              {company.description ? (
                <p className="whitespace-pre-wrap text-sm text-foreground">{company.description}</p>
              ) : (
                <div className="flex flex-col items-center gap-1 py-6 text-center text-sm text-muted-foreground">
                  <span className="text-3xl" aria-hidden="true">
                    😔
                  </span>
                  <span>No information yet.</span>
                </div>
              )}
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  {company.website}
                </a>
              )}
            </div>
          </div>

          <WorkplaceVibeFlags companySlug={slug} />
        </div>

        {/* Full column width, not squeezed into the grid above — this is
            the actual review text people are here to read, so it gets the
            most room. */}
        <div className="mt-8">
          <ReviewsList companySlug={slug} workplaceTypes={company.workplaceTypes} companyName={company.name} />
        </div>

        <div className="mt-8">
          <OwnerClaimPanel companySlug={slug} />
        </div>
      </div>

      <AdSlot />
    </div>
  );
}

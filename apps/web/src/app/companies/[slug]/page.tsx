import Link from "next/link";
import { notFound } from "next/navigation";
import { scoreBandLabel, type CompanyDetail } from "@iwtr/shared-types";
import { apiGet, ApiError } from "@/lib/api-client";
import { ReviewsList } from "@/components/ReviewsList";
import { OwnerClaimPanel } from "@/components/OwnerClaimPanel";

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
    detail = await apiGet<CompanyDetail>(`/companies/${slug}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const { company, aggregate } = detail;

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <Link href="/" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
        &larr; Back
      </Link>

      <div className="mt-4 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-zinc-100 text-2xl font-bold text-zinc-500 dark:bg-zinc-800">
          {company.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {company.name}
            {company.isVerifiedBadge && (
              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                Verified Company
              </span>
            )}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {company.category}
            {company.city ? ` · ${company.city}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        {aggregate && aggregate.reviewCount > 0 ? (
          <>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">
                {aggregate.overallAvg.toFixed(1)}
              </span>
              <span className="text-lg font-medium text-zinc-600 dark:text-zinc-300">
                {scoreBandLabel(aggregate.overallAvg)}
              </span>
              <span className="text-sm text-zinc-400">
                ({aggregate.reviewCount} review{aggregate.reviewCount === 1 ? "" : "s"})
              </span>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              {CATEGORIES.map((c) => (
                <div key={c.key} className="flex items-center gap-3">
                  <span className="w-56 text-sm text-zinc-600 dark:text-zinc-400">{c.label}</span>
                  <div className="h-2 flex-1 rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-2 rounded-full bg-zinc-900 dark:bg-zinc-50"
                      style={{ width: `${(aggregate[c.key] / 5) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm text-zinc-600 dark:text-zinc-400">
                    {aggregate[c.key].toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No reviews yet. Be the first to rate this workplace if it&apos;s in your work history.
          </p>
        )}
      </div>

      <ReviewsList companySlug={slug} />
      <OwnerClaimPanel companySlug={slug} />
    </div>
  );
}

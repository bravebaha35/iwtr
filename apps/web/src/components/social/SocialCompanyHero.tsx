import Link from "next/link";
import type { Company } from "@iwtr/shared-types";
import { CompanyLogo } from "@/components/CompanyLogo";
import { BeaverRatingIcon } from "@/components/BeaverRatingIcon";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";
import { IwtSocialIcon } from "@/components/icons/IwtSocialIcon";

// Mirrors the top of the rating page (logo + banner + work-types + sector +
// overall number), plus the mood face and a "Back to Rating" button.
export function SocialCompanyHero({
  company,
  overallAvg,
  reviewCount,
}: {
  company: Company;
  overallAvg: number | null;
  reviewCount: number;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {company.bannerImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- owner-submitted URL
        <img src={company.bannerImageUrl} alt="" className="aspect-[5/1] w-full object-cover" />
      )}
      <div className="flex flex-wrap items-center gap-4 p-4">
        <CompanyLogo name={company.name} mainPhotoUrl={company.mainPhotoUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <IwtSocialIcon className="h-4 w-4 text-muted-foreground" />
            <h1 className="truncate text-xl font-bold text-foreground">{company.name}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {company.category} - {company.workplaceTypes.map(workplaceTypeLabel).join(" / ")}
            {company.city ? ` - ${company.city}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BeaverRatingIcon score={overallAvg} size="sm" />
          <div className="text-right">
            <p className="text-lg font-bold text-foreground">{overallAvg !== null ? overallAvg.toFixed(1) : "-"}</p>
            <p className="text-xs text-muted-foreground">
              {reviewCount} review{reviewCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <Link
          href={`/companies/${company.slug}`}
          className="rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-surface-muted"
        >
          Back to Rating
        </Link>
      </div>
    </div>
  );
}

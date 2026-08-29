import { notFound } from "next/navigation";
import type { Company, CompanyDetail } from "@iwtr/shared-types";
import { apiGetPublic, ApiError } from "@/lib/api-client";
import { ReviewsList } from "@/components/ReviewsList";
import { WorkplaceVibeFlags } from "@/components/WorkplaceVibeFlags";
import { OwnerClaimPanel } from "@/components/OwnerClaimPanel";
import { CompanyLogo } from "@/components/CompanyLogo";
import { RateButton } from "@/components/RateButton";
import { AdSlot } from "@/components/AdSlot";
import { scoreBarColor } from "@/lib/scoreBandColors";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";
import { ratingNarrative } from "@/lib/ratingNarrative";

const CATEGORIES = [
  { key: "corporateCultureAvg" as const, label: "Corporate Culture" },
  { key: "leadershipAvg" as const, label: "Leadership & Management" },
  { key: "infrastructureAvg" as const, label: "Infrastructure & Resources" },
  { key: "workLifeBalanceAvg" as const, label: "Work-Life Balance" },
  { key: "stabilityAvg" as const, label: "Organizational Stability" },
];

// Dynamic image + descriptive text, picked from the company's live overall
// score and its primary (first-tag) work-type — see ratingNarrative.ts.
// "Vertically flexible container that expands to fit its content" means no
// fixed/aspect-ratio height here: plain flexbox, so a longer text block just
// grows the box rather than clipping or scrolling. Flex-col on mobile (image
// stacked above text) / flex-row on larger screens (image left, text
// vertically centered beside it), per the explicit mobile-readability ask.
function RatingNarrativeBox({ score, workplaceType }: { score: number; workplaceType: Company["workplaceTypes"][number] }) {
  const { imageSrc, text } = ratingNarrative(score, workplaceType);
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface p-6 font-sans sm:flex-row sm:items-center lg:max-w-lg lg:shrink-0">
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small
        // fixed set of local /public illustrations, not a remote/arbitrary
        // URL next/image's loader config would need to know about.
        <img src={imageSrc} alt="" className="h-40 w-40 shrink-0 object-contain" />
      ) : (
        <div
          className="flex h-40 w-40 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-center text-xs text-muted-foreground"
          aria-hidden="true"
        >
          Image coming soon
        </div>
      )}
      <p className="text-center text-sm text-foreground sm:text-left">{text}</p>
    </div>
  );
}

// "Overall information / Location / Contact & Social Media / Sector" — every
// field here already comes down on the same CompanyDetail the rest of this
// page renders from; no separate fetch. Purely presentational, so it's kept
// local to this file rather than a new component, same as CATEGORIES above.
function CompanyDetailsBox({ company }: { company: Company }) {
  const location = [company.district, company.city].filter(Boolean).join(", ");

  const socialLinks: { label: string; href: string; external: boolean }[] = [
    company.contactEmail ? { label: "Email", href: `mailto:${company.contactEmail}`, external: false } : null,
    company.contactPhone ? { label: "Phone", href: `tel:${company.contactPhone}`, external: false } : null,
    company.facebookUrl ? { label: "Facebook", href: company.facebookUrl, external: true } : null,
    company.instagramUrl ? { label: "Instagram", href: company.instagramUrl, external: true } : null,
    company.whatsappUrl ? { label: "WhatsApp", href: company.whatsappUrl, external: true } : null,
    company.xUrl ? { label: "X (Twitter)", href: company.xUrl, external: true } : null,
  ].filter((v): v is { label: string; href: string; external: boolean } => v !== null);

  // Fixed height (matching WorkplaceVibeFlags), not content-driven — see
  // that component's comment. 545px matches the Vibe Flags box's true
  // worst-case height (all 10 flags in a single column) plus a small
  // buffer; overflow-y-auto handles whatever doesn't fit (e.g. an unusually
  // long description) without ever growing the box itself.
  return (
    <div className="h-[545px] overflow-y-auto rounded-xl border border-border bg-surface p-6 font-sans">
      <h2 className="mb-4 text-lg font-semibold text-foreground">Company Details</h2>
      <div className="flex flex-col gap-4 text-sm">
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Overall Information
          </h3>
          {company.description ? (
            <p className="whitespace-pre-wrap text-foreground">{company.description}</p>
          ) : (
            <p className="text-muted-foreground">No information provided yet.</p>
          )}
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              {company.website}
            </a>
          )}
        </div>

        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location</h3>
          <p className="text-foreground">{location || "Not provided yet."}</p>
        </div>

        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sector</h3>
          <p className="text-foreground">{company.category}</p>
        </div>

        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Contact &amp; Social Media
          </h3>
          {socialLinks.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {socialLinks.map((s) => (
                <li key={s.label} className="truncate">
                  <span className="text-muted-foreground">{s.label}: </span>
                  <a
                    href={s.href}
                    target={s.external ? "_blank" : undefined}
                    rel={s.external ? "noopener noreferrer" : undefined}
                    className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {s.href.startsWith("mailto:") || s.href.startsWith("tel:") ? s.href.split(":")[1] : s.href}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Not provided yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

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

        {/* Rating visuals (left) + the category-breakdown box (right) sit in
            their own full-width flex row, so there's real room for the
            dynamic image + text beside the 5 category bars. Workplace Vibe
            Flags and the new Company Details box get their own row below,
            side by side. "What reviewers said" (SurveyHighlights, the old
            Q&A detail box) is intentionally not rendered on this page any
            more — the component itself is untouched and still available to
            reuse elsewhere later, it's just not shown here. */}
        <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-stretch">
          {aggregate && aggregate.reviewCount > 0 && (
            <RatingNarrativeBox score={aggregate.overallAvg} workplaceType={company.workplaceTypes[0]} />
          )}

          <div className="flex-1 rounded-xl border border-border bg-surface p-6 font-sans">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Rating Breakdown</h2>
            {aggregate && aggregate.reviewCount > 0 ? (
              <div className="flex flex-col gap-2">
                {CATEGORIES.map((c) => (
                  <div key={c.key} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 text-sm text-muted-foreground sm:w-56">{c.label}</span>
                    <div className="h-1.5 flex-1 rounded-full bg-surface-muted">
                      <div
                        className={`h-1.5 rounded-full ${scoreBarColor(aggregate[c.key])}`}
                        style={{ width: `${(aggregate[c.key] / 5) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-sm text-muted-foreground">
                      {aggregate[c.key].toFixed(1)}
                    </span>
                  </div>
                ))}
                <p className="mt-2 text-xs text-muted-foreground">
                  {aggregate.reviewCount} review{aggregate.reviewCount === 1 ? "" : "s"}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No reviews yet. Be the first to rate this workplace if it&apos;s in your work history.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <WorkplaceVibeFlags companySlug={slug} />
          <CompanyDetailsBox company={company} />
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

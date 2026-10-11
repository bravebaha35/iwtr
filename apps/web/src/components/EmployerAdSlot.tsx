"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { EmployerAd } from "@iwtr/shared-types";
import { apiGet } from "@/lib/api-client";
import { CompanyLogo } from "@/components/CompanyLogo";
import { AdLabel } from "@/components/AdSlot";

/**
 * The employer ad space beside the search bar on the Rating and Jobs pages.
 * Companies buy it with the "Maximum visibility" package (AD_SPACE_14, ad
 * space only - it does not put the job in the Featured jobs row): one
 * running buyer is picked at random on each visit (GET /companies/employer-ad)
 * and its job is shown here. While nobody has bought it, a made-up sample
 * employer ad fills the space. Square corners, like the other ad slots;
 * hidden on narrower screens where the search bar needs the room.
 */
export function EmployerAdSlot() {
  const [ad, setAd] = useState<EmployerAd | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    apiGet<EmployerAd>("/companies/employer-ad")
      .then((data) => {
        // "No ad running" arrives as an empty reply (undefined).
        if (!cancelled) setAd(data ?? null);
      })
      .catch(() => {
        if (!cancelled) setAd(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside
      aria-label="Employer ad"
      data-testid="employer-ad-slot"
      className="relative hidden min-h-[104px] min-w-[18rem] max-w-[30rem] flex-1 overflow-hidden border border-border bg-surface 2xl:flex"
    >
      {ad ? (
        <Link
          href={`/companies/${ad.company.slug}?tab=jobs`}
          className="flex w-full items-center gap-4 border-2 border-amber-400 p-4 transition hover:bg-surface-muted"
        >
          <CompanyLogo name={ad.company.name} mainPhotoUrl={ad.company.mainPhotoUrl} size="md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {ad.company.name}
              {ad.company.city ? ` · ${ad.company.city}` : ""}
            </span>
            <span className="block truncate text-lg font-bold text-foreground">{ad.posting.jobTitle}</span>
            <span className="block truncate text-xs text-muted-foreground">{ad.posting.description}</span>
          </span>
          <span className="shrink-0 bg-brand-600 px-3 py-2 text-sm font-semibold text-white">See the job</span>
        </Link>
      ) : ad === null ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/test-ads/employer-ad-sample.svg"
          alt="Test ad: Örnek Lojistik is hiring a forklift operator"
          className="h-full w-full bg-[#12494c] object-contain"
        />
      ) : null}
      <AdLabel />
    </aside>
  );
}

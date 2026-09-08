"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { scoreBandLabel, type OwnerTier, type WorkplaceType } from "@iwtr/shared-types";
import { scoreTextColor } from "@/lib/scoreBandColors";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";
import { canUseBanner, tickSrcForOwnerTier } from "@/lib/pricingTiers";
import { CompanyLogo } from "@/components/CompanyLogo";

export interface CompanyWorkCardData {
  name: string;
  mainPhotoUrl: string | null;
  workplaceTypes: WorkplaceType[];
  category: string;
  city: string | null;
  district: string | null;
  isHiring: boolean;
  badgeTier: OwnerTier;
  bannerImageUrl: string | null;
  overallAvg: number | null;
  reviewCount: number;
}

// Reports whether `ref`'s element currently renders as more than one line of
// text, by comparing its rendered box height against its own computed
// line-height — used to switch the name/logo row between vertically
// centered (a short, single-line name) and top-aligned (a wrapped 2-line
// name), rather than always centering, which pushes a 2-line name's first
// line up above the logo's top edge. ResizeObserver (not a one-time
// mount-only check) since the same card renders at different grid-column
// widths across breakpoints, and a name that fits one line at a wide column
// can wrap to two at a narrower one.
function useIsMultiline(ref: React.RefObject<HTMLElement | null>, watch: unknown): boolean {
  const [multiline, setMultiline] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    function check() {
      if (!el) return;
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
      if (!lineHeight) return;
      setMultiline(el.getBoundingClientRect().height > lineHeight * 1.5);
    }

    check();
    // Not available in every environment (e.g. jsdom under Jest) — the
    // one-time mount check above still runs either way, this just skips
    // re-checking on a later resize where it's unsupported.
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch]);

  return multiline;
}

/**
 * The one "Rating / Overview" page card layout (originally WorkplaceBrowser's
 * inline CompanyCard) — extracted so the owner dashboard's live preview can
 * render the *exact* same component real visitors see, rather than a
 * look-alike copy that could quietly drift. `href` makes it a real link on
 * the browse grid; omitted entirely for the dashboard's non-navigating
 * live-preview use. Carries no width class of its own (matches the original
 * pre-extraction card) — sizing comes entirely from whatever renders it: a
 * browse-grid cell, or a fixed-width wrapper around the dashboard preview.
 */
export function CompanyWorkCard({ company, href }: { company: CompanyWorkCardData; href?: string }) {
  const tickSrc = tickSrcForOwnerTier(company.badgeTier);
  const nameRef = useRef<HTMLParagraphElement>(null);
  const isWrapped = useIsMultiline(nameRef, company.name);
  const showBanner = canUseBanner(company.badgeTier) && !!company.bannerImageUrl;

  const content = (
    <>
      {showBanner && (
        // Facebook-style cover-photo layout: the banner bleeds to the
        // card's outer edges (negative margin cancels the card's own p-4)
        // and the logo overlaps its bottom-left corner by half its own
        // height (top-full + -translate-y-1/2, anchored against this
        // *relative* wrapper) — mb-6 reserves room below the banner for the
        // half of the logo that hangs past it, so the name row below never
        // collides with it. 4:1 keeps the banner file itself light and the
        // strip short relative to the rest of the card.
        <div className="relative -mx-4 -mt-4 mb-6 w-[calc(100%+2rem)]">
          <div className="aspect-[4/1] w-full overflow-hidden rounded-t-xl">
            {/* eslint-disable-next-line @next/next/no-img-element -- owner-submitted URL, not a known remote host */}
            <img src={company.bannerImageUrl!} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="absolute left-4 top-full -translate-y-1/2 rounded-lg ring-4 ring-surface">
            <CompanyLogo name={company.name} mainPhotoUrl={company.mainPhotoUrl} size="md" />
          </div>
        </div>
      )}

      {/* No banner: logo sits inline beside the name (single line centers
          against it, wrapped 2-line name top-aligns so its first line lines
          up with the logo's top edge). With a banner, the logo has already
          been placed above it, overlapping its bottom-left corner, so this
          row is just the name + tick. The name <p> is NOT flex-1 — that stretched
          it full-width and shoved the tick out to the card's right edge. */}
      <div className={`flex gap-3 ${showBanner || isWrapped ? "items-start" : "items-center"}`}>
        {!showBanner && <CompanyLogo name={company.name} mainPhotoUrl={company.mainPhotoUrl} size="md" />}
        <div className="flex min-w-0 flex-1 items-start gap-1.5">
          <p ref={nameRef} className="line-clamp-2 min-w-0 font-semibold leading-snug text-foreground">
            {company.name}
          </p>
          {tickSrc && (
            // eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size static badge art
            <img
              src={tickSrc}
              alt={`${company.badgeTier === "ENTERPRISE" ? "Enterprise" : company.badgeTier === "BLUE_PLUS" ? "Blue+" : "Blue"} verified badge`}
              width={company.badgeTier === "ENTERPRISE" ? 26 : 18}
              height={company.badgeTier === "ENTERPRISE" ? 26 : 18}
              className="mt-0.5 inline-flex shrink-0 items-center"
            />
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {company.workplaceTypes.map(workplaceTypeLabel).join(" / ")} · {company.category}
      </p>
      {(company.city || company.district) && (
        <p className="truncate text-xs text-muted-foreground">
          {company.district ? `${company.district}, ` : ""}
          {company.city}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-2">
        {company.overallAvg !== null ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold text-foreground">{company.overallAvg.toFixed(1)}</span>
              <span className={`text-xs font-medium ${scoreTextColor(company.overallAvg)}`}>
                {scoreBandLabel(company.overallAvg)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {company.isHiring && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
                  Hiring now
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {company.reviewCount} review{company.reviewCount === 1 ? "" : "s"}
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            {company.isHiring && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
                Hiring now
              </span>
            )}
            <p className="text-xs text-muted-foreground">No reviews yet</p>
          </div>
        )}
      </div>
    </>
  );

  // min-h (not a fixed h) — the standard card height is exactly 196px (see
  // the original pre-extraction CompanyCard), but a banner strip needs to be
  // able to grow a card taller than that rather than getting clipped.
  const className = "flex min-h-[196px] flex-col gap-2 rounded-xl border border-border bg-surface p-4 transition";

  if (href) {
    return (
      <Link href={href} className={`${className} hover:border-brand-300 hover:shadow-md dark:hover:border-brand-700`}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}

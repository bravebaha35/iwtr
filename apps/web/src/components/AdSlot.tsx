"use client";

import { useT } from "@/lib/i18n/client";

// The site's ad slots. Until a Google Ad Manager account is set up, every
// slot shows made-up test ads (public/test-ads/, fictional brands) so the
// layout can be judged with something real-looking in it. Swap the ads here
// (or the contents of this one component) for the real ad tag/script later -
// every call site picks it up automatically. Square corners, by request.
//
// Sizes are the standard ad-network (IAB) sizes, so a real ad drops in without
// cropping: the side rails are a 160x600 "Wide Skyscraper", the ads between
// IWT Social posts a 300x250 "Medium Rectangle" (the usual in-feed size; the
// feed column is narrower than a 728x90 leaderboard).

type TestAd = { src: string; alt: string };

// One 160x600 ad per side rail, different on each side.
const RAIL_ADS: Record<"left" | "right", TestAd> = {
  left: { src: "/test-ads/lodge-roast-tall.svg", alt: "Test ad: Lodge Roast coffee, 2-for-1 lattes" },
  right: { src: "/test-ads/dam-good-desks-tall.svg", alt: "Test ad: Dam Good Desks, 30% off this week" },
};

// 300x250 in-feed ads, alternating.
const BANNER_ADS: TestAd[] = [
  { src: "/test-ads/lodge-roast-rect.svg", alt: "Test ad: Lodge Roast coffee, 2-for-1 lattes" },
  { src: "/test-ads/pathfinder-courses-rect.svg", alt: "Test ad: Pathfinder Courses, Excel in 30 days" },
];

export function AdLabel() {
  const t = useT();
  return (
    <span className="absolute right-1 top-1 bg-black/55 px-1 text-[9px] font-semibold uppercase tracking-wide text-white">
      {t("Ad")}
    </span>
  );
}

// From which window width a tall rail ad shows. "xl" is every page's rule.
// IWT Social has two more columns than the other pages, so there the left ad
// waits until the feed can keep a comfortable width beside it ("roomy",
// 86rem), and the right-hand ad only gets a column of its own on a wide
// window ("wide", 100rem); on a narrower one the same ad sits under the rail
// instead ("xl-until-wide"). Written in rem so they sort after `xl`.
const RAIL_SHOW = {
  xl: "hidden xl:block",
  roomy: "hidden min-[86rem]:block",
  wide: "hidden min-[100rem]:block",
  "xl-until-wide": "hidden xl:block min-[100rem]:hidden",
} as const;

export function AdSlot({
  orientation = "vertical",
  side = "left",
  variant = 0,
  show = "xl",
}: {
  orientation?: "vertical" | "horizontal";
  // vertical only: which rail this is, so each side gets its own ad.
  side?: "left" | "right";
  // horizontal only: which banner to show (alternates by index).
  variant?: number;
  // vertical only: see RAIL_SHOW.
  show?: keyof typeof RAIL_SHOW;
}) {
  // "vertical": narrow tall rail, hidden below `xl` since there's no spare
  // width for it on smaller screens — used for the left/right page rails.
  // "horizontal": a 300x250 box centred in the column, shown at every
  // breakpoint — used between feed posts.
  if (orientation === "horizontal") {
    const ad = BANNER_ADS[Math.abs(variant) % BANNER_ADS.length];
    return (
      <div className="flex w-full justify-center">
        <div data-testid="ad-slot" className="relative h-[250px] w-[300px] shrink-0 overflow-hidden ring-1 ring-border">
          {/* Static SVG from public/ - a plain img keeps it crisp. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ad.src} alt={ad.alt} width={300} height={250} className="block h-full w-full" />
          <AdLabel />
        </div>
      </div>
    );
  }
  const ad = RAIL_ADS[side];
  return (
    <div data-testid="ad-slot" className={`relative w-40 shrink-0 self-start overflow-hidden ring-1 ring-border ${RAIL_SHOW[show]}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ad.src} alt={ad.alt} width={160} height={600} className="block h-[600px] w-40" />
      <AdLabel />
    </div>
  );
}

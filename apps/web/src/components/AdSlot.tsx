// The site's ad slots. Until a Google Ad Manager account is set up, every
// slot shows made-up test ads (public/test-ads/, fictional brands) so the
// layout can be judged with something real-looking in it. Swap the ads here
// (or the contents of this one component) for the real ad tag/script later -
// every call site picks it up automatically. Square corners, by request.

type TestAd = { src: string; alt: string };

// One tall ad per side rail, different on each side.
const RAIL_ADS: Record<"left" | "right", TestAd> = {
  left: { src: "/test-ads/lodge-roast-tall.svg", alt: "Test ad: Lodge Roast coffee, 2-for-1 lattes" },
  right: { src: "/test-ads/dam-good-desks-tall.svg", alt: "Test ad: Dam Good Desks, 30% off this week" },
};

const BANNER_ADS: TestAd[] = [
  { src: "/test-ads/lodge-roast-wide.svg", alt: "Test ad: Lodge Roast coffee, 2-for-1 lattes" },
  { src: "/test-ads/pathfinder-courses-wide.svg", alt: "Test ad: Pathfinder Courses, Excel in 30 days" },
];

export function AdLabel() {
  return (
    <span className="absolute right-1 top-1 bg-black/55 px-1 text-[9px] font-semibold uppercase tracking-wide text-white">
      Ad
    </span>
  );
}

export function AdSlot({
  orientation = "vertical",
  side = "left",
  variant = 0,
}: {
  orientation?: "vertical" | "horizontal";
  // vertical only: which rail this is, so each side gets its own ad.
  side?: "left" | "right";
  // horizontal only: which banner to show (alternates by index).
  variant?: number;
}) {
  // "vertical": narrow tall rail, hidden below `xl` since there's no spare
  // width for it on smaller screens — used for the left/right page rails.
  // "horizontal": full-width short banner, shown at every breakpoint — used
  // above/below the hero and between feed posts.
  if (orientation === "horizontal") {
    const ad = BANNER_ADS[Math.abs(variant) % BANNER_ADS.length];
    return (
      <div data-testid="ad-slot" className="relative flex w-full justify-center overflow-hidden border border-border" style={{ minHeight: 90 }}>
        {/* Static SVG from public/ - a plain img keeps it crisp at any width. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ad.src} alt={ad.alt} className="h-[90px] w-full max-w-[728px] object-cover" />
        <AdLabel />
      </div>
    );
  }
  const ad = RAIL_ADS[side];
  return (
    <div data-testid="ad-slot" className="relative hidden w-40 shrink-0 self-start overflow-hidden border border-border xl:block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ad.src} alt={ad.alt} width={160} height={720} className="block h-auto w-full" />
      <AdLabel />
    </div>
  );
}

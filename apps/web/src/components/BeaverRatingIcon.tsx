import { RATING_TICKS, activeMoodIndex } from "@/lib/beaverRating";

const SIZES = { sm: "h-10 w-10", md: "h-16 w-16" } as const;

// One mood face for a company's overall score. Unlike WorkplaceBrowser's
// slider (which shows all 3 with the inactive two dimmed), this shows just
// the one that matches the score.
export function BeaverRatingIcon({
  score,
  size = "md",
  className = "",
}: {
  score: number | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  if (score === null) {
    return <span className={`${SIZES[size]} shrink-0 rounded-full bg-surface-muted ${className}`} aria-hidden="true" />;
  }
  const tick = RATING_TICKS[activeMoodIndex(score)];
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny fixed-size static mood art
    <img src={tick.src} alt={tick.alt} className={`${SIZES[size]} shrink-0 object-contain ${className}`} />
  );
}

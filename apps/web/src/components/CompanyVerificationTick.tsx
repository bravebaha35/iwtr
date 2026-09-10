import type { OwnerTier } from "@iwtr/shared-types";
import { badgeLabelForOwnerTier, tickSrcForOwnerTier } from "@/lib/pricingTiers";

// The badge next to a company's name. Three cases:
//   - a paid tier (Blue / Blue+ / Enterprise) → the coloured tick image
//   - Free tier, but the company IS claimed (has an approved owner) → a
//     minimal, colourless check-mark that reads correctly in light and dark
//   - unclaimed → nothing
//
// `claimed` is only consulted for the Free-tier case; the paid tick already
// implies an active paid owner. Callers that render for a context where the
// company is claimed by definition (the owner's own dashboard, an IWT
// Social post — you must be an approved owner to post) pass `claimed`.
export function CompanyVerificationTick({
  badgeTier,
  claimed,
  size = 18,
  className = "",
}: {
  badgeTier: OwnerTier;
  claimed: boolean;
  size?: number;
  className?: string;
}) {
  const tickSrc = tickSrcForOwnerTier(badgeTier);
  if (tickSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- small local static badge asset
      <img
        src={tickSrc}
        alt={`${badgeLabelForOwnerTier(badgeTier)} verified employer badge`}
        width={size}
        height={size}
        className={`inline-block shrink-0 align-middle ${className}`}
      />
    );
  }

  if (claimed && badgeTier === "FREE") {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        role="img"
        aria-label="Claimed by the employer"
        className={`inline-block shrink-0 align-middle text-muted-foreground ${className}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.5 2.5 2.5 4.5-5.5" />
      </svg>
    );
  }

  return null;
}

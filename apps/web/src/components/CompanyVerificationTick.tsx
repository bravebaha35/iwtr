import type { OwnerTier } from "@iwtr/shared-types";

// The badge next to a company's name. One minimal check-mark symbol at every
// level — only its colour changes with the owner's membership:
//   - Free tier, company is claimed  → muted (no colour)
//   - Starter (Blue)                 → blue
//   - Pro (Blue+)                    → green
//   - Enterprise                     → gold
//   - Free tier, unclaimed           → nothing
//
// The mark is an inline SVG stroked with `currentColor`, so each colour is a
// text-colour class with a light/dark pair — it stays legible in both
// themes. `claimed` is only consulted for the Free case; a paid tier always
// implies an active paid owner (see Company.badgeTier). Callers whose context
// guarantees a claim (the owner's own dashboard, an IWT Social post — you
// must be an approved owner to post) just pass `claimed`.
const TIER_TICK: Record<OwnerTier, { colorClassName: string; label: string }> = {
  FREE: { colorClassName: "text-muted-foreground", label: "Claimed by the employer" },
  BLUE: { colorClassName: "text-blue-600 dark:text-blue-400", label: "Starter member" },
  BLUE_PLUS: { colorClassName: "text-green-600 dark:text-green-400", label: "Pro member" },
  ENTERPRISE: { colorClassName: "text-amber-500 dark:text-amber-400", label: "Enterprise member" },
};

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
  if (badgeTier === "FREE" && !claimed) return null;

  const { colorClassName, label } = TIER_TICK[badgeTier];

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      className={`inline-block shrink-0 align-middle ${colorClassName} ${className}`}
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

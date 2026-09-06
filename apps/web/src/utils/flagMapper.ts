import type { CategoryKey, CompanyWorkplaceVibeFlags, VibeFlag, YellowVibeFlag } from "@iwtr/shared-types";

// Category ordering only (no visible headers — see WorkplaceVibeFlags.tsx)
// so that pooled order stays stable and matches the chart's own category
// sequence rather than whatever order the API happened to return.
const ROW_ORDER: CategoryKey[] = ["corporateCulture", "leadership", "infrastructure", "workLifeBalance", "stability"];

export interface MappedVibeFlags {
  green: VibeFlag[];
  red: VibeFlag[];
  yellow: YellowVibeFlag[];
}

/**
 * Groups one workplaceType section of GET /companies/:slug/vibe-flags into
 * the three chip columns WorkplaceVibeFlags renders. Purely a selector over
 * data the backend already fully resolved (FlagCalculatorService.
 * computeVibeFlags / computeYellowFlags) — never evaluates a survey answer
 * itself, since raw answers never reach the client in the first place.
 */
export function mapVibeFlags(section: CompanyWorkplaceVibeFlags | null): MappedVibeFlags {
  if (!section) return { green: [], red: [], yellow: [] };

  const pooled = ROW_ORDER.flatMap((category) => section.flags.filter((f) => f.category === category));

  return {
    green: pooled.filter((f) => f.color === "GREEN"),
    red: pooled.filter((f) => f.color === "RED"),
    yellow: section.yellowFlags,
  };
}

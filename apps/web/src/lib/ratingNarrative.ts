import type { CategoryKey, VibeFlag, WorkplaceType } from "@iwtr/shared-types";

// Score/work-type/flags -> {image, text} mapping for the company page's
// "Dynamic Rating Visuals" box. Text is no longer fixed prose per tier —
// hand-written copy read the same for every company at a given score/type,
// which the CEO flagged as inaccurate (a 4.2-star office with great
// leadership but bad infrastructure got the exact same paragraph as one with
// the opposite problem). Instead this generates the paragraph from the
// company's own real Workplace Vibe Flags (WorkplaceVibeFlags.tsx / GET
// /companies/:slug/vibe-flags): one clause per category, picked from
// whether that category's 2 flags actually came back GREEN or RED for THIS
// company, plus a tier-framed opening sentence for the overall star level.
// "Pattern" = the per-category/per-state sentence templates below; the
// actual chart flag labels (already work-type-specific, e.g. "Toxic
// Backstabbing" for OFFICE vs "Toxic Machismo & Hazing" for MANUAL_LABOUR —
// see flag-calculator.service.ts's MASTER_FLAG_CHART) get slotted in, so the
// text is automatically flavored per work-type without needing separate
// hand-written paragraphs per type.
type ScoreTier = "unsatisfactory" | "developing" | "effective" | "highlyEffective" | "exemplary";

const WORKPLACE_IMAGE_PREFIX: Record<WorkplaceType, string> = {
  OFFICE: "office",
  HYBRID_REMOTE: "hybrid",
  SERVICE: "service",
  MANUAL_LABOUR: "manuallabour",
};

// Same [min, max) boundaries as shared-types/company.ts's scoreBands (0-2.0
// Unsatisfactory / 2.0-3.0 Developing / 3.0-4.0 Effective / 4.0-5.0 Superb /
// exactly 5.0 Exemplary) — "4.0 to 4.9" in the product copy just means "the
// whole top tier short of a perfect 5.0".
function scoreTier(score: number): ScoreTier {
  if (score >= 5.0) return "exemplary";
  if (score >= 4.0) return "highlyEffective";
  if (score >= 3.0) return "effective";
  if (score >= 2.0) return "developing";
  return "unsatisfactory";
}

const TIER_IMAGE_NUMBER: Record<Exclude<ScoreTier, "exemplary">, number> = {
  unsatisfactory: 1,
  developing: 2,
  effective: 3,
  highlyEffective: 4,
};

// Overall framing sentence, picked purely by the aggregate score tier (same
// tier the image uses) — the one place star-level still speaks directly,
// since a category-by-category paragraph alone never says how the workplace
// reads as a whole. {group} is filled from WORKPLACE_GROUP_NOUN so the same
// 5 sentences still read as work-type-appropriate.
const TIER_OPENING: Record<ScoreTier, string> = {
  unsatisfactory: "This {group} is struggling badly, according to what reviewers report across the board.",
  developing: "This {group} is inconsistent — real strengths are undercut by ongoing weak spots.",
  effective: "This {group} performs solidly across the board, according to reviewers.",
  highlyEffective: "This {group} performs strongly across nearly every area reviewers assessed.",
  exemplary: "This {group} is rated exemplary, excelling across every area reviewers assessed.",
};

const WORKPLACE_GROUP_NOUN: Record<WorkplaceType, string> = {
  OFFICE: "office",
  HYBRID_REMOTE: "remote/hybrid team",
  SERVICE: "service floor",
  MANUAL_LABOUR: "job site",
};

// Category order matches WorkplaceVibeFlags.tsx's ROW_ORDER, so the
// paragraph's clause order matches the flag chips' own display order.
const CATEGORY_ORDER: CategoryKey[] = ["corporateCulture", "leadership", "infrastructure", "workLifeBalance", "stability"];

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  corporateCulture: "Corporate culture",
  leadership: "Leadership",
  infrastructure: "Infrastructure and resources",
  workLifeBalance: "Work-life balance",
  stability: "Organizational stability",
};

// The pattern: one template per category per resolved state, filled with
// that category's actual 2 flag labels. A category is GREEN only when both
// its clusters came back GREEN, RED only when both came back RED, otherwise
// MIXED (one of each) — mirroring how the flag chips themselves render
// (2 flags per category, independently resolved).
function categoryClause(categoryLabel: string, flags: VibeFlag[]): string | null {
  const byCluster = [...flags].sort((a, b) => a.cluster - b.cluster);
  if (byCluster.length < 2) return null;
  const [c1, c2] = byCluster;

  if (c1.color === "GREEN" && c2.color === "GREEN") {
    return `${categoryLabel} is a genuine strength here, driven by ${c1.label} and ${c2.label}.`;
  }
  if (c1.color === "RED" && c2.color === "RED") {
    return `${categoryLabel} is a serious weak point, marked by ${c1.label} and ${c2.label}.`;
  }
  const green = c1.color === "GREEN" ? c1 : c2;
  const red = c1.color === "RED" ? c1 : c2;
  return `${categoryLabel} is mixed here: ${green.label} is a real plus, but ${red.label} still holds it back.`;
}

function generateText(tier: ScoreTier, workplaceType: WorkplaceType, flags: VibeFlag[]): string {
  const opening = TIER_OPENING[tier].replace("{group}", WORKPLACE_GROUP_NOUN[workplaceType]);
  const clauses = CATEGORY_ORDER.map((category) =>
    categoryClause(
      CATEGORY_LABELS[category],
      flags.filter((f) => f.category === category),
    ),
  ).filter((c): c is string => c !== null);

  return [opening, ...clauses].join(" ");
}

export interface RatingNarrative {
  // null only for the exemplary (perfect 5.0) tier — no artwork exists for
  // it yet, a placeholder is shown in its place until one is added.
  imageSrc: string | null;
  text: string;
}

// flags: this company's real vibe flags for `workplaceType` (empty when it
// has no published reviews yet under that type) — see page.tsx, which
// fetches GET /companies/:slug/vibe-flags server-side and passes the
// matching workplaceType's section in.
export function ratingNarrative(score: number, workplaceType: WorkplaceType, flags: VibeFlag[]): RatingNarrative {
  const tier = scoreTier(score);
  const text = generateText(tier, workplaceType, flags);
  if (tier === "exemplary") return { imageSrc: null, text };

  const prefix = WORKPLACE_IMAGE_PREFIX[workplaceType];
  const imageSrc = `/${prefix}${TIER_IMAGE_NUMBER[tier]}.png`;
  return { imageSrc, text };
}

import type { CategoryKey, WorkplaceType } from "@iwtr/shared-types";

// Bump when the pattern-assembly algorithm (PatternGeneratorService) changes
// in a way that should invalidate every stored description (CompanyNarrativeService
// compares row.promptVersion).
export const PROMPT_VERSION = 1;
// Stored in CompanyNarrative.model — a leftover column name from the old
// Claude-based generator, now just this engine's version tag (no LLM
// involved). A mismatch forces regeneration the same way it always did.
export const PATTERN_ENGINE_VERSION = "pattern-engine-v1";

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  corporateCulture: "corporate culture",
  leadership: "leadership",
  infrastructure: "infrastructure",
  workLifeBalance: "work-life balance",
  stability: "job stability",
};

const CATEGORY_ORDER: CategoryKey[] = [
  "corporateCulture",
  "leadership",
  "infrastructure",
  "workLifeBalance",
  "stability",
];

export interface NumbersLineInput {
  workplaceType: WorkplaceType;
  overall: number;
  categories: Record<CategoryKey, number>;
  reviewCount: number;
}

/**
 * Absolute last-resort fallback: a plain, factual sentence built straight
 * from the numbers, used only when neither a fresh pattern-engine assembly
 * nor a previously stored description is available (e.g. a genuine
 * SummaryPattern content gap for this workplaceType).
 */
export function buildNumbersLine(input: NumbersLineInput): string {
  const entries = CATEGORY_ORDER.map((k) => ({ k, v: input.categories[k] }));
  const max = entries.reduce((a, b) => (b.v > a.v ? b : a));
  const min = entries.reduce((a, b) => (b.v < a.v ? b : a));
  const head = `Across ${input.reviewCount} reviews this workplace scores ${input.overall.toFixed(1)} out of 5`;

  if (max.v - min.v < 0.05) {
    return `${head}, with all five areas rating about the same.`;
  }

  const label = (k: CategoryKey) => {
    const l = CATEGORY_LABELS[k];
    return l.charAt(0).toUpperCase() + l.slice(1);
  };
  return `${head}. ${label(max.k)} (${max.v.toFixed(1)}) is the strongest area and ${CATEGORY_LABELS[min.k]} (${min.v.toFixed(1)}) the weakest.`;
}

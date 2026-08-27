import type { WorkplaceType } from "@iwtr/shared-types";
import type { FlagCalculatorService } from "../flags/flag-calculator.service";

interface QuestionTally {
  questionId: string;
  agreeCount: number;
  disagreeCount: number;
}

export interface TurnoverRiskAssessment {
  workplaceType: WorkplaceType;
  // 0-1 fraction of the 4 hazard clusters (Stability x2, Work-Life x2)
  // that resolved RED in the most recent quarter / the prior 9-month
  // baseline respectively.
  recentQuarterHazardRate: number;
  baselineHazardRate: number;
  // True only when the recent quarter is *worse than it used to be* by a
  // meaningful margin — not just "currently bad" (see turnoverRiskPercentage
  // for that). Chronically bad-but-stable is a real risk signal on its own,
  // just not a *sudden* one.
  spikeDetected: boolean;
  // 0-100 — how much of the hazard set is currently red. This is the
  // headline number; spikeDetected is a separate, additional flag on top
  // of it, not a multiplier or adjustment to it.
  turnoverRiskPercentage: number;
  // True when the trailing 12-month window has too few published reviews
  // for the percentage above to mean much — surfaced rather than silently
  // reporting a confident-looking number off of e.g. 2 reviews.
  sampleSizeWarning: boolean;
}

// A jump of at least 1 full hazard-cluster's worth (out of 4) between the
// baseline and the recent quarter counts as a spike — noise from a single
// borderline question tipping one cluster is expected; a quarter-point jump
// is not.
const SPIKE_THRESHOLD = 0.25;

// Below this many total published reviews across the whole 12-month
// window, the hazard rate is one or two people's answers away from
// flipping entirely — not a statement worth calling "statistical" yet.
const MIN_REVIEWS_FOR_CONFIDENCE = 5;

const HAZARD_CATEGORIES = ["stability", "workLifeBalance"] as const;

/**
 * Turnover Risk Prediction Engine's core math — deliberately pure (no DB,
 * no dates) so the spike-detection logic can be verified directly. The
 * hazard set is every Stability + Work-Life cluster (4 total: 2 categories
 * x 2 clusters each) — chosen because those are exactly the categories the
 * spec's own example flags come from (High Turnover/Chaotic Layoffs are
 * Stability reds; Exhausting Shift Lengths is a Work-Life red) — reusing
 * FlagCalculatorService's own cluster-resolution logic rather than
 * re-implementing it, so a hazard cluster is "red" by the exact same
 * definition the Workplace Vibe Flags feature already uses.
 *
 * This is a rule-based heuristic, not a trained model — same "deliberate
 * stand-in for a future AI-backed implementation" status as
 * ModerationService (see its own class comment).
 */
export function computeTurnoverRisk(
  flagCalculator: FlagCalculatorService,
  workplaceType: WorkplaceType,
  recentQuarterQuestions: QuestionTally[],
  baselineQuestions: QuestionTally[],
  totalReviewsInWindow: number,
): TurnoverRiskAssessment {
  const hazardRate = (questions: QuestionTally[]): number => {
    const flags = HAZARD_CATEGORIES.flatMap((category) =>
      flagCalculator.computeCategoryFlags(
        workplaceType,
        category,
        questions.filter((q) => q.questionId.includes(`.${category}.`)),
      ),
    );
    const redCount = flags.filter((f) => f.color === "RED").length;
    return flags.length === 0 ? 0 : redCount / flags.length;
  };

  const recentQuarterHazardRate = hazardRate(recentQuarterQuestions);
  const baselineHazardRate = hazardRate(baselineQuestions);

  return {
    workplaceType,
    recentQuarterHazardRate,
    baselineHazardRate,
    spikeDetected: recentQuarterHazardRate - baselineHazardRate >= SPIKE_THRESHOLD,
    turnoverRiskPercentage: Math.round(recentQuarterHazardRate * 100),
    sampleSizeWarning: totalReviewsInWindow < MIN_REVIEWS_FOR_CONFIDENCE,
  };
}

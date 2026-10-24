import { Injectable } from "@nestjs/common";
import type { CategoryKey, CompanyWorkplaceSurveyStats, WorkplaceType } from "@iwtr/shared-types";
import { YELLOW_FLAG_PAIRS } from "./yellow-flag-pairs.data";
import { themeQuestionIds, themesFor, type FlagTheme } from "./flag-themes.data";
import type { ContradictionPairMatchCount } from "../reviews/survey-tally.util";

export type FlagColor = "GREEN" | "RED";

export interface VibeFlag {
  category: CategoryKey;
  /** The theme's slot within its category (1 or 2), see flag-themes.data.ts. */
  cluster: 1 | 2;
  color: FlagColor;
  label: string;
}

export interface YellowFlag {
  id: string;
  workplaceType: WorkplaceType;
  label: string;
  explanation: string;
  /** Present on a "split opinions" signal, so the page can translate it. */
  split?: { topic: string; green: string; red: string };
}

interface QuestionTally {
  questionId: string;
  agreeCount: number;
  disagreeCount: number;
  preferNotCount?: number;
}

type Verdict = "GREEN" | "RED" | "SPLIT" | "NONE";

export interface ThemeEvaluation {
  theme: FlagTheme;
  /** Healthy answers / (healthy + unhealthy); "prefer not" left out. */
  healthyRate: number | null;
  answered: number;
  /** A legal-minimum question in this theme fell short on its own. */
  legalShortfall: boolean;
  verdict: Verdict;
}

// Flags only once this many people have reviewed the work type: one or two
// reviews are one or two opinions, not a pattern.
export const MIN_REVIEWS_FOR_FLAGS = 3;
// A theme needs at least this many real answers (yes/no, not "prefer not").
const MIN_ANSWERS_PER_THEME = 3;
const GREEN_AT = 0.75;
const GREEN_AT_LEGAL = 0.85;
const RED_AT = 0.4;
// A legal minimum is a warning once 40% or more say it is not met.
const LEGAL_UNMET_SHARE = 0.4;
// Room for floating-point rounding at the exact thresholds.
const EPS = 1e-9;
const SPLIT_MIN_ANSWERS = 6;
const MAX_RED = 6;
const MAX_MIXED = 3;
// A mixed signal needs this share of the work type's reviewers (and 2+ people).
const MIXED_PAIR_SHARE = 1 / 3;

/**
 * How many green flags a work type may show, by its score (0-5, the same
 * average the company's rating is built from). This is what keeps a poorly
 * rated company from wearing a wall of green: below 2 none, below 3 at most
 * one and only when it is near-unanimous.
 */
function greenAllowance(score: number): { max: number; minRate: number } {
  if (score >= 4) return { max: 6, minRate: GREEN_AT };
  if (score >= 3) return { max: 4, minRate: GREEN_AT };
  if (score >= 2) return { max: 1, minRate: 0.85 };
  return { max: 0, minRate: 1 };
}

function rateOf(tallies: QuestionTally[]): { rate: number | null; answered: number } {
  const agree = tallies.reduce((s, q) => s + q.agreeCount, 0);
  const answered = agree + tallies.reduce((s, q) => s + q.disagreeCount, 0);
  return { rate: answered > 0 ? agree / answered : null, answered };
}

/** 0-5 like a review's category score: every non-healthy answer, "prefer not" included, costs the same. */
function categoryScore(tallies: QuestionTally[]): number | null {
  const agree = tallies.reduce((s, q) => s + q.agreeCount, 0);
  const all = tallies.reduce((s, q) => s + q.agreeCount + q.disagreeCount + (q.preferNotCount ?? 0), 0);
  return all > 0 ? (5 * agree) / all : null;
}

/**
 * Workplace Vibe Flags v2 (2026-10-24). Pure, DB-free: works only on the
 * already-anonymized per-question agree/disagree/prefer-not counts of a
 * company's published reviews, never on any one person's answers.
 *
 * A theme (flag-themes.data.ts) is GREEN when reviewers clearly describe the
 * healthy side (75%+, 85%+ for a legal minimum), RED when they clearly
 * describe the unhealthy side (60%+ unhealthy) or when a legal-minimum
 * question on its own is reported as unmet by 40%+, a SPLIT when they are
 * evenly divided, and no flag at all in between or without enough answers.
 * Greens are then capped by the work type's score (greenAllowance).
 */
@Injectable()
export class FlagCalculatorService {
  evaluateTheme(workplaceType: WorkplaceType, theme: FlagTheme, questions: QuestionTally[]): ThemeEvaluation {
    const ids = themeQuestionIds(workplaceType, theme);
    const tallies = questions.filter((q) => ids.includes(q.questionId));
    const { rate, answered } = rateOf(tallies);

    const legalIds = (theme.legal ?? []).map((n) => `${workplaceType}.${theme.category}.${n}`);
    const legalShortfall = tallies
      .filter((q) => legalIds.includes(q.questionId))
      .some((q) => {
        const own = rateOf([q]);
        return own.answered >= 2 && own.rate !== null && 1 - own.rate >= LEGAL_UNMET_SHARE - EPS;
      });

    let verdict: Verdict = "NONE";
    if (rate !== null && answered >= MIN_ANSWERS_PER_THEME) {
      if (legalShortfall || rate <= RED_AT + EPS) verdict = "RED";
      else if (rate >= (legalIds.length > 0 ? GREEN_AT_LEGAL : GREEN_AT) - EPS) verdict = "GREEN";
      else if (rate > RED_AT && rate < 0.6 && answered >= SPLIT_MIN_ANSWERS) verdict = "SPLIT";
    }
    return { theme, healthyRate: rate, answered, legalShortfall, verdict };
  }

  evaluateCategory(workplaceType: WorkplaceType, category: CategoryKey, questions: QuestionTally[]): ThemeEvaluation[] {
    return themesFor(workplaceType, category).map((theme) => this.evaluateTheme(workplaceType, theme, questions));
  }

  /**
   * One category's flags with no score cap (the turnover-risk engine and
   * tests use this). Zero, one or two flags: a theme in the middle ground
   * shows nothing.
   */
  computeCategoryFlags(workplaceType: WorkplaceType, category: CategoryKey, questions: QuestionTally[]): VibeFlag[] {
    return this.evaluateCategory(workplaceType, category, questions)
      .filter((e) => e.verdict === "GREEN" || e.verdict === "RED")
      .map((e) => toFlag(e, e.verdict as FlagColor));
  }

  /** The work type's score (0-5): the mean of its five category scores. */
  workTypeScore(questions: (QuestionTally & { category: CategoryKey })[]): number {
    const categories: CategoryKey[] = ["corporateCulture", "leadership", "infrastructure", "workLifeBalance", "stability"];
    const scores = categories
      .map((c) => categoryScore(questions.filter((q) => q.category === c)))
      .filter((s): s is number => s !== null);
    return scores.length === 0 ? 0 : scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  /**
   * The green and red flags for one work type of a company. None until
   * MIN_REVIEWS_FOR_FLAGS people have reviewed it. Reds first (the most
   * one-sided, and legal shortfalls, lead), then greens up to what the score
   * allows; a green also needs its own category to score 3 or more.
   */
  computeVibeFlags(stats: CompanyWorkplaceSurveyStats): VibeFlag[] {
    if (stats.totalReviews < MIN_REVIEWS_FOR_FLAGS) return [];
    const evaluations = themesFor(stats.workplaceType).map((theme) =>
      this.evaluateTheme(stats.workplaceType, theme, stats.questions),
    );
    const score = this.workTypeScore(stats.questions);

    const redCandidates = evaluations.filter(
      (e) =>
        e.verdict === "RED" ||
        // A low-rated work type: a theme leaning unhealthy is already a warning.
        (score < 2.5 && e.healthyRate !== null && e.answered >= MIN_ANSWERS_PER_THEME && e.healthyRate < 0.5),
    );
    const reds = redCandidates
      .sort((a, b) => Number(b.legalShortfall) - Number(a.legalShortfall) || (a.healthyRate ?? 0) - (b.healthyRate ?? 0))
      .slice(0, MAX_RED);

    const allowance = greenAllowance(score);
    const greens = evaluations
      .filter((e) => e.verdict === "GREEN" && (e.healthyRate ?? 0) >= allowance.minRate)
      .filter((e) => (categoryScore(stats.questions.filter((q) => q.category === e.theme.category)) ?? 0) >= 3)
      .sort((a, b) => (b.healthyRate ?? 0) - (a.healthyRate ?? 0))
      .slice(0, allowance.max);

    return [...reds.map((e) => toFlag(e, "RED")), ...greens.map((e) => toFlag(e, "GREEN"))];
  }

  /**
   * Mixed signals for one work type: contradiction pairs (yellow-flag-
   * pairs.data.ts) that a third or more of its reviewers (and at least two
   * people) answered the contradictory way, then themes where reviewers are
   * evenly split. At most three, pairs first. `questions` is needed for the
   * split ones; without it only pairs are checked.
   */
  computeYellowFlags(
    workplaceType: WorkplaceType,
    totalReviews: number,
    pairMatchCounts: ContradictionPairMatchCount[],
    questions: QuestionTally[] = [],
  ): YellowFlag[] {
    if (totalReviews < MIN_REVIEWS_FOR_FLAGS) return [];
    const matchCountByPairId = new Map(pairMatchCounts.map((m) => [m.pairId, m.matchCount]));

    const pairs: YellowFlag[] = YELLOW_FLAG_PAIRS[workplaceType]
      .map((pair) => ({ pair, count: matchCountByPairId.get(pair.id) ?? 0 }))
      .filter(({ count }) => count >= 2 && count / totalReviews >= MIXED_PAIR_SHARE - EPS)
      .sort((a, b) => b.count - a.count)
      .map(({ pair }) => ({ id: pair.id, workplaceType, label: pair.label, explanation: pair.explanation }));

    const splits: YellowFlag[] =
      questions.length === 0
        ? []
        : themesFor(workplaceType)
            .map((theme) => this.evaluateTheme(workplaceType, theme, questions))
            .filter((e) => e.verdict === "SPLIT")
            .map((e) => ({
              id: `split.${e.theme.category}.${e.theme.slot}`,
              workplaceType,
              label: `Split opinions on ${e.theme.topic}`,
              explanation: `Reviewers are divided: about as many describe "${e.theme.green}" as "${e.theme.red}".`,
              split: { topic: e.theme.topic, green: e.theme.green, red: e.theme.red },
            }));

    return [...pairs, ...splits].slice(0, MAX_MIXED);
  }
}

function toFlag(e: ThemeEvaluation, color: FlagColor): VibeFlag {
  return { category: e.theme.category, cluster: e.theme.slot, color, label: color === "GREEN" ? e.theme.green : e.theme.red };
}

import type { CategoryKey, CompanyWorkplaceSurveyStats, WorkplaceType } from "@iwtr/shared-types";
import { FlagCalculatorService, MIN_REVIEWS_FOR_FLAGS } from "../flag-calculator.service";
import { FLAG_THEMES } from "../flag-themes.data";
import { YELLOW_FLAG_PAIRS } from "../yellow-flag-pairs.data";
import { getQuestionsFor } from "../../reviews/survey-questions.data";

const TYPES: WorkplaceType[] = ["OFFICE", "HYBRID_REMOTE", "SERVICE", "MANUAL_LABOUR"];
const service = new FlagCalculatorService();

/**
 * Builds the anonymous per-question tally for `reviewers` people, where
 * `healthy(questionId)` says how many of them gave the healthy answer (the
 * rest gave the unhealthy one).
 */
function stats(
  workplaceType: WorkplaceType,
  reviewers: number,
  healthy: (questionId: string) => number,
): CompanyWorkplaceSurveyStats {
  return {
    workplaceType,
    totalReviews: reviewers,
    questions: getQuestionsFor(workplaceType).map((q) => {
      const agree = Math.min(reviewers, healthy(q.id));
      return { questionId: q.id, category: q.category, text: q.text, agreeCount: agree, disagreeCount: reviewers - agree, preferNotCount: 0 };
    }),
  };
}

describe("flag definitions", () => {
  it.each(TYPES)("%s: two themes per category, built only from real questions", (type) => {
    const ids = new Set(getQuestionsFor(type).map((q) => q.id));
    const categories: CategoryKey[] = ["corporateCulture", "leadership", "infrastructure", "workLifeBalance", "stability"];
    for (const category of categories) {
      const themes = FLAG_THEMES[type].filter((t) => t.category === category);
      expect(themes.map((t) => t.slot).sort()).toEqual([1, 2]);
      for (const theme of themes) {
        for (const n of theme.questions) expect(ids.has(`${type}.${category}.${n}`)).toBe(true);
        for (const n of theme.legal ?? []) expect(theme.questions).toContain(n);
      }
    }
    for (const pair of YELLOW_FLAG_PAIRS[type]) {
      expect(ids.has(pair.questionAId)).toBe(true);
      expect(ids.has(pair.questionBId)).toBe(true);
    }
  });

  it("never words a flag as a legal finding or an accusation of a crime", () => {
    const words = TYPES.flatMap((type) => [
      ...FLAG_THEMES[type].flatMap((t) => [t.green, t.red, t.topic]),
      ...YELLOW_FLAG_PAIRS[type].flatMap((p) => [p.label, p.explanation]),
    ]).join(" | ");
    expect(words).not.toMatch(/illegal|unlawful|theft|steal|fraud|crime|criminal|scam|violat/i);
  });
});

describe("computeVibeFlags", () => {
  it(`shows nothing until ${MIN_REVIEWS_FOR_FLAGS} people have reviewed the work type`, () => {
    expect(service.computeVibeFlags(stats("OFFICE", MIN_REVIEWS_FOR_FLAGS - 1, () => 0))).toEqual([]);
    expect(service.computeVibeFlags(stats("OFFICE", MIN_REVIEWS_FOR_FLAGS, () => 0)).length).toBeGreaterThan(0);
  });

  it("a top-rated work type gets greens (capped at 6) and no reds", () => {
    const flags = service.computeVibeFlags(stats("OFFICE", 10, () => 10));
    expect(flags.every((f) => f.color === "GREEN")).toBe(true);
    expect(flags).toHaveLength(6);
  });

  it("a work type scoring under 2 gets no greens at all, even where one theme is perfect", () => {
    // Everything unhealthy except the "quick IT help" theme.
    const perfect = new Set(["OFFICE.infrastructure.1", "OFFICE.infrastructure.5"]);
    const flags = service.computeVibeFlags(stats("OFFICE", 10, (id) => (perfect.has(id) ? 10 : 0)));
    expect(flags.some((f) => f.color === "GREEN")).toBe(false);
    expect(flags.filter((f) => f.color === "RED").length).toBeGreaterThan(0);
  });

  it("a work type scoring 2-3 gets at most one green, and only a near-unanimous one", () => {
    // Mostly unhealthy, but Resources is unanimous (two perfect themes).
    const s = stats("OFFICE", 10, (id) =>
      id.startsWith("OFFICE.infrastructure.") || id === "OFFICE.stability.3" || id === "OFFICE.stability.4" ? 10 : id.endsWith(".1") ? 5 : 2,
    );
    const score = service.workTypeScore(s.questions);
    expect(score).toBeGreaterThanOrEqual(2);
    expect(score).toBeLessThan(3);
    const greens = service.computeVibeFlags(s).filter((f) => f.color === "GREEN");
    expect(greens).toHaveLength(1);
    // Stability's pay theme is unanimous too, but Stability itself scores under 3.
    expect(greens[0].category).toBe("infrastructure");
  });

  it("a legal minimum reported as unmet by 40%+ is a red flag, even when the rest looks fine", () => {
    // Everything healthy, except 4 of 10 say unpaid overtime is expected.
    const flags = service.computeVibeFlags(stats("OFFICE", 10, (id) => (id === "OFFICE.workLifeBalance.2" ? 6 : 10)));
    expect(flags).toContainEqual({ category: "workLifeBalance", cluster: 1, color: "RED", label: "Unpaid overtime reported" });
  });

  it("a theme in the middle ground shows no flag", () => {
    // 65% healthy everywhere: neither clearly good nor clearly bad.
    const flags = service.computeVibeFlags(stats("SERVICE", 20, () => 13));
    expect(flags).toEqual([]);
  });

  it("never shows both the green and the red of one theme", () => {
    const flags = service.computeVibeFlags(stats("MANUAL_LABOUR", 10, (id) => (id.endsWith(".1") ? 0 : 10)));
    const keys = flags.map((f) => `${f.category}.${f.cluster}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("computeYellowFlags (mixed signals)", () => {
  const pair = YELLOW_FLAG_PAIRS.OFFICE[0];

  it("shows a contradiction a third or more of reviewers (2+ people) answered", () => {
    expect(service.computeYellowFlags("OFFICE", 6, [{ pairId: pair.id, matchCount: 2 }])).toHaveLength(1);
    expect(service.computeYellowFlags("OFFICE", 9, [{ pairId: pair.id, matchCount: 2 }])).toHaveLength(0);
    expect(service.computeYellowFlags("OFFICE", 3, [{ pairId: pair.id, matchCount: 1 }])).toHaveLength(0);
  });

  it("shows nothing below the review minimum", () => {
    expect(service.computeYellowFlags("OFFICE", 2, [{ pairId: pair.id, matchCount: 2 }])).toEqual([]);
  });

  it("adds 'split opinions' where reviewers are evenly divided, with its parts for translation", () => {
    // Overtime question: 5 of 10 healthy. Everything else healthy.
    const s = stats("OFFICE", 10, (id) => (id === "OFFICE.workLifeBalance.2" ? 5 : 10));
    // A legal minimum at 50% is red, not split; use a non-legal theme instead.
    const s2 = stats("OFFICE", 10, (id) => (id === "OFFICE.infrastructure.1" || id === "OFFICE.infrastructure.5" ? 5 : 10));
    expect(service.computeYellowFlags("OFFICE", 10, [], s.questions).some((y) => y.id === "split.workLifeBalance.1")).toBe(false);
    const split = service.computeYellowFlags("OFFICE", 10, [], s2.questions).find((y) => y.id === "split.infrastructure.1");
    expect(split?.split).toEqual({ topic: "computers and IT help", green: "Working tech, quick IT help", red: "Tech slows the work down" });
  });

  it("shows at most three mixed signals, contradictions first", () => {
    const counts = YELLOW_FLAG_PAIRS.OFFICE.map((p) => ({ pairId: p.id, matchCount: 5 }));
    const s = stats("OFFICE", 10, () => 5);
    const yellow = service.computeYellowFlags("OFFICE", 10, counts, s.questions);
    expect(yellow).toHaveLength(3);
    expect(yellow.every((y) => !y.id.startsWith("split."))).toBe(true);
  });
});

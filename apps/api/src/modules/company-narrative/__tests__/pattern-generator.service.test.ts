import type { SurveyQuestionStats } from "@iwtr/shared-types";
import type { VibeFlag } from "../../flags/flag-calculator.service";
import {
  MIN_DESCRIPTION_CHARS,
  MAX_DESCRIPTION_CHARS,
  PatternGeneratorService,
  qnaKeyFor,
  flagKeyFor,
  introOrConclusionKeyFor,
  rankQuestions,
  type PatternRow,
} from "../pattern-generator.service";

function question(
  questionId: string,
  category: SurveyQuestionStats["category"],
  agreeCount: number,
  disagreeCount: number,
): SurveyQuestionStats {
  return { questionId, category, text: questionId, agreeCount, disagreeCount, preferNotCount: 0 };
}

function flag(category: VibeFlag["category"], cluster: 1 | 2, color: "GREEN" | "RED", label: string): VibeFlag {
  return { category, cluster, color, label };
}

function pattern(
  category: PatternRow["category"],
  textBlock: string,
  keys: { qnaKey?: string; flagKey?: string } = {},
): PatternRow {
  return { id: `${category}:${keys.qnaKey ?? keys.flagKey ?? textBlock}`, category, qnaKey: keys.qnaKey ?? null, flagKey: keys.flagKey ?? null, textBlock };
}

const svc = new PatternGeneratorService();

describe("rankQuestions", () => {
  it("orders by margin (most lopsided answer first) and drops exact ties", () => {
    const ranked = rankQuestions([
      question("A", "stability", 5, 5), // tie -> dropped
      question("B", "stability", 6, 4), // margin 0.2
      question("C", "stability", 9, 1), // margin 0.8
      question("D", "stability", 0, 0), // unanswered -> dropped
    ]);
    expect(ranked.map((r) => r.questionId)).toEqual(["C", "B"]);
    expect(ranked[0].direction).toBe("AGREE");
  });

  it("is deterministic: equal margins tie-break by questionId", () => {
    const ranked = rankQuestions([question("Z", "stability", 8, 2), question("A", "stability", 8, 2)]);
    expect(ranked.map((r) => r.questionId)).toEqual(["A", "Z"]);
  });
});

describe("PatternGeneratorService.generate — priority logic", () => {
  const workplaceType = "MANUAL_LABOUR" as const;

  it("prefers a QNA_SECONDARY block over a flag for the top-up slot when both are authored", () => {
    const questions = [
      question("MANUAL_LABOUR.stability.1", "stability", 9, 1),
      question("MANUAL_LABOUR.infrastructure.2", "infrastructure", 8, 2),
      question("MANUAL_LABOUR.workLifeBalance.3", "workLifeBalance", 7, 3),
    ];
    const flags = [flag("stability", 1, "GREEN", "Accurate Hazard Pay")];
    const patterns = [
      pattern("QNA_PRIMARY", "Paychecks here arrive on time, every single cycle, without you ever needing to chase management for what you're owed.", { qnaKey: qnaKeyFor("MANUAL_LABOUR.stability.1", "AGREE") }),
      pattern("QNA_SECONDARY", "Safety gear shows up on your very first day already, fully issued and free of charge, no waiting period at all.", { qnaKey: qnaKeyFor("MANUAL_LABOUR.infrastructure.2", "AGREE") }),
      // Third-ranked question's own content is what the 450-floor cascade
      // should reach for — it must be preferred over the flag below even
      // during the cascade, not just at the initial pick.
      pattern("QNA_SECONDARY", "Scheduling here is posted two weeks ahead, so planning the rest of your life around shifts is actually realistic.", { qnaKey: qnaKeyFor("MANUAL_LABOUR.workLifeBalance.3", "AGREE") }),
      pattern("FLAG_FALLBACK", "Hazard pay is calculated correctly every single cycle, matching exactly what the schedule says you're due.", { flagKey: flagKeyFor("stability", 1, "GREEN") }),
      pattern("CONCLUSION", "Overall, the basics that matter most here are consistently handled the right way, cycle after cycle, without fail.", { qnaKey: introOrConclusionKeyFor(workplaceType, "CONCLUSION") }),
    ];

    const out = svc.generate({ workplaceType, questions, flags, patterns })!;

    expect(out.length).toBeGreaterThanOrEqual(MIN_DESCRIPTION_CHARS);
    expect(out).toContain("Safety gear shows up on");
    expect(out).toContain("Scheduling here is posted two weeks ahead");
    expect(out).not.toContain("Hazard pay is calculated correctly");
  });

  it("falls back to a same-category flag when no QNA_SECONDARY is authored for the runner-up question", () => {
    const questions = [
      question("MANUAL_LABOUR.workLifeBalance.1", "workLifeBalance", 1, 9), // negative primary
      question("MANUAL_LABOUR.stability.2", "stability", 2, 8), // no authored content at all, below
    ];
    const flags = [
      flag("workLifeBalance", 1, "RED", "Denied Rest & Water"),
      flag("corporateCulture", 1, "RED", "Speed Over Safety"),
    ];
    const patterns = [
      pattern("QNA_PRIMARY", "Shift lengths on this site run so long that most workers describe the job as physically brutal by the time the week is finally over and the schedule resets for the next one.", { qnaKey: qnaKeyFor("MANUAL_LABOUR.workLifeBalance.1", "DISAGREE") }),
      pattern("FLAG_FALLBACK", "Rest breaks and drinking water get denied outright whenever the production line is running behind its daily schedule target for that shift.", { flagKey: flagKeyFor("workLifeBalance", 1, "RED") }),
      pattern("FLAG_FALLBACK", "Speed is consistently pushed over basic on-site safety, according to the people who actually work there day to day.", { flagKey: flagKeyFor("corporateCulture", 1, "RED") }),
      pattern("CONCLUSION", "Come prepared for a demanding, physically draining pace if you decide to take a role at this particular manual-labour site of theirs overall.", { qnaKey: introOrConclusionKeyFor(workplaceType, "CONCLUSION") }),
    ];

    const out = svc.generate({ workplaceType, questions, flags, patterns })!;

    // Same-category (workLifeBalance) flag reinforces the primary's theme —
    // preferred over the unrelated corporateCulture flag.
    expect(out.length).toBeGreaterThanOrEqual(MIN_DESCRIPTION_CHARS);
    expect(out).toContain("Rest breaks and drinking water get denied");
    expect(out).not.toContain("Speed is consistently pushed over basic");
  });

  it("selects the single most distinct question as primary, not merely the first one listed", () => {
    const questions = [
      question("MANUAL_LABOUR.stability.1", "stability", 6, 4), // margin 0.2
      question("MANUAL_LABOUR.infrastructure.2", "infrastructure", 9, 1), // margin 0.8 -> should win
    ];
    const patterns = [
      pattern("QNA_PRIMARY", "Paychecks are usually fine.", { qnaKey: qnaKeyFor("MANUAL_LABOUR.stability.1", "AGREE") }),
      pattern("QNA_PRIMARY", "Every worker gets free PPE on day one.", { qnaKey: qnaKeyFor("MANUAL_LABOUR.infrastructure.2", "AGREE") }),
      pattern("CONCLUSION", "A solid place to work overall.", { qnaKey: introOrConclusionKeyFor(workplaceType, "CONCLUSION") }),
    ];

    const out = svc.generate({ workplaceType, questions, flags: [], patterns });

    expect(out).toContain("Every worker gets free PPE on day one.");
  });

  it("produces only one QNA_PRIMARY block for an all-positive company (no negative signal at all)", () => {
    const questions = [question("MANUAL_LABOUR.stability.1", "stability", 9, 1)];
    const patterns = [
      pattern("QNA_PRIMARY", "Paychecks arrive on time, every time.", { qnaKey: qnaKeyFor("MANUAL_LABOUR.stability.1", "AGREE") }),
      pattern("CONCLUSION", "A dependable place to work.", { qnaKey: introOrConclusionKeyFor(workplaceType, "CONCLUSION") }),
    ];

    const out = svc.generate({ workplaceType, questions, flags: [], patterns })!;

    expect(out.startsWith("Paychecks arrive on time")).toBe(true);
    expect(out.endsWith("A dependable place to work.")).toBe(true);
  });

  it("opens with the INTRO fallback when no question has a clear majority (every answer exactly tied)", () => {
    const questions = [question("MANUAL_LABOUR.stability.1", "stability", 5, 5)];
    const patterns = [
      pattern("INTRO", "Reviews here are still mixed and evolving.", { qnaKey: introOrConclusionKeyFor(workplaceType, "INTRO") }),
      pattern("CONCLUSION", "Check back as more reviews come in.", { qnaKey: introOrConclusionKeyFor(workplaceType, "CONCLUSION") }),
    ];

    const out = svc.generate({ workplaceType, questions, flags: [], patterns });

    expect(out).toBe("Reviews here are still mixed and evolving. Check back as more reviews come in.");
  });

  it("returns null when even the CONCLUSION tier has no authored content for this workplaceType", () => {
    const out = svc.generate({ workplaceType, questions: [], flags: [], patterns: [] });
    expect(out).toBeNull();
  });

  it("is deterministic across repeated calls with identical input", () => {
    const questions = [question("MANUAL_LABOUR.stability.1", "stability", 9, 1)];
    const patterns = [
      pattern("QNA_PRIMARY", "Paychecks arrive on time, every time.", { qnaKey: qnaKeyFor("MANUAL_LABOUR.stability.1", "AGREE") }),
      pattern("CONCLUSION", "A dependable place to work.", { qnaKey: introOrConclusionKeyFor(workplaceType, "CONCLUSION") }),
    ];
    const input = { workplaceType, questions, flags: [], patterns };
    expect(svc.generate(input)).toBe(svc.generate(input));
  });
});

describe("PatternGeneratorService.generate — 450 minimum enforcement", () => {
  const workplaceType = "OFFICE" as const;

  it("cascades to a second-most-distinct question, then a flag, until the 450 floor is crossed", () => {
    const questions = [
      question("OFFICE.workLifeBalance.1", "workLifeBalance", 9, 1),
      question("OFFICE.corporateCulture.3", "corporateCulture", 8, 2),
      question("OFFICE.leadership.4", "leadership", 7, 3),
    ];
    const flags = [flag("infrastructure", 1, "GREEN", "Modern Equipment")];
    const patterns = [
      pattern("QNA_PRIMARY", "Autonomy here is real: you own your own deliverables end to end without a manager hovering over every step.", {
        qnaKey: qnaKeyFor("OFFICE.workLifeBalance.1", "AGREE"),
      }),
      // Only PRIMARY-tier content exists for the runner-up questions — no
      // QNA_SECONDARY rows — so the floor cascade must fall through to them
      // via their PRIMARY row, then to the flag.
      pattern("QNA_PRIMARY", "Disagreements with a decision can be raised openly in the room without anyone worrying about being punished for speaking up later.", {
        qnaKey: qnaKeyFor("OFFICE.corporateCulture.3", "AGREE"),
      }),
      pattern("QNA_PRIMARY", "Managers here give feedback you can actually act on instead of vague, generic comments at review time.", {
        qnaKey: qnaKeyFor("OFFICE.leadership.4", "AGREE"),
      }),
      pattern("FLAG_FALLBACK", "Desks and equipment are kept current rather than being left to limp along for years past their prime.", {
        flagKey: flagKeyFor("infrastructure", 1, "GREEN"),
      }),
      pattern("CONCLUSION", "Overall, this is a comfortable, well-run place to build a career for the long haul.", {
        qnaKey: introOrConclusionKeyFor(workplaceType, "CONCLUSION"),
      }),
    ];

    const out = svc.generate({ workplaceType, questions, flags, patterns })!;

    expect(out.length).toBeGreaterThanOrEqual(MIN_DESCRIPTION_CHARS);
    expect(out.length).toBeLessThanOrEqual(MAX_DESCRIPTION_CHARS);
    expect(out).toContain("Disagreements with a decision");
  });
});

describe("PatternGeneratorService.generate — 600 maximum enforcement", () => {
  const workplaceType = "OFFICE" as const;
  const longSentence = (label: string) => `${label} ${"padding word ".repeat(20)}.`.trim();

  it("swaps in the shorter pre-measured conclusion when the natural assembly exceeds 600", () => {
    const questions = [
      question("OFFICE.workLifeBalance.1", "workLifeBalance", 9, 1),
      question("OFFICE.corporateCulture.1", "corporateCulture", 1, 9),
    ];
    const patterns = [
      pattern("QNA_PRIMARY", longSentence("Positive primary."), { qnaKey: qnaKeyFor("OFFICE.workLifeBalance.1", "AGREE") }),
      pattern("QNA_PRIMARY", longSentence("Negative primary."), { qnaKey: qnaKeyFor("OFFICE.corporateCulture.1", "DISAGREE") }),
      pattern("CONCLUSION", longSentence("Long conclusion."), { qnaKey: introOrConclusionKeyFor(workplaceType, "CONCLUSION") }),
      pattern("CONCLUSION", "Short conclusion.", { qnaKey: introOrConclusionKeyFor(workplaceType, "CONCLUSION") }),
    ];

    const out = svc.generate({ workplaceType, questions, flags: [], patterns })!;

    expect(out.length).toBeLessThanOrEqual(MAX_DESCRIPTION_CHARS);
    expect(out).toContain("Short conclusion.");
    expect(out).not.toContain("Long conclusion.");
  });

  it("drops the flag/secondary extras as a last resort when swapping alone isn't enough", () => {
    const questions = [
      question("OFFICE.workLifeBalance.1", "workLifeBalance", 9, 1),
      question("OFFICE.corporateCulture.1", "corporateCulture", 1, 9),
    ];
    const flags = [flag("leadership", 1, "RED", "Extreme Micromanagement")];
    const patterns = [
      pattern("QNA_PRIMARY", longSentence("Positive primary."), { qnaKey: qnaKeyFor("OFFICE.workLifeBalance.1", "AGREE") }),
      pattern("QNA_PRIMARY", longSentence("Negative primary."), { qnaKey: qnaKeyFor("OFFICE.corporateCulture.1", "DISAGREE") }),
      pattern("FLAG_FALLBACK", longSentence("Flag fallback."), { flagKey: flagKeyFor("leadership", 1, "RED") }),
      pattern("CONCLUSION", "Short conclusion.", { qnaKey: introOrConclusionKeyFor(workplaceType, "CONCLUSION") }),
    ];

    const out = svc.generate({ workplaceType, questions, flags, patterns })!;

    expect(out.length).toBeLessThanOrEqual(MAX_DESCRIPTION_CHARS);
    expect(out).not.toContain("Flag fallback.");
  });
});

// Reproduces the CEO-provided examples verbatim as seeded content, to prove
// the engine's assembly order and length land exactly where the spec says.
describe("PatternGeneratorService.generate — CEO worked examples", () => {
  it("Manual-Labour factory profile", () => {
    const workplaceType = "MANUAL_LABOUR" as const;
    const questions = [
      question("MANUAL_LABOUR.stability.1", "stability", 9, 1),
      question("MANUAL_LABOUR.infrastructure.2", "infrastructure", 8, 2),
      question("MANUAL_LABOUR.workLifeBalance.1", "workLifeBalance", 1, 9),
    ];
    const flags = [flag("workLifeBalance", 1, "RED", "Denied Rest & Water")];
    const patterns = [
      pattern(
        "QNA_PRIMARY",
        "Working at this facility means you will always receive your paycheck on time without chasing down management, providing real financial peace of mind.",
        { qnaKey: qnaKeyFor("MANUAL_LABOUR.stability.1", "AGREE") },
      ),
      pattern("QNA_SECONDARY", "The company also provides all required safety gear for free on your first day.", {
        qnaKey: qnaKeyFor("MANUAL_LABOUR.infrastructure.2", "AGREE"),
      }),
      pattern("QNA_PRIMARY", "However, workers report that the daily shift lengths are deeply exhausting.", {
        qnaKey: qnaKeyFor("MANUAL_LABOUR.workLifeBalance.1", "DISAGREE"),
      }),
      pattern(
        "FLAG_FALLBACK",
        "Management enforces speed over physical recovery, often denying mandatory rest breaks and water when the production line is busy.",
        { flagKey: flagKeyFor("workLifeBalance", 1, "RED") },
      ),
      pattern(
        "CONCLUSION",
        "While the pay is highly reliable and the safety equipment is modern, you must be prepared for a physically punishing daily pace on the floor.",
        { qnaKey: introOrConclusionKeyFor(workplaceType, "CONCLUSION") },
      ),
    ];

    const out = svc.generate({ workplaceType, questions, flags, patterns });

    expect(out).toBe(
      [
        "Working at this facility means you will always receive your paycheck on time without chasing down management, providing real financial peace of mind.",
        "The company also provides all required safety gear for free on your first day.",
        "However, workers report that the daily shift lengths are deeply exhausting.",
        "Management enforces speed over physical recovery, often denying mandatory rest breaks and water when the production line is busy.",
        "While the pay is highly reliable and the safety equipment is modern, you must be prepared for a physically punishing daily pace on the floor.",
      ].join(" "),
    );
    expect(out!.length).toBeGreaterThanOrEqual(MIN_DESCRIPTION_CHARS);
    expect(out!.length).toBeLessThanOrEqual(MAX_DESCRIPTION_CHARS);
  });

  it("Office/Tech corporate profile", () => {
    const workplaceType = "OFFICE" as const;
    const questions = [
      question("OFFICE.workLifeBalance.1", "workLifeBalance", 9, 1),
      question("OFFICE.corporateCulture.3", "corporateCulture", 8, 2),
      question("OFFICE.workLifeBalance.2", "workLifeBalance", 1, 9),
    ];
    const flags = [flag("workLifeBalance", 2, "RED", "After-Hours Pressure")];
    const patterns = [
      pattern(
        "QNA_PRIMARY",
        "The daily environment here offers high employee autonomy, allowing you to focus on your deliverables without being subjected to extreme micromanagement.",
        { qnaKey: qnaKeyFor("OFFICE.workLifeBalance.1", "AGREE") },
      ),
      pattern("QNA_SECONDARY", "Teams collaborate well and internal knowledge is openly shared among departments.", {
        qnaKey: qnaKeyFor("OFFICE.corporateCulture.3", "AGREE"),
      }),
      pattern(
        "QNA_PRIMARY",
        "The major downside is an intense culture that expects uncompensated overtime and after-hours communication.",
        { qnaKey: qnaKeyFor("OFFICE.workLifeBalance.2", "DISAGREE") },
      ),
      pattern("FLAG_FALLBACK", "You will frequently be contacted during your time off.", {
        flagKey: flagKeyFor("workLifeBalance", 2, "RED"),
      }),
      pattern(
        "CONCLUSION",
        "This is a stable environment for career growth, but you must aggressively set boundaries to protect your personal time.",
        { qnaKey: introOrConclusionKeyFor(workplaceType, "CONCLUSION") },
      ),
    ];

    const out = svc.generate({ workplaceType, questions, flags, patterns });

    expect(out).toBe(
      [
        "The daily environment here offers high employee autonomy, allowing you to focus on your deliverables without being subjected to extreme micromanagement.",
        "Teams collaborate well and internal knowledge is openly shared among departments.",
        "The major downside is an intense culture that expects uncompensated overtime and after-hours communication.",
        "You will frequently be contacted during your time off.",
        "This is a stable environment for career growth, but you must aggressively set boundaries to protect your personal time.",
      ].join(" "),
    );
    expect(out!.length).toBeGreaterThanOrEqual(MIN_DESCRIPTION_CHARS);
    expect(out!.length).toBeLessThanOrEqual(MAX_DESCRIPTION_CHARS);
  });
});

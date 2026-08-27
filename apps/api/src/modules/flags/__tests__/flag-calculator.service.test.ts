import type { CategoryKey, WorkplaceType } from "@iwtr/shared-types";
import { FlagCalculatorService } from "../flag-calculator.service";

// One row per (workplaceType, category) exactly as transcribed from the
// Master Dual-Opposite Flag Chart PDF. Doubles as a transcription-accuracy
// test: every one of the 80 flag strings gets asserted below.
const CHART_ROWS: [WorkplaceType, CategoryKey, { green1: string; green2: string; red1: string; red2: string }][] = [
  ["OFFICE", "corporateCulture", { green1: "Collaborative Team", green2: "Ethical Leadership", red1: "Toxic Backstabbing", red2: "Hypocritical Leadership" }],
  ["OFFICE", "leadership", { green1: "Accountable Managers", green2: "Actionable Feedback", red1: "Blames Subordinates", red2: "Extreme Micromanagement" }],
  ["OFFICE", "infrastructure", { green1: "Modern Equipment", green2: "Fast IT Support", red1: "Outdated Tech", red2: "Neglected Maintenance" }],
  ["OFFICE", "workLifeBalance", { green1: "Paid Overtime", green2: "Disconnect After Hours", red1: "Unpaid Overtime Expected", red2: "After-Hours Pressure" }],
  ["OFFICE", "stability", { green1: "High Job Security", green2: "Predictable Promotions", red1: "High Turnover", red2: "Chaotic Layoffs" }],

  ["HYBRID_REMOTE", "corporateCulture", { green1: "Trust Without Tracking", green2: "Timezones Respected", red1: "Surveillance Software", red2: "Ignored Timezones" }],
  ["HYBRID_REMOTE", "leadership", { green1: "Outcome-Based Evaluation", green2: "Proactive Burnout Care", red1: "Status Icon Tracking", red2: "Burnout Ignored" }],
  ["HYBRID_REMOTE", "infrastructure", { green1: "Hardware Stipend", green2: "Reliable Cloud Access", red1: "Forced Personal Tech", red2: "Unreliable Remote Access" }],
  ["HYBRID_REMOTE", "workLifeBalance", { green1: "Enforced Disconnect", green2: "Manageable Workload", red1: "Blurred Unpaid Hours", red2: "Pointless RTO Mandates" }],
  ["HYBRID_REMOTE", "stability", { green1: "Equal Remote Pay", green2: "Secure Remote Policy", red1: "Remote Pay Penalties", red2: "Constant RTO Threats" }],

  ["SERVICE", "corporateCulture", { green1: "Defends Staff From Customers", green2: "Realistic Speed Targets", red1: "Customer Is Always Right", red2: "Dangerous Service Shortcuts" }],
  ["SERVICE", "leadership", { green1: "Hands-On Management", green2: "Impartial Scheduling", red1: "Absent During Peaks", red2: "Supervisor Favoritism" }],
  ["SERVICE", "infrastructure", { green1: "Reliable Service Tech", green2: "Sanitary Break Areas", red1: "Crashing POS Systems", red2: "Neglected Break Zones" }],
  ["SERVICE", "workLifeBalance", { green1: "Advanced Schedule Notice", green2: "Voluntary Overtime", red1: "Last-Minute Shift Changes", red2: "Forced Clopening Shifts" }],
  ["SERVICE", "stability", { green1: "100% Accurate Wages", green2: "Fully Staffed Shifts", red1: "Wage & Tip Theft", red2: "Constant Understaffing" }],

  ["MANUAL_LABOUR", "corporateCulture", { green1: "Health & Safety First", green2: "Respectful Site Culture", red1: "Speed Over Safety", red2: "Toxic Machismo & Hazing" }],
  ["MANUAL_LABOUR", "leadership", { green1: "Experienced Foremen", green2: "Immediate Hazard Resolution", red1: "Inexperienced Management", red2: "Unsafe Conditions Ignored" }],
  ["MANUAL_LABOUR", "infrastructure", { green1: "Safe Heavy Machinery", green2: "Free Required PPE", red1: "Unsafe Equipment", red2: "PPE Not Provided" }],
  ["MANUAL_LABOUR", "workLifeBalance", { green1: "Enforced Hydration Breaks", green2: "Safe Shift Durations", red1: "Denied Rest & Water", red2: "Exhausting Shift Lengths" }],
  ["MANUAL_LABOUR", "stability", { green1: "Accurate Hazard Pay", green2: "Consistent Year-Round Work", red1: "Missing Hazard Pay", red2: "Chaotic Hire-and-Fire" }],
];

// Cluster 1 = the category's Q1-Q3 (3 questions), Cluster 2 = Q4-Q5 (2 questions).
function questionId(workplaceType: WorkplaceType, category: CategoryKey, n: number): string {
  return `${workplaceType}.${category}.${n}`;
}

function tally(questionId: string, agreeCount: number, disagreeCount: number) {
  return { questionId, agreeCount, disagreeCount };
}

describe("FlagCalculatorService.computeCategoryFlags", () => {
  const service = new FlagCalculatorService();

  it.each(CHART_ROWS)("labels %s / %s correctly when every question in both clusters leans positive", (workplaceType, category, flags) => {
    const questions = [
      tally(questionId(workplaceType, category, 1), 8, 2),
      tally(questionId(workplaceType, category, 2), 6, 4),
      tally(questionId(workplaceType, category, 3), 9, 1),
      tally(questionId(workplaceType, category, 4), 7, 3),
      tally(questionId(workplaceType, category, 5), 5, 2),
    ];

    const result = service.computeCategoryFlags(workplaceType, category, questions);

    expect(result).toEqual([
      { category, cluster: 1, color: "GREEN", label: flags.green1 },
      { category, cluster: 2, color: "GREEN", label: flags.green2 },
    ]);
  });

  it.each(CHART_ROWS)("labels %s / %s correctly when every question in both clusters leans negative", (workplaceType, category, flags) => {
    const questions = [
      tally(questionId(workplaceType, category, 1), 2, 8),
      tally(questionId(workplaceType, category, 2), 4, 6),
      tally(questionId(workplaceType, category, 3), 1, 9),
      tally(questionId(workplaceType, category, 4), 3, 7),
      tally(questionId(workplaceType, category, 5), 2, 5),
    ];

    const result = service.computeCategoryFlags(workplaceType, category, questions);

    expect(result).toEqual([
      { category, cluster: 1, color: "RED", label: flags.red1 },
      { category, cluster: 2, color: "RED", label: flags.red2 },
    ]);
  });

  it("clusters on a per-question majority basis: 2 of 3 questions leaning positive is 67% -> GREEN", () => {
    const questions = [
      tally(questionId("OFFICE", "corporateCulture", 1), 10, 1), // positive
      tally(questionId("OFFICE", "corporateCulture", 2), 1, 10), // negative
      tally(questionId("OFFICE", "corporateCulture", 3), 6, 5), // positive
      tally(questionId("OFFICE", "corporateCulture", 4), 5, 3),
      tally(questionId("OFFICE", "corporateCulture", 5), 5, 3),
    ];

    const result = service.computeCategoryFlags("OFFICE", "corporateCulture", questions);

    expect(result[0]).toEqual({ category: "corporateCulture", cluster: 1, color: "GREEN", label: "Collaborative Team" });
  });

  it("clusters on a per-question majority basis: 1 of 3 questions leaning positive is 33% -> RED", () => {
    const questions = [
      tally(questionId("OFFICE", "corporateCulture", 1), 10, 1), // positive
      tally(questionId("OFFICE", "corporateCulture", 2), 1, 10), // negative
      tally(questionId("OFFICE", "corporateCulture", 3), 2, 9), // negative
      tally(questionId("OFFICE", "corporateCulture", 4), 5, 3),
      tally(questionId("OFFICE", "corporateCulture", 5), 5, 3),
    ];

    const result = service.computeCategoryFlags("OFFICE", "corporateCulture", questions);

    expect(result[0]).toEqual({ category: "corporateCulture", cluster: 1, color: "RED", label: "Toxic Backstabbing" });
  });

  it("a 3-question cluster can never land on an exact 50/50 tie", () => {
    // Exhaustively check every possible positive/negative combination
    // (2^3 = 8) never produces a percentage of exactly 50.
    const combos: [boolean, boolean, boolean][] = [
      [true, true, true], [true, true, false], [true, false, true], [false, true, true],
      [true, false, false], [false, true, false], [false, false, true], [false, false, false],
    ];
    for (const [a, b, c] of combos) {
      const questions = [
        tally(questionId("OFFICE", "corporateCulture", 1), a ? 9 : 1, a ? 1 : 9),
        tally(questionId("OFFICE", "corporateCulture", 2), b ? 9 : 1, b ? 1 : 9),
        tally(questionId("OFFICE", "corporateCulture", 3), c ? 9 : 1, c ? 1 : 9),
        tally(questionId("OFFICE", "corporateCulture", 4), 5, 3),
        tally(questionId("OFFICE", "corporateCulture", 5), 5, 3),
      ];
      const result = service.computeCategoryFlags("OFFICE", "corporateCulture", questions);
      const positiveCount = [a, b, c].filter(Boolean).length;
      const expectedColor = positiveCount > 1.5 ? "GREEN" : "RED"; // 2 or 3 positive -> GREEN, 0 or 1 -> RED
      expect(result[0].color).toBe(expectedColor);
    }
  });

  it("an exact 50/50 tie on the 2-question cluster defaults to RED (worker-safety tie-break)", () => {
    const questions = [
      tally(questionId("OFFICE", "corporateCulture", 1), 5, 3),
      tally(questionId("OFFICE", "corporateCulture", 2), 5, 3),
      tally(questionId("OFFICE", "corporateCulture", 3), 5, 3),
      tally(questionId("OFFICE", "corporateCulture", 4), 10, 1), // positive
      tally(questionId("OFFICE", "corporateCulture", 5), 1, 10), // negative
    ];

    const result = service.computeCategoryFlags("OFFICE", "corporateCulture", questions);

    expect(result[1]).toEqual({ category: "corporateCulture", cluster: 2, color: "RED", label: "Hypocritical Leadership" });
  });

  it("treats an exact agree/disagree tie on a single question as not-positive (also defaults toward RED)", () => {
    const questions = [
      tally(questionId("OFFICE", "corporateCulture", 1), 5, 5), // tied -> not positive
      tally(questionId("OFFICE", "corporateCulture", 2), 1, 10), // negative
      tally(questionId("OFFICE", "corporateCulture", 3), 10, 1), // positive
      tally(questionId("OFFICE", "corporateCulture", 4), 5, 3),
      tally(questionId("OFFICE", "corporateCulture", 5), 5, 3),
    ];

    // Only 1 of 3 (33%) truly positive -> RED, proving the tied question did not count as positive.
    const result = service.computeCategoryFlags("OFFICE", "corporateCulture", questions);

    expect(result[0]).toEqual({ category: "corporateCulture", cluster: 1, color: "RED", label: "Toxic Backstabbing" });
  });
});

describe("FlagCalculatorService.computeVibeFlags", () => {
  const service = new FlagCalculatorService();

  it("returns no flags when the company has zero published reviews for this workplace type", () => {
    const result = service.computeVibeFlags({
      workplaceType: "OFFICE",
      totalReviews: 0,
      questions: [],
    });

    expect(result).toEqual([]);
  });

  it("returns exactly 10 flags (5 categories x 2 clusters) for a company with reviews, never exposing raw counts", () => {
    const categories: CategoryKey[] = ["corporateCulture", "leadership", "infrastructure", "workLifeBalance", "stability"];
    const questions = categories.flatMap((category) =>
      [1, 2, 3, 4, 5].map((n) => ({
        questionId: questionId("OFFICE", category, n),
        category,
        text: "irrelevant",
        agreeCount: 8,
        disagreeCount: 2,
        preferNotCount: 0,
      })),
    );

    const result = service.computeVibeFlags({ workplaceType: "OFFICE", totalReviews: 10, questions });

    expect(result).toHaveLength(10);
    for (const flag of result) {
      expect(Object.keys(flag).sort()).toEqual(["category", "cluster", "color", "label"]);
    }
    expect(result.filter((f) => f.color === "GREEN")).toHaveLength(10); // 8-2 is positive on every question here
  });
});

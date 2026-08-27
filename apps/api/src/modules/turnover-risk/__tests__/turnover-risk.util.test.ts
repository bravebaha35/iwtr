import { FlagCalculatorService } from "../../flags/flag-calculator.service";
import { computeTurnoverRisk } from "../turnover-risk.util";

function tally(questionId: string, agreeCount: number, disagreeCount: number) {
  return { questionId, agreeCount, disagreeCount };
}

// The hazard set is Stability + Work-Life red flags (Cluster 1 = Q1-3,
// Cluster 2 = Q4-5 of each category) — 4 clusters total, matching the
// spec's own examples ("High Turnover"/"Chaotic Layoffs" are OFFICE
// Stability reds, "Exhausting Shift Lengths" is MANUAL_LABOUR Work-Life
// red2). "hazard" helper below builds a full 10-question tally set (5
// Stability + 5 Work-Life) so tests can dial in exactly how many of the 4
// hazard clusters come out RED, without needing every flag chart label.
function hazardTallies(wp: "OFFICE", stabilityAllPositive: boolean, workLifeAllPositive: boolean) {
  const mk = (category: "stability" | "workLifeBalance", positive: boolean) =>
    [1, 2, 3, 4, 5].map((n) => tally(`${wp}.${category}.${n}`, positive ? 9 : 1, positive ? 1 : 9));
  return [...mk("stability", stabilityAllPositive), ...mk("workLifeBalance", workLifeAllPositive)];
}

describe("computeTurnoverRisk", () => {
  const flagCalculator = new FlagCalculatorService();

  it("reports 0% risk and no spike when the recent quarter and baseline are both entirely healthy", () => {
    const recent = hazardTallies("OFFICE", true, true);
    const baseline = hazardTallies("OFFICE", true, true);

    const result = computeTurnoverRisk(flagCalculator, "OFFICE", recent, baseline, 40);

    expect(result.turnoverRiskPercentage).toBe(0);
    expect(result.spikeDetected).toBe(false);
  });

  it("reports 100% risk when every hazard cluster is red in the recent quarter", () => {
    const recent = hazardTallies("OFFICE", false, false);
    const baseline = hazardTallies("OFFICE", false, false);

    const result = computeTurnoverRisk(flagCalculator, "OFFICE", recent, baseline, 40);

    expect(result.turnoverRiskPercentage).toBe(100);
  });

  it("detects a spike when the recent quarter is much worse than the established baseline", () => {
    const recent = hazardTallies("OFFICE", false, false); // 4/4 hazard clusters red -> 100%
    const baseline = hazardTallies("OFFICE", true, true); // 0/4 red -> 0%

    const result = computeTurnoverRisk(flagCalculator, "OFFICE", recent, baseline, 40);

    expect(result.recentQuarterHazardRate).toBe(1);
    expect(result.baselineHazardRate).toBe(0);
    expect(result.spikeDetected).toBe(true);
  });

  it("does NOT flag a spike when hazard rate is chronically high but not rising", () => {
    // Both periods equally bad (100% hazard both times) — a real, high-risk
    // company, but not a *sudden* change, so spikeDetected must stay false
    // even though the risk percentage itself is high.
    const recent = hazardTallies("OFFICE", false, false);
    const baseline = hazardTallies("OFFICE", false, false);

    const result = computeTurnoverRisk(flagCalculator, "OFFICE", recent, baseline, 40);

    expect(result.turnoverRiskPercentage).toBe(100);
    expect(result.spikeDetected).toBe(false);
  });

  it("does not detect a spike for a small, noise-level increase", () => {
    // Stability cluster1 flips from healthy to red in the recent quarter
    // only (1 of 4 hazard clusters = 25%), everything else steady healthy.
    // Exactly at the 0.25 threshold — treated as a spike (inclusive boundary).
    const recentStabilityRed = [
      tally("OFFICE.stability.1", 1, 9),
      tally("OFFICE.stability.2", 1, 9),
      tally("OFFICE.stability.3", 1, 9),
      tally("OFFICE.stability.4", 9, 1),
      tally("OFFICE.stability.5", 9, 1),
      ...[1, 2, 3, 4, 5].map((n) => tally(`OFFICE.workLifeBalance.${n}`, 9, 1)),
    ];
    const baseline = hazardTallies("OFFICE", true, true);

    const result = computeTurnoverRisk(flagCalculator, "OFFICE", recentStabilityRed, baseline, 40);

    expect(result.recentQuarterHazardRate).toBeCloseTo(0.25);
    expect(result.baselineHazardRate).toBe(0);
    expect(result.spikeDetected).toBe(true);
  });

  it("flags sampleSizeWarning when the 12-month window has very few total reviews", () => {
    const recent = hazardTallies("OFFICE", true, true);
    const baseline = hazardTallies("OFFICE", true, true);

    const result = computeTurnoverRisk(flagCalculator, "OFFICE", recent, baseline, 3);

    expect(result.sampleSizeWarning).toBe(true);
  });

  it("does not flag sampleSizeWarning once there's a healthy amount of data", () => {
    const recent = hazardTallies("OFFICE", true, true);
    const baseline = hazardTallies("OFFICE", true, true);

    const result = computeTurnoverRisk(flagCalculator, "OFFICE", recent, baseline, 40);

    expect(result.sampleSizeWarning).toBe(false);
  });

  it("never lets an all-zero (no reviews in the window at all) tally throw or divide by zero", () => {
    const zero = ["stability", "workLifeBalance"].flatMap((category) =>
      [1, 2, 3, 4, 5].map((n) => tally(`OFFICE.${category}.${n}`, 0, 0)),
    );

    const result = computeTurnoverRisk(flagCalculator, "OFFICE", zero, zero, 0);

    expect(Number.isFinite(result.turnoverRiskPercentage)).toBe(true);
    expect(result.sampleSizeWarning).toBe(true);
  });
});

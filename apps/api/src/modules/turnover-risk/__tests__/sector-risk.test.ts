import { FlagCalculatorService } from "../../flags/flag-calculator.service";
import { getQuestionsFor } from "../../reviews/survey-questions.data";
import { TurnoverPredictionService, explainSectorRisk } from "../turnover-prediction.service";

const NOW = new Date("2026-09-24T12:00:00Z");

function review(workplaceType: "OFFICE" | "SERVICE", daysAgo: number, healthy: boolean) {
  const answers = Object.fromEntries(
    getQuestionsFor(workplaceType).map((q) => [q.id, healthy ? q.correctAnswer : q.correctAnswer === "YES" ? "NO" : "YES"]),
  );
  return { workplaceType, surveyAnswers: answers, publishedAt: new Date(NOW.getTime() - daysAgo * 86_400_000) };
}

describe("TurnoverPredictionService.assessSectorRisk", () => {
  const service = new TurnoverPredictionService({} as never, new FlagCalculatorService());

  it("pools a sector's reviews and weights each workplace type by its review count", () => {
    const result = service.assessSectorRisk(
      [
        // OFFICE: 3 recent, all unhealthy -> 100% red
        review("OFFICE", 10, false),
        review("OFFICE", 20, false),
        review("OFFICE", 30, false),
        // SERVICE: 1 recent, healthy -> 0% red
        review("SERVICE", 10, true),
      ],
      NOW,
    );
    expect(result.turnoverRiskPercentage).toBe(75);
    expect(result.reviewsInWindow).toBe(4);
    expect(result.sampleSizeWarning).toBe(true);
    expect(result.explanation).toContain("75%");
  });

  it("ignores reviews older than 12 months", () => {
    const result = service.assessSectorRisk([review("OFFICE", 400, false)], NOW);
    expect(result.reviewsInWindow).toBe(0);
    expect(result.turnoverRiskPercentage).toBe(0);
  });

  it("explains a rising risk in plain words", () => {
    expect(explainSectorRisk(60, true, false, 40)).toMatch(/high risk.*rising/);
  });
});

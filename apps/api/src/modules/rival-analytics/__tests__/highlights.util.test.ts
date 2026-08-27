import type { SurveyQuestionStats } from "@iwtr/shared-types";
import { mostAgreedAndDisputed } from "../highlights.util";

function q(questionId: string, agreeCount: number, disagreeCount: number, preferNotCount = 0): SurveyQuestionStats {
  return { questionId, category: "corporateCulture", text: `Question ${questionId}`, agreeCount, disagreeCount, preferNotCount };
}

describe("mostAgreedAndDisputed", () => {
  it("picks the question with the highest agree ratio as most agreed", () => {
    const questions = [q("a", 5, 5), q("b", 9, 1), q("c", 6, 4)];

    const { mostAgreed } = mostAgreedAndDisputed(questions);

    expect(mostAgreed?.questionId).toBe("b");
  });

  it("picks the question with the highest disagree ratio as most disputed", () => {
    const questions = [q("a", 5, 5), q("b", 9, 1), q("c", 2, 8)];

    const { mostDisputed } = mostAgreedAndDisputed(questions);

    expect(mostDisputed?.questionId).toBe("c");
  });

  it("returns null for both when there are no questions with any answers at all", () => {
    const questions = [q("a", 0, 0, 0), q("b", 0, 0, 0)];

    const result = mostAgreedAndDisputed(questions);

    expect(result.mostAgreed).toBeNull();
    expect(result.mostDisputed).toBeNull();
  });

  it("returns null for both on an empty question list", () => {
    const result = mostAgreedAndDisputed([]);

    expect(result.mostAgreed).toBeNull();
    expect(result.mostDisputed).toBeNull();
  });

  it("counts preferNotCount in the ratio denominator, same as the frontend's rate()", () => {
    // 9 agree out of (9 agree + 0 disagree + 9 preferNot) = 50% — lower than
    // a question with 5 agree out of 5 total (100%), even though 9 > 5 in
    // raw count.
    const questions = [q("a", 9, 0, 9), q("b", 5, 0, 0)];

    const { mostAgreed } = mostAgreedAndDisputed(questions);

    expect(mostAgreed?.questionId).toBe("b");
  });
});

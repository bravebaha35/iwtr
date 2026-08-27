import type { SurveyQuestionStats, SurveyAnswer } from "@iwtr/shared-types";
import type { SurveyQuestion } from "./survey-questions.data";

/**
 * Pure per-question agree/disagree/prefer-not tally over a set of reviews'
 * raw surveyAnswers, extracted out of ReviewsService.getSurveyStats so
 * other server-only consumers that need the same tally over a different
 * review subset (a date-windowed range for turnover-risk trend analysis, a
 * specific company for a rival-analytics PDF) don't duplicate this logic.
 * Never receives or returns anything that identifies which review an answer
 * came from — callers already filtered to just { surveyAnswers } before
 * calling this.
 */
export function tallyQuestions(
  reviews: { surveyAnswers: unknown }[],
  questions: SurveyQuestion[],
): SurveyQuestionStats[] {
  const tallies = new Map(questions.map((q) => [q.id, { agreeCount: 0, disagreeCount: 0, preferNotCount: 0 }]));

  for (const review of reviews) {
    const answers = review.surveyAnswers as Record<string, SurveyAnswer>;
    for (const question of questions) {
      const answer = answers[question.id];
      const tally = tallies.get(question.id);
      if (!tally || answer === undefined) continue;
      if (answer === question.correctAnswer) {
        tally.agreeCount += 1;
      } else if (answer === "PREFER_NOT_TO_ANSWER") {
        tally.preferNotCount += 1;
      } else {
        tally.disagreeCount += 1;
      }
    }
  }

  return questions.map((q) => ({
    questionId: q.id,
    category: q.category,
    text: q.text,
    ...tallies.get(q.id)!,
  }));
}

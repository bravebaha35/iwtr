import type { SurveyQuestionStats } from "@iwtr/shared-types";

// Same formula as apps/web/src/components/SurveyHighlights.tsx's rate() —
// kept independent (not cross-imported, Mode A forbids touching apps/web/
// and this needs to run server-side for the PDF anyway) but must stay
// numerically identical so a rival-analytics PDF's "most agreed" question
// always matches what the same company's own public page would show.
function rate(q: SurveyQuestionStats, count: number): number {
  const total = q.agreeCount + q.disagreeCount + q.preferNotCount;
  return total === 0 ? 0 : count / total;
}

export interface HighlightQuestions {
  mostAgreed: SurveyQuestionStats | null;
  mostDisputed: SurveyQuestionStats | null;
}

export function mostAgreedAndDisputed(questions: SurveyQuestionStats[]): HighlightQuestions {
  const answered = questions.filter((q) => q.agreeCount + q.disagreeCount + q.preferNotCount > 0);
  if (answered.length === 0) return { mostAgreed: null, mostDisputed: null };

  const mostAgreed = [...answered].sort((a, b) => rate(b, b.agreeCount) - rate(a, a.agreeCount))[0];
  const mostDisputed = [...answered].sort((a, b) => rate(b, b.disagreeCount) - rate(a, a.disagreeCount))[0];

  return { mostAgreed, mostDisputed };
}

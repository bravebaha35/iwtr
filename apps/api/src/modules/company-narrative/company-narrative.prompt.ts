import type { CategoryKey, SurveyQuestionStats, WorkplaceType } from "@iwtr/shared-types";

// Bump when the wording below changes in a way that should invalidate every
// stored description (CompanyNarrativeService compares row.promptVersion).
export const PROMPT_VERSION = 1;
export const NARRATIVE_MODEL = "claude-haiku-4-5-20251001";
export const MAX_DESCRIPTION_CHARS = 600;

const WORKPLACE_LABELS: Record<WorkplaceType, string> = {
  OFFICE: "Office",
  HYBRID_REMOTE: "Hybrid / Remote",
  SERVICE: "Service",
  MANUAL_LABOUR: "Manual-Labour",
};

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  corporateCulture: "corporate culture",
  leadership: "leadership",
  infrastructure: "infrastructure",
  workLifeBalance: "work-life balance",
  stability: "job stability",
};

const CATEGORY_ORDER: CategoryKey[] = [
  "corporateCulture",
  "leadership",
  "infrastructure",
  "workLifeBalance",
  "stability",
];

export const SYSTEM_PROMPT = [
  "You are the analytical engine for iworkedthere.com, an employee-first workplace-review platform.",
  "You receive one company's anonymised, aggregated employee survey results for a single type of work, plus its 1-to-5 star rating.",
  "Write one paragraph that sums up what it is actually like to work there right now.",
  "",
  'For each question you get three counts: "agreed" (the employee\'s answer indicated a healthy workplace), "disagreed" (it indicated a problem), and "preferred not to say".',
  "",
  "Rules:",
  "- Base the summary only on what the counts show. Ignore any positive or negative spin.",
  "- The star rating sets the tone. 1-2 stars: a plain, direct warning about the real problems. 3 stars: even-handed, the good and the bad. 4-5 stars: point to the concrete things employees confirm are done well.",
  "- Use plain, everyday words a manual worker in a small town would understand immediately. No corporate or HR jargon.",
  "- Every sentence must carry new information. Never repeat a point. Never use filler phrases such as \"is a genuine strength\", \"fosters a culture of\", \"a testament to\", \"when it comes to\".",
  '- Write about "this workplace" or "the company". Do not invent or guess a company name.',
  "- One paragraph. Hard limit: 600 characters. Plain text only: no headings, no bullet points, no line breaks, no preamble. Output only the paragraph.",
].join("\n");

export interface NarrativeInput {
  workplaceType: WorkplaceType;
  overall: number;
  categories: Record<CategoryKey, number>;
  reviewCount: number;
  questions: SurveyQuestionStats[];
}

export function buildUserMessage(input: NarrativeInput): string {
  const cat = (k: CategoryKey) => input.categories[k].toFixed(1);
  const lines = [
    `Work type: ${WORKPLACE_LABELS[input.workplaceType]}`,
    `Overall rating: ${input.overall.toFixed(1)} out of 5`,
    `Category averages (0-5): corporate culture ${cat("corporateCulture")}, leadership ${cat("leadership")}, infrastructure ${cat("infrastructure")}, work-life balance ${cat("workLifeBalance")}, job stability ${cat("stability")}`,
    `Based on ${input.reviewCount} published employee reviews.`,
    "",
    "Survey results (question — agreed / disagreed / preferred not to say):",
    ...input.questions.map(
      (q) => `${q.text} — ${q.agreeCount} / ${q.disagreeCount} / ${q.preferNotCount}`,
    ),
  ];
  return lines.join("\n");
}

export function buildNumbersLine(input: Omit<NarrativeInput, "questions">): string {
  const entries = CATEGORY_ORDER.map((k) => ({ k, v: input.categories[k] }));
  const max = entries.reduce((a, b) => (b.v > a.v ? b : a));
  const min = entries.reduce((a, b) => (b.v < a.v ? b : a));
  const head = `Across ${input.reviewCount} reviews this workplace scores ${input.overall.toFixed(1)} out of 5`;

  if (max.v - min.v < 0.05) {
    return `${head}, with all five areas rating about the same.`;
  }

  const label = (k: CategoryKey) => {
    const l = CATEGORY_LABELS[k];
    return l.charAt(0).toUpperCase() + l.slice(1);
  };
  return `${head}. ${label(max.k)} (${max.v.toFixed(1)}) is the strongest area and ${CATEGORY_LABELS[min.k]} (${min.v.toFixed(1)}) the weakest.`;
}

export function clampToLimit(text: string, limit: number = MAX_DESCRIPTION_CHARS): string {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;

  const window = trimmed.slice(0, limit);
  const lastSentenceEnd = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "));
  if (lastSentenceEnd > 0) {
    return window.slice(0, lastSentenceEnd + 1).trim();
  }
  // Also accept a sentence that ends exactly at the window edge.
  if (/[.!?]$/.test(window)) return window.trim();

  return window.replace(/\s+\S*$/, "").trim();
}

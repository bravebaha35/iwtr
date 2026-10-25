import type { CategoryKey, SurveyQuestionStats, WorkplaceType } from "@iwtr/shared-types";
import { themesFor } from "../flags/flag-themes.data";
import {
  ADVICE,
  CATEGORY_NAMES,
  OPENINGS,
  QUESTION_PHRASES,
  TIP_LEAD,
  type Lang,
  type ScoreBand,
} from "./summary-phrases.data";

// Stored in CompanyNarrative.model; a stored summary from any other engine
// is rewritten on the next read.
export const SUMMARY_ENGINE_VERSION = "summary-v2";
export const MAX_SUMMARY_CHARS = 600;

// A question speaks for the company only when enough people answered it.
const MIN_ANSWERED = 3;
// Praise: two thirds or more gave the healthy answer.
const STRENGTH_SHARE = 0.67;
// Complaint: under 40% gave the healthy answer - or, for a legal minimum
// (the Vibe Flags' `legal` questions), 40% or more reporting it unmet.
const CONCERN_SHARE = 0.4;
const LEGAL_CONCERN_SHARE = 0.6;
// Areas this close together are "about the same", not strongest/weakest.
const FLAT_SPREAD = 0.3;

export interface SummaryInput {
  workplaceType: WorkplaceType;
  band: ScoreBand;
  questions: SurveyQuestionStats[];
  categoryAverages: Record<CategoryKey, number>;
}

export type Summary = Record<Lang, string>;

/** The Rating Breakdown's overall average as a band: 1 (<2), 2, 3, 4 (4.0+). */
export function scoreBandFor(overallAvg: number): ScoreBand {
  return Math.min(4, Math.max(1, Math.floor(overallAvg))) as ScoreBand;
}

interface Signal {
  questionId: string;
  category: CategoryKey;
  // How strongly it points its way (share of healthy answers for praise,
  // of unhealthy ones for a complaint, legal minimums weighted up).
  weight: number;
  answered: number;
}

function legalQuestionIds(workplaceType: WorkplaceType): Set<string> {
  const ids = new Set<string>();
  for (const theme of themesFor(workplaceType)) {
    for (const n of theme.legal ?? []) ids.add(`${workplaceType}.${theme.category}.${n}`);
  }
  return ids;
}

/** Up to `max` signals, each from a different area, strongest first. */
function pickDistinct(signals: Signal[], max: number): Signal[] {
  const sorted = [...signals].sort(
    (a, b) => b.weight - a.weight || b.answered - a.answered || a.questionId.localeCompare(b.questionId),
  );
  const picked: Signal[] = [];
  for (const s of sorted) {
    if (picked.length >= max) break;
    if (picked.some((x) => x.category === s.category)) continue;
    picked.push(s);
  }
  return picked;
}

export function findSignals(workplaceType: WorkplaceType, questions: SurveyQuestionStats[]) {
  const legal = legalQuestionIds(workplaceType);
  const strengths: Signal[] = [];
  const concerns: Signal[] = [];
  for (const q of questions) {
    if (!QUESTION_PHRASES[q.questionId]) continue;
    const answered = q.agreeCount + q.disagreeCount;
    if (answered < MIN_ANSWERED) continue;
    const healthy = q.agreeCount / answered;
    const isLegal = legal.has(q.questionId);
    if (healthy >= STRENGTH_SHARE) {
      strengths.push({ questionId: q.questionId, category: q.category, weight: healthy, answered });
    } else if (healthy < CONCERN_SHARE || (isLegal && healthy <= LEGAL_CONCERN_SHARE)) {
      concerns.push({ questionId: q.questionId, category: q.category, weight: 1 - healthy + (isLegal ? 0.15 : 0), answered });
    }
  }
  return { strengths, concerns };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Two points are joined as "X, followed by Y" (TR "X; ardından Y geliyor"),
// never "X and Y": many phrases already contain "and" / "ve", and the order
// says which one reviewers raise more.
function strengthSentence(band: ScoreBand, phrases: string[], lang: Lang): string | null {
  if (phrases.length === 0) {
    if (band >= 3) return null;
    return lang === "en" ? "Reviewers rarely single out a clear strength." : "Değerlendirenler belirgin bir güçlü yan pek göstermiyor.";
  }
  const [first, second] = phrases;
  if (lang === "en") {
    const lead = band >= 3 ? `Most praise goes to ${first}` : `On the plus side, some mention ${first}`;
    return second ? `${lead}, followed by ${second}.` : `${lead}.`;
  }
  if (band >= 3) {
    return second
      ? `Çalışanların en çok övdüğü konu ${first}; ardından ${second} geliyor.`
      : `Çalışanların en çok övdüğü konu ${first}.`;
  }
  return second ? `Olumlu yan olarak en çok ${first} anılıyor; ardından ${second} geliyor.` : `Olumlu yan olarak ${first} anılıyor.`;
}

function concernSentence(band: ScoreBand, phrases: string[], lang: Lang): string | null {
  if (phrases.length === 0) {
    if (band < 4) return null;
    return lang === "en" ? "No complaint comes up again and again." : "Sürekli tekrar eden bir şikâyet yok.";
  }
  const [first, second] = phrases;
  if (band === 4) return lang === "en" ? `The main criticism is ${first}.` : `Eleştirilerin odağında ise ${first} var.`;
  if (lang === "en") return second ? `The most common complaint is ${first}, followed by ${second}.` : `The most common complaint is ${first}.`;
  return second ? `En sık dile getirilen sorun ise ${first}; bunu ${second} izliyor.` : `En sık dile getirilen sorun ise ${first}.`;
}

function rankedAreas(averages: Record<CategoryKey, number>): CategoryKey[] {
  return (Object.keys(averages) as CategoryKey[]).sort((a, b) => averages[b] - averages[a] || a.localeCompare(b));
}

function areaSentence(averages: Record<CategoryKey, number>, lang: Lang): string {
  const ranked = rankedAreas(averages);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  if (averages[best] - averages[worst] < FLAT_SPREAD) {
    return lang === "en" ? "Its five areas score close to one another." : "Beş alanın puanları birbirine yakın.";
  }
  const b = CATEGORY_NAMES[best][lang];
  const w = CATEGORY_NAMES[worst][lang];
  return lang === "en" ? `${capitalize(b)} is its strongest area and ${w} its weakest.` : `En güçlü alanı ${b}, en zayıf alanı ${w}.`;
}

function closingSentence(band: ScoreBand, weakest: CategoryKey, lang: Lang): string {
  const advice = ADVICE[weakest];
  return band >= 3 ? `${TIP_LEAD[band as 3 | 4][lang]}${advice.tip[lang]}` : advice.warn[lang];
}

/**
 * The company Summary in both languages: an opening that sets the tone for
 * the score band, what reviewers praise most, what they complain about most,
 * the strongest and weakest area, and one piece of advice aimed at the
 * weakest area. Pure and deterministic. Kept to 600 characters per language
 * by dropping, in turn, the second complaint, the second praise and the area
 * sentence - never the opening, the main points or the advice.
 */
export function composeSummary(input: SummaryInput): Summary {
  const { workplaceType, band, questions, categoryAverages } = input;
  const { strengths, concerns } = findSignals(workplaceType, questions);
  const praise = pickDistinct(strengths, band === 1 ? 1 : 2);
  const complaints = pickDistinct(concerns, band === 4 ? 1 : 2);
  const ranked = rankedAreas(categoryAverages);
  const weakest = ranked[ranked.length - 1];

  const build = (lang: Lang): string => {
    let praiseCount = praise.length;
    let complaintCount = complaints.length;
    let withAreas = true;
    const assemble = () =>
      [
        OPENINGS[workplaceType][band][lang],
        strengthSentence(band, praise.slice(0, praiseCount).map((s) => QUESTION_PHRASES[s.questionId].good[lang]), lang),
        concernSentence(band, complaints.slice(0, complaintCount).map((s) => QUESTION_PHRASES[s.questionId].bad[lang]), lang),
        withAreas ? areaSentence(categoryAverages, lang) : null,
        closingSentence(band, weakest, lang),
      ]
        .filter((s): s is string => !!s)
        .join(" ");

    let text = assemble();
    if (text.length > MAX_SUMMARY_CHARS && complaintCount > 1) {
      complaintCount = 1;
      text = assemble();
    }
    if (text.length > MAX_SUMMARY_CHARS && praiseCount > 1) {
      praiseCount = 1;
      text = assemble();
    }
    if (text.length > MAX_SUMMARY_CHARS) {
      withAreas = false;
      text = assemble();
    }
    return text.length > MAX_SUMMARY_CHARS ? `${text.slice(0, MAX_SUMMARY_CHARS - 1).trimEnd()}…` : text;
  };

  return { en: build("en"), tr: build("tr") };
}

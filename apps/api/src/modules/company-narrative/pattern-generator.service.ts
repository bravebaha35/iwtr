import { Injectable } from "@nestjs/common";
import type { CategoryKey, SurveyQuestionStats, WorkplaceType } from "@iwtr/shared-types";
import type { VibeFlag } from "../flags/flag-calculator.service";

export const MIN_DESCRIPTION_CHARS = 450;
export const MAX_DESCRIPTION_CHARS = 600;

export type QnaDirection = "AGREE" | "DISAGREE";

export type SummaryPatternCategoryLit =
  | "INTRO"
  | "QNA_PRIMARY"
  | "QNA_SECONDARY"
  | "FLAG_FALLBACK"
  | "CONCLUSION";

/** Plain shape of a SummaryPattern row — deliberately not the Prisma type, so this
 * engine stays DB-free and testable with plain fixtures (same philosophy as
 * FlagCalculatorService: pure, no I/O, no mocking required to test it). */
export interface PatternRow {
  id: string;
  category: SummaryPatternCategoryLit;
  qnaKey: string | null;
  flagKey: string | null;
  textBlock: string;
}

export interface PatternGeneratorInput {
  workplaceType: WorkplaceType;
  questions: SurveyQuestionStats[];
  flags: VibeFlag[];
  patterns: PatternRow[];
}

export function qnaKeyFor(questionId: string, direction: QnaDirection): string {
  return `${questionId}:${direction}`;
}

export function flagKeyFor(category: CategoryKey, cluster: 1 | 2, color: "GREEN" | "RED"): string {
  return `${category}:${cluster}:${color}`;
}

export function introOrConclusionKeyFor(workplaceType: WorkplaceType, kind: "INTRO" | "CONCLUSION"): string {
  return `${workplaceType}:${kind}`;
}

interface RankedQuestion {
  questionId: string;
  category: CategoryKey;
  direction: QnaDirection;
  margin: number;
  answered: number;
}

/**
 * Orders every question that has a clear majority answer by how lopsided
 * that majority is ("most distinct employee answers") — an exact tie (or an
 * unanswered question) carries no clear direction to narrate, so it's
 * dropped rather than arbitrarily assigned one.
 */
export function rankQuestions(questions: SurveyQuestionStats[]): RankedQuestion[] {
  const ranked: RankedQuestion[] = [];
  for (const q of questions) {
    const answered = q.agreeCount + q.disagreeCount;
    if (answered === 0 || q.agreeCount === q.disagreeCount) continue;
    ranked.push({
      questionId: q.questionId,
      category: q.category,
      direction: q.agreeCount > q.disagreeCount ? "AGREE" : "DISAGREE",
      margin: Math.abs(q.agreeCount - q.disagreeCount) / answered,
      answered,
    });
  }
  return ranked.sort((a, b) => b.margin - a.margin || b.answered - a.answered || a.questionId.localeCompare(b.questionId));
}

function findByQnaKey(patterns: PatternRow[], category: SummaryPatternCategoryLit, qnaKey: string): PatternRow | null {
  return patterns.find((p) => p.category === category && p.qnaKey === qnaKey) ?? null;
}

function findByFlagKey(patterns: PatternRow[], flagKey: string): PatternRow | null {
  return patterns.find((p) => p.category === "FLAG_FALLBACK" && p.flagKey === flagKey) ?? null;
}

/** Longest-first, so the default pick is the richer variant and overflow handling
 * (see enforceMaxLength) can step through progressively shorter ones. */
function candidatesFor(patterns: PatternRow[], workplaceType: WorkplaceType, kind: "INTRO" | "CONCLUSION"): PatternRow[] {
  const key = introOrConclusionKeyFor(workplaceType, kind);
  return patterns
    .filter((p) => p.category === kind && p.qnaKey === key)
    .sort((a, b) => b.textBlock.length - a.textBlock.length);
}

type Slot = "opener" | "posSecondary" | "posFlag" | "negPrimary" | "negSecondary" | "negFlag" | "topup" | "conclusion";

interface Block {
  slot: Slot;
  row: PatternRow;
}

/**
 * Pattern Aggregation Engine — assembles one company's description entirely
 * from pre-authored SummaryPattern rows. No network call, no randomness: the
 * same (questions, flags, patterns) input always produces the same output.
 *
 * Structure mirrors the CEO's own two worked examples exactly: an opening
 * positive fact (+ a supporting positive detail), a pivot to the most
 * distinct negative fact (+ a supporting negative detail), then a
 * conclusion — falling back to flag-chart prose wherever a specific
 * question-level detail hasn't been authored yet, and only ever reaching
 * for a second-tier question or a flag when the base template alone would
 * land under 450 characters. See MIN/MAX enforcement below for the two
 * character-count rules.
 */
@Injectable()
export class PatternGeneratorService {
  generate(input: PatternGeneratorInput): string | null {
    const { workplaceType, questions, flags, patterns } = input;
    const ranked = rankQuestions(questions);
    const usedQuestionIds = new Set<string>();
    const usedFlagKeys = new Set<string>();

    const pickPrimary = (direction: QnaDirection): { row: PatternRow; questionId: string; category: CategoryKey } | null => {
      for (const r of ranked) {
        if (r.direction !== direction || usedQuestionIds.has(r.questionId)) continue;
        const row = findByQnaKey(patterns, "QNA_PRIMARY", qnaKeyFor(r.questionId, direction));
        if (row) return { row, questionId: r.questionId, category: r.category };
      }
      return null;
    };

    const pickSecondary = (direction: QnaDirection): PatternRow | null => {
      for (const r of ranked) {
        if (r.direction !== direction || usedQuestionIds.has(r.questionId)) continue;
        const row = findByQnaKey(patterns, "QNA_SECONDARY", qnaKeyFor(r.questionId, direction));
        if (row) {
          usedQuestionIds.add(r.questionId);
          return row;
        }
      }
      return null;
    };

    // Prefers a flag that REINFORCES the same category as the primary fact
    // already shown (e.g. a "shift lengths are exhausting" primary paired
    // with that same workLifeBalance category's "denied rest & water" flag)
    // over a same-color flag from an unrelated category — matching how both
    // of the CEO's worked examples deepen one theme rather than diversify.
    const pickFlag = (color: "GREEN" | "RED", preferCategory?: CategoryKey): PatternRow | null => {
      const eligible = flags
        .filter((f) => f.color === color && !usedFlagKeys.has(flagKeyFor(f.category, f.cluster, f.color)))
        .sort((a, b) => {
          const aFirst = preferCategory && a.category === preferCategory ? 0 : 1;
          const bFirst = preferCategory && b.category === preferCategory ? 0 : 1;
          return aFirst - bFirst;
        });
      for (const f of eligible) {
        const key = flagKeyFor(f.category, f.cluster, f.color);
        const row = findByFlagKey(patterns, key);
        if (row) {
          usedFlagKeys.add(key);
          return row;
        }
      }
      return null;
    };

    const introCandidates = candidatesFor(patterns, workplaceType, "INTRO");
    const conclusionCandidates = candidatesFor(patterns, workplaceType, "CONCLUSION");
    if (conclusionCandidates.length === 0) return null;

    const positivePrimary = pickPrimary("AGREE");
    if (positivePrimary) usedQuestionIds.add(positivePrimary.questionId);
    const negativePrimary = pickPrimary("DISAGREE");
    if (negativePrimary) usedQuestionIds.add(negativePrimary.questionId);

    // The opener is the positive primary whenever one exists (matches both
    // CEO worked examples). A company with real signal but none of it
    // positive leads with the negative primary directly instead — the
    // generic INTRO filler is reserved for the true no-signal case (every
    // question tied/unanswered), never used to avoid stating the bad news
    // up front.
    let introIndex = 0;
    const openerFromNegative = !positivePrimary && !!negativePrimary;
    const opener: PatternRow | null = positivePrimary
      ? positivePrimary.row
      : negativePrimary
        ? negativePrimary.row
        : introCandidates[0] ?? null;
    if (!opener) return null;

    const blocks: Block[] = [{ slot: "opener", row: opener }];

    if (positivePrimary) {
      const posSecondary = pickSecondary("AGREE");
      if (posSecondary) {
        blocks.push({ slot: "posSecondary", row: posSecondary });
      } else {
        const posFlag = pickFlag("GREEN", positivePrimary.category);
        if (posFlag) blocks.push({ slot: "posFlag", row: posFlag });
      }
    }

    if (negativePrimary) {
      if (!openerFromNegative) blocks.push({ slot: "negPrimary", row: negativePrimary.row });
      const negSecondary = pickSecondary("DISAGREE");
      if (negSecondary) {
        blocks.push({ slot: "negSecondary", row: negSecondary });
      } else {
        const negFlag = pickFlag("RED", negativePrimary.category);
        if (negFlag) blocks.push({ slot: "negFlag", row: negFlag });
      }
    }

    let conclusionIndex = 0;
    blocks.push({ slot: "conclusion", row: conclusionCandidates[conclusionIndex] });

    const assemble = () => blocks.map((b) => b.row.textBlock).join(" ");

    // Mandatory minimum: cascade through whatever authored content is left —
    // next most-distinct unused question (either tier) first, then any
    // unused flag of either color — before ever giving up. Bounded so a
    // content gap can never spin forever; real coverage should never hit the
    // cap.
    for (let i = 0; i < 20 && assemble().length < MIN_DESCRIPTION_CHARS; i++) {
      let addedRow: PatternRow | null = null;
      for (const r of ranked) {
        if (usedQuestionIds.has(r.questionId)) continue;
        const row =
          findByQnaKey(patterns, "QNA_SECONDARY", qnaKeyFor(r.questionId, r.direction)) ??
          findByQnaKey(patterns, "QNA_PRIMARY", qnaKeyFor(r.questionId, r.direction));
        if (row) {
          usedQuestionIds.add(r.questionId);
          addedRow = row;
          break;
        }
      }
      if (!addedRow) addedRow = pickFlag("RED") ?? pickFlag("GREEN");
      if (!addedRow) break;
      blocks.splice(blocks.length - 1, 0, { slot: "topup", row: addedRow });
    }

    // Mandatory maximum: swap the conclusion, then (if the opener came from
    // the INTRO tier) the intro, for a shorter pre-measured alternative;
    // only as a last resort drop the lowest-priority extras (flags before
    // Q&A, matching the same Q&A-over-flags priority used to select them).
    while (assemble().length > MAX_DESCRIPTION_CHARS && conclusionIndex + 1 < conclusionCandidates.length) {
      conclusionIndex += 1;
      blocks[blocks.length - 1] = { slot: "conclusion", row: conclusionCandidates[conclusionIndex] };
    }
    if (!positivePrimary && !negativePrimary) {
      while (assemble().length > MAX_DESCRIPTION_CHARS && introIndex + 1 < introCandidates.length) {
        introIndex += 1;
        blocks[0] = { slot: "opener", row: introCandidates[introIndex] };
      }
    }
    // "topup" blocks are dropped least-distinctive-first (last inserted =
    // closest to the conclusion), since rankQuestions already ordered them
    // most- to least-distinctive at insertion time.
    while (assemble().length > MAX_DESCRIPTION_CHARS) {
      const idx = blocks.map((b) => b.slot).lastIndexOf("topup");
      if (idx === -1) break;
      blocks.splice(idx, 1);
    }
    for (const droppable of ["posFlag", "negFlag", "posSecondary", "negSecondary"] as Slot[]) {
      while (assemble().length > MAX_DESCRIPTION_CHARS) {
        const idx = blocks.findIndex((b) => b.slot === droppable);
        if (idx === -1) break;
        blocks.splice(idx, 1);
      }
    }

    return assemble();
  }
}

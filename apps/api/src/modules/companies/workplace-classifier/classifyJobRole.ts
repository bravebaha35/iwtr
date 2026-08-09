import type { WorkplaceType } from "@iwtr/shared-types";
import { WORKPLACE_CATEGORY_MAP, WORKPLACE_TYPE_ORDER, type JobSector } from "./workplaceCategories";

export interface ClassificationResult {
  workplaceType: WorkplaceType;
  confidenceScore: number;
  matchedSector: JobSector | "Unclassified";
}

// Same Unicode-letter word-boundary technique used in
// moderation.service.ts's matchesAsWord and the Turkey-seeding scripts'
// keyword matching — plain \b doesn't treat Turkish letters (ş/ı/ğ/ü/ö/ç) as
// word characters, so "Muhasebe" would otherwise false-positive-match inside
// an unrelated longer word. Kept local here (not imported from
// moderation.service.ts) since it's a tiny, stable, already-duplicated-twice
// helper in this codebase — see the other two normalizeTr/matchesAsWord
// copies in apps/api/scripts/ — not worth a shared-package extraction yet.
function matchesAsWord(haystackLower: string, wordLower: string): boolean {
  const escaped = wordLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u");
  return pattern.test(haystackLower);
}

// ASCII-folds Turkish-specific letters after lowercasing, so keywords still
// match text that was typed/scraped without diacritics (very common in
// real-world Turkish job postings and OSM-derived data) — e.g. "muhasebeci"
// stays matchable even when the source text spells it "muhasebeci" with a
// plain "i" throughout rather than "muhasebeci" with dotless-ı elsewhere in
// the word. Same replacement table as seed-istanbul-companies.ts's
// normalizeTr.
function foldTr(value: string): string {
  return value
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

const FALLBACK_WORKPLACE_TYPE: WorkplaceType = "SERVICE";

/**
 * Deterministically classifies a job title/sector/description into one of
 * the 4 WorkplaceType values, using the keyword tables in
 * workplaceCategories.ts. Never trusts the caller to pre-classify — this is
 * the single source of truth callers (e.g. the Turkey company-seeding
 * pipeline) should use instead of ad-hoc tag-based guessing.
 *
 * Fallback strategy for ambiguous/unmatched input: rather than throwing or
 * returning null (which would force every caller to handle a missing
 * classification), falls back to SERVICE — the same default
 * Company.workplaceType already uses at the schema level
 * (`@default(SERVICE)` in schema.prisma) — with confidenceScore 0 and
 * matchedSector "Unclassified", so a caller can cheaply detect "this was a
 * guess" via `confidenceScore === 0` without a separate null-check path.
 */
export function classifyWorkplace(title: string, sector?: string, description?: string): ClassificationResult {
  const parts = [title, sector, description].filter((v): v is string => Boolean(v && v.trim()));
  if (parts.length === 0) {
    return { workplaceType: FALLBACK_WORKPLACE_TYPE, confidenceScore: 0, matchedSector: "Unclassified" };
  }

  const raw = parts.join(" ");
  const lower = raw.toLocaleLowerCase("tr-TR");
  const folded = foldTr(lower);

  let bestType: WorkplaceType | null = null;
  let bestSector: JobSector | null = null;
  let bestHits = 0;

  for (const workplaceType of WORKPLACE_TYPE_ORDER) {
    for (const group of WORKPLACE_CATEGORY_MAP[workplaceType]) {
      let hits = 0;
      for (const keyword of group.keywords) {
        const keywordLower = keyword.toLocaleLowerCase("tr-TR");
        if (matchesAsWord(lower, keywordLower) || matchesAsWord(folded, foldTr(keywordLower))) {
          hits += 1;
        }
      }
      // Strictly greater-than: first group to reach a given hit count wins
      // ties, which is why WORKPLACE_TYPE_ORDER's declared order doubles as
      // the tie-break priority.
      if (hits > bestHits) {
        bestHits = hits;
        bestType = workplaceType;
        bestSector = group.sector;
      }
    }
  }

  if (!bestType || !bestSector || bestHits === 0) {
    return { workplaceType: FALLBACK_WORKPLACE_TYPE, confidenceScore: 0, matchedSector: "Unclassified" };
  }

  // Simple, explainable confidence curve: these keyword phrases are fairly
  // specific job-title terms (not generic words), so even a single hit is
  // decent evidence (0.6); each additional distinct keyword hit in the same
  // winning sector raises confidence further, capped at 1.0.
  const confidenceScore = Math.min(1, 0.6 + 0.15 * (bestHits - 1));

  return { workplaceType: bestType, confidenceScore, matchedSector: bestSector };
}

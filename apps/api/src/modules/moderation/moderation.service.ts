import { Injectable } from "@nestjs/common";
import type { ContentCheckResult, SkippableViolationType, TrustScoreResult } from "@iwtr/shared-types";

// Small, deliberately simple word lists for the Phase 1 stand-in. Swap this
// whole class for a Claude-backed implementation later (see plan) — nothing
// outside ReviewsService depends on how these two methods are implemented.
const PROFANITY_WORDS = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "amk",
  "orospu",
  "siktir",
  "pic",
  "piç",
  "gerizekali",
  "salak",
  "aptal",
  "ibne",
  "yavşak",
];

const SEXUAL_CONTENT_WORDS = ["porn", "sex", "nude", "xxx", "seks", "porno", "çıplak", "yarrak"];

const JOB_TITLE_WORDS = [
  "manager",
  "müdür",
  "mudur",
  "supervisor",
  "director",
  "ceo",
  "cfo",
  "coo",
  "şef",
  "sef",
  "yönetici",
  "yonetici",
  "patron",
  "amir",
  // Added for the nationwide launch's anonymity-hardening pass: specific
  // departments/roles small enough that naming them in review text can
  // narrow down who wrote it, even though none of these are as inherently
  // risky as a real name (see JOB_TITLE_PHRASES below for the multi-word
  // ones — "insan" alone is deliberately NOT here, see that list's comment).
  "hr",
  "depo",
  "warehouse",
  "muhasebe",
];

// Multi-word department/job-title phrases — checked separately from
// JOB_TITLE_WORDS because matchesAsWord/the space-agnostic patterns below
// operate on a single unbroken token. "insan" (Turkish for "person/human")
// is deliberately NOT added to JOB_TITLE_WORDS on its own — it's one of the
// most common words in the language and would false-positive on huge
// amounts of ordinary review text ("İnsanlar çok iyiydi", etc.). Only the
// full phrase is specific enough to safely flag.
const JOB_TITLE_PHRASES = ["insan kaynaklari", "human resources"];

// Two-or-more consecutive Capitalized Words looks like a person's full name.
const NAME_LIKE_PATTERN = /\b[A-ZÇĞİÖŞÜ][a-zçğıöşü]+\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+\b/;

// Plain `.includes()` on these short word lists false-positives constantly on
// ordinary text ("pic" inside "picture", "amir" inside Turkish "tamir"
// [repair], "sef" inside "sefer" [trip]) because it matches mid-word. JS's
// built-in `\b` doesn't treat Turkish letters (ş, ı, ğ, ü, ö, ç) as word
// characters, so it can't be trusted here either — this builds a real
// Unicode-letter-aware boundary check instead.
function matchesAsWord(haystackLower: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u");
  return pattern.test(haystackLower);
}


// Turkish-letter fold to plain ASCII, position-preserving (keeps whitespace/
// punctuation in place, unlike a "strip everything" fold) — needed here
// because the space-agnostic patterns below key off exactly where the
// separator characters sit.
function foldTurkishLayout(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u");
}

function escapeRegExpChar(ch: string): string {
  return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 0-3 optional separator characters between every letter/digit of a target
// — the "space-agnostic" mechanism. Optional (not required) so the same
// pattern matches the plain, unspaced form of the word too; this replaces
// matchesAsWord for the lists it's built from, not just adding evasion
// detection on top of it.
const SPACE_AGNOSTIC_SEP = "[\\s.\\-_]{0,3}";

// Builds a regex matching `literal`'s characters in order, allowing 0-3
// optional separator characters between every adjacent pair — catches both
// the word/phrase written normally ("insan kaynaklari") and the same text
// with letters spaced apart to dodge a plain keyword check ("İ n s a n K a
// y n a k l a r ı"). `literal` must already be lowercase, Turkish-folded
// (see foldTurkishLayout), with its own internal spaces present — a
// multi-word phrase's own word-gap is just another character-pair gap as
// far as this pattern is concerned, so it's stripped here before building.
function buildSpaceAgnosticPattern(literal: string): RegExp {
  const chars = literal.replace(/\s+/g, "").split("");
  const body = chars.map(escapeRegExpChar).join(SPACE_AGNOSTIC_SEP);
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "u");
}

const SPACE_AGNOSTIC_PROFANITY_PATTERNS = [...PROFANITY_WORDS, ...SEXUAL_CONTENT_WORDS].map(buildSpaceAgnosticPattern);

// Global-flag twins of the plain word/phrase boundary patterns, needed only
// to collect MATCH POSITIONS (matchAll requires 'g') rather than just a
// yes/no .test() - used by the name-proximity check below, which needs to
// know WHERE a job-title word sits relative to a name-like span, not just
// whether either exists anywhere in the text.
function wordPatternGlobal(word: string): RegExp {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu");
}
const JOB_TITLE_WORD_PATTERNS_GLOBAL = JOB_TITLE_WORDS.map(wordPatternGlobal);
const JOB_TITLE_PHRASE_PATTERNS_GLOBAL = JOB_TITLE_PHRASES.map(wordPatternGlobal);
const SPACE_AGNOSTIC_JOB_TITLE_PATTERNS_GLOBAL = [...JOB_TITLE_WORDS, ...JOB_TITLE_PHRASES].map((w) =>
  new RegExp(buildSpaceAgnosticPattern(w).source, "gu"),
);

// How close (in characters) a job-title mention has to be to a name-like
// span to count as 'naming a specific person's role' rather than just
// ordinary workplace talk ('I wish HR handled this better' must NOT flag;
// 'CEO Ahmet Yılmaz is...' must). ~2-3 short sentences' worth either side -
// generous enough for 'Our CEO, who everyone calls Ahmet Bey, ...' while
// still excluding two unrelated mentions in the same long comment.
const NAME_TITLE_PROXIMITY_CHARS = 60;

interface Span {
  start: number;
  end: number;
}

function collectSpans(text: string, patterns: RegExp[]): Span[] {
  const spans: Span[] = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (match.index === undefined) continue;
      spans.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  return spans;
}

function anySpanWithin(a: Span[], b: Span[], maxDistance: number): boolean {
  for (const x of a) {
    for (const y of b) {
      const gap = x.start >= y.end ? x.start - y.end : y.start - x.end;
      if (gap <= maxDistance) return true;
    }
  }
  return false;
}

// Turkish mobile phone shape: optional leading "0", then "5", then 9 more
// digits (10-11 significant digits total), with 0-2 optional separator
// characters between every digit. Matches normal grouping ("0555 555 55
// 55"), no grouping at all ("05555555555"), and fully spaced-out evasion
// ("0 5 5 5 5 5 5 5 5 5 5") with the exact same pattern, for the same
// reason buildSpaceAgnosticPattern does. No "g" flag — this is only ever
// used with .test(), and a global flag makes .test() stateful (remembers
// lastIndex across calls) which would corrupt results across concurrent
// requests since this pattern is a module-level singleton.
const PHONE_SEP = "[\\s.\\-]{0,2}";
const PHONE_PATTERN = new RegExp(`(?<!\\d)(?:0${PHONE_SEP})?5(?:${PHONE_SEP}\\d){9}(?!\\d)`, "u");

// Matches an open-ended run of 4+ single letters, each separated by 1-3
// separator characters — the literal shape of someone spelling a word out
// one character at a time ("A h m e t", "İ n s a n"), regardless of what
// the word actually is. Unlike buildSpaceAgnosticPattern, requires an
// ACTUAL separator between every letter (no zero-width option) since this
// exists specifically to catch open-ended tokens with no fixed dictionary
// (real names can't be enumerated) — it must not fire on ordinary unspaced
// prose. The (?<!\p{L})/(?!\p{L}) boundary at each end stops the run from
// bleeding into an adjacent normal word — without it, "müdürümüz A h m e t
// çok" matched as "z A h m e t ç" (grabbing the last letter of "müdürümüz"
// and the first letter of "çok" too), corrupting the shape check below.
// Needs the "g" flag for matchAll below, which (unlike .test()/.exec()) is
// specified to not mutate shared regex state across calls.
const EVASION_RUN_PATTERN = /(?<!\p{L})(?:\p{L}[\s.\-_]{1,3}){3,}\p{L}(?!\p{L})/gu;

// A collapsed evasion-run candidate "looks like a name" if it starts with a
// real uppercase letter (Turkish-locale-aware — plain toUpperCase mishandles
// İ/I) and is long enough not to just be an initial.
function looksLikeSpacedName(candidate: string): boolean {
  if (candidate.length < 3) return false;
  const first = candidate.charAt(0);
  return first === first.toLocaleUpperCase("tr-TR") && first !== first.toLocaleLowerCase("tr-TR");
}

@Injectable()
export class ModerationService {
  checkContent(
    texts: string[],
    options?: { skipViolationTypes?: SkippableViolationType[] },
  ): ContentCheckResult {
    // Categories the caller opts out of. SocialService.createPost passes
    // ["NAME_OR_SURNAME", "JOB_TITLE", "ABUSE_OR_INSULT"] for an employer's own
    // post caption: it may name its own staff and job roles and write an
    // all-caps announcement in its own post. Only those three are opt-outable
    // (see SkippableViolationType) - profanity, sexual content and phone
    // numbers always apply. With no options this stays byte-identical to the
    // original.
    const skip = new Set<SkippableViolationType>(options?.skipViolationTypes ?? []);
    const combined = texts.filter(Boolean).join(" \n ");
    const lower = combined.toLowerCase();
    const layoutFolded = foldTurkishLayout(combined);
    const violationTypes: ContentCheckResult["violationTypes"] = [];

    // --- Profanity / sexual content: plain word-boundary match (existing
    // behavior, unchanged) plus the space-agnostic evasion variant.
    // SEXUAL_CONTENT_WORDS is newly wired in here too — it previously only
    // guarded display names, never actual review content.
    const hasPlainProfanity = [...PROFANITY_WORDS, ...SEXUAL_CONTENT_WORDS].some((w) => matchesAsWord(lower, w));
    const hasEvasiveProfanity = SPACE_AGNOSTIC_PROFANITY_PATTERNS.some((p) => p.test(layoutFolded));
    if (hasPlainProfanity || hasEvasiveProfanity) violationTypes.push("PROFANITY");

    // --- Names/surnames: existing two-capitalized-words heuristic, plus the
    // open-ended spaced-out single-word variant. Collected as spans (not
    // just a yes/no) because JOB_TITLE below needs to know WHERE a name-like
    // mention sits, not just whether one exists anywhere in the text.
    const nameLikeSpans = collectSpans(combined, [new RegExp(NAME_LIKE_PATTERN.source, "gu")]);
    const evasiveNameSpans: Span[] = [];
    for (const match of combined.matchAll(EVASION_RUN_PATTERN)) {
      const candidate = match[0].replace(/[\s.\-_]/g, "");
      if (looksLikeSpacedName(candidate) && match.index !== undefined) {
        evasiveNameSpans.push({ start: match.index, end: match.index + match[0].length });
      }
    }
    const hasPlainNameLike = nameLikeSpans.length > 0;
    const hasEvasiveName = evasiveNameSpans.length > 0;
    const allNameSpans = [...nameLikeSpans, ...evasiveNameSpans];
    // Gated by skipViolationTypes: an employer may name its own staff in its own caption.
    if ((hasPlainNameLike || hasEvasiveName) && !skip.has("NAME_OR_SURNAME")) violationTypes.push("NAME_OR_SURNAME");

    // --- Job titles / departments: only a violation when a title mention
    // sits close to a name-like span (see NAME_TITLE_PROXIMITY_CHARS) - a
    // bare title word alone is ordinary workplace vocabulary ("I wish HR
    // handled this better" must NOT flag), but a title next to what looks
    // like a real person's name is exactly the doxxing-adjacent pattern this
    // exists to catch ("CEO Ahmet Yılmaz is..." must). Covers spaced-out
    // evasion on either side (title, name, or both).
    const jobTitleSpans = collectSpans(combined, [...JOB_TITLE_WORD_PATTERNS_GLOBAL, ...JOB_TITLE_PHRASE_PATTERNS_GLOBAL]);
    const evasiveJobTitleSpans = collectSpans(layoutFolded, SPACE_AGNOSTIC_JOB_TITLE_PATTERNS_GLOBAL);
    const hasJobTitleNearName = anySpanWithin(
      [...jobTitleSpans, ...evasiveJobTitleSpans],
      allNameSpans,
      NAME_TITLE_PROXIMITY_CHARS,
    );
    // Gated by skipViolationTypes: an employer may name a role in its own caption.
    if (hasJobTitleNearName && !skip.has("JOB_TITLE")) violationTypes.push("JOB_TITLE");

    // --- Phone numbers: dedicated shape-based PII check, not a keyword.
    if (PHONE_PATTERN.test(combined)) {
      violationTypes.push("PII_PHONE_NUMBER");
    }

    // Gated by skipViolationTypes: an employer's own caption may be an all-caps
    // announcement ("GRAND OPENING THIS SATURDAY") - the shouting heuristic is
    // tuned for an employee venting in a review, not this.
    const shoutingRatio = this.shoutingRatio(combined);
    if (shoutingRatio > 0.6 && combined.length > 20 && !skip.has("ABUSE_OR_INSULT")) {
      violationTypes.push("ABUSE_OR_INSULT");
    }

    if (violationTypes.length === 0) {
      return { violates: false, violationTypes: [], confidence: 0.95 };
    }

    // Only an unambiguous, non-evasive profanity match is high-confidence
    // enough to hard-reject at submission time (see ReviewsService.
    // runModerationPipeline's >= 0.9 threshold, unchanged). Every new
    // evasion-derived detection above — spaced profanity, spaced job
    // titles/departments, spaced names, and phone numbers — deliberately
    // stays at the existing 0.5 "flag for human review" tier instead: the
    // requirement is that this filter routes matches to the admin queue,
    // never silently rejects or deletes them outright.
    const confidence = hasPlainProfanity ? 0.95 : 0.5;
    return { violates: true, violationTypes, confidence };
  }

  scoreTrust(context: {
    accountAgeDays: number;
    priorPublishedReviewCount: number;
    priorRejectedReviewCount: number;
    employmentDatesPlausible: boolean;
  }): TrustScoreResult {
    const factors: string[] = [];
    let score = 0.5;

    if (context.accountAgeDays >= 7) {
      score += 0.15;
      factors.push("account_older_than_7_days");
    } else {
      factors.push("new_account");
    }

    if (context.priorPublishedReviewCount > 0) {
      score += 0.2;
      factors.push("has_prior_published_reviews");
    } else {
      factors.push("first_review");
    }

    if (context.priorRejectedReviewCount > 0) {
      score -= 0.3 * context.priorRejectedReviewCount;
      factors.push("has_prior_rejected_reviews");
    }

    if (context.employmentDatesPlausible) {
      score += 0.15;
      factors.push("employment_dates_plausible");
    } else {
      score -= 0.2;
      factors.push("employment_dates_implausible");
    }

    return { score: Math.max(0, Math.min(1, score)), factors };
  }

  private shoutingRatio(text: string): number {
    const letters = text.replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ]/g, "");
    if (letters.length === 0) return 0;
    const upper = letters.replace(/[^A-ZÇĞİÖŞÜ]/g, "");
    return upper.length / letters.length;
  }
}

import { Injectable } from "@nestjs/common";
import type { ContentCheckResult, TrustScoreResult } from "@iwtr/shared-types";

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
  "gerizekali",
  "salak",
  "aptal",
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
];

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

// Substring (not word-boundary) matching on purpose for display names: a
// short single-token nickname is exactly where someone concatenates a slur
// into a compound word ("fuckface") with no space to give matchesAsWord's
// boundary check anything to key off. "pic" is excluded here (unlike the
// review-content list) since it's short enough to false-positive constantly
// as a substring (Picasso, topic, picnic...).
const DISPLAY_NAME_BLOCKED_SUBSTRINGS = [...PROFANITY_WORDS.filter((w) => w !== "pic"), ...SEXUAL_CONTENT_WORDS];

@Injectable()
export class ModerationService {
  // For short free-text fields (currently: the self-chosen display name) where
  // only an unambiguous block matters — no name-pattern/job-title/shouting
  // heuristics, those are noisy on short strings and irrelevant to a nickname.
  checkDisplayName(name: string): boolean {
    const lower = name.toLowerCase();
    return DISPLAY_NAME_BLOCKED_SUBSTRINGS.some((w) => lower.includes(w));
  }

  checkContent(texts: string[]): ContentCheckResult {
    const combined = texts.filter(Boolean).join(" \n ");
    const lower = combined.toLowerCase();
    const violationTypes: ContentCheckResult["violationTypes"] = [];

    const hasProfanity = PROFANITY_WORDS.some((w) => matchesAsWord(lower, w));
    if (hasProfanity) violationTypes.push("PROFANITY");

    const hasJobTitle = JOB_TITLE_WORDS.some((w) => matchesAsWord(lower, w));
    if (hasJobTitle) violationTypes.push("JOB_TITLE");

    const hasNameLike = NAME_LIKE_PATTERN.test(combined);
    if (hasNameLike) violationTypes.push("NAME_OR_SURNAME");

    const shoutingRatio = this.shoutingRatio(combined);
    if (shoutingRatio > 0.6 && combined.length > 20) violationTypes.push("ABUSE_OR_INSULT");

    if (violationTypes.length === 0) {
      return { violates: false, violationTypes: [], confidence: 0.95 };
    }

    // Profanity is an unambiguous, high-confidence rule match -> hard reject.
    // Name-like patterns, job titles, and shouting are heuristic and easy to
    // false-positive on (e.g. a company's own name, "The Manager's office
    // hours...") -> low confidence, goes to the admin queue instead of a hard
    // reject.
    const confidence = hasProfanity ? 0.95 : 0.5;
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

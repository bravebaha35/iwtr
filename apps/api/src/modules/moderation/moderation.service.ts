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

@Injectable()
export class ModerationService {
  checkContent(texts: string[]): ContentCheckResult {
    const combined = texts.filter(Boolean).join(" \n ");
    const lower = combined.toLowerCase();
    const violationTypes: ContentCheckResult["violationTypes"] = [];

    const hasProfanity = PROFANITY_WORDS.some((w) => lower.includes(w));
    if (hasProfanity) violationTypes.push("PROFANITY");

    const hasJobTitle = JOB_TITLE_WORDS.some((w) => lower.includes(w));
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

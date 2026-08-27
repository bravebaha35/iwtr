export interface ThemeMention {
  theme: string;
  mentionCount: number;
}

// Turkish-aware, case-insensitive, word-boundary matched (never a bare
// substring test — "team" must not match inside "steamroller"), same
// technique as ModerationService's job-title matching. Deliberately a
// small fixed rule table, not free-text generation — this codebase has no
// LLM/NLP integration wired in (see ModerationService's own class comment:
// "a deliberate stand-in for a future AI-backed implementation"); this is
// that same kind of stand-in, not a real summarizer.
const THEME_KEYWORDS: Record<string, string[]> = {
  Culture: ["team", "ekip", "culture", "kültür", "backstab", "toxic", "toksik"],
  "Leadership & Management": ["manager", "management", "yönetici", "yönetim", "leadership", "liderlik", "micromanag"],
  "Infrastructure & Resources": ["equipment", "ekipman", "hardware", "donanım", "it support", "yazılım"],
  "Work-Life Balance": ["overtime", "mesai", "work-life", "burnout", "tükenmişlik", "shift", "vardiya"],
  Compensation: ["salary", "maaş", "pay", "ücret", "wage", "bonus", "prim"],
  "Organizational Stability": ["layoff", "işten çıkar", "turnover", "security", "güvence", "istikrar"],
  Safety: ["safety", "güvenlik", "ppe", "hazard", "tehlike", "injury", "yaralanma"],
};

function wordBoundaryPattern(keyword: string): RegExp {
  // Keyword may itself be multiple words ("layoff", "it support") — match
  // it as a run bounded by non-letter characters on each side rather than
  // requiring \b, which doesn't reliably bound Turkish letters (ı/ğ/ş/ç/ö/ü).
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, "iu");
}

/**
 * Anonymized theme-frequency summary of a company's review comments — the
 * only thing Rival Analytics is allowed to derive from generalThoughts.
 * Takes only the raw comment strings (already stripped of any author
 * identity by the caller) and returns per-theme mention COUNTS, never any
 * comment text itself, so the output can't be reversed into who said what
 * or reconstructed into anything close to a quote.
 */
export function summarizeCommentThemes(comments: string[]): ThemeMention[] {
  return Object.entries(THEME_KEYWORDS).map(([theme, keywords]) => {
    const mentionCount = comments.filter((comment) => {
      const trimmed = comment.trim();
      if (!trimmed) return false;
      return keywords.some((keyword) => wordBoundaryPattern(keyword).test(trimmed));
    }).length;
    return { theme, mentionCount };
  });
}

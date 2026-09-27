import { EMBEDDED_WORDS, EXACT_WORDS, PHRASES, PREFIX_WORDS, UNFOLDED_EXACT_WORDS } from "./profanity-lexicon";

// Finds a rude word from profanity-lexicon.ts in free text, including the
// usual ways of dodging a word filter:
//   - spaced or dotted letters:  "s t u p i d", "s.i.k.t.i.r", "f-u-c-k"
//   - a word split in two:       "stu pid", "sik tir"
//   - stretched letters:         "fuuuuck", "salaaaak"
//   - look-alike digits/symbols: "sh1t", "@ptal", "0rospu"
//   - a star for a letter:       "f*ck", "s*kerim"
//   - Turkish letters or not:    "şerefsiz" / "serefsiz", "SALAK"
// "plain" = the word itself was written normally (confident enough to reject
// a review outright); "evasive" = only found after undoing one of the tricks
// above (sent to a human moderator instead - see ModerationService).

export interface ProfanityMatch {
  plain: boolean;
  evasive: boolean;
}

function foldTurkish(s: string): string {
  return s
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/â/g, "a")
    .replace(/î/g, "i")
    .replace(/û/g, "u");
}

const LOOKALIKES: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };

// Digits/symbols only count as letters inside a word that also has real
// letters ("sh1t"), never in a plain number ("2024").
function undoLookalikes(token: string): string {
  if (!/\p{L}/u.test(token) || !/[0-9@$]/.test(token)) return token;
  return token.replace(/[0134570@$]/g, (ch) => LOOKALIKES[ch] ?? ch);
}

const EXACT = new Set(EXACT_WORDS);
const UNFOLDED_EXACT = new Set(UNFOLDED_EXACT_WORDS);
const ALL_WORDS = [...EXACT_WORDS, ...PREFIX_WORDS];
// Long enough to trust as a piece of a spelled-out run ("youarestupid").
const RUN_EMBEDDED = [...new Set([...EMBEDDED_WORDS, ...ALL_WORDS.filter((w) => w.length >= 5)])];

function matchesWord(folded: string): boolean {
  return (
    EXACT.has(folded) ||
    PREFIX_WORDS.some((p) => folded.startsWith(p)) ||
    EMBEDDED_WORDS.some((e) => folded.includes(e))
  );
}

// "fuuuuck" -> "fuck" and "fuuck"; "assss" -> "as" and "ass". Only runs of 3+
// are shortened, so a normal double letter ("class", "tassak") is untouched.
function stretchedVariants(folded: string): string[] {
  if (!/(\p{L})\1\1/u.test(folded)) return [];
  return [folded.replace(/(\p{L})\1{2,}/gu, "$1"), folded.replace(/(\p{L})\1{2,}/gu, "$1$1")];
}

// "f*ck": a star stands for any one letter.
function matchesWithStars(folded: string): boolean {
  if (!folded.includes("*") || folded.replace(/\*/g, "").length < 2) return false;
  const pattern = new RegExp(`^${folded.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "\\p{L}")}`, "u");
  return ALL_WORDS.some((w) => w.length >= folded.length - 1 && pattern.test(w));
}

const TOKEN_PATTERN = /[\p{L}\p{N}@$*]+/gu;
// 3+ single characters, each followed by 1-3 separators: "s t u p i d", "s.i.k".
const SPELLED_OUT_PATTERN = /(?<![\p{L}\p{N}])(?:[\p{L}\p{N}@$*][\s.\-_,+|/]{1,3}){2,}[\p{L}\p{N}@$*](?![\p{L}\p{N}])/gu;

export function findProfanity(text: string): ProfanityMatch {
  const lower = text.toLocaleLowerCase("tr-TR");
  const rawTokens = lower.match(TOKEN_PATTERN) ?? [];
  const folded = rawTokens.map((t) => undoLookalikes(foldTurkish(t)));

  // Written normally.
  const plain =
    rawTokens.some((t) => UNFOLDED_EXACT.has(t)) ||
    folded.some(matchesWord) ||
    (() => {
      const joined = ` ${folded.join(" ")} `;
      return PHRASES.some((p) => joined.includes(` ${p} `));
    })();
  if (plain) return { plain: true, evasive: false };

  // Dodged.
  const stretched = folded.some((t) => stretchedVariants(t).some(matchesWord)) || folded.some(matchesWithStars);

  const spelledOut = [...lower.matchAll(SPELLED_OUT_PATTERN)].some((m) => {
    const joined = undoLookalikes(foldTurkish(m[0].replace(/[\s.\-_,+|/]/g, "")));
    const unfoldedJoined = m[0].replace(/[\s.\-_,+|/]/g, "");
    return (
      UNFOLDED_EXACT.has(unfoldedJoined) ||
      matchesWord(joined) ||
      matchesWithStars(joined) ||
      RUN_EMBEDDED.some((w) => joined.includes(w))
    );
  });

  // "stu pid", "sik tir": two short letter-only pieces that make a word
  // from the prefix list only (never a short exact word - "an al" is fine).
  const split = folded.some((t, i) => {
    const next = folded[i + 1];
    if (!next || t.length > 3 || next.length > 3 || !/^\p{L}+$/u.test(t + next)) return false;
    const combined = t + next;
    // 6+ letters: shorter joins ("apt al" -> "aptal") are too often two real words.
    return combined.length >= 6 && PREFIX_WORDS.some((p) => combined.startsWith(p));
  });

  return { plain: false, evasive: stretched || spelledOut || split };
}

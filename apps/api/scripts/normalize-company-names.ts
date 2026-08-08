// Dry-run + apply pass for company-name text quality: restores Turkish
// diacritics OSM flattened to ASCII (e.g. "Altin" -> "Altın") and normalizes
// casing to Title Case, while preserving genuine brand/legal-suffix acronyms
// (e.g. "ADT Dedektiflik" keeps "ADT", "... A.Ş." keeps "A.Ş.").
//
// Deasciification uses the `turkish-deasciifier` package — a JS port of Dr.
// Deniz Yuret's statistical Turkish deasciifier (the same algorithm used by
// Zemberek and most Turkish NLP tooling). It's context-aware (uses
// surrounding letters to disambiguate, e.g. "Sirketi" -> "Şirketi") and gets
// the large majority of cases right, but it is NOT perfect — short common
// words/names are its weak point (it will occasionally turn "Ali" into "Alı"
// or "Su" into "Şu" in an unlucky context). That's why this is a dry run
// first: read the full diff before trusting it.
//
// Usage: pnpm exec ts-node scripts/normalize-company-names.ts           (dry run, no writes)
//        pnpm exec ts-node scripts/normalize-company-names.ts --apply   (writes the changes)

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
// No published type declarations for this package — see scripts/turkish-deasciifier.d.ts,
// but ts-node's per-file compilation (tsconfig's "include" is scoped to src/)
// doesn't reliably pick that up for files under scripts/, so require() (typed
// `any` by TS by default) sidesteps needing module resolution to find it.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Deasciifier: new () => { deasciify(text: string): string } = require("turkish-deasciifier");

// Common Turkish corporate/legal-suffix abbreviations — preserved verbatim
// wherever they appear in a name (not just first-word position), since
// title-casing them (e.g. "A.Ş." -> "A.ş.") would break, not fix, them.
const CORPORATE_ABBREVIATIONS = new Set(
  ["A.Ş.", "AŞ", "A.Ş", "LTD.", "LTD", "ŞTİ.", "ŞTİ", "A.O.", "T.C.", "TC", "İNC.", "INC.", "CO.", "CORP."].map(
    (s) => s.toLocaleUpperCase("tr-TR"),
  ),
);

// A word is treated as an intentional acronym/brand-signature — and left
// completely untouched — if it's short and was already fully uppercase in
// the source data. "ADT" in "ADT Dedektiflik" is the motivating example: forcing
// it to "Adt" would destroy the brand's actual identity. Same reasoning
// applies wherever a short all-caps token appears, not just first-word
// position — parenthetical acronyms like "(İŞKUR)" or "(F.A.S.T.)" elsewhere
// in a name need the same protection, or title-casing mangles them too
// ("İşkur", "F.a.ş.t."). The FIRST word specifically is only exempted when
// the whole name has fewer than 4 words — a first word that short in a
// longer, more descriptive name is less likely to be a standalone acronym.
function isShortAllCaps(word: string): boolean {
  const letters = word.replace(/[^\p{L}]/gu, "");
  if (letters.length < 2 || letters.length > 6) return false;
  return letters === letters.toLocaleUpperCase("tr-TR") && letters !== letters.toLocaleLowerCase("tr-TR");
}

// Distinguishes "one genuine acronym sits inside an otherwise normal-case
// name" (İŞKUR, F.A.S.T.) from "the whole name was typed in caps" (where
// every word looks like a short acronym by the check above purely because
// nothing in the name has lowercase letters at all — verified: without this
// gate, "2M ENDÜSTRİYEL... SAN. VE DIŞ TİC. LTD. ŞTİ" kept "SAN"/"VE"/"DIŞ"/
// "TİC" fully uppercase instead of normalizing them). Only the specific
// legal suffixes in CORPORATE_ABBREVIATIONS are exempt from this gate, since
// "A.Ş."/"LTD. ŞTİ." are conventionally written in caps regardless.
function isAllCapsName(words: string[]): boolean {
  const letters = words.join("").replace(/[^\p{L}]/gu, "");
  if (letters.length === 0) return false;
  return letters === letters.toLocaleUpperCase("tr-TR") && letters !== letters.toLocaleLowerCase("tr-TR");
}

// A word that already contains any Turkish special character was almost
// certainly typed correctly by whoever entered it — running it back through
// the deasciifier risks "correcting" something that wasn't broken. Verified:
// without this guard, already-correct "Mektüm", "Erenköy", "Akçansa",
// "Aslantaş", "Kurtköy" all got WORSE (lost their diacritics). Only words
// that are currently pure ASCII are candidates for restoration.
function isPureAscii(word: string): boolean {
  return !/[ıİşŞçÇğĞöÖüÜ]/.test(word);
}

// Specific words directly observed, in a full manual read-through of every
// proposed change, to be mis-converted by the statistical model — mostly
// short words with two valid Turkish readings where it guessed the wrong
// one ("su"/water -> "şu"), a real already-correct word ("iplik"/thread
// getting a wrong ı), a couple of English loanwords it tried to
// "Turkify" ("International"), and specific proper nouns/brands it
// mis-guessed (a real place name, a real supermarket chain, real surnames).
// Exact match, case-insensitive — left completely as originally typed.
const NEVER_DEASCIIFY = new Set(
  [
    "su", "as", "ali", "adli", "isi", "iplik", "asm",
    "international", "manufacturer",
    "battalgazi", "basko", "aras", "alohan", "aslantas", "arpas",
  ].map((w) => w.toLocaleLowerCase("tr-TR")),
);

// Capitalizes the first letter of EVERY letter-run in the token, not just
// the very first character overall — a naive "capitalize index 0, lowercase
// the rest" breaks glued compounds like "Bd.Asya" -> "Bd.asya" or
// "Inşaat-Emlak" -> "Inşaat-emlak", since everything past the first letter
// gets forced to lowercase regardless of punctuation boundaries in between.
// Domain TLDs after a literal "." in a name like "e-makarna.com" aren't a
// title-case-able word — forcing "com" -> "Com" looks wrong for what's
// clearly meant to read as a web address.
const DOMAIN_SUFFIXES = new Set(["com", "net", "org", "co", "info", "biz", "tr", "gov", "edu"]);

function titleCaseWordTr(word: string): string {
  return word.replace(/\p{L}+/gu, (run, offset: number, full: string) => {
    // Single-letter runs are usually a grammatical suffix/particle glued on
    // with a hyphen (e.g. "Bab-ı" — "ı" there isn't a standalone word), not a
    // second word needing its own capital — recapitalizing it produces
    // "Bab-I", which reads wrong. Leave length-1 runs as originally cased.
    if (run.length === 1) return run;

    // Turkish convention never capitalizes a case-suffix glued on with an
    // apostrophe ("Mahir'de", "Kur'an") — leave whatever casing it already had.
    if (full.charAt(offset - 1) === "'" || full.charAt(offset - 1) === "’") return run;

    const lower = run.toLocaleLowerCase("tr-TR");
    if (full.charAt(offset - 1) === "." && DOMAIN_SUFFIXES.has(lower)) return lower;
    return lower.charAt(0).toLocaleUpperCase("tr-TR") + lower.slice(1);
  });
}

// TDK convention keeps short conjunctions lowercase inside a title
// ("Sanayi ve Ticaret", not "Sanayi Ve Ticaret") — same idea as "of"/"and"
// staying lowercase in an English title, unless it's the very first word.
const LOWERCASE_CONJUNCTIONS = new Set(["ve", "ile", "veya", "da", "de", "ya", "ki"]);

// Names manually reviewed word-for-word during the government/political
// cleanup pass (see cleanup-public-entities.ts) — several of these have a
// short mixed-case brand-initial first word ("Asm İnşaat") that doesn't meet
// isShortAllCaps's "already fully uppercase" bar, so without this explicit
// list the normalizer would silently undo that manual review (verified: it
// turned "Asm" into "Aşm").
const SKIP_ENTIRELY = new Set([
  "Asm Inşaat",
  "Boğaziçi Elektrik Dağıtım A.Ş. Beyazıt İşletme Müdürlüğü",
  "Akçansa Genel Müdürlük",
  "Birlik Sigorta Gn. Müdürlüğü",
  "Bosch Türkiye ve Orta Doğu Genel Müdürlük",
  "Çimsa Çimento Genel Müdürlük",
  "Gülaylar Genel Müdürlük",
  "Hedef Filo Genel Müdürlüğü",
  "HSBC Genel Müdürlük",
  "Hyundai Assam Genel Müdürlük",
  "İpekyol Genel Müdürlük Merkez Ofis",
  "İpragaz Genel Müdürlük",
  "Koton Genel Müdürlük",
  "MNG Kargo Genel Müdürlüğü",
  "UPS Türkiye Genel Müdürlüğü",
]);

function normalizeName(originalRaw: string): string {
  if (SKIP_ENTIRELY.has(originalRaw)) return originalRaw;
  // Turkish dotted İ can arrive as either the single precomposed codepoint or
  // as "i" + a combining dot-above mark — visually identical, but the latter
  // makes the letter-run regex below see two runs instead of one, mangling
  // e.g. "Ci̇hat" into "Çi̇Hat". NFC collapses it to the precomposed form.
  const original = originalRaw.normalize("NFC");
  const trimmed = original.trim().replace(/\s+/g, " ");
  const originalWords = trimmed.split(" ");
  const totalWords = originalWords.length;

  const deasciified = new Deasciifier().deasciify(trimmed);
  const deasciifiedWords = deasciified.split(" ");
  const wholeNameShouting = isAllCapsName(originalWords);

  const resultWords = originalWords.map((origWord, i) => {
    const isKnownAbbreviation = CORPORATE_ABBREVIATIONS.has(origWord.toLocaleUpperCase("tr-TR"));
    const isAcronymPosition = i === 0 ? totalWords < 4 : true;
    const isSignatureAcronym = !wholeNameShouting && isAcronymPosition && isShortAllCaps(origWord);
    if (isKnownAbbreviation || isSignatureAcronym) {
      return origWord;
    }

    const skipDeasciify = NEVER_DEASCIIFY.has(origWord.toLocaleLowerCase("tr-TR")) || !isPureAscii(origWord);
    const source = skipDeasciify ? origWord : (deasciifiedWords[i] ?? origWord);
    if (i > 0 && LOWERCASE_CONJUNCTIONS.has(source.toLocaleLowerCase("tr-TR"))) {
      return source.toLocaleLowerCase("tr-TR");
    }
    return titleCaseWordTr(source);
  });

  return resultWords.join(" ");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();
  const companies = await prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });

  const changes: { id: string; before: string; after: string }[] = [];
  for (const c of companies) {
    const after = normalizeName(c.name);
    if (after !== c.name) {
      changes.push({ id: c.id, before: c.name, after });
    }
  }

  console.log(apply ? "=== APPLYING CHANGES ===" : "=== DRY RUN — NO RECORDS CHANGED ===");
  console.log("Total companies evaluated:", companies.length);
  console.log("Names that would change:", changes.length);
  console.log("Names already clean:", companies.length - changes.length);
  console.log("");
  console.log(`--- ALL ${changes.length} proposed changes ---`);
  for (const c of changes) {
    console.log(`  "${c.before}"  ->  "${c.after}"`);
  }

  if (apply) {
    let updated = 0;
    for (const c of changes) {
      await prisma.company.update({ where: { id: c.id }, data: { name: c.after } });
      updated++;
    }
    console.log("");
    console.log("Updated:", updated);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

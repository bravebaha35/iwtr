// The site's own small translation layer: no library, no keys to invent.
// The English text written in a component IS the key; the Turkish
// dictionary (lib/i18n/tr) maps it to the Turkish wording. Anything not in
// the dictionary stays in English, so a missed string shows English rather
// than a blank or a key name.
//
// Placeholders are written {name} in both languages and filled from `vars`.

export type Locale = "en" | "tr";

export const LOCALES: Locale[] = ["en", "tr"];

// Read by the server (root layout, server pages) and written by the
// Language setting on Edit Profile > Account Options. A cookie, not
// localStorage, so the server can render the right language on the very
// first paint.
export const LOCALE_COOKIE = "iwtr-lang";

export type Dictionary = Readonly<Record<string, string>>;

export type Vars = Record<string, string | number>;

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "en" || value === "tr";
}

function fill(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

export interface Translator {
  locale: Locale;
  // t("Open roles") / t("{count} followers", { count })
  t: (text: string, vars?: Vars) => string;
  // English singular/plural chosen by n; Turkish uses one form for both.
  // tp(3, "{n} review", "{n} reviews")
  tp: (n: number, one: string, many: string, vars?: Vars) => string;
}

export function makeTranslator(locale: Locale, dict: Dictionary | null): Translator {
  const t = (text: string, vars?: Vars) => fill((locale === "tr" && dict?.[text]) || text, vars);
  const tp = (n: number, one: string, many: string, vars?: Vars) => t(n === 1 ? one : many, { n, ...vars });
  return { locale, t, tp };
}

export type TFn = Translator["t"];

// For plain helpers (validators, formatters) that build a message: they take
// a `t` argument defaulting to this, so a component passes its own and the
// message comes back in the visitor's language.
export const plainT: TFn = makeTranslator("en", null).t;

// BCP 47 tag for Intl date/number formatting.
export function intlLocale(locale: Locale): string {
  return locale === "tr" ? "tr-TR" : "en-GB";
}

// A country's name in the visitor's language from its ISO code (the browser
// knows every country's Turkish name), the stored English name otherwise.
let trRegions: Intl.DisplayNames | null = null;
export function regionName(code: string, english: string, locale: Locale): string {
  if (locale === "en") return english;
  try {
    trRegions ??= new Intl.DisplayNames(["tr-TR"], { type: "region" });
    return trRegions.of(code.toUpperCase()) ?? english;
  } catch {
    return english;
  }
}

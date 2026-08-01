// ğ/Ğ and ı/İ have no Unicode canonical decomposition (unlike ç/ö/ü/ş, which
// NFKD splits into a base letter + combining diacritic below), so the
// normalize+strip-diacritics pipeline below can't reduce them to plain ASCII
// on its own — without this map they'd fall through to the final
// non-alphanumeric replace and turn into a stray "-" instead of a letter.
const TURKISH_ASCII_MAP: Record<string, string> = {
  ğ: "g",
  Ğ: "g",
  ı: "i",
  İ: "i",
};

export function slugify(name: string): string {
  const asciified = name.replace(/[ğĞıİ]/g, (ch) => TURKISH_ASCII_MAP[ch]);
  return asciified
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

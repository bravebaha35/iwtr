import { z } from "zod";

// The languages a member can say they know (Edit Profile > Personal
// Information), shown on their CV. A fixed list picked from a dropdown,
// never free text. Stored on User.languages as these codes, in the order
// the member added them. Kept apart from the Skill table on purpose: a
// language is not a "verified skill".
export const LANGUAGES = [
  { code: "tr", label: "Turkish" },
  { code: "en", label: "English" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "it", label: "Italian" },
  { code: "ru", label: "Russian" },
  { code: "ar", label: "Arabic" },
  { code: "ku", label: "Kurdish" },
  { code: "az", label: "Azerbaijani" },
  { code: "fa", label: "Persian" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
  { code: "el", label: "Greek" },
  { code: "bg", label: "Bulgarian" },
  { code: "ro", label: "Romanian" },
  { code: "uk", label: "Ukrainian" },
  { code: "pl", label: "Polish" },
  { code: "sv", label: "Swedish" },
  { code: "no", label: "Norwegian" },
  { code: "da", label: "Danish" },
  { code: "fi", label: "Finnish" },
  { code: "cs", label: "Czech" },
  { code: "hu", label: "Hungarian" },
  { code: "sr", label: "Serbian" },
  { code: "hr", label: "Croatian" },
  { code: "bs", label: "Bosnian" },
  { code: "sq", label: "Albanian" },
  { code: "mk", label: "Macedonian" },
  { code: "ka", label: "Georgian" },
  { code: "hy", label: "Armenian" },
  { code: "he", label: "Hebrew" },
  { code: "hi", label: "Hindi" },
  { code: "ur", label: "Urdu" },
  { code: "bn", label: "Bengali" },
  { code: "id", label: "Indonesian" },
  { code: "ms", label: "Malay" },
  { code: "th", label: "Thai" },
  { code: "vi", label: "Vietnamese" },
  { code: "kk", label: "Kazakh" },
  { code: "uz", label: "Uzbek" },
  { code: "tk", label: "Turkmen" },
  { code: "ky", label: "Kyrgyz" },
  { code: "tt", label: "Tatar" },
  { code: "sw", label: "Swahili" },
  { code: "la", label: "Latin" },
  { code: "tsl", label: "Turkish Sign Language" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as [LanguageCode, ...LanguageCode[]];
export const languageCodeSchema = z.enum(LANGUAGE_CODES);

export const MAX_LANGUAGES_PER_MEMBER = 8;

const LABEL_BY_CODE = new Map<string, string>(LANGUAGES.map((l) => [l.code, l.label]));

/** The display name of a stored language code (unknown codes are shown as they are). */
export function languageLabel(code: string): string {
  return LABEL_BY_CODE.get(code) ?? code;
}

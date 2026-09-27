import { z } from "zod";
import { ALL_TURKEY_AREA_CODES } from "../geo/turkeyAreaCodes";

export type TurkishPhoneKind = "MOBILE" | "LANDLINE";

export interface TurkishPhoneParts {
  kind: TurkishPhoneKind;
  // 3 digits, no leading trunk "0" — a mobile operator prefix (e.g. "532")
  // or a landline province area code (e.g. "212").
  areaCode: string;
  // Remaining 7 digits of the national significant number.
  localNumber: string;
}

// A Turkish national significant number is always 10 digits: a 3-digit
// area code/mobile prefix + a 7-digit local number. Mobile prefixes start
// with 5; landline area codes start with 2, 3, or 4 (no area code table
// entry starts with anything else — see geo/turkeyAreaCodes.ts).
const NATIONAL_NUMBER_PATTERN = /^\+90(\d{10})$/;

// Splits a full E.164 Turkish number into its area-code/mobile-prefix and
// local-number parts. Only checks *shape* (+90, 10 digits, plausible first
// digit) — a landline's area code isn't cross-checked against the real
// province list here (that's validateTurkishCompanyPhone's job), since this
// function is also used by formatTurkishPhoneDisplay, which should still
// render a not-yet-fully-typed or edge-case number rather than go blank.
export function parseTurkishPhone(e164: string): TurkishPhoneParts | null {
  const match = NATIONAL_NUMBER_PATTERN.exec(e164);
  if (!match) return null;

  const national = match[1];
  const areaCode = national.slice(0, 3);
  const localNumber = national.slice(3);
  const firstDigit = areaCode[0];

  if (firstDigit === "5") return { kind: "MOBILE", areaCode, localNumber };
  if (firstDigit === "2" || firstDigit === "3" || firstDigit === "4") {
    return { kind: "LANDLINE", areaCode, localNumber };
  }
  return null;
}

export function isRealTurkishAreaCode(areaCode: string): boolean {
  return ALL_TURKEY_AREA_CODES.includes(areaCode);
}

// The check a company's contact-phone field must pass: a mobile number (any
// 5xx prefix — Turkey's mobile prefixes span 40+ values across operators,
// not a fixed directory worth hardcoding), or a landline whose area code is
// one of the 81 provinces' real codes.
export function validateTurkishCompanyPhone(
  e164: string,
): { valid: true; kind: TurkishPhoneKind } | { valid: false; kind: null; error: string } {
  const parts = parseTurkishPhone(e164);
  if (!parts) {
    return { valid: false, kind: null, error: "Must be a Turkish mobile (05XX) or landline (0XXX) number." };
  }
  if (parts.kind === "LANDLINE" && !isRealTurkishAreaCode(parts.areaCode)) {
    return { valid: false, kind: null, error: `"0${parts.areaCode}" isn't a recognized Turkish area code.` };
  }
  return { valid: true, kind: parts.kind };
}

// "+90 (0XXX) XXX XX XX" for both mobile and landline — the exact display
// format requested for this field, distinct from the plain E.164 storage
// format (which has no separators/parentheses at all).
export function formatTurkishPhoneDisplay(e164: string): string | null {
  const parts = parseTurkishPhone(e164);
  if (!parts) return null;
  const { areaCode, localNumber } = parts;
  return `+90 (0${areaCode}) ${localNumber.slice(0, 3)} ${localNumber.slice(3, 5)} ${localNumber.slice(5, 7)}`;
}

export const companyContactPhoneSchema = z.string().superRefine((value, ctx) => {
  const result = validateTurkishCompanyPhone(value);
  if (!result.valid) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error });
  }
});

// --- Finding phone numbers inside free text (private messages, reviews,
// social comments). Different job from the validators above: those check a
// single form field; this scans prose for anything that looks like a
// Turkish number someone typed out, however they grouped it.

// A digit, then 9-13 more digits, with up to 2 separator characters between
// any two digits: "0532 123 45 67", "0532-123-4567", "(0532) 1234567",
// "+90 532 123 45 67", and the spaced-out "0 5 3 2 1 2 3 4 5 6 7" all match
// as one candidate. The 2-character cap keeps two numbers separated by
// " / " or a word from merging into one. The candidate must also be the
// whole run of digits (nothing digit-like right before or after it), so a
// slice out of a longer figure such as an IBAN never counts.
const PHONE_CANDIDATE_PATTERN = /(?<!\d[\s.\-()/]{0,2})\+?\d(?:[\s.\-()/]{0,2}\d){9,13}(?![\s.\-()/]{0,2}\d)/g;

function nationalNumberOf(digits: string): { national: string; hadTrunkPrefix: boolean } | null {
  if (digits.length === 10) return { national: digits, hadTrunkPrefix: false };
  if (digits.length === 11 && digits.startsWith("0")) return { national: digits.slice(1), hadTrunkPrefix: true };
  if (digits.length === 12 && digits.startsWith("90")) return { national: digits.slice(2), hadTrunkPrefix: true };
  if (digits.length === 13 && digits.startsWith("900")) return { national: digits.slice(3), hadTrunkPrefix: true };
  if (digits.length === 14 && digits.startsWith("0090")) return { national: digits.slice(4), hadTrunkPrefix: true };
  return null;
}

function isPhoneShaped(digits: string): boolean {
  const parsed = nationalNumberOf(digits);
  if (!parsed) return false;
  const { national, hadTrunkPrefix } = parsed;
  // "5.000.000.000" is an amount, not a number anyone can call.
  if (/^\d{3}0{7}$/.test(national)) return false;
  // Mobile (5xx): counts with or without the leading 0 / +90, since people
  // write "532 123 45 67" all the time.
  if (national.startsWith("5")) return true;
  // Landline (2xx/3xx/4xx): only with a 0 / +90 in front AND a real province
  // area code, so an ordinary 10-digit figure isn't mistaken for one.
  return hadTrunkPrefix && isRealTurkishAreaCode(national.slice(0, 3));
}

/** Every Turkish mobile or landline number written in `text`, as typed. */
export function findTurkishPhoneNumbers(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(PHONE_CANDIDATE_PATTERN)) {
    if (isPhoneShaped(match[0].replace(/\D/g, ""))) found.push(match[0].trim());
  }
  return found;
}

export function containsTurkishPhoneNumber(text: string): boolean {
  return findTurkishPhoneNumbers(text).length > 0;
}

// Shown next to a private message that shares a phone number (and under the
// message box while one is being typed). Sharing is allowed once both sides
// have talked it through; this is the reminder, not a block.
export const PHONE_SHARING_NOTE =
  "Our main purpose is protecting your anonymity. Be careful while sharing your phone number.";

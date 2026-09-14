"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.companyContactPhoneSchema = void 0;
exports.parseTurkishPhone = parseTurkishPhone;
exports.isRealTurkishAreaCode = isRealTurkishAreaCode;
exports.validateTurkishCompanyPhone = validateTurkishCompanyPhone;
exports.formatTurkishPhoneDisplay = formatTurkishPhoneDisplay;
const zod_1 = require("zod");
const turkeyAreaCodes_1 = require("../geo/turkeyAreaCodes");
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
function parseTurkishPhone(e164) {
    const match = NATIONAL_NUMBER_PATTERN.exec(e164);
    if (!match)
        return null;
    const national = match[1];
    const areaCode = national.slice(0, 3);
    const localNumber = national.slice(3);
    const firstDigit = areaCode[0];
    if (firstDigit === "5")
        return { kind: "MOBILE", areaCode, localNumber };
    if (firstDigit === "2" || firstDigit === "3" || firstDigit === "4") {
        return { kind: "LANDLINE", areaCode, localNumber };
    }
    return null;
}
function isRealTurkishAreaCode(areaCode) {
    return turkeyAreaCodes_1.ALL_TURKEY_AREA_CODES.includes(areaCode);
}
// The check a company's contact-phone field must pass: a mobile number (any
// 5xx prefix — Turkey's mobile prefixes span 40+ values across operators,
// not a fixed directory worth hardcoding), or a landline whose area code is
// one of the 81 provinces' real codes.
function validateTurkishCompanyPhone(e164) {
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
function formatTurkishPhoneDisplay(e164) {
    const parts = parseTurkishPhone(e164);
    if (!parts)
        return null;
    const { areaCode, localNumber } = parts;
    return `+90 (0${areaCode}) ${localNumber.slice(0, 3)} ${localNumber.slice(3, 5)} ${localNumber.slice(5, 7)}`;
}
exports.companyContactPhoneSchema = zod_1.z.string().superRefine((value, ctx) => {
    const result = validateTurkishCompanyPhone(value);
    if (!result.valid) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: result.error });
    }
});

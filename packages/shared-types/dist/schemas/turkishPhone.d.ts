import { z } from "zod";
export type TurkishPhoneKind = "MOBILE" | "LANDLINE";
export interface TurkishPhoneParts {
    kind: TurkishPhoneKind;
    areaCode: string;
    localNumber: string;
}
export declare function parseTurkishPhone(e164: string): TurkishPhoneParts | null;
export declare function isRealTurkishAreaCode(areaCode: string): boolean;
export declare function validateTurkishCompanyPhone(e164: string): {
    valid: true;
    kind: TurkishPhoneKind;
} | {
    valid: false;
    kind: null;
    error: string;
};
export declare function formatTurkishPhoneDisplay(e164: string): string | null;
export declare const companyContactPhoneSchema: z.ZodEffects<z.ZodString, string, string>;

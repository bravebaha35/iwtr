"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const turkishPhone_1 = require("../turkishPhone");
describe("parseTurkishPhone", () => {
    test("recognizes a mobile number (starts with 5)", () => {
        const result = (0, turkishPhone_1.parseTurkishPhone)("+905321234567");
        expect(result).toEqual({ kind: "MOBILE", areaCode: "532", localNumber: "1234567" });
    });
    test("recognizes a landline number with Ankara's area code", () => {
        const result = (0, turkishPhone_1.parseTurkishPhone)("+903121234567");
        expect(result).toEqual({ kind: "LANDLINE", areaCode: "312", localNumber: "1234567" });
    });
    test("recognizes İstanbul's Asian-side area code (216) as landline", () => {
        const result = (0, turkishPhone_1.parseTurkishPhone)("+902161234567");
        expect(result).toEqual({ kind: "LANDLINE", areaCode: "216", localNumber: "1234567" });
    });
    test("returns null for a non-+90 country code", () => {
        expect((0, turkishPhone_1.parseTurkishPhone)("+15551234567")).toBeNull();
    });
    test("returns null when there are too few digits after +90", () => {
        expect((0, turkishPhone_1.parseTurkishPhone)("+9053212345")).toBeNull();
    });
    test("returns null when there are too many digits after +90", () => {
        expect((0, turkishPhone_1.parseTurkishPhone)("+90532123456789")).toBeNull();
    });
    test("returns null for a national significant number starting with an unused digit (1)", () => {
        expect((0, turkishPhone_1.parseTurkishPhone)("+901234567890")).toBeNull();
    });
});
describe("validateTurkishCompanyPhone", () => {
    test("accepts a mobile number", () => {
        expect((0, turkishPhone_1.validateTurkishCompanyPhone)("+905321234567")).toEqual({ valid: true, kind: "MOBILE" });
    });
    test("accepts a landline number with a real area code (Ankara, 312)", () => {
        expect((0, turkishPhone_1.validateTurkishCompanyPhone)("+903121234567")).toEqual({ valid: true, kind: "LANDLINE" });
    });
    test("rejects a landline number with an area code that doesn't belong to any province", () => {
        // 399 starts with 3 (a real landline first-digit) but isn't any province's
        // actual code — deliberately distinct from a wrong-country-code number.
        const result = (0, turkishPhone_1.validateTurkishCompanyPhone)("+903991234567");
        if (result.valid)
            throw new Error("expected validation to fail");
        expect(result.kind).toBeNull();
        expect(result.error).toMatch(/area code/i);
    });
    test("rejects a non-Turkish number", () => {
        const result = (0, turkishPhone_1.validateTurkishCompanyPhone)("+15551234567");
        if (result.valid)
            throw new Error("expected validation to fail");
        expect(result.error).toBeTruthy();
    });
});
describe("formatTurkishPhoneDisplay", () => {
    test("formats a mobile number as +90 (0XXX) XXX XX XX", () => {
        expect((0, turkishPhone_1.formatTurkishPhoneDisplay)("+905321234567")).toBe("+90 (0532) 123 45 67");
    });
    test("formats a landline number as +90 (0XXX) XXX XX XX", () => {
        expect((0, turkishPhone_1.formatTurkishPhoneDisplay)("+902121234567")).toBe("+90 (0212) 123 45 67");
    });
    test("returns null for an unparseable number", () => {
        expect((0, turkishPhone_1.formatTurkishPhoneDisplay)("+15551234567")).toBeNull();
    });
});
describe("companyContactPhoneSchema", () => {
    test("passes a valid mobile number", () => {
        expect(turkishPhone_1.companyContactPhoneSchema.safeParse("+905321234567").success).toBe(true);
    });
    test("passes a valid landline number with a real area code", () => {
        expect(turkishPhone_1.companyContactPhoneSchema.safeParse("+902121234567").success).toBe(true);
    });
    test("fails a landline number with a fake area code", () => {
        const result = turkishPhone_1.companyContactPhoneSchema.safeParse("+903991234567");
        expect(result.success).toBe(false);
    });
    test("fails a non-Turkish number", () => {
        expect(turkishPhone_1.companyContactPhoneSchema.safeParse("+15551234567").success).toBe(false);
    });
});

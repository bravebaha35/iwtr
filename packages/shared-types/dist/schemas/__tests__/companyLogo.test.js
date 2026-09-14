"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const companyLogo_1 = require("../companyLogo");
const validMeta = { mimeType: "image/png", sizeBytes: 100_000, width: 400, height: 400 };
describe("validateLogoFile", () => {
    test("accepts a square PNG at the recommended size", () => {
        expect((0, companyLogo_1.validateLogoFile)(validMeta)).toEqual({ valid: true });
    });
    test("accepts a square PNG at exactly the minimum dimension", () => {
        const result = (0, companyLogo_1.validateLogoFile)({ ...validMeta, width: companyLogo_1.LOGO_MIN_DIMENSION_PX, height: companyLogo_1.LOGO_MIN_DIMENSION_PX });
        expect(result.valid).toBe(true);
    });
    test("rejects a non-PNG file", () => {
        const result = (0, companyLogo_1.validateLogoFile)({ ...validMeta, mimeType: "image/jpeg" });
        if (result.valid)
            throw new Error("expected validation to fail");
        expect(result.error).toMatch(/PNG/i);
    });
    test("rejects a file over the size cap", () => {
        const result = (0, companyLogo_1.validateLogoFile)({ ...validMeta, sizeBytes: companyLogo_1.LOGO_MAX_FILE_SIZE_BYTES + 1 });
        if (result.valid)
            throw new Error("expected validation to fail");
        expect(result.error).toMatch(/large/i);
    });
    test("rejects a non-square image and names both dimensions", () => {
        const result = (0, companyLogo_1.validateLogoFile)({ ...validMeta, width: 400, height: 300 });
        if (result.valid)
            throw new Error("expected validation to fail");
        expect(result.error).toMatch(/square/i);
        expect(result.error).toContain("400");
        expect(result.error).toContain("300");
    });
    test("rejects a square image smaller than the minimum", () => {
        const tooSmall = companyLogo_1.LOGO_MIN_DIMENSION_PX - 1;
        const result = (0, companyLogo_1.validateLogoFile)({ ...validMeta, width: tooSmall, height: tooSmall });
        if (result.valid)
            throw new Error("expected validation to fail");
        expect(result.error).toContain(String(companyLogo_1.LOGO_MIN_DIMENSION_PX));
    });
});
describe("validateSourceImageForCrop", () => {
    test("accepts a non-square PNG large enough to crop a square out of", () => {
        expect((0, companyLogo_1.validateSourceImageForCrop)({ ...validMeta, width: 1200, height: 630 })).toEqual({ valid: true });
    });
    test("rejects a non-PNG file", () => {
        const result = (0, companyLogo_1.validateSourceImageForCrop)({ ...validMeta, mimeType: "image/jpeg", width: 1200, height: 630 });
        if (result.valid)
            throw new Error("expected validation to fail");
        expect(result.error).toMatch(/PNG/i);
    });
    test("rejects a file over the size cap", () => {
        const result = (0, companyLogo_1.validateSourceImageForCrop)({ ...validMeta, sizeBytes: companyLogo_1.LOGO_MAX_FILE_SIZE_BYTES + 1 });
        if (result.valid)
            throw new Error("expected validation to fail");
        expect(result.error).toMatch(/large/i);
    });
    test("rejects an image whose shorter side is below the crop-quality floor, even if the other side is huge", () => {
        const tooSmall = companyLogo_1.LOGO_MIN_DIMENSION_PX - 1;
        const result = (0, companyLogo_1.validateSourceImageForCrop)({ ...validMeta, width: 2000, height: tooSmall });
        if (result.valid)
            throw new Error("expected validation to fail");
        expect(result.error).toContain(String(companyLogo_1.LOGO_MIN_DIMENSION_PX));
    });
    test("does not reject a non-square image the way validateLogoFile would", () => {
        expect((0, companyLogo_1.validateSourceImageForCrop)({ ...validMeta, width: 400, height: 300 }).valid).toBe(true);
    });
});

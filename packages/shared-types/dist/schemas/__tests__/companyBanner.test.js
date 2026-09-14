"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const companyBanner_1 = require("../companyBanner");
describe("validateBannerSourceFile", () => {
    const validMeta = { mimeType: "image/jpeg", sizeBytes: 500_000, width: 1600, height: 900 };
    it("accepts a reasonably-sized JPEG regardless of aspect ratio", () => {
        expect((0, companyBanner_1.validateBannerSourceFile)(validMeta)).toEqual({ valid: true });
    });
    it("accepts PNG and WebP too", () => {
        expect((0, companyBanner_1.validateBannerSourceFile)({ ...validMeta, mimeType: "image/png" })).toEqual({ valid: true });
        expect((0, companyBanner_1.validateBannerSourceFile)({ ...validMeta, mimeType: "image/webp" })).toEqual({ valid: true });
    });
    it("rejects an unsupported format", () => {
        const result = (0, companyBanner_1.validateBannerSourceFile)({ ...validMeta, mimeType: "image/gif" });
        expect(result.valid).toBe(false);
    });
    it("rejects a file over the max size", () => {
        const result = (0, companyBanner_1.validateBannerSourceFile)({ ...validMeta, sizeBytes: companyBanner_1.BANNER_SOURCE_MAX_FILE_SIZE_BYTES + 1 });
        expect(result.valid).toBe(false);
    });
    it("rejects an image whose shorter side is below the minimum", () => {
        const result = (0, companyBanner_1.validateBannerSourceFile)({
            ...validMeta,
            width: companyBanner_1.BANNER_SOURCE_MIN_DIMENSION_PX - 1,
            height: 900,
        });
        expect(result.valid).toBe(false);
    });
    it("rejects an image whose dimension exceeds the maximum", () => {
        const result = (0, companyBanner_1.validateBannerSourceFile)({
            ...validMeta,
            width: companyBanner_1.BANNER_SOURCE_MAX_DIMENSION_PX + 1,
            height: 900,
        });
        expect(result.valid).toBe(false);
    });
    it("accepts a square image — no aspect-ratio requirement", () => {
        expect((0, companyBanner_1.validateBannerSourceFile)({ ...validMeta, width: 800, height: 800 })).toEqual({ valid: true });
    });
});

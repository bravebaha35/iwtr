import { validateBannerSourceFile, BANNER_SOURCE_MAX_FILE_SIZE_BYTES, BANNER_SOURCE_MIN_DIMENSION_PX } from "../companyBanner";

describe("validateBannerSourceFile", () => {
  const validMeta = { mimeType: "image/jpeg", sizeBytes: 500_000, width: 1600, height: 900 };

  it("accepts a reasonably-sized JPEG regardless of aspect ratio", () => {
    expect(validateBannerSourceFile(validMeta)).toEqual({ valid: true });
  });

  it("accepts PNG and WebP too", () => {
    expect(validateBannerSourceFile({ ...validMeta, mimeType: "image/png" })).toEqual({ valid: true });
    expect(validateBannerSourceFile({ ...validMeta, mimeType: "image/webp" })).toEqual({ valid: true });
  });

  it("rejects an unsupported format", () => {
    const result = validateBannerSourceFile({ ...validMeta, mimeType: "image/gif" });
    expect(result.valid).toBe(false);
  });

  it("rejects a file over the max size", () => {
    const result = validateBannerSourceFile({ ...validMeta, sizeBytes: BANNER_SOURCE_MAX_FILE_SIZE_BYTES + 1 });
    expect(result.valid).toBe(false);
  });

  it("rejects an image whose shorter side is below the minimum", () => {
    const result = validateBannerSourceFile({
      ...validMeta,
      width: BANNER_SOURCE_MIN_DIMENSION_PX - 1,
      height: 900,
    });
    expect(result.valid).toBe(false);
  });

  it("accepts a square image — no aspect-ratio requirement", () => {
    expect(validateBannerSourceFile({ ...validMeta, width: 800, height: 800 })).toEqual({ valid: true });
  });
});

import { validateLogoFile, LOGO_MIN_DIMENSION_PX, LOGO_MAX_FILE_SIZE_BYTES } from "../companyLogo";

const validMeta = { mimeType: "image/png", sizeBytes: 100_000, width: 400, height: 400 };

describe("validateLogoFile", () => {
  test("accepts a square PNG at the recommended size", () => {
    expect(validateLogoFile(validMeta)).toEqual({ valid: true });
  });

  test("accepts a square PNG at exactly the minimum dimension", () => {
    const result = validateLogoFile({ ...validMeta, width: LOGO_MIN_DIMENSION_PX, height: LOGO_MIN_DIMENSION_PX });
    expect(result.valid).toBe(true);
  });

  test("rejects a non-PNG file", () => {
    const result = validateLogoFile({ ...validMeta, mimeType: "image/jpeg" });
    if (result.valid) throw new Error("expected validation to fail");
    expect(result.error).toMatch(/PNG/i);
  });

  test("rejects a file over the size cap", () => {
    const result = validateLogoFile({ ...validMeta, sizeBytes: LOGO_MAX_FILE_SIZE_BYTES + 1 });
    if (result.valid) throw new Error("expected validation to fail");
    expect(result.error).toMatch(/large/i);
  });

  test("rejects a non-square image and names both dimensions", () => {
    const result = validateLogoFile({ ...validMeta, width: 400, height: 300 });
    if (result.valid) throw new Error("expected validation to fail");
    expect(result.error).toMatch(/square/i);
    expect(result.error).toContain("400");
    expect(result.error).toContain("300");
  });

  test("rejects a square image smaller than the minimum", () => {
    const tooSmall = LOGO_MIN_DIMENSION_PX - 1;
    const result = validateLogoFile({ ...validMeta, width: tooSmall, height: tooSmall });
    if (result.valid) throw new Error("expected validation to fail");
    expect(result.error).toContain(String(LOGO_MIN_DIMENSION_PX));
  });
});

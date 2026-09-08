import {
  createSocialCommentInputSchema,
  validateSocialImageUpload,
  SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES,
} from "../social";

describe("social schemas", () => {
  it("rejects an empty comment body", () => {
    expect(createSocialCommentInputSchema.safeParse({ body: "   " }).success).toBe(false);
  });
  it("accepts a normal comment body", () => {
    expect(createSocialCommentInputSchema.safeParse({ body: "great place" }).success).toBe(true);
  });
  it("rejects a non-image mime type", () => {
    expect(validateSocialImageUpload({ mimeType: "application/pdf", sizeBytes: 10 }).valid).toBe(false);
  });
  it("rejects an oversized file", () => {
    expect(
      validateSocialImageUpload({ mimeType: "image/jpeg", sizeBytes: SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES + 1 }).valid,
    ).toBe(false);
  });
  it("accepts a normal HEIC upload", () => {
    expect(validateSocialImageUpload({ mimeType: "image/heic", sizeBytes: 2_000_000 }).valid).toBe(true);
  });
});

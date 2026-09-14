"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const social_1 = require("../social");
describe("social schemas", () => {
    it("rejects an empty comment body", () => {
        expect(social_1.createSocialCommentInputSchema.safeParse({ body: "   " }).success).toBe(false);
    });
    it("accepts a normal comment body", () => {
        expect(social_1.createSocialCommentInputSchema.safeParse({ body: "great place" }).success).toBe(true);
    });
    it("rejects a non-image mime type", () => {
        expect((0, social_1.validateSocialImageUpload)({ mimeType: "application/pdf", sizeBytes: 10 }).valid).toBe(false);
    });
    it("rejects an oversized file", () => {
        expect((0, social_1.validateSocialImageUpload)({ mimeType: "image/jpeg", sizeBytes: social_1.SOCIAL_IMAGE_MAX_FILE_SIZE_BYTES + 1 }).valid).toBe(false);
    });
    it("accepts a normal HEIC upload", () => {
        expect((0, social_1.validateSocialImageUpload)({ mimeType: "image/heic", sizeBytes: 2_000_000 }).valid).toBe(true);
    });
});

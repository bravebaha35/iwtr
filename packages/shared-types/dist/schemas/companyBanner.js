"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bannerUploadResultSchema = exports.BANNER_SOURCE_MAX_DIMENSION_PX = exports.BANNER_SOURCE_MIN_DIMENSION_PX = exports.BANNER_SOURCE_MAX_FILE_SIZE_BYTES = void 0;
exports.validateBannerSourceFile = validateBannerSourceFile;
const zod_1 = require("zod");
const company_1 = require("./company");
// Server-side resizing/compression (OwnerService.uploadBanner, via sharp)
// means the owner never needs to pre-crop or hit an exact resolution — this
// only rejects genuinely unusable source files (wrong format, too small to
// look decent after a center-crop resize, or an unreasonably large upload).
// Deliberately no aspect-ratio or exact-dimension check, unlike the logo
// validator (companyLogo.ts) — the server crops whatever shape comes in
// down to the card's fixed 4:1 banner box.
exports.BANNER_SOURCE_MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
exports.BANNER_SOURCE_MIN_DIMENSION_PX = 400;
exports.BANNER_SOURCE_MAX_DIMENSION_PX = 8000;
// Pure, environment-agnostic — same reasoning as validateLogoFile
// (companyLogo.ts): the authoritative call is server-side, reading
// dimensions from the uploaded buffer via `image-size`, never trusting the
// client alone.
function validateBannerSourceFile(meta) {
    if (meta.mimeType !== "image/png" && meta.mimeType !== "image/jpeg" && meta.mimeType !== "image/webp") {
        return { valid: false, error: "Banner must be a PNG, JPEG, or WebP file." };
    }
    if (meta.sizeBytes > exports.BANNER_SOURCE_MAX_FILE_SIZE_BYTES) {
        return {
            valid: false,
            error: `Banner file is too large — keep it under ${exports.BANNER_SOURCE_MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
        };
    }
    const shorterSide = Math.min(meta.width, meta.height);
    if (shorterSide < exports.BANNER_SOURCE_MIN_DIMENSION_PX) {
        return {
            valid: false,
            error: `Image is too small for a banner — its shorter side must be at least ${exports.BANNER_SOURCE_MIN_DIMENSION_PX}px (got ${meta.width}x${meta.height}px).`,
        };
    }
    if (meta.width > exports.BANNER_SOURCE_MAX_DIMENSION_PX || meta.height > exports.BANNER_SOURCE_MAX_DIMENSION_PX) {
        return {
            valid: false,
            error: `Image is too large for a banner — each side must be under ${exports.BANNER_SOURCE_MAX_DIMENSION_PX}px (got ${meta.width}x${meta.height}px).`,
        };
    }
    return { valid: true };
}
exports.bannerUploadResultSchema = zod_1.z.object({ url: company_1.httpUrlSchema });

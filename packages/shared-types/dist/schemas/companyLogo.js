"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logoUploadResultSchema = exports.LOGO_MAX_FILE_SIZE_BYTES = exports.LOGO_MIN_DIMENSION_PX = exports.LOGO_RECOMMENDED_DIMENSION_PX = void 0;
exports.validateLogoFile = validateLogoFile;
exports.validateSourceImageForCrop = validateSourceImageForCrop;
const zod_1 = require("zod");
const company_1 = require("./company");
// Sourced from LinkedIn's own company-page logo guidance (recommended
// 400x400, minimum 268x268, PNG/JPEG under 3MB) — PNG-only and a hard 1:1
// requirement are this platform's own tightening on top of that, not
// LinkedIn's rule.
exports.LOGO_RECOMMENDED_DIMENSION_PX = 400;
exports.LOGO_MIN_DIMENSION_PX = 268;
exports.LOGO_MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024;
// Pure, environment-agnostic so the exact same rule runs both client-side
// (right after reading a picked file's dimensions via an <img> element, for
// instant feedback) and server-side (the authoritative check, after reading
// dimensions from the uploaded buffer with `image-size` — never trust the
// client-side pass alone).
function validateLogoFile(meta) {
    if (meta.mimeType !== "image/png") {
        return { valid: false, error: "Logo must be a PNG file." };
    }
    if (meta.sizeBytes > exports.LOGO_MAX_FILE_SIZE_BYTES) {
        return {
            valid: false,
            error: `Logo file is too large — keep it under ${exports.LOGO_MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
        };
    }
    if (meta.width !== meta.height) {
        return {
            valid: false,
            error: `Logo must be square (1:1) — this file is ${meta.width}x${meta.height}px.`,
        };
    }
    if (meta.width < exports.LOGO_MIN_DIMENSION_PX) {
        return {
            valid: false,
            error: `Logo must be at least ${exports.LOGO_MIN_DIMENSION_PX}x${exports.LOGO_MIN_DIMENSION_PX}px (got ${meta.width}x${meta.height}px).`,
        };
    }
    return { valid: true };
}
// Checked on the RAW picked file, before the owner crops it — deliberately
// does NOT require square here (that's the whole point of letting them crop
// afterward instead of rejecting a rectangular photo outright). Still
// enforces a minimum resolution on the shorter side, since the crop step
// exports a fixed LOGO_RECOMMENDED_DIMENSION_PX square regardless of source
// size — cropping a too-small source would just silently upscale into a
// blurry logo rather than failing loudly here. `validateLogoFile` above
// stays the authoritative check on the final cropped (always-square)
// output, both client- and server-side.
function validateSourceImageForCrop(meta) {
    if (meta.mimeType !== "image/png") {
        return { valid: false, error: "Logo must be a PNG file." };
    }
    if (meta.sizeBytes > exports.LOGO_MAX_FILE_SIZE_BYTES) {
        return {
            valid: false,
            error: `Logo file is too large — keep it under ${exports.LOGO_MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
        };
    }
    const shorterSide = Math.min(meta.width, meta.height);
    if (shorterSide < exports.LOGO_MIN_DIMENSION_PX) {
        return {
            valid: false,
            error: `Image is too small to crop a good logo from — its shorter side must be at least ${exports.LOGO_MIN_DIMENSION_PX}px (got ${meta.width}x${meta.height}px).`,
        };
    }
    return { valid: true };
}
exports.logoUploadResultSchema = zod_1.z.object({ url: company_1.httpUrlSchema });

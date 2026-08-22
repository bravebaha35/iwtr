import { z } from "zod";
import { httpUrlSchema } from "./company";

// Sourced from LinkedIn's own company-page logo guidance (recommended
// 400x400, minimum 268x268, PNG/JPEG under 3MB) — PNG-only and a hard 1:1
// requirement are this platform's own tightening on top of that, not
// LinkedIn's rule.
export const LOGO_RECOMMENDED_DIMENSION_PX = 400;
export const LOGO_MIN_DIMENSION_PX = 268;
export const LOGO_MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024;

export interface LogoFileMeta {
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

// Pure, environment-agnostic so the exact same rule runs both client-side
// (right after reading a picked file's dimensions via an <img> element, for
// instant feedback) and server-side (the authoritative check, after reading
// dimensions from the uploaded buffer with `image-size` — never trust the
// client-side pass alone).
export function validateLogoFile(meta: LogoFileMeta): { valid: true } | { valid: false; error: string } {
  if (meta.mimeType !== "image/png") {
    return { valid: false, error: "Logo must be a PNG file." };
  }
  if (meta.sizeBytes > LOGO_MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Logo file is too large — keep it under ${LOGO_MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
    };
  }
  if (meta.width !== meta.height) {
    return {
      valid: false,
      error: `Logo must be square (1:1) — this file is ${meta.width}x${meta.height}px.`,
    };
  }
  if (meta.width < LOGO_MIN_DIMENSION_PX) {
    return {
      valid: false,
      error: `Logo must be at least ${LOGO_MIN_DIMENSION_PX}x${LOGO_MIN_DIMENSION_PX}px (got ${meta.width}x${meta.height}px).`,
    };
  }
  return { valid: true };
}

export const logoUploadResultSchema = z.object({ url: httpUrlSchema });
export type LogoUploadResult = z.infer<typeof logoUploadResultSchema>;

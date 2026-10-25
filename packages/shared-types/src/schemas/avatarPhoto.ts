import { z } from "zod";
import { httpUrlSchema } from "./company";

// Same LinkedIn-derived reasoning as companyLogo.ts but for a personal
// employer headshot rather than a company logo — larger recommended size,
// PNG+JPEG both accepted. The upload pipeline always compresses to JPEG
// client-side before sending (see AvatarPhotoUploader.tsx), but the
// authoritative server check stays permissive rather than assuming that
// step always ran.
export const AVATAR_RECOMMENDED_DIMENSION_PX = 800;
// The cropper always draws an 800x800 JPEG, so the original only needs to be
// big enough not to look blurry, and phone photos (often 10MB+) are fine.
export const AVATAR_MIN_DIMENSION_PX = 200;
export const AVATAR_MAX_SOURCE_FILE_SIZE_BYTES = 25 * 1024 * 1024;
// The authoritative cap on the already client-compressed uploaded file —
// much smaller than the source cap above, since by the time a file reaches
// this check it's already been through client-side compression.
export const AVATAR_MAX_UPLOAD_FILE_SIZE_BYTES = 2 * 1024 * 1024;

const AVATAR_MIME_TYPES = ["image/png", "image/jpeg"];
// What a member may pick to crop from: phones often save WebP. The cropper
// always turns the result into a JPEG, so the upload itself stays PNG/JPEG.
export const AVATAR_SOURCE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

export interface AvatarFileMeta {
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

// Checked on the RAW picked file, before cropping — same "don't require
// square yet" reasoning as validateSourceImageForCrop in companyLogo.ts:
// the crop step is what enforces 1:1, so rejecting a rectangular source
// photo here would defeat the point of letting the owner crop it.
export function validateSourceImageForAvatarCrop(
  meta: AvatarFileMeta,
): { valid: true } | { valid: false; error: string } {
  if (!AVATAR_SOURCE_MIME_TYPES.includes(meta.mimeType)) {
    return { valid: false, error: "Photo must be a PNG, JPEG or WebP file." };
  }
  if (meta.sizeBytes > AVATAR_MAX_SOURCE_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Photo is too large — keep it under ${AVATAR_MAX_SOURCE_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
    };
  }
  const shorterSide = Math.min(meta.width, meta.height);
  if (shorterSide < AVATAR_MIN_DIMENSION_PX) {
    return {
      valid: false,
      error: `Image is too small to crop a good photo from — its shorter side must be at least ${AVATAR_MIN_DIMENSION_PX}px (got ${meta.width}x${meta.height}px).`,
    };
  }
  return { valid: true };
}

// Authoritative check on the final cropped+compressed output, both client-
// and server-side — the server never trusts the client-side pass alone
// (dimensions read from the uploaded buffer via image-size, same as
// validateLogoFile's own server usage).
export function validateAvatarPhotoFile(
  meta: AvatarFileMeta,
): { valid: true } | { valid: false; error: string } {
  if (!AVATAR_MIME_TYPES.includes(meta.mimeType)) {
    return { valid: false, error: "Photo must be a PNG or JPEG file." };
  }
  if (meta.sizeBytes > AVATAR_MAX_UPLOAD_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Photo file is too large — keep it under ${AVATAR_MAX_UPLOAD_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
    };
  }
  if (meta.width !== meta.height) {
    return { valid: false, error: `Photo must be square (1:1) — this file is ${meta.width}x${meta.height}px.` };
  }
  return { valid: true };
}

// The CV photo is a portrait (the CV shows it 112 x 132 px, i.e. 28:33), so
// the cropper cuts exactly that shape and the CV never has to squash or crop
// it again. 672 x 792 is that ratio at a print-sharp size.
export const CV_PHOTO_WIDTH_PX = 672;
export const CV_PHOTO_HEIGHT_PX = 792;

// Same checks as validateAvatarPhotoFile, but for the CV's portrait shape
// (a pixel of rounding either way is fine).
export function validateCvPhotoFile(
  meta: AvatarFileMeta,
): { valid: true } | { valid: false; error: string } {
  if (!AVATAR_MIME_TYPES.includes(meta.mimeType)) {
    return { valid: false, error: "Photo must be a PNG or JPEG file." };
  }
  if (meta.sizeBytes > AVATAR_MAX_UPLOAD_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Photo file is too large — keep it under ${AVATAR_MAX_UPLOAD_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
    };
  }
  const expectedHeight = (meta.width * CV_PHOTO_HEIGHT_PX) / CV_PHOTO_WIDTH_PX;
  if (meta.width < 1 || Math.abs(meta.height - expectedHeight) > 2) {
    return { valid: false, error: "Please crop the photo with the photo cropper first." };
  }
  return { valid: true };
}

export const avatarPhotoUploadResultSchema = z.object({ url: httpUrlSchema });
export type AvatarPhotoUploadResult = z.infer<typeof avatarPhotoUploadResultSchema>;

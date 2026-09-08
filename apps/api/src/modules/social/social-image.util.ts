import { BadRequestException } from "@nestjs/common";
import sharp from "sharp";
import heicConvert from "heic-convert";

// Instagram-ish long-edge cap - big enough to stay legible on a desktop
// feed card, small enough that a re-encoded WebP is a few dozen KB.
export const SOCIAL_IMAGE_OUTPUT_MAX_WIDTH_PX = 1080;
// Deliberately aggressive: the spec asks for "cost-effective for mass
// storage without becoming illegible". 58 keeps photos readable while
// roughly halving the size vs the ~80 default.
export const SOCIAL_IMAGE_WEBP_QUALITY = 58;

const HEIC_MIME_TYPES = new Set(["image/heic", "image/heif"]);

/**
 * Decode any accepted upload (HEIC via heic-convert, JPEG/PNG natively) and
 * re-encode it to a compressed, metadata-stripped WebP. The returned buffer
 * is what gets written to disk - a client-supplied file is never stored
 * as-is. Throws BadRequestException if the bytes can't be decoded.
 */
export async function processSocialImage(buffer: Buffer, mimeType: string): Promise<Buffer> {
  let decoded = buffer;

  // sharp's prebuilt binaries omit HEIC decoding (libheif licensing), so a
  // .heic upload is converted to a JPEG buffer first, then treated like any
  // other JPEG below.
  if (HEIC_MIME_TYPES.has(mimeType)) {
    try {
      const jpeg = await heicConvert({ buffer, format: "JPEG", quality: 0.9 });
      decoded = Buffer.from(jpeg);
    } catch {
      throw new BadRequestException("Could not read that HEIC photo - try exporting it as JPEG.");
    }
  }

  try {
    return await sharp(decoded)
      // Honour EXIF orientation before stripping metadata, or a phone photo
      // lands sideways.
      .rotate()
      .resize({ width: SOCIAL_IMAGE_OUTPUT_MAX_WIDTH_PX, withoutEnlargement: true })
      .webp({ quality: SOCIAL_IMAGE_WEBP_QUALITY })
      .toBuffer();
  } catch {
    throw new BadRequestException("That file could not be read as an image.");
  }
}

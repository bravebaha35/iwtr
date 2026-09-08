import sharp from "sharp";
import { processSocialImage, SOCIAL_IMAGE_OUTPUT_MAX_WIDTH_PX } from "../social-image.util";

async function makeJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 30, b: 30 } } })
    .jpeg()
    .toBuffer();
}

describe("processSocialImage", () => {
  it("downscales an oversized JPEG and returns WebP", async () => {
    const input = await makeJpeg(2000, 1500);
    const out = await processSocialImage(input, "image/jpeg");
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(SOCIAL_IMAGE_OUTPUT_MAX_WIDTH_PX);
    expect(out.length).toBeLessThan(input.length);
  });

  it("leaves a small image at its own size but still re-encodes to WebP", async () => {
    const input = await makeJpeg(400, 400);
    const out = await processSocialImage(input, "image/png");
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(400);
  });

  it("throws on an undecodable buffer", async () => {
    await expect(processSocialImage(Buffer.from("not an image"), "image/jpeg")).rejects.toThrow();
  });
});

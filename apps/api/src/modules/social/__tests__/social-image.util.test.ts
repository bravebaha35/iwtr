import { BadRequestException } from "@nestjs/common";
import sharp from "sharp";
import heicConvert from "heic-convert";
import { processSocialImage, SOCIAL_IMAGE_OUTPUT_MAX_WIDTH_PX } from "../social-image.util";

// sharp's prebuilt binary can't decode HEIC, so the HEIC branch is the one
// part of the pipeline that can't be exercised with real bytes here. Stub
// heic-convert and assert the util routes to it and feeds its output back
// into the real sharp pipeline. The JPEG/PNG tests below are unaffected -
// jest.mock("heic-convert") only replaces that one module.
jest.mock("heic-convert", () => jest.fn());
const mockHeic = heicConvert as jest.MockedFunction<typeof heicConvert>;

afterEach(() => jest.clearAllMocks());

async function makeJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 30, b: 30 } } })
    .jpeg()
    .toBuffer();
}

async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 30, b: 30 } } })
    .png()
    .toBuffer();
}

// A real JPEG that actually carries an EXIF block, so the "metadata stripped"
// assertion proves removal rather than mere absence.
async function makeJpegWithExif(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 30, b: 30 } } })
    .withExif({ IFD0: { Copyright: "iwt-test-exif-should-be-stripped" } })
    .jpeg()
    .toBuffer();
}

describe("processSocialImage", () => {
  it("downscales an oversized JPEG and returns WebP", async () => {
    const input = await makeJpegWithExif(2000, 1500);
    // sanity: the fixture really does carry EXIF going in
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const out = await processSocialImage(input, "image/jpeg");
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(SOCIAL_IMAGE_OUTPUT_MAX_WIDTH_PX);
    expect(out.length).toBeLessThan(input.length);
    // anonymity-first: owner photos can carry EXIF GPS - it must not survive
    expect(meta.exif).toBeUndefined();
  });

  it("leaves a small image at its own size but still re-encodes to WebP", async () => {
    const input = await makePng(400, 400);
    const out = await processSocialImage(input, "image/png");
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(400);
  });

  it("throws on an undecodable buffer", async () => {
    await expect(
      processSocialImage(Buffer.from("not an image"), "image/jpeg"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("routes a HEIC upload through heic-convert and returns a downscaled WebP", async () => {
    const converted = await makeJpeg(1200, 900);
    mockHeic.mockResolvedValue(converted);
    const input = Buffer.from("pretend-heic-bytes");

    const out = await processSocialImage(input, "image/heic");

    expect(mockHeic).toHaveBeenCalledWith({ buffer: input, format: "JPEG", quality: 0.9 });
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(SOCIAL_IMAGE_OUTPUT_MAX_WIDTH_PX);
    expect(meta.exif).toBeUndefined();
  });

  it("routes an image/heif upload through heic-convert too", async () => {
    const converted = await makeJpeg(800, 600);
    mockHeic.mockResolvedValue(converted);

    const out = await processSocialImage(Buffer.from("pretend-heif-bytes"), "image/heif");

    expect(mockHeic).toHaveBeenCalledTimes(1);
    expect((await sharp(out).metadata()).format).toBe("webp");
  });

  it("maps a HEIC decode failure to a 400 (BadRequestException)", async () => {
    mockHeic.mockRejectedValue(new Error("libheif: bad box"));

    await expect(
      processSocialImage(Buffer.from("x"), "image/heic"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

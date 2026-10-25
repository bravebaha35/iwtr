// Turns the owner's beaver art in public/ (mal<worktype><n>.webp and
// fem<worktype><n>.webp, 1024x1024, transparent background) into the round
// avatar files the site uses: public/avatars/<key>.webp (384px, picker and
// large avatars) and public/avatars/sm/<key>.webp (96px, small avatars).
//
// Every beaver is framed by its own head: the head width (rows 240-300) and
// centre are measured and the crop is scaled to them, so every face sits in
// the same place in the circle even when one drawing is a little bigger.
// Keys: male = office_1, female = office_f1 (see lib/avatars.ts).
//
// Run from apps/web:  node scripts/crop-avatars.mjs
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require(require.resolve("sharp", { paths: [require.resolve("next")] }));
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const OUT_DIR = path.join(PUBLIC_DIR, "avatars");
const WORK_TYPE_PREFIX = { office: "office", remote: "remote", service: "service", mlabour: "manual" };
const SOURCE = /^(mal|fem)(office|remote|service|mlabour)(\d)\.webp$/;

// Framing measured on the standard drawing: head 563px wide, ears reach full
// width at y=216, and an 800px square centred 204px below that shows the
// whole head (hats included) with the top of the shoulders.
const STD_HEAD_WIDTH = 563;
const STD_SIDE = 800;
const STD_CENTRE_BELOW_EARS = 204;

async function cropOne(file) {
  const [, gender, workType, n] = file.match(SOURCE);
  const key = `${WORK_TYPE_PREFIX[workType]}_${gender === "fem" ? "f" : ""}${n}`;
  const img = sharp(path.join(PUBLIC_DIR, file)).ensureAlpha();
  const { data, info } = await img.clone().raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const extent = (y) => {
    let left = -1;
    let right = -1;
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 128) {
        if (left < 0) left = x;
        right = x;
      }
    }
    return [left, right];
  };

  let widthSum = 0;
  let centreSum = 0;
  let rows = 0;
  for (let y = 240; y <= 300; y += 4) {
    const [l, r] = extent(y);
    widthSum += r - l;
    centreSum += (l + r) / 2;
    rows++;
  }
  const headWidth = widthSum / rows;
  const centreX = centreSum / rows;
  let ears = 0;
  for (let y = 100; y < 400; y++) {
    const [l, r] = extent(y);
    if (l >= 0 && r - l >= 0.85 * headWidth) {
      ears = y;
      break;
    }
  }

  const scale = headWidth / STD_HEAD_WIDTH;
  const side = Math.round(STD_SIDE * scale);
  const centreY = ears + STD_CENTRE_BELOW_EARS * scale;
  const pad = 200; // a crop running past the edge stays transparent
  const padded = await img
    .clone()
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const square = await sharp(padded)
    .extract({ left: Math.round(centreX - side / 2) + pad, top: Math.round(centreY - side / 2) + pad, width: side, height: side })
    .png()
    .toBuffer();

  await sharp(square).resize(384, 384).webp({ quality: 86, alphaQuality: 90 }).toFile(path.join(OUT_DIR, `${key}.webp`));
  await sharp(square).resize(96, 96).webp({ quality: 88, alphaQuality: 90 }).toFile(path.join(OUT_DIR, "sm", `${key}.webp`));
  return key;
}

fs.mkdirSync(path.join(OUT_DIR, "sm"), { recursive: true });
const files = fs.readdirSync(PUBLIC_DIR).filter((f) => SOURCE.test(f)).sort();
for (const file of files) console.log(file, "->", await cropOne(file));

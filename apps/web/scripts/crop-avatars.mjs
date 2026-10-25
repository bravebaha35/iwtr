// Turns the owner's beaver art in public/ into the round avatar files the
// site uses: public/avatars/<key>.webp (384px, picker and large avatars) and
// public/avatars/sm/<key>.webp (96px, small avatars).
//
// Sources (1024x1024, transparent background):
//   mal<worktype><n>.webp / fem<worktype><n>.webp  -> office_1 / office_f1 ...
//   malsecret.webp / femsecret.webp                -> randomized_identity /
//                                                     randomized_identity_f
//
// Framing (the owner's example, 2026-10-25): the whole head with plenty of
// shirt, the bottom of the drawing touching the bottom of the circle. Every
// beaver is framed by its own head - the head's width and middle are
// measured and the crop is scaled and centred on them - so every face sits
// in the same place, in the middle of the circle, even when one drawing is a
// little bigger or off-centre.
//
// Nearly transparent pixels (a soft glow some drawings carry around their
// outline, e.g. malsecret) are dropped so no pale halo shows on the
// coloured background.
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
const SOURCE = /^(mal|fem)(office|remote|service|mlabour|secret)(\d?)\.webp$/;

// Measured on the standard drawing: head 563px wide, ears reach full width
// at y=204. A 1145px circle centred 248px below that line puts the eyes about
// a third of the way down and the drawing's bottom edge on the circle's
// bottom edge.
const STD_HEAD_WIDTH = 563;
const STD_SIDE = 1145;
const STD_CENTRE_BELOW_EARS = 248;
// Below this opacity a pixel is glow or speckle, not drawing.
const MIN_ALPHA = 64;

function keyFor(gender, workType, n) {
  if (workType === "secret") return gender === "fem" ? "randomized_identity_f" : "randomized_identity";
  return `${WORK_TYPE_PREFIX[workType]}_${gender === "fem" ? "f" : ""}${n}`;
}

async function cropOne(file) {
  const [, gender, workType, n] = file.match(SOURCE);
  const key = keyFor(gender, workType, n);
  const { data, info } = await sharp(path.join(PUBLIC_DIR, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  for (let i = 3; i < data.length; i += 4) if (data[i] < MIN_ALPHA) data[i] = 0;

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

  // Head size from the ear line; head middle from ears down to the cheeks
  // (above any collar or hood), so stray fur tufts barely move it.
  let widthSum = 0;
  let rows = 0;
  for (let y = 240; y <= 300; y += 4) {
    const [l, r] = extent(y);
    widthSum += r - l;
    rows++;
  }
  const headWidth = widthSum / rows;
  let centreSum = 0;
  rows = 0;
  for (let y = 240; y <= 460; y += 4) {
    const [l, r] = extent(y);
    if (l < 0) continue;
    centreSum += (l + r) / 2;
    rows++;
  }
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
  const pad = 400; // the circle reaches past the drawing's sides; that stays transparent
  const padded = await sharp(data, { raw: { width, height, channels: 4 } })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const square = await sharp(padded)
    .extract({ left: Math.round(centreX - side / 2) + pad, top: Math.round(centreY - side / 2) + pad, width: side, height: side })
    .png()
    .toBuffer();

  await sharp(square).resize(384, 384).webp({ quality: 86, alphaQuality: 90 }).toFile(path.join(OUT_DIR, `${key}.webp`));
  await sharp(square).resize(96, 96).webp({ quality: 88, alphaQuality: 90 }).toFile(path.join(OUT_DIR, "sm", `${key}.webp`));
  return `${key} (head ${headWidth.toFixed(0)}px, middle x ${centreX.toFixed(0)}, ears y ${ears})`;
}

fs.mkdirSync(path.join(OUT_DIR, "sm"), { recursive: true });
const files = fs.readdirSync(PUBLIC_DIR).filter((f) => SOURCE.test(f)).sort();
for (const file of files) console.log(file, "->", await cropOne(file));

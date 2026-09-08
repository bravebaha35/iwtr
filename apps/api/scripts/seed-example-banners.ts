import "dotenv/config";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

const prisma = new PrismaClient();

// One already-seeded real company per CLAUDE.md's "oil, clothing, market"
// example categories (seed-nationwide-brands.ts) — not the fictional
// reset-to-demo-companies.ts placeholders, which use a different category
// vocabulary entirely and don't populate these categories. Existing fields
// on these rows (name, category, city, etc.) are never touched — this
// script only ever sets bannerImageUrl and badgeTier on them.
const TARGETS: { name: string; gradient: [string, string] }[] = [
  { name: "Shell", gradient: ["#e8302a", "#8a1a17"] },
  { name: "LC Waikiki", gradient: ["#1f3a93", "#0d1b3e"] },
  { name: "Migros", gradient: ["#f5a623", "#8a5a0f"] },
];

const BANNER_UPLOADS_DIR = join(process.cwd(), "uploads", "company-banners");
const BANNER_OUTPUT_WIDTH_PX = 1200;
const BANNER_OUTPUT_HEIGHT_PX = 300;

// A plain two-stop diagonal gradient PNG, generated in-memory — deliberately
// not scraped brand photography (avoids any trademark/IP question), just
// enough of a real image to exercise the Facebook-style banner+avatar layout
// against real, already-seeded company rows.
async function generatePlaceholderBanner(gradient: [string, string]): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${BANNER_OUTPUT_WIDTH_PX}" height="${BANNER_OUTPUT_HEIGHT_PX}">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${gradient[0]}" />
        <stop offset="100%" stop-color="${gradient[1]}" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)" />
  </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 82 }).toBuffer();
}

async function main() {
  const origin = process.env.API_PUBLIC_ORIGIN ?? "http://localhost:3001";
  await mkdir(BANNER_UPLOADS_DIR, { recursive: true });

  for (const target of TARGETS) {
    // seed-nationwide-brands.ts (the only legitimate non-fictional source for
    // these brand names — see CLAUDE.md) always creates one Company row per
    // real branch location, named "<Brand> <City> Şubeleri" or "<Brand>
    // <Region> Bölgesi Şubeleri" — it never creates a bare "<Brand>" row. So
    // an exact-name match can never succeed here; match by prefix instead and
    // pick deterministically (orderBy name) so re-runs hit the same row.
    const company = await prisma.company.findFirst({
      where: { name: { startsWith: target.name, mode: "insensitive" } },
      orderBy: { name: "asc" },
    });
    if (!company) {
      console.log(`Skipping "${target.name}" — not found (run seed-nationwide-brands.ts first).`);
      continue;
    }

    const buffer = await generatePlaceholderBanner(target.gradient);
    const filename = `${randomUUID()}.webp`;
    await writeFile(join(BANNER_UPLOADS_DIR, filename), buffer);
    const bannerImageUrl = `${origin}/uploads/company-banners/${filename}`;

    // BLUE_PLUS, not ENTERPRISE — canUseBanner() (apps/web/src/lib/pricingTiers.ts)
    // grants banner display to both, so BLUE_PLUS is enough to prove the
    // gate isn't accidentally Enterprise-only, while leaving at least one of
    // these three free to separately promote to ENTERPRISE by hand if a
    // reviewer wants an Enterprise-badge example too.
    await prisma.company.update({
      where: { id: company.id },
      data: { bannerImageUrl, badgeTier: "BLUE_PLUS" },
    });
    console.log(`Set example banner + BLUE_PLUS badge on "${company.name}" (${bannerImageUrl})`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

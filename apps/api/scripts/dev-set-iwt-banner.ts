import "dotenv/config";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

// Dev-only helper: drop a generated placeholder banner onto the "I Worked
// There" demo company (already ENTERPRISE + hiring) so the Facebook-style
// banner+avatar layout has real data to render against on this machine.
// Mirrors seed-example-banners.ts but targets the demo row instead of the
// seed-nationwide-brands.ts branch rows (which this dev DB doesn't have).
const prisma = new PrismaClient();

const OUT_DIR = join(process.cwd(), "uploads", "company-banners");
const W = 1200;
const H = 300;

async function main() {
  const origin = process.env.API_PUBLIC_ORIGIN ?? "http://localhost:3001";
  await mkdir(OUT_DIR, { recursive: true });

  const company = await prisma.company.findFirst({
    where: { name: { equals: "I Worked There", mode: "insensitive" } },
  });
  if (!company) {
    console.log('No "I Worked There" company found.');
    return;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#c2410c" />
        <stop offset="100%" stop-color="#7c2d12" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)" />
  </svg>`;
  const buffer = await sharp(Buffer.from(svg)).webp({ quality: 82 }).toBuffer();
  const filename = `${randomUUID()}.webp`;
  await writeFile(join(OUT_DIR, filename), buffer);
  const bannerImageUrl = `${origin}/uploads/company-banners/${filename}`;

  await prisma.company.update({
    where: { id: company.id },
    data: { bannerImageUrl },
  });
  console.log(`Set banner on "${company.name}": ${bannerImageUrl}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

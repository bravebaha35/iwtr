// Fills SocialPost.imageAspectRatios (width / height per photo) for posts
// made before that column existed, by reading each stored WebP under
// uploads/social/. Safe to re-run: posts that already have a ratio for every
// photo are skipped, and a photo whose file is missing gets 1 (a square).
//
// Run from apps/api:
//   pnpm exec ts-node --transpile-only scripts/backfill-social-image-aspects.ts

import "dotenv/config";
import { join } from "path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";

const SOCIAL_UPLOADS_DIR = join(process.cwd(), "uploads", "social");

async function aspectOf(imageUrl: string): Promise<number> {
  const name = imageUrl.split("/uploads/social/")[1];
  if (!name) return 1;
  try {
    const meta = await sharp(join(SOCIAL_UPLOADS_DIR, name)).metadata();
    return meta.width && meta.height ? Number((meta.width / meta.height).toFixed(4)) : 1;
  } catch {
    return 1;
  }
}

async function main() {
  const prisma = new PrismaClient();
  const posts = await prisma.socialPost.findMany({ select: { id: true, imageUrls: true, imageAspectRatios: true } });
  let updated = 0;
  for (const post of posts) {
    if (post.imageUrls.length === 0 || post.imageAspectRatios.length === post.imageUrls.length) continue;
    const imageAspectRatios = await Promise.all(post.imageUrls.map(aspectOf));
    await prisma.socialPost.update({ where: { id: post.id }, data: { imageAspectRatios } });
    updated += 1;
  }
  console.log(`Posts checked: ${posts.length}. Updated: ${updated}.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

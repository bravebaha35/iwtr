// Dev-only: gives a few photo posts several photos each, so the photo slider
// (feed card and photo view) can be seen locally. The extra photos are ones
// already uploaded to other posts of the same database; nothing is fetched or
// created on disk.
//
// Safe to re-run: a post that already has more than one photo is left alone.
//
// Run from apps/api: pnpm exec ts-node --transpile-only scripts/seed-social-multi-photo-demo.ts

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const POSTS_TO_FILL = 4;
const PHOTOS_PER_POST = 4;

async function main() {
  const withPhotos = await prisma.socialPost.findMany({
    where: { NOT: { imageUrls: { isEmpty: true } } },
    select: { id: true, imageUrls: true, imageAspectRatios: true },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  // Every distinct uploaded photo, with its proportions.
  const pool = new Map<string, number>();
  for (const p of withPhotos) p.imageUrls.forEach((url, i) => pool.set(url, p.imageAspectRatios[i] ?? 1));
  if (pool.size < 2) {
    console.log("Fewer than 2 uploaded photos in this database - nothing to combine.");
    return;
  }
  const photos = [...pool.entries()];

  let filled = 0;
  for (const post of withPhotos) {
    if (filled >= POSTS_TO_FILL) break;
    if (post.imageUrls.length > 1) continue;
    const extra = photos.filter(([url]) => url !== post.imageUrls[0]).slice(filled, filled + PHOTOS_PER_POST - 1);
    if (extra.length === 0) continue;
    await prisma.socialPost.update({
      where: { id: post.id },
      data: {
        imageUrls: [...post.imageUrls, ...extra.map(([url]) => url)],
        imageAspectRatios: [post.imageAspectRatios[0] ?? 1, ...extra.map(([, ratio]) => ratio)],
      },
    });
    filled += 1;
    console.log(`Post ${post.id}: now ${1 + extra.length} photos`);
  }
  console.log(`Done: ${filled} post(s) given several photos.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

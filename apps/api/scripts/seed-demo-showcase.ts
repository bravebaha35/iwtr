// Dev-only "what will it feel like live" seed for the fictional demo
// companies (every company that isn't a real-brand "<Brand> <City> Şubeleri"
// branch row from seed-nationwide-brands.ts — i.e. the Demo / Numune /
// Örnek / Placeholder / Test rows from reset-to-demo-companies.ts, plus
// I Worked There and any other hand-made company).
//
// For each demo company, only filling in what's missing:
//   - a logo (mainPhotoUrl): an abstract shapes mark from DiceBear
//     (api.dicebear.com, "shapes" style, CC0), seeded by the company slug;
//   - a banner (bannerImageUrl): a random free photo from Lorem Picsum
//     (picsum.photos, Unsplash License), seeded by the slug. Banners only
//     render on paid tiers (canUseBanner), so a FREE company is moved to
//     BLUE / BLUE_PLUS / ENTERPRISE in rotation;
//   - job postings (only if it has none): 1-3 PUBLISHED postings from the
//     role list for its category, spread over the last 2 weeks (inside the
//     30-day live window), plus isHiring and a clearly fake .example contact
//     email so the Mail button has something to show;
//   - Social posts (only if it has none): 1-3 captioned posts, most with one
//     Picsum photo, spread over the last 3 weeks, liked by a random handful
//     of existing active members.
//
// Images are downloaded once and stored exactly like owner uploads
// (uploads/company-logos, uploads/company-banners, uploads/social).
// Safe to re-run: anything a company already has is left alone.
//
// Run from apps/api: pnpm exec ts-node --transpile-only scripts/seed-demo-showcase.ts

import "dotenv/config";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { PrismaClient, type OwnerTier, type WorkplaceType } from "@prisma/client";
import sharp from "sharp";

const prisma = new PrismaClient();
const ORIGIN = process.env.API_PUBLIC_ORIGIN ?? "http://localhost:3001";
const UPLOADS = join(process.cwd(), "uploads");

type Role = [title: string, workType: WorkplaceType];

const ROLES_BY_CATEGORY: Record<string, Role[]> = {
  Consulting: [["İş Analisti", "OFFICE"], ["Yönetim Danışmanı", "HYBRID_REMOTE"], ["Muhasebe Uzmanı", "OFFICE"]],
  Energy: [["Elektrik Teknisyeni", "MANUAL_LABOUR"], ["Saha Mühendisi", "OFFICE"], ["Bakım Operatörü", "MANUAL_LABOUR"]],
  Logistics: [["Forklift Operatörü", "MANUAL_LABOUR"], ["Depo Sorumlusu", "MANUAL_LABOUR"], ["Lojistik Planlama Uzmanı", "OFFICE"]],
  IT: [["Frontend Geliştirici", "HYBRID_REMOTE"], ["Backend Geliştirici", "HYBRID_REMOTE"], ["BT Destek Uzmanı", "OFFICE"]],
  Software: [["Yazılım Geliştirici", "HYBRID_REMOTE"], ["QA Test Uzmanı", "HYBRID_REMOTE"], ["Ürün Tasarımcısı", "OFFICE"]],
  Education: [["İngilizce Öğretmeni", "SERVICE"], ["Rehber Öğretmen", "SERVICE"]],
  Construction: [["İnşaat Mühendisi", "OFFICE"], ["Kalıpçı Ustası", "MANUAL_LABOUR"], ["İş Güvenliği Uzmanı", "OFFICE"]],
  Manufacturing: [["CNC Operatörü", "MANUAL_LABOUR"], ["Üretim Şefi", "OFFICE"], ["Montaj Elemanı", "MANUAL_LABOUR"]],
  Textile: [["Dikiş Makinecisi", "MANUAL_LABOUR"], ["Kalite Kontrol Elemanı", "MANUAL_LABOUR"]],
  Retail: [["Mağaza Satış Danışmanı", "SERVICE"], ["Kasiyer", "SERVICE"], ["Reyon Görevlisi", "SERVICE"]],
  Agriculture: [["Tarım Teknisyeni", "MANUAL_LABOUR"], ["Sera Çalışanı", "MANUAL_LABOUR"]],
  Tourism: [["Resepsiyonist", "SERVICE"], ["Kat Görevlisi", "SERVICE"], ["Aşçı Yardımcısı", "SERVICE"]],
  Aerospace: [["Uçak Bakım Teknisyeni", "MANUAL_LABOUR"], ["Tasarım Mühendisi", "OFFICE"]],
  Chemical: [["Laboratuvar Teknisyeni", "OFFICE"], ["Proses Mühendisi", "OFFICE"]],
  Healthcare: [["Hemşire", "SERVICE"], ["Hasta Danışmanı", "SERVICE"], ["Radyoloji Teknikeri", "SERVICE"]],
  "Food & Beverage": [["Garson", "SERVICE"], ["Barista", "SERVICE"], ["Mutfak Personeli", "SERVICE"]],
  Automotive: [["Oto Elektrikçisi", "MANUAL_LABOUR"], ["Yedek Parça Satış Danışmanı", "SERVICE"]],
  "Advertising & Marketing": [["Sosyal Medya Uzmanı", "HYBRID_REMOTE"], ["Grafik Tasarımcı", "HYBRID_REMOTE"]],
};
const FALLBACK_ROLES: Role[] = [["Genel Personel", "SERVICE"], ["Ofis Asistanı", "OFFICE"]];

const PERKS = [
  "Full-time, Monday to Friday.",
  "Shift work with a monthly rota.",
  "Meal card and company transport included.",
  "Private health insurance after probation.",
  "Two remote days a week.",
  "Training provided, no experience needed.",
  "Overtime paid at the legal rate.",
];

const CAPTIONS = [
  "Our team celebrated finishing a big project this week. Thank you all for the hard work!",
  "We're growing! New colleagues joined us this month — welcome aboard.",
  "Behind the scenes at our workplace this morning.",
  "Safety first: this week every team completed its refresher training.",
  "Friday breakfast with the whole team.",
  "We just moved into a brighter, bigger space. Come say hello!",
  "Proud of our interns — here's what they built this summer.",
  "Open roles are live on our Jobs page. Know someone great? Send them our way.",
  "A quiet moment before the busy season starts.",
  "Thank you to everyone who shared honest feedback on I Worked There — we're listening.",
  "New equipment arrived today, making everyone's day a little easier.",
  "Team volunteering day at the local park.",
];

const PAID_TIERS: OwnerTier[] = ["BLUE", "BLUE_PLUS", "ENTERPRISE"];

// Small deterministic PRNG so a given company always gets the same picks.
function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
const pick = <T>(r: () => number, list: T[]): T => list[Math.floor(r() * list.length)];
const twoPerks = (r: () => number) => {
  const first = Math.floor(r() * PERKS.length);
  const second = (first + 1 + Math.floor(r() * (PERKS.length - 1))) % PERKS.length;
  return `${PERKS[first]} ${PERKS[second]}`;
};
const daysAgo = (days: number, r: () => number) =>
  new Date(Date.now() - days * 86_400_000 - Math.floor(r() * 8) * 3_600_000);

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.startsWith("image/")) throw new Error(`Download failed (${res.status} ${type}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function saveImage(folder: string, image: Buffer, ext: "png" | "webp"): Promise<string> {
  await mkdir(join(UPLOADS, folder), { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  await writeFile(join(UPLOADS, folder, filename), image);
  return `${ORIGIN}/uploads/${folder}/${filename}`;
}

async function main() {
  const companies = await prisma.company.findMany({
    where: { NOT: { name: { endsWith: "Şubeleri" } }, hiddenAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      city: true,
      badgeTier: true,
      mainPhotoUrl: true,
      bannerImageUrl: true,
      contactEmail: true,
      workplaceTypes: true,
      _count: { select: { jobPostings: true, socialPosts: true } },
    },
    orderBy: { name: "asc" },
  });
  const likers = await prisma.user.findMany({ where: { status: "ACTIVE" }, select: { id: true }, take: 60 });
  console.log(`${companies.length} demo companies, ${likers.length} active members available to like posts.`);

  let tierTurn = 0;
  for (const c of companies) {
    const r = rng(c.slug);
    const done: string[] = [];
    const data: Record<string, unknown> = {};

    if (!c.mainPhotoUrl) {
      const png = await download(`https://api.dicebear.com/9.x/shapes/png?seed=${encodeURIComponent(c.slug)}&size=256`);
      data.mainPhotoUrl = await saveImage("company-logos", png, "png");
      done.push("logo");
    }
    if (!c.bannerImageUrl) {
      const photo = await download(`https://picsum.photos/seed/${encodeURIComponent(c.slug)}-banner/1200/300`);
      data.bannerImageUrl = await saveImage("company-banners", await sharp(photo).webp({ quality: 80 }).toBuffer(), "webp");
      done.push("banner");
    }
    if (c.badgeTier === "FREE") {
      data.badgeTier = PAID_TIERS[tierTurn++ % PAID_TIERS.length];
      done.push(`tier ${data.badgeTier}`);
    }

    if (c._count.jobPostings === 0) {
      const roles = [...(ROLES_BY_CATEGORY[c.category] ?? FALLBACK_ROLES)].sort(() => r() - 0.5);
      const count = Math.min(roles.length, 1 + Math.floor(r() * 3));
      for (let i = 0; i < count; i++) {
        const [jobTitle, workType] = roles[i];
        await prisma.jobPosting.create({
          data: {
            companyId: c.id,
            jobTitle,
            workType,
            description: `${jobTitle} wanted${c.city ? ` in ${c.city}` : ""}. ${twoPerks(r)} Apply with your CV through I Worked There.`,
            status: "PUBLISHED",
            createdAt: daysAgo(Math.floor(r() * 14), r),
          },
        });
      }
      data.isHiring = true;
      if (!c.contactEmail) data.contactEmail = `kariyer@${c.slug}.example`;
      done.push(`${count} job post${count === 1 ? "" : "s"}`);
    }

    if (c._count.socialPosts === 0) {
      const count = 1 + Math.floor(r() * 3);
      for (let i = 0; i < count; i++) {
        const withPhoto = r() < 0.8;
        const imageUrls = withPhoto
          ? [
              await saveImage(
                "social",
                await sharp(await download(`https://picsum.photos/seed/${encodeURIComponent(c.slug)}-post-${i}/1080/720`))
                  .webp({ quality: 80 })
                  .toBuffer(),
                "webp",
              ),
            ]
          : [];
        const post = await prisma.socialPost.create({
          data: { companyId: c.id, caption: pick(r, CAPTIONS), imageUrls, createdAt: daysAgo(Math.floor(r() * 21), r) },
        });
        const likeCount = Math.floor(r() * Math.min(12, likers.length));
        const chosen = [...likers].sort(() => r() - 0.5).slice(0, likeCount);
        if (chosen.length > 0) {
          await prisma.socialPostLike.createMany({
            data: chosen.map((u) => ({ postId: post.id, userId: u.id })),
            skipDuplicates: true,
          });
        }
      }
      done.push(`${count} social post${count === 1 ? "" : "s"}`);
    }

    if (Object.keys(data).length > 0) await prisma.company.update({ where: { id: c.id }, data });
    console.log(`${c.name}: ${done.length > 0 ? done.join(", ") : "already complete"}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

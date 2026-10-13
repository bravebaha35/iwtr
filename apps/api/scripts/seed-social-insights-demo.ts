// Dev-only demo numbers for the owner dashboard's IWT Social section, so its
// charts can be judged with something in them: followers arriving over the
// last few months, a few who came and left, and views on the posts each
// claimed company already has.
//
// The followers are real rows (active demo members following the company,
// dated in the past) and the day counts are worked out from them the same
// way backfill-social-days.ts does for real data; views are made up, spread
// over the days after each post went out. The dev fast-login owner's company
// gets the most.
//
// Safe to re-run: a company that already has followers / views is left as it
// is. Refuses to run in production.
//
// Run from apps/api: pnpm exec ts-node --transpile-only scripts/seed-social-insights-demo.ts

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { backfillFollowerDays } from "./backfill-social-days";
import { socialDay } from "../src/modules/social/social-day.util";

const prisma = new PrismaClient();

const DEV_OWNER_COMPANY = "Demo Finans Holding";
const DAY = 24 * 60 * 60 * 1000;

const between = (low: number, high: number) => low + Math.floor(Math.random() * (high - low + 1));
function shuffled<T>(list: T[]): T[] {
  return [...list].sort(() => Math.random() - 0.5);
}

function bump(companyId: string, day: Date, data: { postViews?: number; followersGained?: number; followersLost?: number }) {
  return prisma.companySocialDay.upsert({
    where: { companyId_day: { companyId, day } },
    create: { companyId, day, ...data },
    update: Object.fromEntries(Object.entries(data).map(([key, by]) => [key, { increment: by }])),
  });
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Demo data is for local use only.");

  const members = await prisma.user.findMany({ where: { status: "ACTIVE", role: "MEMBER" }, select: { id: true }, take: 400 });
  const owners = await prisma.companyOwner.findMany({
    where: { claimStatus: "APPROVED", company: { hiddenAt: null, socialPosts: { some: {} } } },
    select: { companyId: true, company: { select: { name: true } } },
  });
  const companies = [...new Map(owners.map((o) => [o.companyId, o.company.name])).entries()].map(([id, name]) => ({ id, name }));
  if (companies.length === 0) throw new Error("No claimed company has posted yet - run seed-social-demo.ts first.");

  let followsAdded = 0;
  let viewsAdded = 0;
  for (const company of companies) {
    const isDevOwner = company.name === DEV_OWNER_COMPANY;

    // --- followers, arriving over the last four months (more of them lately)
    const have = await prisma.companyFollow.findMany({ where: { companyId: company.id }, select: { userId: true } });
    const want = Math.min(members.length, isDevOwner ? 46 : between(6, 18));
    if (have.length < want / 2) {
      const already = new Set(have.map((f) => f.userId));
      const newcomers = shuffled(members.filter((m) => !already.has(m.id))).slice(0, want - have.length);
      for (const member of newcomers) {
        const daysAgo = Math.floor(120 * Math.random() ** 1.8);
        await prisma.companyFollow.create({
          data: { userId: member.id, companyId: company.id, createdAt: new Date(Date.now() - daysAgo * DAY - between(0, 20) * 3_600_000) },
        });
        followsAdded++;
      }
    }

    // --- a few who followed and later left (counts only: there is no row for them)
    const lost = await prisma.companySocialDay.aggregate({ where: { companyId: company.id }, _sum: { followersLost: true } });
    if (!lost._sum.followersLost) {
      for (let n = 0; n < (isDevOwner ? 7 : between(1, 3)); n++) {
        const leftDaysAgo = between(1, 80);
        const today = socialDay();
        await bump(company.id, new Date(today.getTime() - leftDaysAgo * DAY), { followersLost: 1 });
        await bump(company.id, new Date(today.getTime() - (leftDaysAgo + between(3, 30)) * DAY), { followersGained: 1 });
      }
    }

    // --- views: most in a post's first days, tailing off over two weeks
    const posts = await prisma.socialPost.findMany({ where: { companyId: company.id, viewCount: 0 }, select: { id: true, createdAt: true } });
    for (const post of posts) {
      const total = isDevOwner ? between(180, 900) : between(40, 320);
      const weights = Array.from({ length: 14 }, (_, k) => Math.exp(-k / 2.5));
      const weightSum = weights.reduce((sum, w) => sum + w, 0);
      let counted = 0;
      for (const [k, weight] of weights.entries()) {
        const day = new Date(socialDay(post.createdAt).getTime() + k * DAY);
        if (day.getTime() > Date.now()) break;
        const views = Math.round((total * weight) / weightSum);
        if (views === 0) continue;
        await bump(company.id, day, { postViews: views });
        counted += views;
      }
      await prisma.socialPost.update({ where: { id: post.id }, data: { viewCount: counted } });
      viewsAdded += counted;
    }
  }

  // The follows above (and any real ones) counted into their days.
  await backfillFollowerDays(prisma);
  console.log(`${companies.length} companies: ${followsAdded} follows and ${viewsAdded} post views added.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

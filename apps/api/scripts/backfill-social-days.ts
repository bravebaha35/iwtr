// Fills CompanySocialDay.followersGained for the days before that table
// existed, from the follows that are still there (CompanyFollow.createdAt),
// so an owner's Insights chart does not start flat on the day it shipped.
// Follows that were undone before then left no trace and stay uncounted.
//
// Counts only, like the table itself: it groups follows by company and day
// and never reads who followed. Safe to re-run: a day's number is only ever
// raised to what the surviving follows show.
//
// Run from apps/api:
//   pnpm exec ts-node --transpile-only scripts/backfill-social-days.ts

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { SOCIAL_DAY_OFFSET_HOURS } from "../src/modules/social/social-day.util";

export async function backfillFollowerDays(prisma: PrismaClient): Promise<number> {
  // The same day boundary as socialDay(): Turkey's clock.
  return prisma.$executeRaw`
    INSERT INTO "public"."CompanySocialDay" ("companyId", "day", "followersGained")
    SELECT "companyId", ("createdAt" + make_interval(hours => ${SOCIAL_DAY_OFFSET_HOURS}::int))::date, COUNT(*)::int
    FROM "public"."CompanyFollow"
    GROUP BY 1, 2
    ON CONFLICT ("companyId", "day") DO UPDATE
      SET "followersGained" = GREATEST("CompanySocialDay"."followersGained", EXCLUDED."followersGained")
  `;
}

if (require.main === module) {
  const prisma = new PrismaClient();
  backfillFollowerDays(prisma)
    .then((days) => console.log(`Follower counts written for ${days} company-days.`))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

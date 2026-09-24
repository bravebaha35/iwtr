// One-off: truncates the review-related timestamps written before
// day-precision storage (see src/common/time/day-precision.util.ts) to the
// UTC day, so no existing row keeps an exact posting time either. Safe to
// re-run — truncating an already-truncated value changes nothing.
//
// Run from apps/api (after setup-db-roles.ts): pnpm exec ts-node scripts/backfill-day-precision-timestamps.ts

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { SALARY_ACCESS, withRowAccess } from "../src/common/db/row-access";

async function main() {
  const prisma = new PrismaClient();
  const counts = await withRowAccess(prisma, SALARY_ACCESS, async (tx) => ({
    reviews: await tx.$executeRaw`
      UPDATE "public"."Review"
      SET "createdAt" = date_trunc('day', "createdAt"),
          "publishedAt" = date_trunc('day', "publishedAt")
      WHERE "createdAt" <> date_trunc('day', "createdAt")
         OR "publishedAt" <> date_trunc('day', "publishedAt")`,
    queueItems: await tx.$executeRaw`
      UPDATE "public"."ModerationQueueItem"
      SET "createdAt" = date_trunc('day', "createdAt")
      WHERE "createdAt" <> date_trunc('day', "createdAt")`,
    salaries: await tx.$executeRaw`
      UPDATE "public"."SalarySubmission"
      SET "createdAt" = date_trunc('day', "createdAt")
      WHERE "createdAt" <> date_trunc('day', "createdAt")`,
  }));
  await prisma.$disconnect();
  console.log(`Truncated to the day: ${counts.reviews} reviews, ${counts.queueItems} queue items, ${counts.salaries} salary answers.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

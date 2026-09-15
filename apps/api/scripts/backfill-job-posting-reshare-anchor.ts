// apps/api/scripts/backfill-job-posting-reshare-anchor.ts
// Run from apps/api: pnpm exec ts-node scripts/backfill-job-posting-reshare-anchor.ts
//
// One-time deploy step for the Job Posting Lifecycle & Risk Score feature.
// Every JobPosting row that predates this feature has lastResharedAt: null,
// so daysRemaining() counts its public 30-day window from the original
// createdAt — meaning any already-live posting older than 30 days would
// vanish from the public Jobs feed and the company-profile tab the instant
// this feature ships, with no warning. This gives every currently-PUBLISHED
// pre-existing posting a fresh 30 days from the moment this script runs,
// instead of retroactively expiring it. Idempotent: only touches rows where
// lastResharedAt is still null, so re-running it is a no-op on anything it
// already backfilled.
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const prisma = app.get(PrismaService);

  const result = await prisma.jobPosting.updateMany({
    where: { status: "PUBLISHED", lastResharedAt: null },
    data: { lastResharedAt: new Date() },
  });
  console.log(`Backfilled lastResharedAt on ${result.count} pre-existing PUBLISHED job posting(s).`);

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

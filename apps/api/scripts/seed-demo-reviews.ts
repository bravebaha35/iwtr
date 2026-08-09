// Gives each demo company (see reset-to-demo-companies.ts) one published
// demo review, so company cards/pages have a rating to look at (and to edit,
// via the new PATCH /reviews/:id endpoint) while the frontend is designed.
//
// Creates one throwaway reviewer account per company — backdated 60 days so
// ModerationService.scoreTrust's "account_older_than_7_days" bonus applies,
// which (combined with a plausible employment date range) is exactly enough
// to clear AUTO_PUBLISH_THRESHOLD on the first review. Submits through the
// real ReviewsService.submitReview, so moderation scoring and the company's
// CompanyAggregateScore go through the same path a real review would.
//
// Safe to re-run: reviewer accounts are upserted by a fixed email per
// company, and submitReview itself rejects a second review for the same
// (user, company) pair, so re-running just skips companies that already
// have their demo review.
//
// Run from apps/api: pnpm exec ts-node scripts/seed-demo-reviews.ts

import "dotenv/config";
import { ConflictException } from "@nestjs/common";
import { PrismaService } from "../src/prisma/prisma.service";
import { ReviewsService } from "../src/modules/reviews/reviews.service";
import { ModerationService } from "../src/modules/moderation/moderation.service";
import { PiiVaultService } from "../src/modules/pii-vault/pii-vault.service";

const DAY_MS = 24 * 60 * 60 * 1000;

interface DemoReview {
  companyName: string;
  reviewerEmail: string;
  reviewerDisplayName: string;
  scores: {
    corporateCulture: number;
    leadership: number;
    infrastructure: number;
    workLifeBalance: number;
    stability: number;
  };
  generalThoughts: string;
}

const DEMO_REVIEWS: DemoReview[] = [
  {
    companyName: "Demo Teknoloji A.Ş.",
    reviewerEmail: "demo-reviewer-1@iwtr.local",
    reviewerDisplayName: "Demo Reviewer 1",
    scores: { corporateCulture: 4, leadership: 4, infrastructure: 5, workLifeBalance: 3, stability: 4 },
    generalThoughts: "Sample review content for design purposes — good team, occasionally long hours.",
  },
  {
    companyName: "Örnek Kargo ve Lojistik",
    reviewerEmail: "demo-reviewer-2@iwtr.local",
    reviewerDisplayName: "Demo Reviewer 2",
    scores: { corporateCulture: 3, leadership: 3, infrastructure: 3, workLifeBalance: 2, stability: 4 },
    generalThoughts: "Sample review content for design purposes — physically demanding but steady work.",
  },
  {
    companyName: "Test Cafe & Restoran",
    reviewerEmail: "demo-reviewer-3@iwtr.local",
    reviewerDisplayName: "Demo Reviewer 3",
    scores: { corporateCulture: 5, leadership: 4, infrastructure: 4, workLifeBalance: 4, stability: 3 },
    generalThoughts: "Sample review content for design purposes — friendly place, tips were fair.",
  },
  {
    companyName: "Placeholder Danışmanlık",
    reviewerEmail: "demo-reviewer-4@iwtr.local",
    reviewerDisplayName: "Demo Reviewer 4",
    scores: { corporateCulture: 4, leadership: 5, infrastructure: 3, workLifeBalance: 5, stability: 3 },
    generalThoughts: "Sample review content for design purposes — fully remote, great flexibility.",
  },
  {
    companyName: "Numune İnşaat",
    reviewerEmail: "demo-reviewer-5@iwtr.local",
    reviewerDisplayName: "Demo Reviewer 5",
    scores: { corporateCulture: 2, leadership: 2, infrastructure: 3, workLifeBalance: 2, stability: 3 },
    generalThoughts: "Sample review content for design purposes — safety gear was inconsistent.",
  },
  {
    companyName: "Demo Finans Holding",
    reviewerEmail: "demo-reviewer-6@iwtr.local",
    reviewerDisplayName: "Demo Reviewer 6",
    scores: { corporateCulture: 4, leadership: 3, infrastructure: 5, workLifeBalance: 3, stability: 5 },
    generalThoughts: "Sample review content for design purposes — very stable, formal culture.",
  },
  {
    companyName: "Örnek Perakende Mağazacılık",
    reviewerEmail: "demo-reviewer-7@iwtr.local",
    reviewerDisplayName: "Demo Reviewer 7",
    scores: { corporateCulture: 3, leadership: 3, infrastructure: 3, workLifeBalance: 3, stability: 3 },
    generalThoughts: "Sample review content for design purposes — pretty average all around.",
  },
  {
    companyName: "Test Yazılım Stüdyosu",
    reviewerEmail: "demo-reviewer-8@iwtr.local",
    reviewerDisplayName: "Demo Reviewer 8",
    scores: { corporateCulture: 5, leadership: 5, infrastructure: 4, workLifeBalance: 4, stability: 3 },
    generalThoughts: "Sample review content for design purposes — small team, lots of ownership.",
  },
  {
    companyName: "Placeholder Sağlık Hizmetleri",
    reviewerEmail: "demo-reviewer-9@iwtr.local",
    reviewerDisplayName: "Demo Reviewer 9",
    scores: { corporateCulture: 4, leadership: 4, infrastructure: 4, workLifeBalance: 2, stability: 4 },
    generalThoughts: "Sample review content for design purposes — rewarding but exhausting shifts.",
  },
  {
    companyName: "Numune Eğitim Kurumları",
    reviewerEmail: "demo-reviewer-10@iwtr.local",
    reviewerDisplayName: "Demo Reviewer 10",
    scores: { corporateCulture: 4, leadership: 3, infrastructure: 3, workLifeBalance: 4, stability: 4 },
    generalThoughts: "Sample review content for design purposes — supportive colleagues.",
  },
];

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const moderation = new ModerationService();
  const piiVault = new PiiVaultService(prisma);
  const reviews = new ReviewsService(prisma, moderation, piiVault);

  const backdatedCreatedAt = new Date(Date.now() - 60 * DAY_MS);
  const employmentStart = new Date(Date.now() - 2 * 365 * DAY_MS);
  const employmentEnd = new Date(Date.now() - 180 * DAY_MS);

  let created = 0;
  let skipped = 0;

  for (const demo of DEMO_REVIEWS) {
    const company = await prisma.company.findFirst({ where: { name: demo.companyName } });
    if (!company) {
      console.warn(`Skipping "${demo.companyName}" — company not found (did reset-to-demo-companies.ts run?)`);
      continue;
    }

    const user = await prisma.user.upsert({
      where: { email: demo.reviewerEmail },
      create: {
        email: demo.reviewerEmail,
        authProvider: "EMAIL",
        status: "ACTIVE",
        displayName: demo.reviewerDisplayName,
        createdAt: backdatedCreatedAt,
      },
      update: {},
    });

    let employment = await prisma.employmentHistory.findFirst({
      where: { userId: user.id, companyId: company.id },
    });
    if (!employment) {
      employment = await prisma.employmentHistory.create({
        data: {
          userId: user.id,
          companyId: company.id,
          rawCompanyName: company.name,
          startDate: employmentStart,
          endDate: employmentEnd,
        },
      });
    }

    try {
      const result = await reviews.submitReview(user.id, {
        companyId: company.id,
        employmentHistoryId: employment.id,
        corporateCultureScore: demo.scores.corporateCulture,
        leadershipScore: demo.scores.leadership,
        infrastructureScore: demo.scores.infrastructure,
        workLifeBalanceScore: demo.scores.workLifeBalance,
        stabilityScore: demo.scores.stability,
        generalThoughts: demo.generalThoughts,
      });
      console.log(`  ${demo.companyName}: ${result.status} (${demo.reviewerEmail})`);
      created++;
    } catch (err) {
      if (err instanceof ConflictException) {
        console.log(`  ${demo.companyName}: already reviewed by ${demo.reviewerEmail}, skipping`);
        skipped++;
      } else {
        throw err;
      }
    }
  }

  console.log(`\nDone. Submitted ${created}, skipped ${skipped} (already existed).`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

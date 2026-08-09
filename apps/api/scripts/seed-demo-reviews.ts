// Gives each demo company (see reset-to-demo-companies.ts) one published
// demo review, so company cards/pages have a rating to look at (and to edit,
// via the new PATCH /reviews/:id endpoint) while the frontend is designed.
// Submits a full 25-question survey per company — matching that company's
// workplaceType question set — rather than raw scores, since scores are now
// always computed server-side from answers (see ReviewsService.scoreAnswers).
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
import type { CategoryKey, WorkplaceType } from "@iwtr/shared-types";
import { PrismaService } from "../src/prisma/prisma.service";
import { ReviewsService } from "../src/modules/reviews/reviews.service";
import { ModerationService } from "../src/modules/moderation/moderation.service";
import { PiiVaultService } from "../src/modules/pii-vault/pii-vault.service";
import { getQuestionsFor } from "../src/modules/reviews/survey-questions.data";

const DAY_MS = 24 * 60 * 60 * 1000;

// How many of each category's 5 questions this reviewer gets "wrong" (the
// opposite of the question's correct answer) — the rest are answered
// correctly. Chosen to land each company's overall average in roughly the
// same 2.4-4.2 spread the original hand-picked star demo data had.
interface DemoReview {
  companyName: string;
  // Which of the company's (up to 2) workplaceTypes this reviewer is
  // answering as — must be one of Company.workplaceTypes at submission time
  // (ReviewsService.submitReview re-validates this).
  workplaceType: WorkplaceType;
  reviewerEmail: string;
  reviewerDisplayName: string;
  missCounts: Record<CategoryKey, number>;
  generalThoughts: string;
}

const DEMO_REVIEWS: DemoReview[] = [
  {
    companyName: "Demo Teknoloji A.Ş.",
    workplaceType: "OFFICE",
    reviewerEmail: "demo-reviewer-1@iwtr.local",
    reviewerDisplayName: "Demo Reviewer 1",
    missCounts: { corporateCulture: 1, leadership: 1, infrastructure: 0, workLifeBalance: 2, stability: 1 },
    generalThoughts: "Sample review content for design purposes — good team, occasionally long hours.",
  },
  {
    companyName: "Örnek Kargo ve Lojistik",
    workplaceType: "MANUAL_LABOUR",
    reviewerEmail: "demo-reviewer-2@iwtr.local",
    reviewerDisplayName: "Demo Reviewer 2",
    missCounts: { corporateCulture: 2, leadership: 2, infrastructure: 2, workLifeBalance: 2, stability: 2 },
    generalThoughts: "Sample review content for design purposes — physically demanding but steady work.",
  },
  {
    companyName: "Test Cafe & Restoran",
    workplaceType: "SERVICE",
    reviewerEmail: "demo-reviewer-3@iwtr.local",
    reviewerDisplayName: "Demo Reviewer 3",
    missCounts: { corporateCulture: 0, leadership: 1, infrastructure: 1, workLifeBalance: 2, stability: 1 },
    generalThoughts: "Sample review content for design purposes — friendly place, tips were fair.",
  },
  {
    companyName: "Placeholder Danışmanlık",
    workplaceType: "HYBRID_REMOTE",
    reviewerEmail: "demo-reviewer-4@iwtr.local",
    reviewerDisplayName: "Demo Reviewer 4",
    missCounts: { corporateCulture: 1, leadership: 0, infrastructure: 1, workLifeBalance: 1, stability: 2 },
    generalThoughts: "Sample review content for design purposes — fully remote, great flexibility.",
  },
  {
    companyName: "Numune İnşaat",
    workplaceType: "MANUAL_LABOUR",
    reviewerEmail: "demo-reviewer-5@iwtr.local",
    reviewerDisplayName: "Demo Reviewer 5",
    missCounts: { corporateCulture: 3, leadership: 3, infrastructure: 2, workLifeBalance: 3, stability: 2 },
    generalThoughts: "Sample review content for design purposes — safety gear was inconsistent.",
  },
  {
    companyName: "Demo Finans Holding",
    workplaceType: "OFFICE",
    reviewerEmail: "demo-reviewer-6@iwtr.local",
    reviewerDisplayName: "Demo Reviewer 6",
    missCounts: { corporateCulture: 1, leadership: 2, infrastructure: 0, workLifeBalance: 2, stability: 0 },
    generalThoughts: "Sample review content for design purposes — very stable, formal culture.",
  },
  {
    companyName: "Örnek Perakende Mağazacılık",
    workplaceType: "SERVICE",
    reviewerEmail: "demo-reviewer-7@iwtr.local",
    reviewerDisplayName: "Demo Reviewer 7",
    missCounts: { corporateCulture: 2, leadership: 2, infrastructure: 2, workLifeBalance: 2, stability: 2 },
    generalThoughts: "Sample review content for design purposes — pretty average all around.",
  },
  {
    companyName: "Test Yazılım Stüdyosu",
    workplaceType: "HYBRID_REMOTE",
    reviewerEmail: "demo-reviewer-8@iwtr.local",
    reviewerDisplayName: "Demo Reviewer 8",
    missCounts: { corporateCulture: 0, leadership: 0, infrastructure: 1, workLifeBalance: 2, stability: 1 },
    generalThoughts: "Sample review content for design purposes — small team, lots of ownership.",
  },
  {
    // SERVICE side of the hospital — a nurse/care-staff perspective.
    companyName: "Placeholder Sağlık Hizmetleri",
    workplaceType: "SERVICE",
    reviewerEmail: "demo-reviewer-9@iwtr.local",
    reviewerDisplayName: "Demo Reviewer 9",
    missCounts: { corporateCulture: 1, leadership: 1, infrastructure: 1, workLifeBalance: 3, stability: 1 },
    generalThoughts: "Sample review content for design purposes — rewarding but exhausting shifts.",
  },
  {
    companyName: "Numune Eğitim Kurumları",
    workplaceType: "OFFICE",
    reviewerEmail: "demo-reviewer-10@iwtr.local",
    reviewerDisplayName: "Demo Reviewer 10",
    missCounts: { corporateCulture: 1, leadership: 2, infrastructure: 2, workLifeBalance: 1, stability: 1 },
    generalThoughts: "Sample review content for design purposes — supportive colleagues.",
  },
  {
    // OFFICE side of the same hospital — an HR/billing perspective. Exists
    // specifically so the split "What reviewers said" survey-stats UI has
    // real data on both sides of a 2-type company, not just one.
    companyName: "Placeholder Sağlık Hizmetleri",
    workplaceType: "OFFICE",
    reviewerEmail: "demo-reviewer-11@iwtr.local",
    reviewerDisplayName: "Demo Reviewer 11",
    missCounts: { corporateCulture: 2, leadership: 1, infrastructure: 0, workLifeBalance: 1, stability: 2 },
    generalThoughts: "Sample review content for design purposes — back-office side is much calmer than the floor.",
  },
];

function oppositeAnswer(correct: "YES" | "NO"): "YES" | "NO" {
  return correct === "YES" ? "NO" : "YES";
}

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

    // Miss the FIRST N questions of each category (deterministic, simple —
    // order within a category doesn't carry meaning), correct the rest.
    const missSeenByCategory: Record<CategoryKey, number> = {
      corporateCulture: 0,
      leadership: 0,
      infrastructure: 0,
      workLifeBalance: 0,
      stability: 0,
    };
    const answers = getQuestionsFor(demo.workplaceType).map((question) => {
      const alreadyMissed = missSeenByCategory[question.category];
      const shouldMiss = alreadyMissed < demo.missCounts[question.category];
      if (shouldMiss) missSeenByCategory[question.category] += 1;
      return {
        questionId: question.id,
        answer: shouldMiss ? oppositeAnswer(question.correctAnswer) : question.correctAnswer,
      };
    });

    try {
      const result = await reviews.submitReview(user.id, {
        companyId: company.id,
        employmentHistoryId: employment.id,
        workplaceType: demo.workplaceType,
        answers,
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

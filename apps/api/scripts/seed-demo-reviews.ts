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
import { pickRandomDisplayUsername } from "../src/modules/reviews/randomized-identity.util";

const DAY_MS = 24 * 60 * 60 * 1000;

// Mirrors the stable storage keys in apps/web/src/lib/avatars.ts and
// avatarGradients.ts — this script deliberately doesn't import apps/web's
// presentation-layer code (avatarKey/avatarGradient are just opaque strings
// as far as the API/DB is concerned; the actual emoji/gradient palette is
// resolved client-side), so the variant lists are duplicated here rather
// than imported across the web/api boundary.
const AVATAR_VARIANTS_BY_TYPE: Record<WorkplaceType, string[]> = {
  OFFICE: ["office_1", "office_2", "office_3", "office_4"],
  HYBRID_REMOTE: ["remote_1", "remote_2", "remote_3", "remote_4"],
  SERVICE: ["service_1", "service_2", "service_3", "service_4"],
  MANUAL_LABOUR: ["manual_1", "manual_2", "manual_3", "manual_4"],
};
const AVATAR_GRADIENT_KEYS = [
  "sunrise",
  "berry",
  "ocean",
  "mint",
  "grape",
  "flame",
  "dusk",
  "candy",
  "citrus",
  "lagoon",
  "rose",
];

// Gives each demo reviewer a real avatar (matching their own workplaceType,
// like the real onboarding picker does) instead of leaving them null —
// PublicReview.avatarKey/avatarGradient now come from the review author's
// actual User row (see ReviewsService.listForCompany), so demo companies
// need real demo avatars to show the feature working, not a UI-only mock.
export function demoAvatarFor(index: number, workplaceType: WorkplaceType): { avatarKey: string; avatarGradient: string } {
  const variants = AVATAR_VARIANTS_BY_TYPE[workplaceType];
  return {
    avatarKey: variants[index % variants.length],
    avatarGradient: AVATAR_GRADIENT_KEYS[index % AVATAR_GRADIENT_KEYS.length],
  };
}

// How many of each category's 5 questions this reviewer gets "wrong" (the
// opposite of the question's correct answer) — the rest are answered
// correctly. Chosen to land each company's overall average in roughly the
// same 2.4-4.2 spread the original hand-picked star demo data had.
export interface DemoReview {
  companyName: string;
  // Which of the company's (up to 2) workplaceTypes this reviewer is
  // answering as — must be one of Company.workplaceTypes at submission time
  // (ReviewsService.submitReview re-validates this).
  workplaceType: WorkplaceType;
  reviewerEmail: string;
  missCounts: Record<CategoryKey, number>;
  generalThoughts: string;
}

// Also the per-(company, workplaceType) baseline scripts/seed-bulk-demo-
// reviews.ts jitters around when generating each pair's 9 additional
// reviewers — keeps the two scripts' data in obvious agreement rather than
// letting a hand-tuned baseline here drift from a second copy elsewhere.
export const DEMO_REVIEWS: DemoReview[] = [
  {
    companyName: "Demo Teknoloji A.Ş.",
    workplaceType: "OFFICE",
    reviewerEmail: "demo-reviewer-1@iwtr.local",
    missCounts: { corporateCulture: 1, leadership: 1, infrastructure: 0, workLifeBalance: 2, stability: 1 },
    generalThoughts: "Sample review content for design purposes — good team, occasionally long hours.",
  },
  {
    companyName: "Örnek Kargo ve Lojistik",
    workplaceType: "MANUAL_LABOUR",
    reviewerEmail: "demo-reviewer-2@iwtr.local",
    missCounts: { corporateCulture: 2, leadership: 2, infrastructure: 2, workLifeBalance: 2, stability: 2 },
    generalThoughts: "Sample review content for design purposes — physically demanding but steady work.",
  },
  {
    companyName: "Test Cafe & Restoran",
    workplaceType: "SERVICE",
    reviewerEmail: "demo-reviewer-3@iwtr.local",
    missCounts: { corporateCulture: 0, leadership: 1, infrastructure: 1, workLifeBalance: 2, stability: 1 },
    generalThoughts: "Sample review content for design purposes — friendly place, tips were fair.",
  },
  {
    companyName: "Placeholder Danışmanlık",
    workplaceType: "HYBRID_REMOTE",
    reviewerEmail: "demo-reviewer-4@iwtr.local",
    missCounts: { corporateCulture: 1, leadership: 0, infrastructure: 1, workLifeBalance: 1, stability: 2 },
    generalThoughts: "Sample review content for design purposes — fully remote, great flexibility.",
  },
  {
    companyName: "Numune İnşaat",
    workplaceType: "MANUAL_LABOUR",
    reviewerEmail: "demo-reviewer-5@iwtr.local",
    missCounts: { corporateCulture: 3, leadership: 3, infrastructure: 2, workLifeBalance: 3, stability: 2 },
    generalThoughts: "Sample review content for design purposes — safety gear was inconsistent.",
  },
  {
    companyName: "Demo Finans Holding",
    workplaceType: "OFFICE",
    reviewerEmail: "demo-reviewer-6@iwtr.local",
    missCounts: { corporateCulture: 1, leadership: 2, infrastructure: 0, workLifeBalance: 2, stability: 0 },
    generalThoughts: "Sample review content for design purposes — very stable, formal culture.",
  },
  {
    companyName: "Örnek Perakende Mağazacılık",
    workplaceType: "SERVICE",
    reviewerEmail: "demo-reviewer-7@iwtr.local",
    missCounts: { corporateCulture: 2, leadership: 2, infrastructure: 2, workLifeBalance: 2, stability: 2 },
    generalThoughts: "Sample review content for design purposes — pretty average all around.",
  },
  {
    companyName: "Test Yazılım Stüdyosu",
    workplaceType: "HYBRID_REMOTE",
    reviewerEmail: "demo-reviewer-8@iwtr.local",
    missCounts: { corporateCulture: 0, leadership: 0, infrastructure: 1, workLifeBalance: 2, stability: 1 },
    generalThoughts: "Sample review content for design purposes — small team, lots of ownership.",
  },
  {
    // SERVICE side of the hospital — a nurse/care-staff perspective.
    companyName: "Placeholder Sağlık Hizmetleri",
    workplaceType: "SERVICE",
    reviewerEmail: "demo-reviewer-9@iwtr.local",
    missCounts: { corporateCulture: 1, leadership: 1, infrastructure: 1, workLifeBalance: 3, stability: 1 },
    generalThoughts: "Sample review content for design purposes — rewarding but exhausting shifts.",
  },
  {
    companyName: "Numune Eğitim Kurumları",
    workplaceType: "OFFICE",
    reviewerEmail: "demo-reviewer-10@iwtr.local",
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
    missCounts: { corporateCulture: 2, leadership: 1, infrastructure: 0, workLifeBalance: 1, stability: 2 },
    generalThoughts: "Sample review content for design purposes — back-office side is much calmer than the floor.",
  },
  {
    companyName: "Örnek Turizm ve Otelcilik",
    workplaceType: "SERVICE",
    reviewerEmail: "demo-reviewer-12@iwtr.local",
    missCounts: { corporateCulture: 1, leadership: 1, infrastructure: 1, workLifeBalance: 3, stability: 2 },
    generalThoughts: "Sample review content for design purposes — busy season is rough but tips help.",
  },
  {
    companyName: "Numune Tekstil Sanayi",
    workplaceType: "MANUAL_LABOUR",
    reviewerEmail: "demo-reviewer-13@iwtr.local",
    missCounts: { corporateCulture: 2, leadership: 2, infrastructure: 3, workLifeBalance: 2, stability: 1 },
    generalThoughts: "Sample review content for design purposes — factory floor is loud, management is fair.",
  },
  {
    companyName: "Demo Liman İşletmeleri",
    workplaceType: "MANUAL_LABOUR",
    reviewerEmail: "demo-reviewer-14@iwtr.local",
    missCounts: { corporateCulture: 1, leadership: 2, infrastructure: 1, workLifeBalance: 2, stability: 0 },
    generalThoughts: "Sample review content for design purposes — steady shifts, decent equipment.",
  },
  {
    companyName: "Test Otomotiv Yedek Parça",
    workplaceType: "OFFICE",
    reviewerEmail: "demo-reviewer-15@iwtr.local",
    missCounts: { corporateCulture: 1, leadership: 1, infrastructure: 0, workLifeBalance: 1, stability: 1 },
    generalThoughts: "Sample review content for design purposes — solid mid-size company, predictable hours.",
  },
  {
    companyName: "Placeholder Havacılık Mühendislik",
    workplaceType: "HYBRID_REMOTE",
    reviewerEmail: "demo-reviewer-16@iwtr.local",
    missCounts: { corporateCulture: 0, leadership: 1, infrastructure: 0, workLifeBalance: 1, stability: 1 },
    generalThoughts: "Sample review content for design purposes — engineering-heavy culture, good tooling.",
  },
  {
    companyName: "Örnek Tarım Ürünleri",
    workplaceType: "SERVICE",
    reviewerEmail: "demo-reviewer-17@iwtr.local",
    missCounts: { corporateCulture: 2, leadership: 2, infrastructure: 2, workLifeBalance: 2, stability: 3 },
    generalThoughts: "Sample review content for design purposes — seasonal work, pay is inconsistent.",
  },
  {
    companyName: "Numune Mobilya Üretim",
    workplaceType: "MANUAL_LABOUR",
    reviewerEmail: "demo-reviewer-18@iwtr.local",
    missCounts: { corporateCulture: 1, leadership: 1, infrastructure: 1, workLifeBalance: 1, stability: 0 },
    generalThoughts: "Sample review content for design purposes — well-run workshop, safety takes seriously.",
  },
  {
    companyName: "Demo Enerji Dağıtım",
    workplaceType: "OFFICE",
    reviewerEmail: "demo-reviewer-19@iwtr.local",
    missCounts: { corporateCulture: 0, leadership: 0, infrastructure: 1, workLifeBalance: 1, stability: 0 },
    generalThoughts: "Sample review content for design purposes — big stable employer, slow to change.",
  },
  {
    companyName: "Test Balıkçılık ve Gıda",
    workplaceType: "SERVICE",
    reviewerEmail: "demo-reviewer-20@iwtr.local",
    missCounts: { corporateCulture: 2, leadership: 2, infrastructure: 3, workLifeBalance: 2, stability: 2 },
    generalThoughts: "Sample review content for design purposes — early mornings, coworkers make it worth it.",
  },
  {
    companyName: "Placeholder Kimya Sanayi",
    workplaceType: "MANUAL_LABOUR",
    reviewerEmail: "demo-reviewer-21@iwtr.local",
    missCounts: { corporateCulture: 2, leadership: 3, infrastructure: 2, workLifeBalance: 2, stability: 1 },
    generalThoughts: "Sample review content for design purposes — safety protocols are strict, which is a good thing.",
  },
];

export function oppositeAnswer(correct: "YES" | "NO"): "YES" | "NO" {
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

  for (const [index, demo] of DEMO_REVIEWS.entries()) {
    const company = await prisma.company.findFirst({ where: { name: demo.companyName } });
    if (!company) {
      console.warn(`Skipping "${demo.companyName}" — company not found (did reset-to-demo-companies.ts run?)`);
      continue;
    }

    const avatar = demoAvatarFor(index, demo.workplaceType);
    const user = await prisma.user.upsert({
      where: { email: demo.reviewerEmail },
      create: {
        email: demo.reviewerEmail,
        authProvider: "EMAIL",
        status: "ACTIVE",
        createdAt: backdatedCreatedAt,
        avatarKey: avatar.avatarKey,
        avatarGradient: avatar.avatarGradient,
      },
      // Re-running the script also backfills avatars onto demo reviewer
      // accounts created before this field existed.
      update: { avatarKey: avatar.avatarKey, avatarGradient: avatar.avatarGradient },
    });

    // Generated once, never overwritten on re-run — same immutability
    // guarantee as real onboarding (see OnboardingService.submitAvatar).
    // Existing demo accounts already got theirs from
    // scripts/backfill-review-usernames.ts; this only covers a brand new
    // demo reviewer added to DEMO_REVIEWS in the future.
    if (!user.reviewUsername) {
      const reviewUsername = pickRandomDisplayUsername(demo.workplaceType);
      await prisma.user.update({ where: { id: user.id }, data: { reviewUsername } });
    }

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
        isRandomizedIdentity: false,
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

// Guarded so scripts/seed-bulk-demo-reviews.ts can import DEMO_REVIEWS/
// demoAvatarFor/oppositeAnswer above without also re-running this file's own
// 21-review seed as an import side effect.
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

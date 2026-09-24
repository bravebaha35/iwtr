// DEV ONLY — demo data so the Sector Benchmark Report can be tried out
// locally from the Demo Finans Holding owner dashboard.
//
// The report refuses any sector with fewer than 5 different reviewers or
// fewer than 3 different companies ("Insufficient Data to Ensure
// Anonymity"). The dev database's Consulting sector (Demo Finans Holding's)
// has plenty of reviewers but only 2 companies, so this script:
//   1. adds a third Consulting company, "Demo Danışmanlık A.Ş." (İstanbul),
//      with 8 published demo reviews, each with a consenting salary +
//      benefits answer (submitted through the real ReviewsService, so the
//      KVKK consent gate and moderation run exactly as for a real reviewer);
//   2. gives every other published Consulting review that has no salary
//      answer yet a consenting demo one, so salary bands clear the lock at
//      all 3 companies. Roughly a quarter are dated 2025 so the report shows
//      two salary years.
//
// Every salary here is made-up demo data. Safe to re-run: existing
// reviewers/reviews/salary rows are left as they are.
//
// Run from apps/api: pnpm exec ts-node scripts/seed-dev-benchmark-demo.ts

import "dotenv/config";
import { ConflictException } from "@nestjs/common";
import type { BenefitKey } from "@iwtr/shared-types";
import { PrismaService } from "../src/prisma/prisma.service";
import { SALARY_ACCESS, withRowAccess } from "../src/common/db/row-access";
import { ReviewsService } from "../src/modules/reviews/reviews.service";
import { ModerationService } from "../src/modules/moderation/moderation.service";
import { PiiVaultService } from "../src/modules/pii-vault/pii-vault.service";
import { getQuestionsFor } from "../src/modules/reviews/survey-questions.data";
import { pickRandomDisplayUsername } from "../src/modules/reviews/randomized-identity.util";
import { demoAvatarFor, oppositeAnswer } from "./seed-demo-reviews";

const DAY_MS = 24 * 60 * 60 * 1000;
const COMPANY_NAME = "Demo Danışmanlık A.Ş.";
const COMPANY_SLUG = "demo-danismanlik-a-s";
const SECTOR = "Consulting";
const REVIEWERS = 8;

const BENEFIT_SETS: BenefitKey[][] = [
  ["MEAL_CARD", "PRIVATE_HEALTH_INSURANCE"],
  ["MEAL_CARD", "TRANSPORT", "BONUS"],
  ["MEAL_CARD"],
  ["PRIVATE_HEALTH_INSURANCE", "BONUS", "TRAINING_BUDGET"],
  ["MEAL_CARD", "REMOTE_WORK_ALLOWANCE"],
  [],
  ["MEAL_CARD", "PRIVATE_PENSION", "PHONE"],
];

// Deterministic spread between roughly 32.000 and 95.000 TL.
function demoSalary(i: number): number {
  return 32_000 + ((i * 7_919) % 63_000);
}

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const reviews = new ReviewsService(prisma, new ModerationService(), new PiiVaultService(prisma));

  // 1. The third Consulting company.
  let company = await prisma.company.findUnique({ where: { slug: COMPANY_SLUG } });
  if (!company) {
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    company = await prisma.company.create({
      data: {
        slug: COMPANY_SLUG,
        name: COMPANY_NAME,
        category: SECTOR,
        workplaceTypes: ["OFFICE"],
        city: "İstanbul",
        createdByAdminId: admin.id,
      },
    });
    console.log(`Created company "${company.name}"`);
  }

  const questions = getQuestionsFor("OFFICE");
  const employmentStart = new Date(Date.now() - 3 * 365 * DAY_MS);
  const employmentEnd = new Date(Date.now() - 120 * DAY_MS);
  let createdReviews = 0;

  for (let n = 1; n <= REVIEWERS; n++) {
    const email = `benchmark-demo-${n}@iwtr.local`;
    const avatar = demoAvatarFor(n + 200, "OFFICE");
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        authProvider: "EMAIL",
        status: "ACTIVE",
        createdAt: new Date(Date.now() - 90 * DAY_MS),
        avatarKey: avatar.avatarKey,
        avatarGradient: avatar.avatarGradient,
        reviewUsername: pickRandomDisplayUsername("OFFICE"),
      },
      update: {},
    });

    const employment =
      (await prisma.employmentHistory.findFirst({ where: { userId: user.id, companyId: company.id } })) ??
      (await prisma.employmentHistory.create({
        data: {
          userId: user.id,
          companyId: company.id,
          rawCompanyName: company.name,
          startDate: employmentStart,
          endDate: employmentEnd,
        },
      }));

    // A mostly-healthy workplace with a few reviewer-specific misses.
    const answers = questions.map((q, i) => ({
      questionId: q.id,
      answer: (i + n) % 5 === 0 ? oppositeAnswer(q.correctAnswer) : q.correctAnswer,
    }));

    try {
      const result = await reviews.submitReview(user.id, {
        companyId: company.id,
        employmentHistoryId: employment.id,
        workplaceType: "OFFICE",
        answers,
        isRandomizedIdentity: false,
        generalThoughts: "Sample review content for design purposes — steady consulting work, busy quarter-ends.",
        compensation: { monthlyNetSalary: demoSalary(n), benefits: BENEFIT_SETS[n % BENEFIT_SETS.length] },
      });
      if (result.status !== "PUBLISHED") console.warn(`  ${email}: ${result.status} (expected PUBLISHED)`);
      createdReviews++;
    } catch (err) {
      if (!(err instanceof ConflictException)) throw err;
    }
  }

  // 2. Consenting demo salary answers for the sector's other published
  //    reviews that don't have one yet. SalarySubmission is behind
  //    Row-Level Security, so this runs with the salary gate on.
  const { withoutSalary, companies, salaryRows } = await withRowAccess(prisma, SALARY_ACCESS, async (tx) => {
    const missing = await tx.review.findMany({
      where: { status: "PUBLISHED", company: { category: SECTOR }, salarySubmission: null },
      select: { id: true, userId: true, companyId: true },
      orderBy: { createdAt: "asc" },
    });
    const thisYear = new Date().getUTCFullYear();
    await tx.salarySubmission.createMany({
      data: missing.map((r, i) => ({
        reviewId: r.id,
        userId: r.userId,
        companyId: r.companyId,
        monthlyNetSalary: demoSalary(i + 11),
        benefits: BENEFIT_SETS[i % BENEFIT_SETS.length],
        salaryYear: i % 4 === 0 ? thisYear - 1 : thisYear,
        kvkkCommercialConsent: true,
      })),
      skipDuplicates: true,
    });

    const [companyCount, salaryCount] = await Promise.all([
      tx.company.count({ where: { category: SECTOR, hiddenAt: null, reviews: { some: { status: "PUBLISHED" } } } }),
      tx.salarySubmission.count({ where: { review: { status: "PUBLISHED", company: { category: SECTOR } } } }),
    ]);
    return { withoutSalary: missing, companies: companyCount, salaryRows: salaryCount };
  });
  console.log(
    `Done. ${createdReviews} new demo reviews; ${withoutSalary.length} demo salary answers added. ` +
      `${SECTOR} now has ${companies} companies with reviews and ${salaryRows} salary answers.`,
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

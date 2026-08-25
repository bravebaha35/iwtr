// Tops up every demo company (see reset-to-demo-companies.ts) that already
// has its one hand-tuned review (seed-demo-reviews.ts) to at least
// TARGET_REVIEWS_PER_TYPE published reviews per (company, workplaceType)
// pair, so the aggregate-driven features (survey-stats, WorkplaceVibeFlags,
// "most disputed") have enough real volume to show interesting variation
// instead of a single reviewer's answers.
//
// Each new reviewer's per-category miss count jitters (±1, clamped 0-5)
// around that pair's existing DEMO_REVIEWS baseline from seed-demo-
// reviews.ts, so a company still reads as "the same kind of place" across
// all 10 reviewers rather than random noise — a seeded PRNG keyed by
// (companyId, workplaceType) keeps every run deterministic (same output
// every time, safe to inspect/diff, no flaky reruns).
//
// Skips "I Worked There" itself — it's the platform's real self-listing
// (see scripts/grant-iwtr-ownership.ts), not a demo company.
//
// Safe to re-run: counts each pair's current PUBLISHED reviews first and
// only creates the shortfall, so a partially-run or already-topped-up pair
// is a no-op rather than piling on more reviewers past the target.
//
// Run from apps/api: pnpm exec ts-node scripts/seed-bulk-demo-reviews.ts

import "dotenv/config";
import { ConflictException } from "@nestjs/common";
import type { CategoryKey, WorkplaceType } from "@iwtr/shared-types";
import { PrismaService } from "../src/prisma/prisma.service";
import { ReviewsService } from "../src/modules/reviews/reviews.service";
import { ModerationService } from "../src/modules/moderation/moderation.service";
import { PiiVaultService } from "../src/modules/pii-vault/pii-vault.service";
import { getQuestionsFor } from "../src/modules/reviews/survey-questions.data";
import { pickRandomDisplayUsername } from "../src/modules/reviews/randomized-identity.util";
import { DEMO_REVIEWS, demoAvatarFor, oppositeAnswer } from "./seed-demo-reviews";

const DAY_MS = 24 * 60 * 60 * 1000;
const TARGET_REVIEWS_PER_TYPE = 10;
const SELF_LISTING_COMPANY_NAME = "I Worked There";

const CATEGORIES: CategoryKey[] = ["corporateCulture", "leadership", "infrastructure", "workLifeBalance", "stability"];

// Extra generalThoughts variety per work-type, cycled by index — the
// baseline entry's own sentence (from DEMO_REVIEWS) already covers
// reviewer #1 (pre-existing); these cover the newly-added #2-10. Kept clear
// of ModerationService's JOB_TITLE_WORDS ("manager"/"supervisor"/etc.) so
// every one of these auto-publishes the same way the original 21 did,
// rather than bouncing to the admin queue over a word choice.
const FILLER_THOUGHTS: Record<WorkplaceType, string[]> = {
  OFFICE: [
    "Sample review content for design purposes — decent place overall, nothing dramatic either way.",
    "Sample review content for design purposes — depends a lot on the team you land in.",
    "Sample review content for design purposes — commute was the only real downside for me.",
    "Sample review content for design purposes — office politics exist but it's manageable.",
    "Sample review content for design purposes — would recommend to a friend with reservations.",
    "Sample review content for design purposes — solid benefits, average pace of work.",
    "Sample review content for design purposes — good place to learn early in a career.",
    "Sample review content for design purposes — pace picked up a lot in the last year.",
    "Sample review content for design purposes — pretty typical corporate experience.",
  ],
  HYBRID_REMOTE: [
    "Sample review content for design purposes — async culture takes getting used to.",
    "Sample review content for design purposes — home office stipend covered the basics.",
    "Sample review content for design purposes — some teams run tighter than others.",
    "Sample review content for design purposes — meetings could be emails half the time.",
    "Sample review content for design purposes — flexibility is real, just don't expect much hand-holding.",
    "Sample review content for design purposes — timezone overlap with leadership is thin.",
    "Sample review content for design purposes — good if you're already disciplined about routine.",
    "Sample review content for design purposes — decent, though onboarding remotely was rough.",
    "Sample review content for design purposes — solid for a fully distributed setup.",
  ],
  SERVICE: [
    "Sample review content for design purposes — busy shifts but coworkers had my back.",
    "Sample review content for design purposes — customers can be a lot, it helps when the floor is well-run.",
    "Sample review content for design purposes — schedule was posted late more often than not.",
    "Sample review content for design purposes — fine starter job, wouldn't stay long-term.",
    "Sample review content for design purposes — tips made up for a lot of the stress.",
    "Sample review content for design purposes — depends heavily on who's running the floor that day.",
    "Sample review content for design purposes — decent training, understaffed on weekends.",
    "Sample review content for design purposes — fair enough for the pay level.",
    "Sample review content for design purposes — busy but predictable once you learn the rhythm.",
  ],
  MANUAL_LABOUR: [
    "Sample review content for design purposes — physically tough but the crew makes it bearable.",
    "Sample review content for design purposes — safety gear was there when it mattered.",
    "Sample review content for design purposes — long shifts, decent overtime pay.",
    "Sample review content for design purposes — equipment could use an upgrade honestly.",
    "Sample review content for design purposes — good for steady work, body feels it by year's end.",
    "Sample review content for design purposes — foreman actually knows the job, which helps.",
    "Sample review content for design purposes — weather-dependent work, plan accordingly.",
    "Sample review content for design purposes — fair pay for the physical demand.",
    "Sample review content for design purposes — decent crew, leadership is hit or miss.",
  ],
};

// Small deterministic PRNG (mulberry32) so re-running this script always
// generates the exact same reviewers/answers for a given pair — no flaky
// diffs between runs, and anything odd found while eyeballing the output is
// reproducible rather than "well it was random."
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFrom(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 31) + text.charCodeAt(i)) | 0;
  return h;
}

function jitteredMissCounts(baseline: Record<CategoryKey, number>, rand: () => number): Record<CategoryKey, number> {
  const result = {} as Record<CategoryKey, number>;
  for (const category of CATEGORIES) {
    const delta = Math.floor(rand() * 3) - 1; // -1, 0, or +1
    result[category] = Math.min(5, Math.max(0, baseline[category] + delta));
  }
  return result;
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
  let skippedExisting = 0;
  let pairsAlreadyAtTarget = 0;

  for (const baseline of DEMO_REVIEWS) {
    if (baseline.companyName === SELF_LISTING_COMPANY_NAME) {
      console.log(`Skipping "${baseline.companyName}" — the platform's own self-listing, not a demo company.`);
      continue;
    }

    const company = await prisma.company.findFirst({ where: { name: baseline.companyName } });
    if (!company) {
      console.warn(`Skipping "${baseline.companyName}" — company not found (did reset-to-demo-companies.ts run?)`);
      continue;
    }

    const currentCount = await prisma.review.count({
      where: { companyId: company.id, workplaceType: baseline.workplaceType, status: "PUBLISHED" },
    });
    const needed = TARGET_REVIEWS_PER_TYPE - currentCount;
    if (needed <= 0) {
      console.log(`  ${baseline.companyName} (${baseline.workplaceType}): already at ${currentCount}, skipping.`);
      pairsAlreadyAtTarget++;
      continue;
    }

    console.log(`  ${baseline.companyName} (${baseline.workplaceType}): ${currentCount} -> ${TARGET_REVIEWS_PER_TYPE} (+${needed})`);
    const fillers = FILLER_THOUGHTS[baseline.workplaceType];
    const rand = mulberry32(seedFrom(`${company.id}:${baseline.workplaceType}`));

    for (let n = 1; n <= needed; n++) {
      const reviewerEmail = `bulk-${company.slug}-${baseline.workplaceType.toLowerCase()}-${n}@iwtr.local`;
      // Offset by 100 so this batch's avatar/gradient rotation phase doesn't
      // line up 1:1 with the original 21 reviewers' — purely cosmetic variety.
      const avatar = demoAvatarFor(n + 100, baseline.workplaceType);

      const user = await prisma.user.upsert({
        where: { email: reviewerEmail },
        create: {
          email: reviewerEmail,
          authProvider: "EMAIL",
          status: "ACTIVE",
          createdAt: backdatedCreatedAt,
          avatarKey: avatar.avatarKey,
          avatarGradient: avatar.avatarGradient,
        },
        update: {},
      });

      if (!user.reviewUsername) {
        const reviewUsername = pickRandomDisplayUsername(baseline.workplaceType);
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

      const missCounts = jitteredMissCounts(baseline.missCounts, rand);
      const missSeenByCategory: Record<CategoryKey, number> = {
        corporateCulture: 0,
        leadership: 0,
        infrastructure: 0,
        workLifeBalance: 0,
        stability: 0,
      };
      const answers = getQuestionsFor(baseline.workplaceType).map((question) => {
        const alreadyMissed = missSeenByCategory[question.category];
        const shouldMiss = alreadyMissed < missCounts[question.category];
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
          workplaceType: baseline.workplaceType,
          answers,
          isRandomizedIdentity: false,
          generalThoughts: fillers[(n - 1) % fillers.length],
        });
        if (result.status !== "PUBLISHED") {
          console.warn(`    ${reviewerEmail}: ${result.status} (expected PUBLISHED — check moderation/trust scoring)`);
        }
        created++;
      } catch (err) {
        if (err instanceof ConflictException) {
          skippedExisting++;
        } else {
          throw err;
        }
      }
    }
  }

  console.log(
    `\nDone. Created ${created} new reviews, ${skippedExisting} already existed, ${pairsAlreadyAtTarget} pairs already at target.`,
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

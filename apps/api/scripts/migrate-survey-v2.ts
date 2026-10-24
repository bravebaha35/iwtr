// One-time move of stored reviews to survey question set v2 (2026-10-24,
// see src/modules/reviews/survey-questions.data.ts). Runs once: it records
// itself in AuditLog and refuses to run a second time (flipping answers
// twice would undo it).
//
// 1. Three questions now ask the opposite of what they used to, so every
//    stored YES/NO answer to them is flipped ("prefer not" stays):
//      OFFICE.corporateCulture.5  "backstabbing is common?"        -> "collaboration is supportive?"
//      OFFICE.stability.1         "high turnover / silent firings?" -> "open about retention and changes?"
//      SERVICE.stability.1        "wage or tip problems?"           -> "pay calculated transparently?"
//    A flipped answer scores exactly as before (the healthy answer flipped too).
// 2. Every review's five category scores are recomputed from its answers
//    with the v2 answer key. This fixes OFFICE.corporateCulture.1 and
//    OFFICE.leadership.1, whose healthy answer was the wrong way round.
// 3. Every company's CompanyAggregateScore is recomputed (same math as
//    ReviewsService.recomputeAggregate), and all cached company summaries
//    (CompanyNarrative) are cleared so they are rebuilt on next view.
//
// Run from apps/api:  pnpm exec ts-node --transpile-only scripts/migrate-survey-v2.ts
// Dry run (counts only, changes nothing):  ... migrate-survey-v2.ts --dry-run

import "dotenv/config";
import { PrismaClient, type Prisma } from "@prisma/client";
import type { CategoryKey, SurveyAnswer, WorkplaceType } from "@iwtr/shared-types";
import { getQuestionsFor } from "../src/modules/reviews/survey-questions.data";

const ACTION = "SURVEY_V2_MIGRATION";
const FLIPPED = new Set(["OFFICE.corporateCulture.5", "OFFICE.stability.1", "SERVICE.stability.1"]);
const SCORE_FIELD: Record<CategoryKey, "corporateCultureScore" | "leadershipScore" | "infrastructureScore" | "workLifeBalanceScore" | "stabilityScore"> = {
  corporateCulture: "corporateCultureScore",
  leadership: "leadershipScore",
  infrastructure: "infrastructureScore",
  workLifeBalance: "workLifeBalanceScore",
  stability: "stabilityScore",
};

const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const dryRun = process.argv.includes("--dry-run");

function flip(answer: SurveyAnswer): SurveyAnswer {
  return answer === "YES" ? "NO" : answer === "NO" ? "YES" : answer;
}

async function main() {
  const done = await prisma.auditLog.findFirst({ where: { action: ACTION } });
  if (done) {
    console.log(`Already done on ${done.createdAt.toISOString()} - nothing to do.`);
    return;
  }

  const reviews = await prisma.review.findMany({
    select: {
      id: true,
      companyId: true,
      workplaceType: true,
      surveyAnswers: true,
      corporateCultureScore: true,
      leadershipScore: true,
      infrastructureScore: true,
      workLifeBalanceScore: true,
      stabilityScore: true,
    },
  });

  let flippedAnswers = 0;
  let rescored = 0;
  const updates: { id: string; data: Prisma.ReviewUpdateInput }[] = [];

  for (const review of reviews) {
    const answers = { ...((review.surveyAnswers ?? {}) as Record<string, SurveyAnswer>) };
    let changedAnswers = false;
    for (const id of FLIPPED) {
      if (answers[id] === "YES" || answers[id] === "NO") {
        answers[id] = flip(answers[id]);
        flippedAnswers += 1;
        changedAnswers = true;
      }
    }

    const scores: Record<CategoryKey, number> = { corporateCulture: 0, leadership: 0, infrastructure: 0, workLifeBalance: 0, stability: 0 };
    for (const q of getQuestionsFor(review.workplaceType as WorkplaceType)) {
      if (answers[q.id] === q.correctAnswer) scores[q.category] += 1;
    }
    const scoreData: Partial<Record<(typeof SCORE_FIELD)[CategoryKey], number>> = {};
    for (const key of Object.keys(SCORE_FIELD) as CategoryKey[]) {
      if (review[SCORE_FIELD[key]] !== scores[key]) scoreData[SCORE_FIELD[key]] = scores[key];
    }
    if (Object.keys(scoreData).length > 0) rescored += 1;

    if (changedAnswers || Object.keys(scoreData).length > 0) {
      updates.push({ id: review.id, data: { ...(changedAnswers ? { surveyAnswers: answers } : {}), ...scoreData } });
    }
  }

  console.log(`${reviews.length} reviews: ${flippedAnswers} answers to flip, ${rescored} reviews with a changed score.`);
  if (dryRun) {
    console.log("Dry run - nothing changed.");
    return;
  }

  for (let i = 0; i < updates.length; i += 200) {
    await prisma.$transaction(updates.slice(i, i + 200).map((u) => prisma.review.update({ where: { id: u.id }, data: u.data })));
  }

  // Same math as ReviewsService.recomputeAggregate: each category's average
  // over published reviews, overall = mean of the five.
  const companyIds = [...new Set(reviews.map((r) => r.companyId))];
  for (const companyId of companyIds) {
    const published = await prisma.review.findMany({
      where: { companyId, status: "PUBLISHED" },
      select: { corporateCultureScore: true, leadershipScore: true, infrastructureScore: true, workLifeBalanceScore: true, stabilityScore: true },
    });
    const count = published.length;
    const avg = (key: keyof (typeof published)[number]) => (count === 0 ? 0 : published.reduce((s, r) => s + r[key], 0) / count);
    const data = {
      corporateCultureAvg: avg("corporateCultureScore"),
      leadershipAvg: avg("leadershipScore"),
      infrastructureAvg: avg("infrastructureScore"),
      workLifeBalanceAvg: avg("workLifeBalanceScore"),
      stabilityAvg: avg("stabilityScore"),
      reviewCount: count,
    };
    const overallAvg =
      count === 0
        ? 0
        : (data.corporateCultureAvg + data.leadershipAvg + data.infrastructureAvg + data.workLifeBalanceAvg + data.stabilityAvg) / 5;
    await prisma.companyAggregateScore.upsert({
      where: { companyId },
      create: { companyId, overallAvg, ...data },
      update: { overallAvg, ...data },
    });
  }

  const narratives = await prisma.companyNarrative.deleteMany({});

  await prisma.auditLog.create({
    data: {
      action: ACTION,
      targetType: "Review",
      targetId: "all",
      metadata: { reviews: reviews.length, flippedAnswers, rescored, companies: companyIds.length, narrativesCleared: narratives.count },
    },
  });
  console.log(`Done: ${updates.length} reviews updated, ${companyIds.length} company scores recomputed, ${narratives.count} summaries cleared.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

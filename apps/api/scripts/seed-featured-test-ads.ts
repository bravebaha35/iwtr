// Dev-only: turns existing job ads (up to 8 per kind of work) into Featured ads for 14 days, so the
// Jobs page's gold "Featured jobs" row can be seen in its final form. Only
// ads of companies with an approved owner are picked (the only ones the Jobs
// page shows), mixed across kinds of work and cities.
//
// Writes the picked ids to uploads/.featured-test-ads.json; --undo takes the
// boost off exactly those again.
//
// Run from apps/api:
//   pnpm exec ts-node --transpile-only scripts/seed-featured-test-ads.ts
//   pnpm exec ts-node --transpile-only scripts/seed-featured-test-ads.ts --undo

import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const RECORD = join(process.cwd(), "uploads", ".featured-test-ads.json");
const PER_TYPE = 8;
const DAYS = 14;

async function undo() {
  if (!existsSync(RECORD)) {
    console.log("Nothing to undo.");
    return;
  }
  const ids = JSON.parse(readFileSync(RECORD, "utf8")) as string[];
  const { count } = await prisma.jobPosting.updateMany({
    where: { id: { in: ids } },
    data: {
      boostDurationDays: null,
      boostIsFree: false,
      boostPaymentStatus: null,
      boostStartedAt: null,
      boostExpiresAt: null,
      boostAdSpace: false,
    },
  });
  writeFileSync(RECORD, "[]");
  console.log(`Took the test boost off ${count} job ads.`);
}

async function seed() {
  const candidates = await prisma.jobPosting.findMany({
    where: {
      status: "PUBLISHED",
      company: { hiddenAt: null, owners: { some: { claimStatus: "APPROVED" } } },
    },
    select: { id: true, jobTitle: true, workType: true, company: { select: { id: true, name: true, city: true } } },
    orderBy: { createdAt: "desc" },
  });

  // The row follows the signed-in member's kind of work (an Office member
  // sees Office ads first), so every kind gets enough ads to fill it: up to
  // PER_TYPE of each, one per company within a kind.
  const picked: typeof candidates = [];
  const perType = new Map<string, Set<string>>();
  for (const c of candidates) {
    const key = c.workType ?? "NONE";
    if (key === "NONE") continue;
    const companies = perType.get(key) ?? new Set<string>();
    if (companies.size >= PER_TYPE || companies.has(c.company.id)) continue;
    companies.add(c.company.id);
    perType.set(key, companies);
    picked.push(c);
  }

  const now = new Date();
  const expires = new Date(now.getTime() + DAYS * 24 * 60 * 60 * 1000);
  await prisma.jobPosting.updateMany({
    where: { id: { in: picked.map((p) => p.id) } },
    data: {
      boostDurationDays: DAYS,
      boostIsFree: false,
      boostPaymentStatus: "PAID",
      boostStartedAt: now,
      boostExpiresAt: expires,
      boostAdSpace: false,
      // Counts as freshly posted, so none of them has run out.
      lastResharedAt: now,
    },
  });

  mkdirSync(join(process.cwd(), "uploads"), { recursive: true });
  const before = existsSync(RECORD) ? (JSON.parse(readFileSync(RECORD, "utf8")) as string[]) : [];
  writeFileSync(RECORD, JSON.stringify([...new Set([...before, ...picked.map((p) => p.id)])]));
  for (const p of picked) {
    console.log(`Featured until ${expires.toISOString().slice(0, 10)}: ${p.jobTitle} - ${p.company.name} (${p.company.city ?? "no city"}, ${p.workType})`);
  }
}

(process.argv.includes("--undo") ? undo() : seed())
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

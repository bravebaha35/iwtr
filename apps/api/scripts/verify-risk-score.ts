// apps/api/scripts/verify-risk-score.ts
// Run from apps/api: pnpm exec ts-node scripts/verify-risk-score.ts
//
// Live end-to-end check of the Risk Score feature against the real dev DB,
// using the existing demo-finans-holding company: post a role, mark it
// filled, repost the identical role, confirm riskScore reads back as 1 via
// the real JobPostingsService/CompaniesService — repeat to confirm the cap
// at 3. Prints every intermediate state so the run is auditable, not just
// "PASS"/"FAIL".
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { JobPostingsService } from "../src/modules/job-postings/job-postings.service";
import { CompaniesService } from "../src/modules/companies/companies.service";
import { PrismaService } from "../src/prisma/prisma.service";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const jobPostings = app.get(JobPostingsService);
  const companies = app.get(CompaniesService);
  const prisma = app.get(PrismaService);

  const company = await prisma.company.findUnique({ where: { slug: "demo-finans-holding" } });
  if (!company) throw new Error("demo-finans-holding not found — seed it first.");

  const owner = await prisma.companyOwner.findFirst({ where: { companyId: company.id, claimStatus: "APPROVED" } });
  if (!owner) throw new Error("demo-finans-holding has no approved owner to post as.");

  const workType = company.workplaceTypes[0] as "OFFICE" | "HYBRID_REMOTE" | "SERVICE" | "MANUAL_LABOUR";
  // Deliberately sentence case, NOT "Risk Score Verification Role" (Title
  // Case) — two consecutive capitalized words trips ModerationService's
  // NAME_LIKE_PATTERN heuristic (built to catch doxxing, e.g. "CEO Ahmet
  // Yılmaz"), which routes create() to PENDING_ADMIN instead of PUBLISHED
  // and makes markFilled() reject it ("Only a published posting can be
  // marked filled."). Verified empirically against the live regex and the
  // real company-name table before this script was run for real — see
  // task-11-report.md. Keep this sentence-cased if you ever edit this title.
  const jobTitle = `Risk score verification role ${Date.now()}`;

  console.log(`Using company "${company.name}" (${company.id}), owner user ${owner.userId}, workType ${workType}`);
  console.log(`Starting riskScore: ${company.riskScore}`);

  for (let round = 1; round <= 4; round++) {
    const created = await jobPostings.create(owner.userId, company.id, {
      jobTitle,
      description: `Verification round ${round}`,
      workType,
      autoReshareEnabled: false,
      boost: null,
    });
    if (created.status !== "PUBLISHED" && created.status !== "PENDING_ADMIN") {
      throw new Error(`Unexpected create() status: ${created.status}`);
    }
    console.log(`Round ${round}: created posting ${created.jobPosting.id}, status ${created.jobPosting.status}`);

    const afterCreate = await prisma.company.findUnique({ where: { id: company.id }, select: { riskScore: true } });
    console.log(`Round ${round}: Company.riskScore after create = ${afterCreate?.riskScore}`);

    await jobPostings.markFilled(owner.userId, company.id, created.jobPosting.id);
    console.log(`Round ${round}: marked ${created.jobPosting.id} FILLED`);
  }

  const finalCompany = await companies.getBySlug("demo-finans-holding");
  console.log(`Final riskScore via CompaniesService.getBySlug (the real public API payload): ${finalCompany.company.riskScore}`);
  if (finalCompany.company.riskScore !== 3) {
    throw new Error(`Expected riskScore to cap at 3, got ${finalCompany.company.riskScore}`);
  }
  console.log("Risk Score verification PASSED — capped correctly at 3 after 4 repost-after-filled rounds.");

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

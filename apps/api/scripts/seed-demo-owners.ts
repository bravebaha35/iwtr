// Dev-only: gives every company that shows a paid badge (Company.badgeTier
// above FREE) but has no approved owner a named demo owner, so the data
// matches what real use produces - a badge always means someone owns the
// company (it mirrors the owner's plan), and every owner is known by their
// real name (see OwnerService.claimCompany).
//
// seed-demo-showcase.ts handed out paid badges and Social posts without
// creating owners, which left "Claim this company" showing on companies that
// look owned. Each demo owner:
//   - is an ACTIVE COMPANY_OWNER account, demo-owner+<slug>@iworkedthere.example
//     (never logged into - random password);
//   - owns the company with an APPROVED claim on the company's current
//     badge tier, plan ACTIVE, name shown in messages;
//   - has a made-up Turkish first/last name in their employer profile.
//
// Safe to re-run: companies that already have an approved owner are skipped.
//
// Run from apps/api: pnpm exec ts-node --transpile-only scripts/seed-demo-owners.ts

import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { PrismaService } from "../src/prisma/prisma.service";
import { EmployerProfileService } from "../src/modules/employer-profile/employer-profile.service";

const FIRST_NAMES = ["Ayşe", "Mehmet", "Elif", "Mustafa", "Zeynep", "Emre", "Fatma", "Burak", "Selin", "Can", "Deniz", "Hakan"];
const LAST_NAMES = ["Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Aydın", "Öztürk", "Arslan", "Doğan", "Koç", "Kurt"];

async function main() {
  const prisma = new PrismaService();
  const employerProfile = new EmployerProfileService(prisma);

  const companies = await prisma.company.findMany({
    where: { badgeTier: { not: "FREE" }, owners: { none: { claimStatus: "APPROVED" } } },
    select: { id: true, slug: true, name: true, badgeTier: true },
    orderBy: { name: "asc" },
  });

  for (const [i, company] of companies.entries()) {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[(i * 5 + 3) % LAST_NAMES.length];
    const passwordHash = await bcrypt.hash(randomBytes(24).toString("hex"), 12);

    const user = await prisma.user.upsert({
      where: { email: `demo-owner+${company.slug}@iworkedthere.example` },
      create: {
        email: `demo-owner+${company.slug}@iworkedthere.example`,
        authProvider: "EMAIL",
        passwordHash,
        role: "COMPANY_OWNER",
        status: "ACTIVE",
        country: "Turkey",
        displayName: `${firstName} ${lastName}`,
        phoneVerifiedAt: new Date(),
      },
      update: { role: "COMPANY_OWNER", status: "ACTIVE" },
    });

    await prisma.companyOwner.upsert({
      where: { userId_companyId: { userId: user.id, companyId: company.id } },
      create: {
        userId: user.id,
        companyId: company.id,
        claimStatus: "APPROVED",
        resolvedAt: new Date(),
        tier: company.badgeTier,
        planStatus: "ACTIVE",
        showNameInMessages: true,
      },
      update: { claimStatus: "APPROVED", tier: company.badgeTier, planStatus: "ACTIVE", showNameInMessages: true },
    });
    await employerProfile.saveClaimantName(user.id, firstName, lastName);
    await prisma.company.update({ where: { id: company.id }, data: { isVerifiedBadge: true } });

    console.log(`${company.name} (${company.badgeTier}): owner ${firstName} ${lastName}`);
  }
  console.log(`Done - ${companies.length} ${companies.length === 1 ? "company" : "companies"} got a demo owner.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

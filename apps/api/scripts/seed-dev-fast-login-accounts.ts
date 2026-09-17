// Sets up the two extra local-dev fast-login accounts requested alongside
// the existing "Dev: Log in as Admin" button (AuthModal.tsx):
//
//   1. Grants the existing "I Worked There" owner account
//      (grant-iwtr-ownership.ts) approved ownership of "Demo Finans Holding"
//      too, so one dev login covers both companies.
//   2. Seeds a fully-onboarded MEMBER test account (Mehmet Ahmetoğlu) with
//      real PiiVault identity, employment history against the seeded demo
//      companies, and an avatar — for testing the CV / job-application send
//      flow without redoing onboarding by hand every time.
//
// Requires: grant-iwtr-ownership.ts already run (for step 1) and
// reset-to-demo-companies.ts already run (for both steps' company lookups).
// Safe to re-run — everything here is an upsert.
//
// Run from apps/api: pnpm exec ts-node scripts/seed-dev-fast-login-accounts.ts
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaService } from "../src/prisma/prisma.service";
import { PiiVaultService } from "../src/modules/pii-vault/pii-vault.service";
import { pickRandomDisplayUsername, workTypeFromAvatarKey } from "../src/modules/reviews/randomized-identity.util";

const PASSWORD_SALT_ROUNDS = 12;
const OWNER_EMAIL = "iworkedthere@hotmail.com";
const TEST_MEMBER_EMAIL = "mehmet.ahmetoglu.test@iworkedthere.dev";

async function grantDemoFinansOwnership(prisma: PrismaService) {
  const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  if (!owner) {
    console.log(
      `Skipping Demo Finans Holding grant — no user found with email ${OWNER_EMAIL} yet (register it, then run grant-iwtr-ownership.ts first).`,
    );
    return;
  }

  const company = await prisma.company.findFirst({
    where: { name: { equals: "Demo Finans Holding", mode: "insensitive" } },
  });
  if (!company) {
    console.log('Skipping Demo Finans Holding grant — no company named "Demo Finans Holding" found (run reset-to-demo-companies.ts first).');
    return;
  }

  await prisma.companyOwner.upsert({
    where: { userId_companyId: { userId: owner.id, companyId: company.id } },
    create: {
      userId: owner.id,
      companyId: company.id,
      claimStatus: "APPROVED",
      resolvedAt: new Date(),
      tier: "ENTERPRISE",
      planStatus: "ACTIVE",
    },
    update: { claimStatus: "APPROVED", resolvedAt: new Date(), tier: "ENTERPRISE", planStatus: "ACTIVE" },
  });
  console.log(`Granted ${OWNER_EMAIL} approved ownership of "${company.name}".`);
}

async function seedTestMember(prisma: PrismaService, piiVault: PiiVaultService) {
  // Never actually used to log in (the dev-member-login endpoint skips
  // password entirely) — just satisfies the non-null convention every other
  // EMAIL-provider account follows.
  const passwordHash = await bcrypt.hash(`dev-only-${Math.random().toString(36).slice(2)}`, PASSWORD_SALT_ROUNDS);
  const avatarKey = "office_2";
  const avatarGradient = "ocean";
  const reviewUsername = pickRandomDisplayUsername(workTypeFromAvatarKey(avatarKey));

  const user = await prisma.user.upsert({
    where: { email: TEST_MEMBER_EMAIL },
    create: {
      email: TEST_MEMBER_EMAIL,
      authProvider: "EMAIL",
      passwordHash,
      role: "MEMBER",
      status: "ACTIVE",
      country: "Turkey",
      city: "İstanbul",
      district: "Şişli",
      avatarKey,
      avatarGradient,
      reviewUsername,
      displayName: "Mehmet Ahmetoğlu",
      phoneVerifiedAt: new Date(),
    },
    update: {
      role: "MEMBER",
      status: "ACTIVE",
      country: "Turkey",
      city: "İstanbul",
      district: "Şişli",
      avatarKey,
      avatarGradient,
      displayName: "Mehmet Ahmetoğlu",
    },
  });

  // Real envelope-encrypted PiiVault write, through the one service allowed
  // to touch that table — same call the real onboarding PII step makes.
  await piiVault.submitPii(user.id, {
    firstName: "Mehmet",
    lastName: "Ahmetoğlu",
    birthDate: "1971-05-01",
    country: "Turkey",
    city: "İstanbul",
    district: "Şişli",
  });

  const companies = await prisma.company.findMany({
    where: { name: { in: ["Demo Finans Holding", "Demo Teknoloji A.Ş."] } },
  });
  const byName = new Map(companies.map((c) => [c.name, c]));
  const financeCompany = byName.get("Demo Finans Holding");
  const techCompany = byName.get("Demo Teknoloji A.Ş.");

  // Re-seedable: drop and recreate rather than upsert-by-guessed-id, since
  // this script owns this account's whole employment history.
  await prisma.employmentHistory.deleteMany({ where: { userId: user.id } });
  const entries = [
    financeCompany && {
      userId: user.id,
      rawCompanyName: financeCompany.name,
      companyId: financeCompany.id,
      jobTitle: "Muhasebe Uzmanı",
      startDate: new Date("2010-03-01"),
      endDate: new Date("2019-06-30"),
    },
    techCompany && {
      userId: user.id,
      rawCompanyName: techCompany.name,
      companyId: techCompany.id,
      jobTitle: "Yazılım Geliştirici",
      startDate: new Date("2019-09-01"),
      endDate: null,
    },
  ].filter((e): e is NonNullable<typeof e> => Boolean(e));

  if (entries.length > 0) {
    await prisma.employmentHistory.createMany({ data: entries });
  } else {
    console.log("Skipping employment history — neither demo company was found (run reset-to-demo-companies.ts first).");
  }

  console.log(
    `Seeded MEMBER test account ${TEST_MEMBER_EMAIL} (Mehmet Ahmetoğlu), status ACTIVE, ${entries.length} employment-history ${entries.length === 1 ? "entry" : "entries"}.`,
  );
}

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const piiVault = new PiiVaultService(prisma);

  await grantDemoFinansOwnership(prisma);
  await seedTestMember(prisma, piiVault);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

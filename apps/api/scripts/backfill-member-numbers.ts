// One-off backfill: assigns User.memberNumber to every existing account that
// doesn't have one yet (the column is nullable specifically to support this
// — see schema.prisma). New accounts get one automatically at registration
// (AuthService.registerWithEmail); this only needs to run once per
// environment, but is safe to re-run (only touches rows where memberNumber
// is still null).
//
// Run from apps/api: pnpm exec ts-node scripts/backfill-member-numbers.ts

import "dotenv/config";
import { PrismaService } from "../src/prisma/prisma.service";
import { generateUniqueMemberNumber } from "../src/modules/auth/member-number.util";

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();

  const users = await prisma.user.findMany({ where: { memberNumber: null }, select: { id: true, email: true } });
  console.log(`Found ${users.length} user(s) without a member number.`);

  for (const user of users) {
    const memberNumber = await generateUniqueMemberNumber(prisma);
    await prisma.user.update({ where: { id: user.id }, data: { memberNumber } });
    console.log(`  ${user.email ?? user.id}: ${memberNumber}`);
  }

  console.log("Done.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

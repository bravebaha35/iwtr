// One-off backfill: assigns User.reviewUsername to every existing account
// that doesn't have one yet — replaces the old backfill-member-numbers.ts,
// which backfilled the numeric memberNumber system this one fully retired.
// New accounts get one automatically at onboarding's avatar-selection step
// (OnboardingService.submitAvatar); this only needs to run once per
// environment, but is safe to re-run (only touches rows still null).
//
// Run from apps/api: pnpm exec ts-node scripts/backfill-review-usernames.ts

import "dotenv/config";
import { PrismaService } from "../src/prisma/prisma.service";
import { pickRandomDisplayUsername, workTypeFromAvatarKey } from "../src/modules/reviews/randomized-identity.util";

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();

  const users = await prisma.user.findMany({
    where: { reviewUsername: null },
    select: { id: true, email: true, avatarKey: true },
  });
  console.log(`Found ${users.length} user(s) without a reviewUsername.`);

  for (const user of users) {
    // No avatarKey yet (still mid-onboarding, before the avatar step) means
    // no work-type category to draw from — leave those for
    // OnboardingService.submitAvatar to assign when they actually get there.
    if (!user.avatarKey) {
      console.log(`  ${user.email ?? user.id}: skipped (no avatarKey yet)`);
      continue;
    }
    const reviewUsername = pickRandomDisplayUsername(workTypeFromAvatarKey(user.avatarKey));
    await prisma.user.update({ where: { id: user.id }, data: { reviewUsername } });
    console.log(`  ${user.email ?? user.id}: ${reviewUsername}`);
  }

  console.log("Done.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

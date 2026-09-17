// One-off backfill: every account that existed before User.workType was
// added (Task 1) has its work-type implicitly encoded in avatarKey's
// prefix ("office_"/"remote_"/"service_"/"manual_") but no explicit
// workType value yet. This copies that implicit value into the new column
// once — going forward, workType is set explicitly (Personal Information
// tab / onboarding), never re-derived. Safe to re-run: only touches rows
// where workType IS NULL.
//
// Run from apps/api: pnpm exec ts-node scripts/backfill-user-worktype-from-avatar.ts
import "dotenv/config";
import { PrismaClient, WorkplaceType } from "@prisma/client";

const prisma = new PrismaClient();

function workTypeFromAvatarKey(avatarKey: string): WorkplaceType {
  if (avatarKey.startsWith("remote_")) return "HYBRID_REMOTE";
  if (avatarKey.startsWith("service_")) return "SERVICE";
  if (avatarKey.startsWith("manual_")) return "MANUAL_LABOUR";
  return "OFFICE";
}

async function main() {
  const users = await prisma.user.findMany({
    where: { workType: null, avatarKey: { not: null } },
    select: { id: true, avatarKey: true },
  });

  let updated = 0;
  for (const u of users) {
    await prisma.user.update({
      where: { id: u.id },
      data: { workType: workTypeFromAvatarKey(u.avatarKey!) },
    });
    updated++;
  }

  console.log(`Backfilled workType for ${updated} of ${users.length} candidate users.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

// One-off bootstrap for the platform's single hardcoded admin account.
//
// Deliberately NOT the public POST /auth/register endpoint: that endpoint
// restricts signups to a short consumer-email allowlist (gmail/hotmail/
// outlook/windowslive — see registerEmailInputSchema in shared-types), which
// a real @iworkedthere.com address would fail. This script writes the User
// row directly instead, going through the exact same bcrypt hashing
// AuthService.registerWithEmail uses so the account logs in through the
// normal /auth/login + admin OTP flow like anything else with role=ADMIN.
//
// The password is read from an environment variable, never hardcoded here
// or anywhere else in this repo — nothing about this script's own source
// ever needs to change to rotate it. Run it once locally:
//
//   ADMIN_SEED_EMAIL="info@iworkedthere.com" ADMIN_SEED_PASSWORD="..." \
//     pnpm exec ts-node scripts/seed-admin.ts
//
// (or set those two vars in your shell for a single command however your
// terminal prefers). Safe to re-run — it upserts by email, so running it
// again with a new ADMIN_SEED_PASSWORD is also how you rotate the password
// later without touching any code.
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const PASSWORD_SALT_ROUNDS = 12;

async function main() {
  const email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD in the environment before running this script — see the comment at the top of scripts/seed-admin.ts.",
    );
  }
  if (password.length < 12) {
    throw new Error("ADMIN_SEED_PASSWORD is too short — use at least 12 characters.");
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        authProvider: "EMAIL",
        passwordHash,
        role: "ADMIN",
        // Skips the PENDING_PHONE -> ... -> ACTIVE onboarding ladder
        // entirely — none of that (phone OTP, PII, employment history,
        // avatar) applies to this account.
        status: "ACTIVE",
      },
      update: {
        passwordHash,
        role: "ADMIN",
      },
    });
    // eslint-disable-next-line no-console
    console.log(`[seed-admin] OK — ${user.email} is role=ADMIN (id=${user.id}). Password was set, not printed.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`[seed-admin] Failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});

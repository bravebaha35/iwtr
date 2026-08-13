import { randomInt } from "node:crypto";
import type { PrismaService } from "../../prisma/prisma.service";

// 11 digits, each 1-9 — "0" is excluded on purpose (per product spec), which
// also conveniently means every digit reads unambiguously in any font/locale.
// Keyspace is 9^11 (~31 billion), so a collision is astronomically unlikely,
// but generateUniqueMemberNumber still checks the DB rather than trusting
// probability alone.
const MEMBER_NUMBER_LENGTH = 11;
const DIGITS = "123456789";
const MAX_ATTEMPTS = 10;

function randomMemberNumber(): string {
  let out = "";
  for (let i = 0; i < MEMBER_NUMBER_LENGTH; i++) {
    out += DIGITS[randomInt(DIGITS.length)];
  }
  return out;
}

export async function generateUniqueMemberNumber(prisma: PrismaService): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = randomMemberNumber();
    const existing = await prisma.user.findUnique({ where: { memberNumber: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }
  throw new Error(`Could not generate a unique member number after ${MAX_ATTEMPTS} attempts`);
}

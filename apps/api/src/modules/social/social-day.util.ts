import type { PrismaClient } from "@prisma/client";

// The client itself or a transaction on it.
type Db = Pick<PrismaClient, "companySocialDay">;
export type SocialDayCounter = "postViews" | "followersGained" | "followersLost";

// Days are counted on Turkey's clock (UTC+3 all year, no summer time), so an
// owner's "today" turns over at their midnight, not at three in the morning.
export const SOCIAL_DAY_OFFSET_HOURS = 3;

/**
 * The calendar day in Turkey that `at` falls on, as the date a
 * CompanySocialDay row is keyed by (stored as that date at midnight UTC).
 */
export function socialDay(at: Date = new Date()): Date {
  const local = new Date(at.getTime() + SOCIAL_DAY_OFFSET_HOURS * 3_600_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

/** The moment that day began. */
export function socialDayStart(day: Date): Date {
  return new Date(day.getTime() - SOCIAL_DAY_OFFSET_HOURS * 3_600_000);
}

/** "2026-10-14" for a day from socialDay. */
export function dayKey(day: Date): string {
  return day.toISOString().slice(0, 10);
}

/**
 * Adds `by` to one of a company's counters for today (CompanySocialDay). One
 * statement, so two requests at once both count. Never give it anything that
 * says who: these rows are counts and nothing else.
 */
export function bumpSocialDay(db: Db, companyId: string, counter: SocialDayCounter, by = 1) {
  const day = socialDay();
  return db.companySocialDay.upsert({
    where: { companyId_day: { companyId, day } },
    create: { companyId, day, [counter]: by },
    update: { [counter]: { increment: by } },
  });
}

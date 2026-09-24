/**
 * Review-related timestamps are stored and shown only to the UTC day, never
 * the exact moment: an exact time ("posted 14:03 on Tuesday") is something
 * an employer could line up against who was at their desk, so it's a
 * re-identification risk for an anonymous reviewer. The columns' own
 * defaults do the same truncation in the database (see schema.prisma's
 * DAY_PRECISION_DEFAULT comment); this helper covers the timestamps the
 * code sets itself (publishedAt).
 */
export function toUtcDay(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

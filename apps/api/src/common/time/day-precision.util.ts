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

/**
 * IWT Social posts and comments are shown only to the hour ("1h ago",
 * "3h ago" - never "4m ago"): a minute-exact time next to an anonymous
 * comment is the same re-identification risk as above. The database keeps
 * the exact moment (the legal record, visible to admins only); this is
 * applied to everything sent to members and companies.
 */
export function toUtcHour(date: Date): Date {
  const hour = new Date(date);
  hour.setUTCMinutes(0, 0, 0);
  return hour;
}

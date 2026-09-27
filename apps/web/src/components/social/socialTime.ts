// "1h ago", "3h ago", "2d ago", "1w ago", "3mo ago", "1y ago" - compact
// relative time for IWT Social posts and comments. Never finer than an hour:
// the API only sends the hour (a minute-exact time next to an anonymous
// comment could single its writer out), so anything newer reads "1h ago".
// No library.
export function shortRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hr = Math.max(1, Math.floor(diffMs / 3_600_000));
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const week = Math.floor(day / 7);
  if (day < 30) return `${week}w ago`;
  const month = Math.floor(day / 30);
  if (day < 365) return `${month}mo ago`;
  const year = Math.floor(day / 365);
  return `${year}y ago`;
}

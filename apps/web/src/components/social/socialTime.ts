// "3h", "2d", "1w", "3mo", "1y", "just now" - compact relative time for feed
// cards. No library.
export function shortRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  const week = Math.floor(day / 7);
  if (day < 30) return `${week}w`;
  const month = Math.floor(day / 30);
  if (day < 365) return `${month}mo`;
  const year = Math.floor(day / 365);
  return `${year}y`;
}

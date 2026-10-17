import { intlLocale, type Locale } from "@/lib/i18n/core";

// "1h ago", "3h ago", "2d ago", "1w ago", "3mo ago", "1y ago" - compact
// relative time for IWT Social posts and comments. Never finer than an hour:
// the API only sends the hour (a minute-exact time next to an anonymous
// comment could single its writer out), so anything newer reads "1h ago".
// No library.
// Turkish: "3 sa önce", "2 gün önce", "1 hf önce", "3 ay önce", "1 yıl önce".
const UNITS: Record<Locale, { h: string; d: string; w: string; mo: string; y: string }> = {
  en: { h: "{n}h ago", d: "{n}d ago", w: "{n}w ago", mo: "{n}mo ago", y: "{n}y ago" },
  tr: { h: "{n} sa önce", d: "{n} gün önce", w: "{n} hf önce", mo: "{n} ay önce", y: "{n} yıl önce" },
};

export function shortRelativeTime(iso: string, locale: Locale = "en"): string {
  const u = UNITS[locale];
  const say = (template: string, n: number) => template.replace("{n}", String(n));
  const diffMs = Date.now() - new Date(iso).getTime();
  const hr = Math.max(1, Math.floor(diffMs / 3_600_000));
  if (hr < 24) return say(u.h, hr);
  const day = Math.floor(hr / 24);
  if (day < 7) return say(u.d, day);
  const week = Math.floor(day / 7);
  if (day < 30) return say(u.w, week);
  const month = Math.floor(day / 30);
  if (day < 365) return say(u.mo, month);
  const year = Math.floor(day / 365);
  return say(u.y, year);
}

// "Thu 16 Oct, 09:00" - when a scheduled post goes out, on the viewer's own
// clock. Exact on purpose: it is the owner's own plan, not a record of what a
// member did.
export function formatScheduledTime(iso: string, locale: Locale = "en"): string {
  return new Date(iso).toLocaleString(intlLocale(locale), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

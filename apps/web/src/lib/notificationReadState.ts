// Which notifications this browser has already marked read, so the header
// bell's dot doesn't come back on every page load. Only notification ids
// are stored (never their content), capped to the most recent ones, and the
// whole record is wiped on sign-out (auth-context logout) so the next
// account on a shared computer starts clean.
const STORAGE_KEY = "iwtr:notifications-read";
const MAX_IDS = 200;

export function readNotificationIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function markNotificationIdsRead(ids: Iterable<string>): void {
  const merged = [...readNotificationIds(), ...ids];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(merged)].slice(-MAX_IDS)));
  } catch {
    // Storage blocked: read state lasts for this page view only.
  }
}

export function clearNotificationReadState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored.
  }
}

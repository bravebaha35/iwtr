// The subset of JobPosting fields every lifecycle calculation below needs.
// A plain interface (not imported from @prisma/client) so these functions
// stay pure and trivially unit-testable without a DB.
export interface PostingLifecycleFields {
  status: "PUBLISHED" | "PENDING_ADMIN" | "REJECTED" | "FILLED";
  createdAt: Date;
  lastResharedAt: Date | null;
  filledAt: Date | null;
  autoReshareEnabled: boolean;
}

const LIVE_WINDOW_DAYS = 30;
const GRACE_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// When this posting's current "live run" started — resets every time it's
// lazily reshared, so a reshared posting gets a fresh 30-day window from
// that point, not from its original createdAt.
export function effectivePostDate(p: Pick<PostingLifecycleFields, "createdAt" | "lastResharedAt">): Date {
  return p.lastResharedAt ?? p.createdAt;
}

// The moment this posting stopped (or, for a still-live PUBLISHED posting,
// will stop) being publicly visible. FILLED postings end the moment they
// were marked filled; everything else ends 30 days after its effective
// post date.
export function liveEndDate(p: PostingLifecycleFields): Date {
  if (p.status === "FILLED") {
    return p.filledAt ?? p.createdAt;
  }
  const end = new Date(effectivePostDate(p));
  end.setDate(end.getDate() + LIVE_WINDOW_DAYS);
  return end;
}

// Whole days left before this posting stops being publicly live. Always 0
// for anything not currently PUBLISHED (a FILLED/REJECTED/PENDING_ADMIN
// posting has no "days remaining" to count down).
export function daysRemaining(p: PostingLifecycleFields, now: Date = new Date()): number {
  if (p.status !== "PUBLISHED") return 0;
  return Math.max(0, Math.ceil((liveEndDate(p).getTime() - now.getTime()) / MS_PER_DAY));
}

// Whole days since this posting's live end (0 while still live or exactly
// at the boundary). Drives the 30-day grace window below.
export function daysPastLiveEnd(p: PostingLifecycleFields, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((now.getTime() - liveEndDate(p).getTime()) / MS_PER_DAY));
}

// True while a posting should still show up in the owner's own dashboard or
// a worker's Saved Posts list — either because it's still genuinely live,
// or because it's within the 30-day grace period after it stopped being
// live (whether that was a natural expiry or a manual mark-filled).
export function isWithinSavedGraceWindow(p: PostingLifecycleFields, now: Date = new Date()): boolean {
  if (p.status === "PUBLISHED" && daysRemaining(p, now) > 0) return true;
  return daysPastLiveEnd(p, now) <= GRACE_WINDOW_DAYS;
}

// True exactly when a listing query should bump lastResharedAt right now —
// the entire "no cron" mechanism. Only ever true for a PUBLISHED posting
// that opted in and has genuinely run out its 30 days.
export function shouldLazyReshare(p: PostingLifecycleFields, now: Date = new Date()): boolean {
  return p.status === "PUBLISHED" && p.autoReshareEnabled && daysRemaining(p, now) === 0;
}

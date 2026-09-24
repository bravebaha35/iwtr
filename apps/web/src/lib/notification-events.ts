// A tiny browser-side signal that "the notifications list has something
// new" — e.g. SectorBenchmarkTile fires it the moment a report it was
// watching turns READY, so the header bell refetches right away instead of
// waiting for the next page load. No payload; listeners just refetch.
export const NOTIFICATIONS_STALE_EVENT = "iwtr:notifications-stale";

export function announceNewNotifications(): void {
  window.dispatchEvent(new Event(NOTIFICATIONS_STALE_EVENT));
}

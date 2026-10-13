import type { PublicSocialPost, SocialRail } from "@iwtr/shared-types";

// What IWT Social last showed, kept in memory for this visit so coming back
// to a list (another tab of the feed, back from a post's page, back from a
// company) shows it at once instead of an empty wait; the list is still
// read again behind it. Nothing here outlives a page reload, and it is
// emptied when the person signs in or out, since likes, votes and saves in
// it belong to whoever was looking.

export interface CachedFeed {
  posts: PublicSocialPost[];
  nextCursor: string | null;
}

const MAX_FEEDS = 24;
const feeds = new Map<string, CachedFeed>();
let rail: SocialRail | null = null;

export function readFeed(key: string): CachedFeed | undefined {
  return feeds.get(key);
}

export function writeFeed(key: string, feed: CachedFeed): void {
  feeds.delete(key);
  feeds.set(key, feed);
  while (feeds.size > MAX_FEEDS) feeds.delete(feeds.keys().next().value!);
}

export function readRail(): SocialRail | null {
  return rail;
}

export function writeRail(next: SocialRail): void {
  rail = next;
}

export function clearSocialCache(): void {
  feeds.clear();
  rail = null;
}

// A new post was just published from this page: every list on it reads
// itself again, instead of the whole page being reloaded.
const postedListeners = new Set<() => void>();

export function onSocialPosted(listener: () => void): () => void {
  postedListeners.add(listener);
  return () => {
    postedListeners.delete(listener);
  };
}

export function notifySocialPosted(): void {
  clearSocialCache();
  postedListeners.forEach((l) => l());
}

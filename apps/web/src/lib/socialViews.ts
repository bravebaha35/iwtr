import { useEffect, type RefObject } from "react";
import { SOCIAL_VIEW_BATCH_MAX } from "@iwtr/shared-types";

// A post counts as seen once this much of its card has been on screen for
// this long - scrolling straight past is not a view.
const SEEN_RATIO = 0.4;
const SEEN_AFTER_MS = 1000;
// Seen posts are reported together, this long after the first one.
const SEND_AFTER_MS = 2000;

// Posts already reported during this page visit. The API has the final say
// on what counts (once per member per post in 12 hours); this only saves the
// request.
const reported = new Set<string>();
let waiting: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let leaveHooked = false;

function send(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  if (waiting.length === 0) return;
  const postIds = waiting.splice(0, SOCIAL_VIEW_BATCH_MAX);
  // keepalive: the last few still go out when the page is being left.
  // Nothing on the page waits for this, and a failure only loses a count.
  fetch("/api/proxy/social/views", {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postIds }),
  }).catch(() => undefined);
  if (waiting.length > 0) timer = setTimeout(send, SEND_AFTER_MS);
}

/** Queues one "this member saw this post" for the company's view count. */
export function reportPostSeen(postId: string): void {
  if (reported.has(postId)) return;
  reported.add(postId);
  waiting.push(postId);
  if (!leaveHooked && typeof window !== "undefined") {
    leaveHooked = true;
    window.addEventListener("pagehide", send);
  }
  if (waiting.length >= SOCIAL_VIEW_BATCH_MAX) send();
  else timer ??= setTimeout(send, SEND_AFTER_MS);
}

/** For tests: forget everything reported so far. */
export function resetSocialViews(): void {
  reported.clear();
  waiting = [];
  if (timer) clearTimeout(timer);
  timer = null;
}

/**
 * Reports a post as seen once its card has really been on screen. Only a
 * member's look counts (the caller passes `enabled`): the number is the
 * company's measure of its audience, so an owner or admin browsing is left
 * out, and so is anyone signed out.
 */
export function usePostSeen(ref: RefObject<HTMLElement | null>, postId: string, enabled: boolean): void {
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || typeof IntersectionObserver === "undefined") return;
    let dwell: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          dwell ??= setTimeout(() => {
            reportPostSeen(postId);
            observer.disconnect();
          }, SEEN_AFTER_MS);
        } else if (dwell) {
          clearTimeout(dwell);
          dwell = null;
        }
      },
      { threshold: SEEN_RATIO },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (dwell) clearTimeout(dwell);
    };
  }, [ref, postId, enabled]);
}

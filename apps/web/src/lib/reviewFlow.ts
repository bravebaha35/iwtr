"use client";

import { useSyncExternalStore } from "react";

// Whether the anonymous review form (RateButton.tsx) is open right now.
// AnalyticsLoader switches analytics off for as long as it is.
let active = false;
const listeners = new Set<() => void>();

export function setReviewFlowActive(value: boolean): void {
  if (active === value) return;
  active = value;
  listeners.forEach((l) => l());
}

export function useReviewFlowActive(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => active,
    () => false,
  );
}

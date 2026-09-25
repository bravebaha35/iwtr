"use client";

import { useSyncExternalStore } from "react";
import type { CookieConsent } from "./analyticsPolicy";

const STORAGE_KEY = "iwtr:cookie-consent";
const listeners = new Set<() => void>();
let cached: CookieConsent | undefined;

function read(): CookieConsent {
  if (cached !== undefined) return cached;
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    cached = value === "accepted" || value === "declined" ? value : null;
  } catch {
    // Storage blocked (private mode, strict settings): ask every visit.
    cached = null;
  }
  return cached;
}

export function setConsent(value: Exclude<CookieConsent, null>): void {
  cached = value;
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Still honoured for this page view.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The visitor's cookie-banner choice. `undefined` during server rendering
 * (unknown yet), so the banner never flashes for someone who already chose.
 */
export function useConsent(): CookieConsent | undefined {
  return useSyncExternalStore(subscribe, read, () => undefined);
}

export function resetConsentForTests(): void {
  cached = undefined;
  listeners.forEach((l) => l());
}

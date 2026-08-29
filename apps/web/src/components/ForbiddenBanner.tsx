"use client";

import { useState } from "react";

const COOKIE_NAME = "iwtr_forbidden_notice";

function readAndClearCookie(): boolean {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  if (!match) return false;
  // Expire it immediately — a refresh (or sharing the URL) shouldn't keep
  // re-showing this.
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
  return match[1] === "1";
}

// Read (and cleared) exactly once per real page load, at module scope
// rather than inside the component. Home's isLoading -> isAuthenticated
// transition renders a structurally different tree (a plain loading div vs.
// the OnboardingFlow/WorkplaceBrowser shell), so React unmounts and
// remounts everything at this position — including a fresh ForbiddenBanner
// instance with its state reset — the moment that transition happens,
// which for a freshly-redirected admin bounce is almost immediately after
// first mount. A module-level capture survives that remount because the
// module itself is only evaluated once per page load, regardless of how
// many times the component instance inside it gets torn down and rebuilt.
// Guarded for SSR, where `document` doesn't exist — the value there is
// irrelevant anyway since it's only ever read again client-side after
// hydration.
const wasForbidden = typeof document !== "undefined" && readAndClearCookie();

// Shown after proxy.ts (the /admin/* route gate) bounces a non-admin back
// to "/" — the actual block already happened server-side (both that
// redirect itself and, independently, every admin-companies/admin-queue
// endpoint's own RolesGuard); this is just telling the visitor why they
// landed back here instead of leaving them guessing.
export function ForbiddenBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (!wasForbidden || dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-3 bg-red-50 px-4 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
      <span>You don&apos;t have access to that page.</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="text-red-800/70 hover:text-red-800 dark:text-red-200/70 dark:hover:text-red-200"
      >
        ✕
      </button>
    </div>
  );
}

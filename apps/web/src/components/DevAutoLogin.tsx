"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";

// The official "I Worked There" owner account (apps/api/scripts/grant-iwtr-
// ownership.ts) — Enterprise tier, owns the platform's own company listing.
const DEV_OWNER_EMAIL = "iworkedthere@hotmail.com";

/**
 * Development-only convenience: skips the login screen entirely so a fresh
 * `pnpm dev` + localhost:3000 visit starts already inside the official
 * owner's dashboard, instead of clicking through AuthModal by hand every
 * reload. Attempts at most once per page load (an attemptedRef guard, not a
 * reactive effect on isAuthenticated) — a manual logout mid-session to test
 * the logged-out UI isn't immediately fought by this component re-firing.
 * The API 404s this call outright once NODE_ENV=production (see
 * AuthService.devOwnerLogin), so it's already inert in any real deployment
 * even before the NODE_ENV check below; that check just skips the network
 * request entirely rather than relying only on the server-side refusal.
 */
export function DevAutoLogin() {
  const { isAuthenticated, isLoading, devOwnerLogin } = useAuth();
  const attempted = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (isLoading || isAuthenticated || attempted.current) return;
    attempted.current = true;
    devOwnerLogin(DEV_OWNER_EMAIL).catch(() => {
      // No such account seeded yet (e.g. a fresh DB before
      // grant-iwtr-ownership.ts has run) — fall through to the normal
      // AuthModal login screen instead of failing the page.
    });
  }, [isLoading, isAuthenticated, devOwnerLogin]);

  return null;
}

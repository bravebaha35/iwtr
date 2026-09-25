"use client";

import { useAuth } from "@/lib/auth-context";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { WorkplaceBrowser } from "@/components/WorkplaceBrowser";
import { ForbiddenBanner } from "@/components/ForbiddenBanner";
import { AnonGate } from "@/components/auth/AnonGate";

export function HomeClient({ hasSessionCookie }: { hasSessionCookie: boolean }) {
  const { isLoading, isAuthenticated, onboardingStatus } = useAuth();

  // No session cookie at all = certainly logged out: skip the loading state
  // so the register prompt is in the server-rendered first paint.
  if (isLoading && hasSessionCookie) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <ForbiddenBanner />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Logged-in but hasn't finished onboarding still gets forced through that
  // flow — unrelated to whether a *visitor* is logged in at all. A fresh
  // login/register is authenticated but hasn't finished the onboarding-status
  // fetch yet (loadSession sets isAuthenticated first, then awaits the status
  // call) — treat "not loaded yet" as still loading, not as ACTIVE, so a
  // brand-new PENDING_PII account can't flash into the authenticated shell.
  if (isAuthenticated) {
    if (!onboardingStatus) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      );
    }
    if (onboardingStatus.status !== "ACTIVE") {
      return (
        <div className="relative min-h-screen">
          <OnboardingFlow />
        </div>
      );
    }
  }

  // No account, or fully onboarded — either way the homepage is the company
  // browser, but AnonGate blocks it entirely behind a Register prompt for a
  // logged-out visitor rather than letting them browse read-only.
  return (
    <>
      <ForbiddenBanner />
      <AnonGate
        assumeAnonymous={!hasSessionCookie}
        title="See what it's really like to work there"
        description="Register for free to browse company scores and read anonymous employee reviews."
      >
        <WorkplaceBrowser />
      </AnonGate>
    </>
  );
}

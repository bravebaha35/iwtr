"use client";

import { useAuth } from "@/lib/auth-context";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { WorkplaceBrowser } from "@/components/WorkplaceBrowser";

export default function Home() {
  const { isLoading, isAuthenticated, onboardingStatus } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
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
  // browser. A logged-out visitor gets it read-only (no Rate button, voting
  // disabled): GlobalHeader shows "Login/Register" (opens AuthModal, mounted
  // globally in layout.tsx) instead of forcing an auth screen before they can
  // see anything.
  return <WorkplaceBrowser />;
}

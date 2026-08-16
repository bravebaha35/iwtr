"use client";

import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth/AuthModal";
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

  if (!isAuthenticated) {
    return (
      <div className="relative min-h-screen">
        <AuthModal />
      </div>
    );
  }

  // A fresh login/register is authenticated but hasn't finished the
  // onboarding-status fetch yet (loadSession sets isAuthenticated first, then
  // awaits the status call) — treat "not loaded yet" as still loading, not as
  // ACTIVE, so a brand-new PENDING_PII account can't flash into the authenticated shell.
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

  // GlobalHeader (layout.tsx) already renders the brand bar, admin nav,
  // avatar/logout, and theme toggle on every page — this used to duplicate
  // all of that locally and lose it the moment you left the homepage.
  return <WorkplaceBrowser />;
}

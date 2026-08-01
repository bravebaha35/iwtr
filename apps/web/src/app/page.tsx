"use client";

import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth/AuthModal";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { CompanySearch } from "@/components/CompanySearch";

export default function Home() {
  const { isLoading, accessToken, onboardingStatus, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="relative min-h-screen bg-zinc-50 dark:bg-black">
        <AuthModal />
      </div>
    );
  }

  // A fresh login/register has a token but hasn't finished the onboarding-status
  // fetch yet (persistTokens sets the token synchronously, then awaits the
  // status call) — treat "not loaded yet" as still loading, not as ACTIVE,
  // so a brand-new PENDING_PII account can't flash into the authenticated shell.
  if (!onboardingStatus) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (onboardingStatus.status !== "ACTIVE") {
    return (
      <div className="relative min-h-screen bg-zinc-50 dark:bg-black">
        <OnboardingFlow />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">I Worked There</h1>
        <div className="flex items-center gap-4">
          <CompanySearch />
          <button
            onClick={logout}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-2xl">{onboardingStatus?.avatarKey ? "👋" : ""}</p>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          You&apos;re all set!
        </h2>
        <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
          Company search and reviews are coming next. Your account is fully onboarded and ready.
        </p>
      </main>
    </div>
  );
}

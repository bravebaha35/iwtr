"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth/AuthModal";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { CompanySearch } from "@/components/CompanySearch";

export default function Home() {
  const { isLoading, accessToken, role, onboardingStatus, logout } = useAuth();

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
          <nav className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
            <Link href="/my/companies" className="hover:text-zinc-900 dark:hover:text-zinc-50">
              My Companies
            </Link>
            {role === "ADMIN" && (
              <>
                <Link href="/admin/moderation" className="hover:text-zinc-900 dark:hover:text-zinc-50">
                  Moderation Queue
                </Link>
                <Link href="/admin/owner-claims" className="hover:text-zinc-900 dark:hover:text-zinc-50">
                  Owner Claims
                </Link>
              </>
            )}
          </nav>
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
          Search for a workplace above to see its score and reviews, or check &ldquo;My Companies&rdquo; if you
          manage a company profile.
        </p>
      </main>
    </div>
  );
}

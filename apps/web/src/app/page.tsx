"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { avatarEmoji } from "@/lib/avatars";
import { AuthModal } from "@/components/auth/AuthModal";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { CompanySearch } from "@/components/CompanySearch";
import { WorkplaceBrowser } from "@/components/WorkplaceBrowser";
import { Logo } from "@/components/Logo";

export default function Home() {
  const { isLoading, accessToken, role, onboardingStatus, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="relative min-h-screen">
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

  return (
    <div className="flex min-h-screen flex-col">
      {/* pr-20 (not the usual pr-6) leaves room for the fixed top-right
          SettingsPanel button so it doesn't sit on top of "Log out". */}
      <header className="flex items-center justify-between border-b border-border bg-surface py-4 pl-6 pr-20">
        <Link href="/" className="flex items-center gap-2">
          <Logo size="sm" />
          <span className="text-lg font-bold text-foreground">I Worked There</span>
        </Link>
        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/my/companies" className="hover:text-brand-600 dark:hover:text-brand-400">
              My Companies
            </Link>
            {role === "ADMIN" && (
              <>
                <Link href="/admin/moderation" className="hover:text-brand-600 dark:hover:text-brand-400">
                  Moderation Queue
                </Link>
                <Link href="/admin/owner-claims" className="hover:text-brand-600 dark:hover:text-brand-400">
                  Owner Claims
                </Link>
              </>
            )}
          </nav>
          <CompanySearch />
          <button onClick={logout} className="text-sm text-muted-foreground hover:text-foreground">
            Log out
          </button>
        </div>
      </header>

      <div className="flex flex-col items-center px-6 pt-10 text-center">
        <p className="text-3xl">{avatarEmoji(onboardingStatus?.avatarKey) ?? "🦫"}</p>
        <h2 className="mt-2 text-3xl font-bold text-foreground">Know before you go.</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Real, anonymous reviews from people who actually worked there.
        </p>
      </div>

      <WorkplaceBrowser defaultCity={onboardingStatus.city} />
    </div>
  );
}

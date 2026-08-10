"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { AuthModal } from "@/components/auth/AuthModal";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { WorkplaceBrowser } from "@/components/WorkplaceBrowser";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/Avatar";
import { avatarLabel } from "@/lib/avatars";

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
      <header className="flex items-center gap-4 border-b border-border bg-surface py-4 pl-6 pr-20">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Logo size="sm" />
          <span className="text-lg font-bold text-foreground">I Worked There</span>
        </Link>
        <div className="ml-auto flex items-center gap-4">
          {role === "ADMIN" && (
            <nav className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="/admin/moderation" className="hover:text-brand-600 dark:hover:text-brand-400">
                Moderation Queue
              </Link>
              <Link href="/admin/owner-claims" className="hover:text-brand-600 dark:hover:text-brand-400">
                Owner Claims
              </Link>
            </nav>
          )}
          <Link
            href="/me"
            className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-surface-muted"
          >
            <Avatar avatarKey={onboardingStatus.avatarKey} avatarGradient={onboardingStatus.avatarGradient} size="sm" />
            <span className="text-sm font-medium text-foreground">
              {onboardingStatus.displayName || avatarLabel(onboardingStatus.avatarKey) || "Anonymous"}
            </span>
          </Link>
          <button
            onClick={logout}
            aria-label="Log out"
            title="Log out"
            className="text-muted-foreground transition hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      <WorkplaceBrowser />
    </div>
  );
}

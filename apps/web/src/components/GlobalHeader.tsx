"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/Avatar";
import { avatarLabel } from "@/lib/avatars";
import { ThemeToggle } from "@/components/ThemeToggle";

// Sticky (not fixed) so it reserves its own space in normal flow and never
// needs a compensating top-padding hack on every page — it just stays
// pinned once scrolled to. Mounted once, globally (layout.tsx), so the
// brand bar and its controls stay visible on every page, not just the
// homepage, which used to build this same markup locally and lose it the
// moment you navigated anywhere else.
export function GlobalHeader() {
  const { isAuthenticated, role, onboardingStatus, logout, openAuthModal } = useAuth();
  const pathname = usePathname();
  const showAccountControls = isAuthenticated && onboardingStatus?.status === "ACTIVE";

  return (
    <header className="sticky top-0 z-40 flex items-center gap-4 border-b border-border bg-surface py-4 pr-6">
      <div
        className={`flex shrink-0 items-center gap-3 ${pathname === "/" ? "pl-6" : "pl-20"}`}
      >
        <Link href="/" className="flex items-center gap-2">
          <Logo size="sm" />
          <span className="text-lg font-bold text-foreground">I Worked There</span>
        </Link>
        <span className="hidden text-sm font-light italic text-muted-foreground sm:inline">
          No names. No HR. Just what it&apos;s really like to work there.
        </span>
      </div>

      <div className="ml-auto flex items-center gap-4">
        {showAccountControls && role === "ADMIN" && (
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/admin/moderation" className="hover:text-brand-600 dark:hover:text-brand-400">
              Moderation Queue
            </Link>
            <Link href="/admin/owner-claims" className="hover:text-brand-600 dark:hover:text-brand-400">
              Owner Claims
            </Link>
          </nav>
        )}

        {/* Placeholder icon — swap for the real mark later. */}
        <Link
          href="/"
          aria-label="Go to homepage"
          title="Home"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </Link>

        <ThemeToggle />

        {showAccountControls && onboardingStatus && (
          <>
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
          </>
        )}

        {/* Logged-out visitor's equivalent of the avatar/edit-profile slot
            above — there's no profile to edit without an account, so this
            opens AuthModal (mounted globally in layout.tsx) instead. */}
        {!isAuthenticated && (
          <button
            type="button"
            onClick={() => openAuthModal()}
            className="rounded-full bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Login/Register
          </button>
        )}
      </div>
    </header>
  );
}

"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/Avatar";
import { avatarLabel } from "@/lib/avatars";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationsMenu } from "@/components/NotificationsMenu";

// Icon + label nav item, the shape every slot in the header's main nav group
// uses (Home, Dashboard/My Ratings, Job, IWT Social — Notifications is its
// own component since it also owns a dropdown). `disabled` is for Job/IWT
// Social: present and visible, but inert until those features exist.
function NavIconLink({
  href,
  label,
  title,
  disabled,
  children,
}: {
  href: string;
  label: string;
  title?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const className =
    "flex flex-col items-center gap-1 rounded-lg px-2 py-1 text-muted-foreground transition hover:bg-surface-muted hover:text-foreground";
  const inner = (
    <>
      <span className="flex h-8 w-8 items-center justify-center">{children}</span>
      <span className="text-[11px] font-medium leading-none">{label}</span>
    </>
  );
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        title={title ?? `${label} — coming soon`}
        className={`${className} cursor-default opacity-50`}
      >
        {inner}
      </span>
    );
  }
  return (
    <Link href={href} title={title ?? label} className={className}>
      {inner}
    </Link>
  );
}

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

        <div className="flex items-center gap-1">
          <NavIconLink href="/" label="Home" title="Home">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </NavIconLink>

          {showAccountControls &&
            (role === "COMPANY_OWNER" ? (
              <NavIconLink href="/my/companies" label="Dashboard" title="Company dashboard">
                {/* dashboard-tile-solid, svgrepo.com/show/445068 — fill
                    swapped for currentColor so it inherits this link's
                    light/dark text color instead of a color baked into the
                    source file. */}
                <svg viewBox="0 0 48 48" className="h-5 w-5" fill="currentColor">
                  <path d="M20,30H8a2,2,0,0,0-2,2V42a2,2,0,0,0,2,2H20a2,2,0,0,0,2-2V32a2,2,0,0,0-2-2Z" />
                  <path d="M20,4H8A2,2,0,0,0,6,6V24a2,2,0,0,0,2,2H20a2,2,0,0,0,2-2V6a2,2,0,0,0-2-2Z" />
                  <path d="M40,4H28a2,2,0,0,0-2,2V16a2,2,0,0,0,2,2H40a2,2,0,0,0,2-2V6a2,2,0,0,0-2-2Z" />
                  <path d="M40,22H28a2,2,0,0,0-2,2V42a2,2,0,0,0,2,2H40a2,2,0,0,0,2-2V24a2,2,0,0,0-2-2Z" />
                </svg>
              </NavIconLink>
            ) : (
              <NavIconLink href="/me/reviews" label="My Ratings" title="The reviews you've submitted">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </NavIconLink>
            ))}

          {showAccountControls && <NotificationsMenu />}

          {showAccountControls && (
            <NavIconLink href="/job" label="Job" title="Job — coming soon" disabled>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
            </NavIconLink>
          )}

          {showAccountControls && (
            <NavIconLink href="/social" label="IWT Social" title="IWT Social — coming soon" disabled>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </NavIconLink>
          )}
        </div>

        <ThemeToggle />

        {showAccountControls && onboardingStatus && (
          <>
            <Link
              href="/me"
              className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-surface-muted"
            >
              <Avatar avatarKey={onboardingStatus.avatarKey} avatarGradient={onboardingStatus.avatarGradient} size="sm" />
              <span className="text-sm font-medium text-foreground">
                {onboardingStatus.reviewUsername || avatarLabel(onboardingStatus.avatarKey) || "Anonymous"}
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

"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/Avatar";
import { headerDisplayName } from "@/lib/headerDisplayName";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationsMenu } from "@/components/NotificationsMenu";
import { IwtSocialIcon } from "@/components/icons/IwtSocialIcon";
import { useIsCompanyOwner } from "@/lib/useIsCompanyOwner";
import { navItemActiveClass, navItemClass, navItemLabelClass } from "@/components/layout/navItem";
import { useT } from "@/lib/i18n/client";

// Icon + label nav item, the shape every slot in the header's main nav group
// uses (Home, Dashboard, Jobs, IWT Social — Notifications is its
// own component since it also owns a dropdown). `disabled` is for IWT
// Social: present and visible, but inert until that feature exists.
function NavIconLink({
  href,
  label,
  title,
  disabled,
  active = false,
  children,
}: {
  href: string;
  label: string;
  title?: string;
  disabled?: boolean;
  // The page the visitor is on: marked with a Wood bar under the item.
  active?: boolean;
  children: ReactNode;
}) {
  const t = useT();
  const className = `${navItemClass} ${active ? navItemActiveClass : ""}`;
  const inner = (
    <>
      <span className="flex h-5 w-5 items-center justify-center">{children}</span>
      <span className={navItemLabelClass}>{label}</span>
    </>
  );
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        title={title ?? t("{label} - coming soon", { label })}
        className={`${className} cursor-default opacity-50`}
      >
        {inner}
      </span>
    );
  }
  return (
    <Link href={href} title={title ?? label} aria-current={active ? "page" : undefined} className={className}>
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
  const { isAuthenticated, role, onboardingStatus, logout, openAuthModal, companyAccount } = useAuth();
  const pathname = usePathname();
  const showAccountControls = isAuthenticated && onboardingStatus?.status === "ACTIVE";
  const isCompanyOwner = useIsCompanyOwner();
  const t = useT();

  if (!isAuthenticated) return <LoggedOutHeader onOpenAuth={openAuthModal} home={pathname === "/"} />;

  return (
    // One 64px line in the page's own colour (slightly see-through over
    // scrolling content) with a single hairline under it, not a white bar.
    <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-border/70 bg-background/90 pr-3 backdrop-blur-md sm:gap-4 sm:pr-8">
      <div
        className={`flex shrink-0 items-center gap-4 ${pathname === "/" ? "pl-3 sm:pl-8" : "pl-14 sm:pl-20"}`}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size="md" />
          {/* Logo only on the narrowest phones, so the header never forces the
              page wider than the screen. */}
          <span className="hidden font-display text-xl text-foreground min-[420px]:inline">I Worked There</span>
        </Link>
        <span className="hidden border-l border-border pl-4 text-sm text-muted-foreground xl:inline">
          {t("Hear it straight from real references !")}
        </span>
      </div>

      {/* min-w-0 lets this row shrink below its content's natural width
          (flex items default to min-width: auto, which is exactly what was
          forcing the whole page wider at <=1024px) — but only the nav-icon
          cluster below scrolls internally when it doesn't fit. ThemeToggle
          and the avatar/logout (or login) controls stay outside that
          scrollable region and shrink-0, so they're always visible rather
          than something a visitor has to know to scroll sideways to find. */}
      <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-4">
        {showAccountControls && role === "ADMIN" && (
          <nav className="flex min-w-0 shrink items-center gap-4 overflow-x-auto no-scrollbar border-r border-border pr-4 text-sm text-muted-foreground">
            <Link href="/admin/dashboard" className="hover:text-brand-600 dark:hover:text-brand-400">
              Admin Portal
            </Link>
            <Link href="/admin/moderation" className="hover:text-brand-600 dark:hover:text-brand-400">
              Moderation Queue
            </Link>
            <Link href="/admin/owner-claims" className="hover:text-brand-600 dark:hover:text-brand-400">
              Owner Claims
            </Link>
            <Link href="/admin/job-postings" className="hover:text-brand-600 dark:hover:text-brand-400">
              Job Postings
            </Link>
            <Link href="/admin/content" className="hover:text-brand-600 dark:hover:text-brand-400">
              Content
            </Link>
          </nav>
        )}

        <div className="flex min-w-0 shrink items-center overflow-x-auto no-scrollbar">
          <NavIconLink href="/" label={t("Home")} title={t("Home")} active={pathname === "/" || pathname.startsWith("/companies")}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </NavIconLink>

          {/* Members find My Ratings in Edit Profile, right under My CV. */}
          {showAccountControls && role === "COMPANY_OWNER" && (
            <NavIconLink href="/my/companies" label={t("Dashboard")} title={t("Company dashboard")} active={pathname.startsWith("/my/companies")}>
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
          )}

          {showAccountControls && (
            <NavIconLink href="/jobs" label={isCompanyOwner ? t("Hire now !") : t("Jobs")} title={isCompanyOwner ? t("Post a job") : t("Jobs")} active={pathname.startsWith("/jobs")}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
            </NavIconLink>
          )}

          {!companyAccount && (
            <NavIconLink href="/social" label={t("IWT Social")} active={pathname.startsWith("/social")}>
              <IwtSocialIcon className="h-5 w-5" />
            </NavIconLink>
          )}
        </div>

        {/* The bell is a symbol on its own (no label), next to the theme
            switch rather than in the nav row. A company login has no
            personal notifications. */}
        {showAccountControls && !companyAccount && (
          <div className="shrink-0">
            <NotificationsMenu />
          </div>
        )}

        <div className="shrink-0">
          <ThemeToggle />
        </div>

        {showAccountControls && onboardingStatus && (
          <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-4 md:shrink">
            {companyAccount ? (
              // A company login: the company's name, never the owner's, and
              // no link to a personal profile it can't open.
              <span
                title={t("Signed in with the company login")}
                className="flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 text-sm font-medium text-foreground"
              >
                <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  {t("Company")}
                </span>
                <span className="hidden max-w-[12rem] truncate md:inline">{companyAccount.companyName}</span>
              </span>
            ) : (
            <Link
              href="/me"
              title={t("My profile")}
              // Below md only the avatar shows, so it keeps its full size
              // (shrinking let it slide under the Log out icon on phones);
              // from md up the name beside it is what gives way.
              className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-full p-1 transition hover:bg-surface-muted md:shrink md:pr-3.5"
            >
              <span className="sr-only md:hidden">{t("My profile")}</span>
              <Avatar
                avatarKey={onboardingStatus.avatarKey}
                avatarGradient={onboardingStatus.avatarGradient}
                photoUrl={onboardingStatus.ownerPhotoUrl}
                size="sm"
              />
              {/* truncate (not shrink-0 like the icon/button siblings) - a
                  long name is the one piece of this row with no fixed size
                  of its own, so it should give up width first rather than
                  pushing the page wider. Owners always show their real name
                  here (see headerDisplayName). */}
              <span className="hidden max-w-[9rem] truncate text-sm font-medium text-foreground md:inline">
                {t(headerDisplayName(onboardingStatus, isCompanyOwner))}
              </span>
            </Link>
            )}
            <button
              onClick={logout}
              aria-label={t("Log out")}
              title={t("Log out")}
              className="shrink-0 text-muted-foreground transition hover:text-foreground"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        )}

      </div>
    </header>
  );
}

// A visitor without an account sees the intro page, so the bar holds only
// what they need there: the name, the tagline, the theme switch and the way
// in. No page links (the intro already says what the site is) and no hairline:
// on the homepage it sits on the same column as the intro below it, as part of
// the page rather than an app toolbar.
function LoggedOutHeader({ onOpenAuth, home }: { onOpenAuth: (mode: "login" | "register") => void; home: boolean }) {
  const t = useT();
  return (
    <header className="sticky top-0 z-40 h-16 bg-background/90 backdrop-blur-md">
      <div
        className={`flex h-full items-center gap-3 sm:gap-4 ${
          home ? "mx-auto w-full max-w-[1400px] px-4 sm:px-8" : "pl-14 pr-3 sm:pl-20 sm:pr-8"
        }`}
      >
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Logo size="md" />
          <span className="hidden font-display text-xl text-foreground min-[420px]:inline">I Worked There</span>
        </Link>
        <span className="hidden border-l border-border pl-4 text-sm text-muted-foreground xl:inline">
          {t("Hear it straight from real references !")}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <div className="mr-1 sm:mr-2">
            <ThemeToggle />
          </div>
          <button
            type="button"
            onClick={() => onOpenAuth("login")}
            className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("Log in")}
          </button>
          <button
            type="button"
            onClick={() => onOpenAuth("register")}
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98]"
          >
            {t("Register")}
          </button>
        </div>
      </div>
    </header>
  );
}

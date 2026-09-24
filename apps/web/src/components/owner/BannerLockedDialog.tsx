"use client";

import { useEffect } from "react";

// Shown when an owner tries to change their banner but their membership
// tier doesn't include custom banners. Either opened up-front (the "Change
// banner" button on a locked tier) or in response to a 403 from the banner
// endpoint — the server is the real gate, this dialog only explains it.
//
// Deliberately its own small dialog rather than jumping straight to the
// full pricing table: it names the exact thing that's blocked (the
// system-assigned default banner) before handing off to "See Plans".
// All colours are semantic tokens and the type is the app-wide
// `font-sans` (Plus Jakarta Sans), so it renders identically in light and
// dark.
export function BannerLockedDialog({
  onClose,
  onSeePlans,
}: {
  onClose: () => void;
  onSeePlans: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 font-sans"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="banner-locked-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="14" rx="2" />
            <path d="m3 14 4-4 4 4 3-3 4 4" />
            <circle cx="9" cy="9" r="1.5" />
          </svg>
        </div>

        <h2 id="banner-locked-title" className="text-lg font-bold text-foreground">
          Custom banners need a membership upgrade
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Your profile currently shows a default banner the system picked automatically from your
          primary work-type. Uploading your own banner image needs a{" "}
          <strong className="font-semibold text-foreground">Starter</strong>{" "}membership or higher — you
          can&apos;t change the system-assigned default banner on the Free plan.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onSeePlans}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            See Plans
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-muted"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

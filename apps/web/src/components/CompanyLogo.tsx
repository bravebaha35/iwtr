"use client";

import { useState } from "react";

const SIZES = {
  sm: "h-9 w-9 text-sm compact:h-7 compact:w-7 compact:text-xs rounded-lg",
  md: "h-12 w-12 text-lg compact:h-9 compact:w-9 compact:text-sm rounded-lg",
  lg: "h-16 w-16 text-2xl rounded-xl",
} as const;

/**
 * Single point of edit for how a company's brand image renders anywhere in
 * the app (browse cards, company detail header). `Company.mainPhotoUrl` is
 * owner-editable (see /my/companies) but wasn't rendered anywhere before this
 * — most companies have none yet, so the colored initial-letter badge below
 * IS the placeholder "space": it's what shows until a real photo exists, and
 * quietly steps aside the moment one does. Falls back the same way if the
 * URL 404s or fails to load, so a broken link never breaks the layout.
 */
export function CompanyLogo({
  name,
  mainPhotoUrl,
  size = "md",
}: {
  name: string;
  mainPhotoUrl: string | null;
  size?: keyof typeof SIZES;
}) {
  const [failed, setFailed] = useState(false);
  const dims = SIZES[size];

  if (mainPhotoUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- mainPhotoUrl is
      // an arbitrary owner-submitted URL, not a known set of remote hosts, so
      // next/image's remotePatterns allowlist doesn't fit here.
      <img
        src={mainPhotoUrl}
        alt={`${name} logo`}
        onError={() => setFailed(true)}
        className={`${dims} shrink-0 object-cover`}
      />
    );
  }

  return (
    <span
      className={`flex ${dims} shrink-0 items-center justify-center bg-brand-100 font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-300`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

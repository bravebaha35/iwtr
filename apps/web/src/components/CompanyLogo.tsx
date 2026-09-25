"use client";

import { useState } from "react";
import Image from "next/image";
import { isOwnStaticAsset } from "@/lib/imageSource";

const SIZES = {
  sm: "h-9 w-9 text-sm compact:h-7 compact:w-7 compact:text-xs rounded-[0.5rem]",
  md: "h-12 w-12 text-lg compact:h-9 compact:w-9 compact:text-sm rounded-[0.5rem]",
  lg: "h-16 w-16 text-2xl rounded-[0.75rem]",
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
      // mainPhotoUrl is an owner upload (already WebP, served by the API) or
      // an arbitrary URL, so it's passed through unoptimized rather than
      // via next/image's remotePatterns allowlist.
      <Image
        src={mainPhotoUrl}
        alt={`${name} logo`}
        width={128}
        height={128}
        unoptimized={!isOwnStaticAsset(mainPhotoUrl)}
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

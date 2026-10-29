"use client";

import Link from "next/link";
import Image from "next/image";
import { useT } from "@/lib/i18n/client";

/**
 * The header's brand corner (2026-10-29 redesign), shared by the member and
 * the logged-out header so both always match. The beaver mark peeks up out of
 * a soft orange tile - its head rises a little when the pointer is over the
 * link (still under reduced motion) - beside the name set in the display
 * face, "There" in the brand orange. On wide screens the tagline sits under
 * the name as one stacked lockup instead of trailing after a divider.
 */
export function BrandLockup() {
  const t = useT();
  return (
    <Link href="/" aria-label="I Worked There" className="group flex shrink-0 items-center gap-3 rounded-[0.75rem]">
      <span
        aria-hidden="true"
        className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[0.75rem] bg-gradient-to-b from-brand-50 to-brand-200 shadow-xs ring-1 ring-inset ring-brand-600/15 dark:from-brand-300/35 dark:to-brand-500/45 dark:ring-brand-300/30"
      >
        <Image
          src="/brand-mark.png"
          alt=""
          width={64}
          height={64}
          sizes="40px"
          priority
          className="absolute bottom-[-3px] left-1/2 h-10 w-10 -translate-x-1/2 object-contain transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:group-hover:-translate-y-[3px]"
        />
      </span>
      {/* Name only from 420px, so the narrowest phones keep room for the nav. */}
      <span className="hidden flex-col min-[420px]:flex">
        <span className="font-display text-[1.3rem] font-bold leading-none tracking-[-0.02em] text-foreground">
          I Worked <span className="text-brand-600 dark:text-brand-400">There</span>
        </span>
        <span className="mt-1.5 hidden text-[12.5px] leading-none text-muted-foreground xl:block">
          {t("Hear it straight from real references !")}
        </span>
      </span>
    </Link>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import { MagneticLink } from "@/components/motion/MagneticLink";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

/**
 * 404. An asymmetric two-column grid (7/5 on wide screens, stacked on
 * phones) instead of centred big text, and exactly one way out.
 */
export default function NotFound() {
  return (
    <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-10 px-4 py-12 md:grid-cols-12 md:py-20">
      <div className="md:col-span-7 md:pr-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Error 404</p>
        <h1 className="mt-3 text-4xl leading-tight text-foreground sm:text-5xl md:text-6xl">
          This page never worked here.
        </h1>
        <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">
          The link may be old, or the page may have moved. Everything you were looking for is still a click away.
        </p>
        <MagneticLink
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-river-600 px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-river-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-river-600"
        >
          Return to Dashboard
          <span aria-hidden="true">→</span>
        </MagneticLink>
      </div>

      <div className="relative mx-auto w-48 sm:w-60 md:col-span-5 md:mt-24 md:w-full md:max-w-xs md:justify-self-end">
        <div aria-hidden="true" className="absolute -inset-4 -z-10 rotate-3 rounded-3xl bg-surface-muted" />
        <Image
          src="/dusunenkunduz.png"
          alt="A thoughtful beaver scratching its head"
          width={2748}
          height={4096}
          sizes="(min-width: 768px) 320px, 240px"
          className="h-auto w-full"
        />
      </div>
    </div>
  );
}

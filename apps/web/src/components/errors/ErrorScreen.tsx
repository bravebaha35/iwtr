import type { ReactNode } from "react";
import Image from "next/image";

/**
 * The shared layout of the full-page error screens (404 and "something went
 * wrong"): text and the way out on the left, a picture on the right (7/5 on
 * wide screens, stacked on phones). No hooks, so it works on both server and
 * client screens. Without a picture the right side keeps its space as a
 * soft empty panel - see lib/errorScreens.ts.
 */
export function ErrorScreen({
  eyebrow,
  title,
  body,
  actions,
  art,
  artAlt,
}: {
  eyebrow: string;
  title: string;
  body: string;
  actions: ReactNode;
  art: { src: string; width: number; height: number } | null;
  artAlt: string;
}) {
  return (
    <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-10 px-4 py-12 md:grid-cols-12 md:py-20">
      <div className="md:col-span-7 md:pr-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">{eyebrow}</p>
        <h1 className="mt-3 text-4xl leading-tight text-foreground sm:text-5xl md:text-6xl">{title}</h1>
        <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">{body}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>
      </div>

      <div className="relative mx-auto w-48 sm:w-60 md:col-span-5 md:mt-24 md:w-full md:max-w-xs md:justify-self-end">
        <div aria-hidden="true" className="absolute -inset-4 -z-10 rotate-3 rounded-3xl bg-surface-muted" />
        {art ? (
          <Image
            src={art.src}
            alt={artAlt}
            width={art.width}
            height={art.height}
            sizes="(min-width: 768px) 320px, 240px"
            className="h-auto w-full"
          />
        ) : (
          // Same shape the picture will have, so adding one later moves nothing.
          <div aria-hidden="true" className="aspect-[2748/4096] w-full" data-error-art-slot />
        )}
      </div>
    </div>
  );
}

export const ERROR_PRIMARY_BUTTON =
  "inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

export const ERROR_SECONDARY_BUTTON =
  "inline-flex items-center gap-2 rounded-full bg-surface-muted px-6 py-3 text-base font-medium text-foreground transition hover:bg-border/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

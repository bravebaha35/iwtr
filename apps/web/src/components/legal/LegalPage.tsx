import Link from "next/link";
import type { ReactNode } from "react";

export const SUPPORT_EMAIL = "iworkedthere@hotmail.com";

/**
 * Shared layout for the long-form legal pages (/privacy, /terms): one
 * readable column (~65 characters a line), generous line height, a table of
 * contents, and plain section headings. Server-rendered, no client JS.
 */
export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: ReactNode;
  sections: { id: string; heading: string; body: ReactNode }[];
}) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Last updated {updated}</p>
      <h1 className="mt-2 text-3xl font-bold leading-tight text-foreground sm:text-4xl">{title}</h1>
      <div className="mt-4 text-base leading-7 text-muted-foreground">{intro}</div>

      <nav aria-label="On this page" className="mt-8 rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">On this page</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-foreground underline-offset-2 hover:underline">
                {s.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {sections.map((s) => (
        <section key={s.id} id={s.id} className="mt-10 scroll-mt-24">
          <h2 className="text-xl font-bold text-foreground">{s.heading}</h2>
          <div className="mt-3 space-y-3 break-words text-base leading-7 text-muted-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">
            {s.body}
          </div>
        </section>
      ))}

      <p className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
        Questions? Write to{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-foreground underline underline-offset-2">
          {SUPPORT_EMAIL}
        </a>
        . See also our{" "}
        <Link href="/privacy" className="font-semibold text-foreground underline underline-offset-2">
          Privacy Policy
        </Link>{" "}
        and{" "}
        <Link href="/terms" className="font-semibold text-foreground underline underline-offset-2">
          Terms &amp; Conditions
        </Link>
        .
      </p>
    </main>
  );
}

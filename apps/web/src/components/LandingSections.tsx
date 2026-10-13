import Image from "next/image";
import { DEFAULT_BANNER_URL_BY_WORKPLACE_TYPE, scoreBands, type WorkplaceType } from "@iwtr/shared-types";
import { RATING_TICKS } from "@/lib/beaverRating";
import { scoreBarColor, scoreTextColor } from "@/lib/scoreBandColors";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";

// The four work types with the same default banner art company pages use.
const WORK_TYPES: { type: WorkplaceType; banner: string; line: string }[] = [
  { type: "MANUAL_LABOUR", banner: DEFAULT_BANNER_URL_BY_WORKPLACE_TYPE.MANUAL_LABOUR, line: "Sites, factories, warehouses and workshops." },
  { type: "SERVICE", banner: DEFAULT_BANNER_URL_BY_WORKPLACE_TYPE.SERVICE, line: "Shops, restaurants, hospitals and call centres." },
  { type: "OFFICE", banner: DEFAULT_BANNER_URL_BY_WORKPLACE_TYPE.OFFICE, line: "Desks, meetings and management." },
  { type: "HYBRID_REMOTE", banner: DEFAULT_BANNER_URL_BY_WORKPLACE_TYPE.HYBRID_REMOTE, line: "Home, office, or a bit of both." },
];

const TRUST_POINTS: { title: string; body: string }[] = [
  {
    title: "Only people who worked there",
    body: "You can rate a company only if it is in your own work history.",
  },
  {
    title: "Your name is never shown",
    body: "Reviews appear under a username and avatar you pick. Employers see scores and anonymous comments, never who wrote them.",
  },
  {
    title: "One person, one account",
    body: "Identity is confirmed once at registration to stop fake and duplicate accounts. It is encrypted and kept apart from everything you post.",
  },
];

/**
 * The explainer sections under the homepage's logged-out Register prompt
 * (passed to AnonGate as `below`): the work types, how a score reads, and
 * how anonymity works. Static content, no state.
 */
export function LandingSections() {
  const top = scoreBands[scoreBands.length - 1].max;
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-24 px-4 pb-24 sm:px-8 md:gap-32 md:pb-32">
      <section aria-labelledby="landing-work-types">
        <h2 id="landing-work-types" className="text-3xl leading-tight text-foreground md:text-4xl">
          Every kind of work has a place here
        </h2>
        <p className="mt-3 max-w-[60ch] text-lg text-muted-foreground">
          Each workplace is rated by the people who did that kind of work there.
        </p>
        <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2">
          {WORK_TYPES.map((w) => (
            <div key={w.type}>
              <div className="relative aspect-[4/1] w-full overflow-hidden rounded-[0.875rem] bg-surface-muted">
                <Image src={w.banner} alt="" fill sizes="(min-width: 768px) 660px, 100vw" className="object-cover" />
              </div>
              <h3 className="mt-4 text-xl text-foreground">{workplaceTypeLabel(w.type)}</h3>
              <p className="mt-1 text-[15px] text-muted-foreground">{w.line}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="landing-score">
        <h2 id="landing-score" className="text-3xl leading-tight text-foreground md:text-4xl">
          How to read a score
        </h2>
        <p className="mt-3 max-w-[60ch] text-lg text-muted-foreground">
          Every workplace gets a score out of 5 from its reviews. Each range has a plain name.
        </p>
        <div className="mt-10">
          <div className="flex items-end justify-between px-1">
            {RATING_TICKS.map((tick) => (
              <Image key={tick.value} src={tick.src} alt={tick.alt} width={192} height={192} sizes="96px" className="h-20 w-20 md:h-24 md:w-24" />
            ))}
          </div>
          {/* One bar, split where the score bands actually change. */}
          <div className="mt-3 flex h-3 w-full gap-1 overflow-hidden rounded-full">
            {scoreBands.map((b) => (
              <div
                key={b.label}
                className={scoreBarColor(b.min)}
                style={{ width: `${((Math.min(b.max, 5) - b.min) / 5) * 100}%` }}
              />
            ))}
          </div>
          {/* From lg up each name sits under its own stretch of the bar
              (same widths); below that the names fall into a simple grid. */}
          <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:flex lg:gap-1">
            {scoreBands.map((b) => (
              <li
                key={b.label}
                className="lg:w-[var(--band)]"
                style={{ "--band": `${((Math.min(b.max, 5) - b.min) / 5) * 100}%` } as React.CSSProperties}
              >
                <span className={`block text-base font-semibold ${scoreTextColor(b.min)}`}>{b.label}</span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {b.min.toFixed(1)} to {(b.max === top ? 5 : b.max).toFixed(1)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="landing-trust" className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:gap-16">
        <div>
          <h2 id="landing-trust" className="max-w-[14ch] text-3xl leading-tight text-foreground md:text-4xl">
            Honest because it is anonymous
          </h2>
          <p className="mt-3 max-w-[40ch] text-lg text-muted-foreground">
            No names. No HR. Just what it&apos;s really like to work there.
          </p>
        </div>
        <dl className="flex flex-col">
          {TRUST_POINTS.map((p) => (
            <div key={p.title} className="border-t border-border py-6 first:border-t-0 first:pt-0 md:first:border-t md:first:pt-6">
              <dt className="font-display text-xl text-foreground">{p.title}</dt>
              <dd className="mt-1.5 max-w-[58ch] text-[15px] leading-relaxed text-muted-foreground">{p.body}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

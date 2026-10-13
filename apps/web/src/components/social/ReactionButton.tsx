"use client";

import { useEffect, useRef, useState } from "react";
import { SOCIAL_REACTIONS, type SocialReaction, type SocialReactionCounts } from "@iwtr/shared-types";
import { HeartIcon } from "@/components/icons/HeartIcon";

// The site's own beaver for each reaction (small WebP cuts of the artwork in
// public/, made for this - the originals are several megabytes each).
export const REACTION_META: Record<SocialReaction, { label: string; src: string }> = {
  LIKE: { label: "Like", src: "/reactions/like.webp" },
  WELL_DONE: { label: "Well done", src: "/reactions/well-done.webp" },
  CURIOUS: { label: "Curious", src: "/reactions/curious.webp" },
};

const OPEN_DELAY_MS = 350;
const CLOSE_DELAY_MS = 250;

function Beaver({ reaction, size }: { reaction: SocialReaction; size: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a 5 KB static WebP at a fixed size
    <img src={REACTION_META[reaction].src} alt="" width={size} height={size} loading="lazy" decoding="async" className="shrink-0 rounded-full" style={{ width: size, height: size }} />
  );
}

/**
 * The like button and its beaver reactions. A click on the main button is
 * the fast path: it leaves a plain like, or takes back whatever reaction is
 * there. Resting the pointer on it, or the small arrow beside it (touch and
 * keyboard), opens the three beavers to pick from.
 */
export function ReactionButton({
  counts,
  total,
  mine,
  onReact,
}: {
  counts: SocialReactionCounts;
  total: number;
  mine: SocialReaction | null;
  // Asked with the reaction to leave; the same one as `mine` takes it back.
  onReact: (reaction: SocialReaction) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function later(next: boolean, delay: number) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(next), delay);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const present = SOCIAL_REACTIONS.filter((r) => counts[r] > 0);
  const breakdown = present.map((r) => `${counts[r]} ${REACTION_META[r].label}`).join(", ");

  return (
    <div ref={ref} className="relative flex items-center" onMouseEnter={() => later(true, OPEN_DELAY_MS)} onMouseLeave={() => later(false, CLOSE_DELAY_MS)}>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          onReact(mine ?? "LIKE");
        }}
        aria-label="Like"
        aria-pressed={mine !== null}
        title={breakdown || undefined}
        className={`flex items-center gap-1.5 font-medium transition active:scale-95 ${
          mine ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {mine ? <Beaver reaction={mine} size={22} /> : <HeartIcon className="h-5 w-5" />}
        <span className="tabular-nums">{total}</span>
      </button>

      {/* Which reactions the post has, as small faces - only once someone has
          gone beyond a plain like, so most posts stay as quiet as before, and
          not when the one face would just repeat the viewer's own beside it. */}
      {present.some((r) => r !== "LIKE") && !(present.length === 1 && present[0] === mine) && (
        <span aria-hidden="true" className="ml-1.5 flex -space-x-1">
          {present.map((r) => (
            <Beaver key={r} reaction={r} size={16} />
          ))}
        </span>
      )}

      <button
        type="button"
        aria-label="More reactions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="ml-0.5 flex h-6 w-5 items-center justify-center rounded text-muted-foreground/70 transition hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 15 6-6 6 6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Reactions"
          // w-max: an absolutely placed box would otherwise be squeezed to
          // the width of the like button it hangs from.
          className="reaction-pop absolute bottom-full left-0 z-20 mb-2 flex w-max gap-1 rounded-full bg-surface p-1.5 shadow-lg ring-1 ring-border/60"
        >
          {SOCIAL_REACTIONS.map((r) => (
            <button
              key={r}
              type="button"
              role="menuitemradio"
              aria-checked={mine === r}
              aria-label={REACTION_META[r].label}
              title={REACTION_META[r].label}
              onClick={() => {
                setOpen(false);
                onReact(r);
              }}
              className={`shrink-0 rounded-full p-0.5 transition duration-150 hover:-translate-y-1 hover:scale-110 active:scale-95 motion-reduce:transform-none ${
                mine === r ? "bg-brand-600/15 dark:bg-brand-400/20" : ""
              }`}
            >
              <Beaver reaction={r} size={38} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

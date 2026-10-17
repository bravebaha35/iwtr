"use client";

import { useEffect, useRef, useState } from "react";
import { SOCIAL_REACTIONS, type SocialReaction, type SocialReactionCounts } from "@iwtr/shared-types";
import { useT } from "@/lib/i18n/client";

// The three reactions as one family of plain line icons (the like is
// Lucide's thumbs up, ISC licence; praise and the question mark are drawn to
// match it). At rest they are outlines; the one a member picked fills with
// its own colour.
export const REACTION_META: Record<SocialReaction, { label: string; color: string }> = {
  LIKE: { label: "Like", color: "text-blue-600 dark:text-blue-400" },
  WELL_DONE: { label: "Praise", color: "text-amber-600 dark:text-amber-400" },
  CURIOUS: { label: "Curious", color: "text-violet-600 dark:text-violet-400" },
};

const OPEN_DELAY_MS = 350;
const CLOSE_DELAY_MS = 250;

export function ReactionGlyph({ reaction, filled = false, className = "h-5 w-5" }: { reaction: SocialReaction; filled?: boolean; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    className: `shrink-0 ${className}`,
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (reaction === "LIKE") {
    return (
      <svg {...common} fill="none">
        <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" fill={filled ? "currentColor" : "none"} />
        <path d="M7 10v12" stroke={filled ? "var(--surface)" : "currentColor"} />
      </svg>
    );
  }
  if (reaction === "WELL_DONE") {
    // Two hands pressed together, fingers up: a thumb inside each palm, the
    // wrists turning out at the bottom.
    const thumb = filled ? "var(--surface)" : "currentColor";
    return (
      <svg {...common} fill="none">
        <path d="M12 2.8c-1.3.9-2.2 2.4-2.6 4.2l-1 4.6c-1.1.7-1.8 1.9-1.9 3.2l-.2 2.6-2.6 2.9 2.7 2.4 3.6-3.6c1.3-1.2 2-2.9 2-4.6V2.8Z" fill={filled ? "currentColor" : "none"} />
        <path d="M12 2.8c1.3.9 2.2 2.4 2.6 4.2l1 4.6c1.1.7 1.8 1.9 1.9 3.2l.2 2.6 2.6 2.9-2.7 2.4-3.6-3.6c-1.3-1.2-2-2.9-2-4.6V2.8Z" fill={filled ? "currentColor" : "none"} />
        <path d="M8.6 11.6c.8.6 1.3 1.6 1.4 2.7M15.4 11.6c-.8.6-1.3 1.6-1.4 2.7" stroke={thumb} />
      </svg>
    );
  }
  // A question mark in a circle.
  return (
    <svg {...common} fill="none">
      <circle cx="12" cy="12" r="9.5" fill={filled ? "currentColor" : "none"} />
      <path d="M9.4 9.2a2.7 2.7 0 1 1 3.9 2.4c-.8.4-1.3 1-1.3 1.9v.6" stroke={filled ? "var(--surface)" : "currentColor"} strokeWidth={2} />
      <circle cx="12" cy="17.2" r="1.05" fill={filled ? "var(--surface)" : "currentColor"} stroke="none" />
    </svg>
  );
}

/**
 * The like button and its three reactions. A click on the main button is
 * the fast path: it leaves a plain like, or takes back whatever reaction is
 * there. Resting the pointer on it, or the small arrow beside it (touch and
 * keyboard), opens the three reactions to pick from.
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
  const t = useT();
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
  const breakdown = present.map((r) => `${counts[r]} ${t(REACTION_META[r].label)}`).join(", ");

  return (
    <div ref={ref} className="relative flex items-center" onMouseEnter={() => later(true, OPEN_DELAY_MS)} onMouseLeave={() => later(false, CLOSE_DELAY_MS)}>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          onReact(mine ?? "LIKE");
        }}
        aria-label={t("Like")}
        aria-pressed={mine !== null}
        title={breakdown || undefined}
        className={`flex items-center gap-1.5 font-medium transition active:scale-95 ${
          mine ? REACTION_META[mine].color : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <ReactionGlyph reaction={mine ?? "LIKE"} filled={mine !== null} />
        <span className="tabular-nums">{total}</span>
      </button>

      {/* Which reactions the post has, as small faces - only once someone has
          gone beyond a plain like, so most posts stay as quiet as before, and
          not when the one face would just repeat the viewer's own beside it. */}
      {present.some((r) => r !== "LIKE") && !(present.length === 1 && present[0] === mine) && (
        <span aria-hidden="true" className="ml-1.5 flex -space-x-1">
          {present.map((r) => (
            <span key={r} className={`flex h-[18px] w-[18px] items-center justify-center rounded-full bg-surface ring-2 ring-surface ${REACTION_META[r].color}`}>
              <ReactionGlyph reaction={r} filled className="h-3.5 w-3.5" />
            </span>
          ))}
        </span>
      )}

      <button
        type="button"
        aria-label={t("More reactions")}
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
          aria-label={t("Reactions")}
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
              aria-label={t(REACTION_META[r].label)}
              title={t(REACTION_META[r].label)}
              onClick={() => {
                setOpen(false);
                onReact(r);
              }}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition duration-150 hover:-translate-y-0.5 hover:bg-surface-muted active:scale-95 motion-reduce:transform-none ${REACTION_META[r].color} ${
                mine === r ? "bg-surface-muted" : ""
              }`}
            >
              <ReactionGlyph reaction={r} filled={mine === r} className="h-6 w-6" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

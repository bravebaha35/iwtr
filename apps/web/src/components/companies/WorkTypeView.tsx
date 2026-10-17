"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { WorkplaceType } from "@iwtr/shared-types";
import { workplaceTypeLabel } from "@/lib/workplaceTypes";
import { collarTileTone } from "@/lib/collarColors";

// Which of a company's work types the Ratings tab is showing. A company can
// hire for more than one (an office plus a shop floor), and the rating
// illustration and the Vibe Flags both differ per work type, so one shared
// choice drives both: turn the illustration to Service and the flags follow.

interface WorkTypeViewValue {
  types: WorkplaceType[];
  active: WorkplaceType;
  index: number;
  // -1 when the last move went to the previous type, 1 for the next; lets
  // the panels slide in from the side the visitor moved toward.
  direction: 1 | -1;
  step: (by: 1 | -1) => void;
}

const WorkTypeViewContext = createContext<WorkTypeViewValue | null>(null);

export function WorkTypeViewProvider({ types, children }: { types: WorkplaceType[]; children: ReactNode }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const count = types.length;

  const step = useCallback(
    (by: 1 | -1) => {
      if (count < 2) return;
      setDirection(by);
      setIndex((i) => (i + by + count) % count);
    },
    [count],
  );

  const value = useMemo<WorkTypeViewValue>(
    () => ({ types, active: types[index] ?? types[0], index, direction, step }),
    [types, index, direction, step],
  );

  return <WorkTypeViewContext.Provider value={value}>{children}</WorkTypeViewContext.Provider>;
}

export function useWorkTypeView(): WorkTypeViewValue {
  const value = useContext(WorkTypeViewContext);
  if (!value) throw new Error("useWorkTypeView must be used inside WorkTypeViewProvider");
  return value;
}

function Chevron({ side }: { side: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {side === "left" ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
    </svg>
  );
}

const arrowClass =
  "flex h-8 w-8 items-center justify-center rounded-full bg-surface-muted text-muted-foreground transition hover:text-foreground active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

/**
 * The work-type control at the top-left of the illustration and of the Vibe
 * Flags: previous arrow, the work type on show (with its collar colour as a
 * short bar), next arrow. A company with one work type gets the name alone.
 * Below the name, one small bar per work type marks where in the set the
 * visitor is, so "there is another one" is visible before any click.
 */
export function WorkTypeSwitcher({ className = "" }: { className?: string }) {
  const { types, active, index, step } = useWorkTypeView();
  const many = types.length > 1;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {many && (
        <button type="button" onClick={() => step(-1)} aria-label={`Previous work type (${workplaceTypeLabel(types[(index - 1 + types.length) % types.length])})`} className={arrowClass}>
          <Chevron side="left" />
        </button>
      )}
      <div className="flex min-w-[7.5rem] flex-col items-center gap-1 px-1" aria-live="polite">
        <span className="text-sm font-semibold text-foreground">{workplaceTypeLabel(active)}</span>
        <span className="flex gap-1" aria-hidden="true">
          {types.map((t) => (
            <span
              key={t}
              className={`h-[3px] rounded-full transition-all duration-300 ${t === active ? `w-5 ${collarTileTone[t].bar}` : "w-2 bg-border"}`}
            />
          ))}
        </span>
      </div>
      {many && (
        <button type="button" onClick={() => step(1)} aria-label={`Next work type (${workplaceTypeLabel(types[(index + 1) % types.length])})`} className={arrowClass}>
          <Chevron side="right" />
        </button>
      )}
    </div>
  );
}

// Horizontal swipe on touch screens: a flick of 60px or more one way moves
// to the neighbouring work type. Vertical scrolling is left alone.
const SWIPE_THRESHOLD = 60;

/**
 * The part of a panel that changes with the work type. Swipeable sideways
 * when the company has more than one, and the new content slides in from
 * the side the visitor moved toward (a plain swap with reduced motion).
 */
export function WorkTypeSlide({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { types, active, direction, step } = useWorkTypeView();
  const reduceMotion = useReducedMotion();
  const many = types.length > 1;
  const offset = reduceMotion ? 0 : 28;
  // Touch and pen only: on a desktop a mouse drag across this text is a
  // text selection, not a swipe.
  const start = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      className={`relative ${many ? "touch-pan-y" : ""} ${className}`}
      onPointerDown={(e) => {
        start.current = many && e.pointerType !== "mouse" ? { x: e.clientX, y: e.clientY } : null;
      }}
      onPointerUp={(e) => {
        const from = start.current;
        start.current = null;
        if (!from) return;
        const dx = e.clientX - from.x;
        const dy = e.clientY - from.y;
        if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
        step(dx < 0 ? 1 : -1);
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
    >
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={active}
          custom={direction}
          initial={{ opacity: 0, x: direction * offset }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -offset }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

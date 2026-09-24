"use client";

import { useEffect } from "react";
import { SNAP_EASE_CSS } from "@/lib/motion/easings";

// Every filled primary CTA on the site is a bg-brand-600 button or link.
// One delegated listener covers all of them, instead of wrapping ~65
// buttons across ~40 files in a new component.
const PRIMARY_SELECTOR = "button.bg-brand-600:not(:disabled), a.bg-brand-600";

// Maximum pull toward the cursor, in px. Small on purpose: a hint, not a
// chase — the button must never drift out from under the pointer.
const PULL_X = 4;
const PULL_Y = 3;

const FOLLOW_TRANSITION =
  "transform 120ms cubic-bezier(0.25, 1, 0.5, 1), background-color 150ms ease, color 150ms ease, border-color 150ms ease";
const SNAP_BACK_TRANSITION = `transform 300ms ${SNAP_EASE_CSS}, background-color 150ms ease, color 150ms ease, border-color 150ms ease`;

/**
 * Magnetic primary buttons: while the pointer is over a primary button it
 * leans a few pixels toward the cursor, and snaps back to rest when the
 * pointer leaves. Mouse/trackpad only, and off entirely for people who ask
 * their OS for reduced motion. Renders nothing.
 */
export function MagneticPrimaryButtons() {
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const finePointer = window.matchMedia("(pointer: fine)");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let current: HTMLElement | null = null;

    const release = (el: HTMLElement) => {
      el.style.transition = SNAP_BACK_TRANSITION;
      el.style.transform = "";
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!finePointer.matches || reduceMotion.matches) return;
      const target = e.target instanceof Element ? e.target.closest<HTMLElement>(PRIMARY_SELECTOR) : null;
      if (current && current !== target) release(current);
      current = target;
      if (!target) return;

      const rect = target.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      // -1 … 1 across the button, 0 at its centre.
      const nx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
      const ny = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
      const clamp = (n: number) => Math.max(-1, Math.min(1, n));
      target.style.transition = FOLLOW_TRANSITION;
      target.style.transform = `translate(${(clamp(nx) * PULL_X).toFixed(2)}px, ${(clamp(ny) * PULL_Y).toFixed(2)}px)`;
    };

    const onLeaveWindow = () => {
      if (current) release(current);
      current = null;
    };

    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeaveWindow);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onLeaveWindow);
      if (current) release(current);
    };
  }, []);

  return null;
}

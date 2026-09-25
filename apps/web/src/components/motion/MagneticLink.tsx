"use client";

import Link from "next/link";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import type { ReactNode } from "react";

const MotionLink = motion.create(Link);

// Maximum pull toward the cursor, in px. A hint, never a chase.
const PULL = 10;

/**
 * A link that leans gently toward the pointer and springs back when it
 * leaves. Off for touch and for people who ask for reduced motion.
 */
export function MagneticLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 300, damping: 18, mass: 0.4 });
  const y = useSpring(useMotionValue(0), { stiffness: 300, damping: 18, mass: 0.4 });

  function onPointerMove(e: React.PointerEvent<HTMLAnchorElement>) {
    if (reduceMotion || e.pointerType !== "mouse") return;
    const rect = e.currentTarget.getBoundingClientRect();
    x.set(((e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)) * PULL);
    y.set(((e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)) * PULL);
  }

  function reset() {
    x.set(0);
    y.set(0);
  }

  return (
    <MotionLink
      href={href}
      className={className}
      style={{ x, y }}
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
      onBlur={reset}
    >
      {children}
    </MotionLink>
  );
}

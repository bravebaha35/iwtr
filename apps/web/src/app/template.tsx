"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SNAP_EASE } from "@/lib/motion/easings";

// Only animate client-side navigations, never the very first page load: an
// `initial={{ opacity: 0 }}` on first load would ship server-rendered HTML
// that stays invisible until JavaScript hydrates. Module scope (not state)
// because App Router remounts this template on every navigation. Read once
// through a useState initializer and set in an effect, so StrictMode's
// double render can't flip it mid-mount.
let hasMountedOnce = false;

export default function Template({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [isNavigation] = useState(() => hasMountedOnce);
  useEffect(() => {
    hasMountedOnce = true;
  }, []);
  const animate = isNavigation && !reduceMotion;

  return (
    // flex-1 flex-col so pages keep behaving as direct children of <body>'s
    // flex column, the way they did before this wrapper existed.
    <motion.div
      className="flex flex-1 flex-col"
      initial={animate ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: SNAP_EASE }}
    >
      {children}
    </motion.div>
  );
}

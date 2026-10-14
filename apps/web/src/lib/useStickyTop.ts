"use client";

import { useEffect, useRef, useState } from "react";

// Space kept under the 64px sticky header, and under a column that is
// taller than the window.
const HEADER_GAP_PX = 80;
const BOTTOM_GAP_PX = 16;

/**
 * The `top` for a `position: sticky` side column that should follow the
 * page as it scrolls. A column shorter than the window sticks just under the
 * header. A taller one scrolls with the page until its own end comes into
 * view and then stays there (its top goes above the window), so nothing at
 * the bottom of it - like IWT Social's "Back to first post" - is ever out of
 * reach. Re-measured whenever the column or the window changes size.
 */
export function useStickyTop<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [top, setTop] = useState(HEADER_GAP_PX);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setTop(Math.min(HEADER_GAP_PX, window.innerHeight - el.offsetHeight - BOTTOM_GAP_PX));
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return { ref, top };
}

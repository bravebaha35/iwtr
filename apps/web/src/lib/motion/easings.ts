// The site's two named easing curves, shared by framer-motion (as bezier
// arrays) and CSS (as cubic-bezier() strings) so both stay in lockstep.

// Sharp in, sharp out: page transitions and the magnetic button snap-back.
export const SNAP_EASE = [0.87, 0, 0.13, 1] as const;
export const SNAP_EASE_CSS = "cubic-bezier(0.87, 0, 0.13, 1)";

// Fast start, long gentle settle: progress indicators.
export const SETTLE_EASE = [0.25, 1, 0.5, 1] as const;

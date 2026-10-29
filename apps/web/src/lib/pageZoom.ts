/**
 * The page's CSS zoom: 1 everywhere, 1.5 on 4K-wide screens (globals.css
 * scales the whole page up there so it isn't tiny).
 *
 * Under that zoom, measured values (getBoundingClientRect, clientX,
 * window.innerWidth/innerHeight, scroll offsets) come back in screen pixels,
 * but lengths written into styles are multiplied by the zoom again. So any
 * code that turns a measurement into a position or size must divide by this
 * first. Ratios of two measurements (a slider's fraction) need nothing.
 */
export function pageZoom(): number {
  if (typeof document === "undefined") return 1;
  const root = document.documentElement as HTMLElement & { currentCSSZoom?: number };
  if (typeof root.currentCSSZoom === "number" && root.currentCSSZoom > 0) return root.currentCSSZoom;
  const z = parseFloat(getComputedStyle(root).zoom);
  return Number.isFinite(z) && z > 0 ? z : 1;
}

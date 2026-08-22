// Pure geometry for LogoCropper's square-crop-with-pan-and-zoom UI — kept
// free of DOM/canvas so the math is unit-testable without a real image
// decode (jsdom can't do that meaningfully).

// The scale that makes the image's shorter side exactly cover a square
// viewport of the given size — the starting "fills the frame, nothing
// cropped off yet" zoom level.
export function baseScaleFor(naturalWidth: number, naturalHeight: number, viewport: number): number {
  return viewport / Math.min(naturalWidth, naturalHeight);
}

// Keeps the image's near/far edges from ever leaving a gap inside the
// viewport — `offset` is the image's left/top position in viewport
// coordinates, `displayedSize` is that dimension's current on-screen size
// (naturalSize * scale).
export function clampOffset({
  offset,
  displayedSize,
  viewport,
}: {
  offset: number;
  displayedSize: number;
  viewport: number;
}): number {
  const min = viewport - displayedSize;
  return Math.min(0, Math.max(min, offset));
}

// Recomputes `offset` after a scale change so the natural-image point that
// was under the viewport's center stays there — without this, zooming
// would visibly jump the image instead of zooming "into" what's centered.
export function recenterOffsetOnZoom({
  offset,
  oldScale,
  newScale,
  viewport,
}: {
  offset: number;
  oldScale: number;
  newScale: number;
  viewport: number;
}): number {
  const center = viewport / 2;
  const imageCoordAtCenter = (center - offset) / oldScale;
  return center - imageCoordAtCenter * newScale;
}

// The square region of the natural (full-resolution) image currently
// visible inside the viewport, in natural-image pixel coordinates — what
// gets drawn onto the export canvas.
export function sourceRectFor({
  offsetX,
  offsetY,
  scale,
  viewport,
}: {
  offsetX: number;
  offsetY: number;
  scale: number;
  viewport: number;
}): { sx: number; sy: number; sSize: number } {
  // `+ 0` normalizes a resulting -0 (e.g. offsetX 0 -> -0/scale) to plain 0
  // so callers never have to special-case the sign of zero.
  return { sx: -offsetX / scale + 0, sy: -offsetY / scale + 0, sSize: viewport / scale };
}

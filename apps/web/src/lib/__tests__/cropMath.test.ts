import { baseScaleFor, clampOffset, recenterOffsetOnZoom, sourceRectFor } from "../cropMath";

describe("baseScaleFor", () => {
  test("scales a wide image up so its shorter side just covers the viewport", () => {
    expect(baseScaleFor(800, 400, 200)).toBe(0.5);
  });

  test("scales a tall image up so its shorter side just covers the viewport", () => {
    expect(baseScaleFor(400, 800, 200)).toBe(0.5);
  });
});

describe("clampOffset", () => {
  test("leaves an offset alone when the image already covers the viewport", () => {
    expect(clampOffset({ offset: -20, displayedSize: 300, viewport: 200 })).toBe(-20);
  });

  test("pulls the offset back to 0 when it would leave a gap on the near edge", () => {
    expect(clampOffset({ offset: 10, displayedSize: 300, viewport: 200 })).toBe(0);
  });

  test("pulls the offset back to viewport-displayedSize when it would leave a gap on the far edge", () => {
    expect(clampOffset({ offset: -150, displayedSize: 300, viewport: 200 })).toBe(-100);
  });
});

describe("recenterOffsetOnZoom", () => {
  test("keeps the image point under the viewport center fixed while zooming in", () => {
    // scale doubles (1 -> 2) with the viewport centered at 100 and offset 0:
    // the natural-image point at the center was 100/1 = 100; after zooming,
    // that same point must still land at the center: 100 - 100*2 = -100.
    expect(recenterOffsetOnZoom({ offset: 0, oldScale: 1, newScale: 2, viewport: 200 })).toBe(-100);
  });

  test("is a no-op when the scale doesn't change", () => {
    expect(recenterOffsetOnZoom({ offset: -40, oldScale: 1.5, newScale: 1.5, viewport: 200 })).toBe(-40);
  });
});

describe("sourceRectFor", () => {
  test("derives the natural-image square currently visible in the viewport", () => {
    expect(sourceRectFor({ offsetX: -50, offsetY: -20, scale: 2, viewport: 200 })).toEqual({
      sx: 25,
      sy: 10,
      sSize: 100,
    });
  });

  test("derives an unscaled, unpanned rect as the viewport itself", () => {
    expect(sourceRectFor({ offsetX: 0, offsetY: 0, scale: 1, viewport: 200 })).toEqual({
      sx: 0,
      sy: 0,
      sSize: 200,
    });
  });
});

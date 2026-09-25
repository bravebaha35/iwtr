import { stampCvWatermark, WATERMARK_OPACITY, WATERMARK_SIZE_MM } from "../cvPdfWatermark";

function fakePdf(pages: number) {
  const calls: { page: number; opacity: number; image?: [string, string, number, number, number, number] }[] = [];
  let page = 1;
  let opacity = 1;
  const pdf = {
    internal: {
      getNumberOfPages: () => pages,
      pageSize: { getWidth: () => 210, getHeight: () => 297 },
    },
    GState: function (this: { opacity: number }, o: { opacity: number }) {
      this.opacity = o.opacity;
    },
    setPage: (n: number) => {
      page = n;
    },
    setGState: (g: { opacity: number }) => {
      opacity = g.opacity;
    },
    addImage: (data: string, format: string, x: number, y: number, w: number, h: number) => {
      calls.push({ page, opacity, image: [data, format, x, y, w, h] });
    },
  };
  return { pdf, calls, currentOpacity: () => opacity };
}

describe("stampCvWatermark", () => {
  it("puts the logo in the exact bottom-left corner of every page at 50% opacity", () => {
    const { pdf, calls, currentOpacity } = fakePdf(3);
    stampCvWatermark(pdf as never, "data:image/png;base64,AAA");

    expect(WATERMARK_OPACITY).toBe(0.5);
    expect(calls.map((c) => c.page)).toEqual([1, 2, 3]);
    for (const c of calls) {
      expect(c.opacity).toBe(0.5);
      expect(c.image).toEqual([
        "data:image/png;base64,AAA",
        "PNG",
        0,
        297 - WATERMARK_SIZE_MM,
        WATERMARK_SIZE_MM,
        WATERMARK_SIZE_MM,
      ]);
    }
    // Anything drawn afterwards isn't left half-transparent.
    expect(currentOpacity()).toBe(1);
  });

  it("is stamped at the page edge even when the CV fills only half a page", () => {
    const { pdf, calls } = fakePdf(1);
    stampCvWatermark(pdf as never, "data:image/png;base64,AAA");
    const [, , x, y, , h] = calls[0].image!;
    expect(x).toBe(0);
    expect(y + h).toBe(297);
  });
});

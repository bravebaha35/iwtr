import { FOOTER_BOTTOM_MM, FOOTER_HEIGHT_MM, FOOTER_LEFT_MM, stampCvFooter } from "../cvPdfFooter";

function fakePdf(pages: number) {
  const calls: { page: number; args: unknown[] }[] = [];
  let current = 1;
  return {
    calls,
    internal: { getNumberOfPages: () => pages, pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    setPage: (p: number) => {
      current = p;
    },
    addImage: (...args: unknown[]) => {
      calls.push({ page: current, args });
    },
  };
}

describe("stampCvFooter", () => {
  it("puts the footer at the bottom of every page", () => {
    const pdf = fakePdf(3);
    stampCvFooter(pdf, { dataUrl: "data:image/png;base64,AAA", aspect: 6 });
    expect(pdf.calls.map((c) => c.page)).toEqual([1, 2, 3]);
    for (const { args } of pdf.calls) {
      expect(args).toEqual([
        "data:image/png;base64,AAA",
        "PNG",
        FOOTER_LEFT_MM,
        297 - FOOTER_BOTTOM_MM - FOOTER_HEIGHT_MM,
        FOOTER_HEIGHT_MM * 6,
        FOOTER_HEIGHT_MM,
      ]);
    }
  });
});

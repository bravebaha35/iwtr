// The beaver mascot stamped onto every page of a CV PDF (ApplyButton.tsx).
// It is drawn straight onto each finished page with jsPDF, after the CV
// content is rendered, rather than laid out as part of the CV's HTML. So it
// is always at the page's own bottom-left corner, whether the CV fills half
// a page or three, and nothing a member types into their CV can push it
// around or paint over it.

export const WATERMARK_OPACITY = 0.5;
// A4 is 210 x 297 mm.
export const WATERMARK_SIZE_MM = 24;
export const WATERMARK_SRC = "/brand-mark.png";

// The slice of jsPDF's API this needs (html2pdf.js hands us a jsPDF instance).
interface PdfLike {
  internal: { getNumberOfPages(): number; pageSize: { getWidth(): number; getHeight(): number } };
  GState: new (options: { opacity: number }) => unknown;
  setPage(page: number): unknown;
  setGState(state: unknown): unknown;
  addImage(data: string, format: string, x: number, y: number, w: number, h: number): unknown;
}

export function stampCvWatermark(pdf: PdfLike, imageDataUrl: string): void {
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pages = pdf.internal.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setGState(new pdf.GState({ opacity: WATERMARK_OPACITY }));
    pdf.addImage(imageDataUrl, "PNG", 0, pageHeight - WATERMARK_SIZE_MM, WATERMARK_SIZE_MM, WATERMARK_SIZE_MM);
    pdf.setGState(new pdf.GState({ opacity: 1 }));
  }
}

/** Loads the watermark image as a data URL for jsPDF. */
export async function loadWatermarkDataUrl(): Promise<string> {
  const blob = await (await fetch(WATERMARK_SRC)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

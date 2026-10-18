// The CV footer ("Made in iworkedthere.com" with the beaver icon), stamped at
// the bottom of every page of a CV PDF (lib/cvPdf.ts) - not printed once
// after the last line of text. It is drawn onto each finished page with
// jsPDF, so it sits in the same place on page 1 and page 3 alike, and nothing
// a member types into their CV can push it around.
//
// The icon and words are drawn into a small picture first (a canvas, using
// the site's own font, already loaded on the page), because jsPDF's built-in
// fonts can't write Turkish letters like "ı".

export const FOOTER_ICON_SRC = "/realicon.png";
// A4 is 210 x 297 mm. Left edge lines up with the CV's text (48 px of 794).
export const FOOTER_LEFT_MM = 12.7;
export const FOOTER_HEIGHT_MM = 5.2;
// From the bottom of the paper to the bottom of the footer.
export const FOOTER_BOTTOM_MM = 6;

// The slice of jsPDF's API this needs (html2pdf.js hands us a jsPDF instance).
export interface PdfLike {
  internal: { getNumberOfPages(): number; pageSize: { getWidth(): number; getHeight(): number } };
  setPage(page: number): unknown;
  addImage(data: string, format: string, x: number, y: number, w: number, h: number): unknown;
}

export interface FooterImage {
  dataUrl: string;
  // width / height
  aspect: number;
}

export function stampCvFooter(pdf: PdfLike, footer: FooterImage): void {
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pages = pdf.internal.getNumberOfPages();
  const height = FOOTER_HEIGHT_MM;
  const width = height * footer.aspect;
  const y = pageHeight - FOOTER_BOTTOM_MM - height;
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.addImage(footer.dataUrl, "PNG", FOOTER_LEFT_MM, y, width, height);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load the footer icon."));
    img.src = src;
  });
}

/**
 * Draws the icon and `label` side by side, centred on one line, into a
 * transparent PNG. Sized in canvas pixels at a high resolution so it stays
 * sharp when printed.
 */
export async function renderCvFooterImage(label: string): Promise<FooterImage> {
  const icon = await loadImage(FOOTER_ICON_SRC);
  await document.fonts?.ready;
  const H = 96; // canvas height in px
  const ICON = 88; // icon box, a little bigger than the words
  const GAP = 26;
  const FONT_PX = 46;
  const family = getComputedStyle(document.body).fontFamily || "sans-serif";
  const font = `600 ${FONT_PX}px ${family}`;

  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = font;
  const textWidth = Math.ceil(measure.measureText(label).width);

  const canvas = document.createElement("canvas");
  canvas.width = ICON + GAP + textWidth + 4;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const iconSize = Math.min(ICON, (icon.naturalHeight / icon.naturalWidth) * ICON);
  ctx.drawImage(icon, 0, (H - iconSize) / 2, ICON, iconSize);
  ctx.font = font;
  ctx.fillStyle = "#5b6659";
  ctx.textBaseline = "middle";
  ctx.fillText(label, ICON + GAP, H / 2 + 2);
  return { dataUrl: canvas.toDataURL("image/png"), aspect: canvas.width / canvas.height };
}

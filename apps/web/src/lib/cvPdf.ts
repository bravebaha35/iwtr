import { renderCvFooterImage, stampCvFooter, type PdfLike } from "@/lib/cvPdfFooter";

// The jsPDF instance html2pdf.js hands back, as far as this file uses it.
type CvPdf = PdfLike & {
  output(type: "blob"): Blob;
  save(filename: string): void;
};

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_TOP_MM = 8;
// The band the page footer is stamped into.
const MARGIN_BOTTOM_MM = 16;

/** How many CSS pixels of the CV fit on one PDF page, at the CV's width. */
export function pageContentHeightPx(elementWidthPx: number): number {
  return ((A4_HEIGHT_MM - MARGIN_TOP_MM - MARGIN_BOTTOM_MM) / A4_WIDTH_MM) * elementWidthPx;
}

/** True when sheet 2 should continue on the same page rather than start a new one. */
function shouldFlowSheets(element: HTMLElement): boolean {
  const page = pageContentHeightPx(element.offsetWidth);
  const sheet1 = element.querySelector<HTMLElement>(".cv-sheet:not(.cv-sheet-2)");
  const sheet2 = element.querySelector<HTMLElement>(".cv-sheet-2");
  if (!sheet1 || !sheet2) return false;
  return sheet1.offsetHeight > page || sheet1.offsetHeight + sheet2.offsetHeight <= page;
}

/**
 * Turns a rendered CvPreview element into an A4 PDF, with the
 * "Made in iworkedthere.com" footer at the bottom of every page
 * (`footerLabel`, already translated). One function for both the PDF sent with a job
 * application (ApplyButton) and the one a member downloads from My CV, so
 * the two are always the same file.
 */
export async function renderCvPdf(element: HTMLElement, footerLabel: string): Promise<CvPdf> {
  // Two frames: let the browser lay the element out (and paint the photo)
  // before html2canvas measures it.
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await Promise.all(
    Array.from(element.querySelectorAll("img")).map((img) =>
      img.complete ? Promise.resolve() : new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      }),
    ),
  );

  // Sheet 2 (work history, certificates, education) normally starts a new
  // page. It follows straight on instead when that break would only waste
  // paper: the whole CV fits on one page (a short CV), or sheet 1 already
  // runs past one page (a long profile, many skills).
  element.classList.add("cv-printing");
  const flowOn = shouldFlowSheets(element);
  element.classList.remove("cv-printing");

  const html2pdf = (await import("html2pdf.js")).default;
  // html2pdf.js's own type declaration leaves out `pagebreak` and some
  // html2canvas options it does support, hence the intersection type.
  const options: Parameters<InstanceType<typeof html2pdf.Worker>["set"]>[0] & {
    pagebreak?: { mode: Array<"avoid-all" | "css" | "legacy">; before?: string };
  } = {
    filename: "cv.pdf",
    // Top margin so a second page does not start flush against the edge;
    // the bottom margin is the band the page footer is stamped into.
    margin: [MARGIN_TOP_MM, 0, MARGIN_BOTTOM_MM, 0],
    image: { type: "jpeg", quality: 0.95 },
    // Sharper text; useCORS lets the CV photo (served by the API) be drawn.
    html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
    jsPDF: { format: "a4", unit: "mm" },
    pagebreak: flowOn ? { mode: ["css", "legacy"] } : { mode: ["css", "legacy"], before: ".cv-sheet-2" },
  };
  const footer = await renderCvFooterImage(footerLabel);
  element.classList.add("cv-printing");
  if (flowOn) element.classList.add("cv-flowing");
  let pdf: CvPdf;
  try {
    pdf = (await html2pdf().set(options).from(element).toPdf().get("pdf")) as CvPdf;
  } finally {
    element.classList.remove("cv-printing", "cv-flowing");
  }
  stampCvFooter(pdf, footer);
  return pdf;
}

/**
 * "Mehmet Ahmetoğlu CV.pdf" (Turkish: "Mehmet Ahmetoğlu Özgeçmiş.pdf") - a
 * safe file name from the member's display name, in the site's language.
 */
export function cvFileName(displayName: string | null | undefined, locale: "en" | "tr" = "en"): string {
  const word = locale === "tr" ? "Özgeçmiş" : "CV";
  const base = (displayName ?? "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return base ? `${base} ${word}.pdf` : `${word}.pdf`;
}

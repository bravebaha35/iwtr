import { renderCvFooterImage, stampCvFooter, type PdfLike } from "@/lib/cvPdfFooter";

// The jsPDF instance html2pdf.js hands back, as far as this file uses it.
type CvPdf = PdfLike & {
  output(type: "blob"): Blob;
  save(filename: string): void;
};

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

  const html2pdf = (await import("html2pdf.js")).default;
  // html2pdf.js's own type declaration leaves out `pagebreak` and some
  // html2canvas options it does support, hence the intersection type.
  const options: Parameters<InstanceType<typeof html2pdf.Worker>["set"]>[0] & {
    pagebreak?: { mode: Array<"avoid-all" | "css" | "legacy">; before?: string };
  } = {
    filename: "cv.pdf",
    // Top margin so a second page does not start flush against the edge;
    // the bottom margin is the band the page footer is stamped into.
    margin: [8, 0, 16, 0],
    image: { type: "jpeg", quality: 0.95 },
    // Sharper text; useCORS lets the CV photo (served by the API) be drawn.
    html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
    jsPDF: { format: "a4", unit: "mm" },
    // Sheet 2 (work history, certificates, education) always starts a page.
    pagebreak: { mode: ["css", "legacy"], before: ".cv-sheet-2" },
  };
  const footer = await renderCvFooterImage(footerLabel);
  element.classList.add("cv-printing");
  let pdf: CvPdf;
  try {
    pdf = (await html2pdf().set(options).from(element).toPdf().get("pdf")) as CvPdf;
  } finally {
    element.classList.remove("cv-printing");
  }
  stampCvFooter(pdf, footer);
  return pdf;
}

/** "Mehmet Ahmetoğlu CV.pdf" - a safe file name from the member's display name. */
export function cvFileName(displayName: string | null | undefined): string {
  const base = (displayName ?? "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return base ? `${base} CV.pdf` : "CV.pdf";
}

import path from "node:path";
import PDFDocument from "pdfkit";
import type { SectorBenchmarkReportData } from "./sector-benchmark.service";

// apps/api/assets — three levels up from both src/modules/rival-analytics
// (tests, ts-node) and dist/modules/rival-analytics (the built server).
export const ASSET_DIR = path.resolve(__dirname, "../../../assets");
const FONT_DIR = path.join(ASSET_DIR, "fonts");
export const FONT_REGULAR = "Jakarta";
export const FONT_BOLD = "Jakarta-Bold";

export type PdfDoc = InstanceType<typeof PDFDocument>;

/**
 * Embeds Plus Jakarta Sans (OFL, see assets/fonts/OFL.txt) and makes it the
 * document font. pdfkit's built-in Helvetica only covers WinAnsi, so
 * Turkish letters like ş, ğ and İ in company or sector names would
 * otherwise print as garbage.
 */
export function registerBrandFonts(doc: PdfDoc): void {
  doc.registerFont(FONT_REGULAR, path.join(FONT_DIR, "PlusJakartaSans-Regular.ttf"));
  doc.registerFont(FONT_BOLD, path.join(FONT_DIR, "PlusJakartaSans-Bold.ttf"));
  doc.font(FONT_REGULAR);
}

const TRY = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

function formatTl(value: number): string {
  return `${TRY.format(value)} TL`;
}

/**
 * The Sector Benchmark Report PDF: white page, black text, Plus Jakarta
 * Sans throughout. It only ever receives already-aggregated, k-anonymous figures (see SectorBenchmarkService) —
 * there is no individual answer or exact salary anywhere in its input.
 */
export function buildSectorBenchmarkPdf(data: SectorBenchmarkReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, info: { Title: `Sector Benchmark: ${data.sectorCategory}` } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    registerBrandFonts(doc);
    doc.fillColor("#000000");

    const heading = (text: string) => {
      doc.moveDown(1);
      doc.font(FONT_BOLD).fontSize(14).text(text);
      doc.moveDown(0.3);
      doc.font(FONT_REGULAR).fontSize(10.5);
    };
    const muted = (text: string) => {
      doc.fillColor("#444444").fontSize(9).text(text).fillColor("#000000").fontSize(10.5);
    };

    doc.font(FONT_BOLD).fontSize(22).text(`Sector Benchmark: ${data.sectorCategory}`);
    doc.font(FONT_REGULAR).fontSize(11).text(data.city ? `${data.city}` : "All of Turkey");
    doc.moveDown(0.3);
    muted(
      `Prepared for ${data.requestingCompanyName} on ${data.generatedAt.toISOString().slice(0, 10)} by iworkedthere.com. ` +
        `Based on ${data.reviewCount} published reviews across ${data.companyCount} companies.`,
    );

    heading("Monthly net salary");
    if (data.salaryBands.length === 0) {
      doc.text("Not enough salary answers yet to show figures without risking anyone's anonymity.");
    } else {
      for (const band of data.salaryBands) {
        doc.font(FONT_BOLD).text(`${band.salaryYear}`, { continued: true }).font(FONT_REGULAR);
        doc.text(
          `   Lower quarter ${formatTl(band.bottom25)}  ·  Middle ${formatTl(band.median)}  ·  Upper quarter ${formatTl(band.top75)}`,
        );
        muted(`${band.respondentCount} people. Figures are rounded to the nearest 500 TL.`);
      }
    }

    heading("Benefits");
    if (data.benefits.length === 0) {
      doc.text("Not enough benefit answers yet to show figures without risking anyone's anonymity.");
    } else {
      muted(`Share of ${data.benefitRespondentCount} people who receive each benefit.`);
      for (const share of data.benefits) {
        drawLabelledBar(doc, share.label, share.percent);
      }
    }

    const questionList = (title: string, rows: SectorBenchmarkReportData["mostAgreed"], key: "agreePercent" | "disagreePercent", note: string) => {
      heading(title);
      muted(note);
      if (rows.length === 0) {
        doc.text("Not enough answers yet.");
        return;
      }
      rows.forEach((row, i) => {
        doc.text(`${i + 1}. ${row.text}`, { continued: true }).font(FONT_BOLD).text(`  ${row[key]}%`).font(FONT_REGULAR);
      });
    };
    questionList(
      "Where the sector does best",
      data.mostAgreed,
      "agreePercent",
      "Questions where the most reviewers gave the healthy-workplace answer.",
    );
    questionList(
      "Where the sector struggles",
      data.mostDisagreed,
      "disagreePercent",
      "Questions where the most reviewers gave the unhealthy-workplace answer.",
    );

    heading("Risk of staff leaving");
    doc.font(FONT_BOLD).fontSize(18).text(`${data.turnover.turnoverRiskPercentage}%`).font(FONT_REGULAR).fontSize(10.5);
    doc.text(data.turnover.explanation);

    heading("How this report protects reviewers");
    muted(
      "Every figure is built from at least 5 different people at 3 or more different companies; anything thinner is left out. " +
        "Salaries are only ever shown as rounded ranges, never as individual amounts or averages, and each year is reported separately. " +
        "Salary data comes only from reviewers who gave explicit consent under KVKK.",
    );

    doc.end();
  });
}

const BAR_LABEL_WIDTH = 170;
const BAR_WIDTH = 220;

function drawLabelledBar(doc: PdfDoc, label: string, percent: number): void {
  const x = doc.page.margins.left;
  const y = doc.y;
  doc.text(label, x, y, { width: BAR_LABEL_WIDTH });
  const barY = y + 3;
  doc.rect(x + BAR_LABEL_WIDTH, barY, BAR_WIDTH, 8).fill("#e5e5e5");
  if (percent > 0) doc.rect(x + BAR_LABEL_WIDTH, barY, (BAR_WIDTH * Math.min(100, percent)) / 100, 8).fill("#000000");
  doc.fillColor("#000000").text(`${percent}%`, x + BAR_LABEL_WIDTH + BAR_WIDTH + 8, y);
  doc.x = x;
  doc.y = Math.max(doc.y, y + 14);
}

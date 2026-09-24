import path from "node:path";
import PDFDocument from "pdfkit";
import type { VibeFlag } from "@iwtr/shared-types";
import type { ThemeMention } from "./comment-theme-summary.util";
import type { SectorBenchmarkReportData } from "./sector-benchmark.service";

// apps/api/assets/fonts — three levels up from both src/modules/rival-analytics
// (tests, ts-node) and dist/modules/rival-analytics (the built server).
const FONT_DIR = path.resolve(__dirname, "../../../assets/fonts");
const FONT_REGULAR = "Jakarta";
const FONT_BOLD = "Jakarta-Bold";

type PdfDoc = InstanceType<typeof PDFDocument>;

/**
 * Embeds Plus Jakarta Sans (OFL, see assets/fonts/OFL.txt) and makes it the
 * document font. pdfkit's built-in Helvetica only covers WinAnsi, so
 * Turkish letters like ş, ğ and İ in company or sector names would
 * otherwise print as garbage.
 */
function registerBrandFonts(doc: PdfDoc): void {
  doc.registerFont(FONT_REGULAR, path.join(FONT_DIR, "PlusJakartaSans-Regular.ttf"));
  doc.registerFont(FONT_BOLD, path.join(FONT_DIR, "PlusJakartaSans-Bold.ttf"));
  doc.font(FONT_REGULAR);
}

export interface RivalAnalyticsReportData {
  targetCompanyName: string;
  requestingCompanyName: string;
  // For an audit-trail footer only — never used to decide report content.
  requesterTier: "STARTER" | "PRO" | "ENTERPRISE" | null;
  generatedAt: Date;
  overallRating: number | null;
  reviewCount: number;
  mostAgreed: { text: string; category: string } | null;
  mostDisputed: { text: string; category: string } | null;
  vibeFlags: VibeFlag[];
  commentThemes: ThemeMention[];
}

/**
 * Renders the aggregated (already-anonymized) rival-analytics data into a
 * PDF. Purely presentational — every value it receives has already had any
 * anonymity-sensitive detail (individual comments, individual answers)
 * stripped by the caller; this function has no access to raw review data
 * at all, so it cannot leak what it was never given.
 */
export function buildRivalAnalyticsPdf(data: RivalAnalyticsReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    registerBrandFonts(doc);

    doc.fontSize(20).text(`Rival Analytics: ${data.targetCompanyName}`);
    doc.moveDown(0.5);
    doc
      .fontSize(9)
      .fillColor("#666666")
      .text(
        `Generated ${data.generatedAt.toISOString()} for ${data.requestingCompanyName}` +
          (data.requesterTier ? ` (${data.requesterTier})` : ""),
      );
    doc.fillColor("#000000");
    doc.moveDown(1);

    doc.fontSize(14).text("Overall Rating");
    doc
      .fontSize(11)
      .text(
        data.reviewCount === 0
          ? "No published reviews yet."
          : `${data.overallRating?.toFixed(1)} / 5 across ${data.reviewCount} review${data.reviewCount === 1 ? "" : "s"}`,
      );
    if (data.reviewCount > 0 && data.overallRating !== null) {
      drawMeterBar(doc, data.overallRating / 5, "#16a34a");
    }
    doc.moveDown(1);

    doc.fontSize(14).text("What Reviewers Said");
    doc
      .fontSize(11)
      .text(`Most agreed on: ${data.mostAgreed ? data.mostAgreed.text : "Not enough data yet."}`)
      .text(`Most disputed: ${data.mostDisputed ? data.mostDisputed.text : "Not enough data yet."}`);
    doc.moveDown(1);

    doc.fontSize(14).text("Workplace Vibe Flags");
    if (data.vibeFlags.length === 0) {
      doc.fontSize(11).text("Not enough data yet.");
    } else {
      const greenCount = data.vibeFlags.filter((f) => f.color === "GREEN").length;
      drawSplitBar(doc, greenCount, data.vibeFlags.length - greenCount);
      for (const flag of data.vibeFlags) {
        doc.fontSize(11).text(`${flag.color === "GREEN" ? "+" : "-"} ${flag.label}`);
      }
    }
    doc.moveDown(1);

    doc.fontSize(14).text("Comment Themes (anonymized — counts only, no individual comments)");
    const mentioned = data.commentThemes.filter((t) => t.mentionCount > 0);
    if (mentioned.length === 0) {
      doc.fontSize(11).text("No themes surfaced yet.");
    } else {
      for (const theme of mentioned) {
        doc.fontSize(11).text(`${theme.theme}: mentioned in ${theme.mentionCount} review${theme.mentionCount === 1 ? "" : "s"}`);
      }
    }

    doc.end();
  });
}

const METER_WIDTH = 200;
const METER_HEIGHT = 10;

// A filled horizontal track — 0 = empty, 1 = completely full — used for the
// Overall Rating gauge. Drawing doesn't advance doc.y the way .text() does,
// so callers must moveDown afterward themselves.
function drawMeterBar(doc: PdfDoc, fraction: number, fillColor: string): void {
  const x = doc.x;
  const y = doc.y + 4;
  const clamped = Math.max(0, Math.min(1, fraction));
  doc.rect(x, y, METER_WIDTH, METER_HEIGHT).fill("#e5e7eb");
  if (clamped > 0) {
    doc.rect(x, y, METER_WIDTH * clamped, METER_HEIGHT).fill(fillColor);
  }
  doc.fillColor("#000000");
  doc.y = y + METER_HEIGHT + 6;
}

// A single bar split green/red by count — the at-a-glance shape of a
// company's Workplace Vibe Flags before the reader gets to the list below.
function drawSplitBar(doc: PdfDoc, greenCount: number, redCount: number): void {
  const total = greenCount + redCount;
  if (total === 0) return;
  const x = doc.x;
  const y = doc.y + 4;
  const greenWidth = (METER_WIDTH * greenCount) / total;
  if (greenWidth > 0) {
    doc.rect(x, y, greenWidth, METER_HEIGHT).fill("#16a34a");
  }
  if (greenWidth < METER_WIDTH) {
    doc.rect(x + greenWidth, y, METER_WIDTH - greenWidth, METER_HEIGHT).fill("#dc2626");
  }
  doc.fillColor("#000000");
  doc.y = y + METER_HEIGHT + 6;
}

const TRY = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

function formatTl(value: number): string {
  return `${TRY.format(value)} TL`;
}

/**
 * The Sector Benchmark Report PDF: white page, black text, Plus Jakarta
 * Sans throughout. Like buildRivalAnalyticsPdf it only ever receives
 * already-aggregated, k-anonymous figures (see SectorBenchmarkService) —
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

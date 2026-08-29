import PDFDocument from "pdfkit";
import type { VibeFlag } from "@iwtr/shared-types";
import type { ThemeMention } from "./comment-theme-summary.util";

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

type PdfDoc = InstanceType<typeof PDFDocument>;

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

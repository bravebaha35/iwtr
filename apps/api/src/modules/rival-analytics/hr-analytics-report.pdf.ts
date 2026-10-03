import path from "node:path";
import PDFDocument from "pdfkit";
import { ASSET_DIR, FONT_BOLD, FONT_REGULAR, registerBrandFonts, type PdfDoc } from "./pdf-report.builder";
import type {
  HrAnalyticsReportData,
  HrReportCategory,
  HrReportFlag,
  HrReportPostingImpact,
  HrReportWorkType,
} from "./hr-analytics-report.data";

const BRAND_MARK = path.join(ASSET_DIR, "brand-mark.png");

// Deep-slate monochrome: one ink, one rule colour, greys for everything else.
const INK = "#0f172a"; // slate-900
const RULE = "#1e293b"; // slate-800
const STEEL = "#475569"; // slate-600, secondary text
const GRAY = "#64748b"; // slate-500, labels
const HAIR = "#cbd5e1"; // slate-300, row hairlines
const PANEL = "#e2e8f0"; // slate-200, header fills
const WASH = "#f1f5f9"; // slate-100, table header fills
const ON_INK = "#94a3b8"; // slate-400, quiet text on an ink bar

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const M = 36;
const W = PAGE_W - 2 * M;
const BOTTOM = PAGE_H - M - 30; // content stops here, the footer sits below

const RISK_NOTES: Record<number, string> = {
  0: "No repeat postings for the same role. A clean track record so far.",
  1: "One identical role was reposted after a prior posting was marked filled.",
  2: "Identical roles were reposted twice after prior postings were marked filled.",
  3: "Maximum score: identical roles were repeatedly reposted after being marked filled.",
};

const IMPACT_TEXT: Record<HrReportPostingImpact, string> = {
  RAISED: "+1 risk",
  KEPT_CLEAN: "Positive",
  NONE: "Neutral",
};

const TONE_ORDER: Record<HrReportFlag["tone"], number> = { STRENGTH: 0, CONCERN: 1, MIXED: 2 };
const TONE_TAG: Record<HrReportFlag["tone"], string> = { STRENGTH: "STRENGTH", CONCERN: "CONCERN", MIXED: "MIXED SIGNAL" };

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/**
 * The HR Analytics Report PDF. A4, Plus Jakarta Sans, slate monochrome,
 * square corners throughout. Page 1: company header, Vibe Flags (each with
 * the sentence explaining it), Risk Score with its posting history. Then one
 * page per reviewed work type with every survey question as percentages.
 * Rows that don't fit move to the next page, so any number of flags or
 * postings lays out cleanly. The brand mark sits bottom left on every page.
 */
export function buildHrAnalyticsPdf(data: HrAnalyticsReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: M, left: M, right: M, bottom: 10 },
      bufferPages: true,
      info: { Title: `HR Analytics Report: ${data.company.name}`, Author: "iworkedthere.com" },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      registerBrandFonts(doc);
      new HrReportLayout(doc, data).render();
      drawFooters(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

class HrReportLayout {
  private y = M;

  constructor(
    private readonly doc: PdfDoc,
    private readonly data: HrAnalyticsReportData,
  ) {}

  render(): void {
    this.pageStrip();
    this.companyHeader();
    this.sectionBar("Vibe flags", "What reviewers' answers add up to, and why");
    for (const workType of this.data.workTypes) this.flagGrid(workType);
    this.y += 14;
    this.riskBlock();
    this.data.workTypes.forEach((workType) => {
      this.newPage();
      this.sectionBar(`Survey breakdown: ${workType.label} reviewers`, "Share of reviewers giving each answer");
      for (const category of workType.categories) this.categoryBlock(category);
    });
    this.privacyNote();
  }

  // ---- primitives -------------------------------------------------------

  /** A fresh page, opened by the same report strip as every other page. */
  private newPage(): void {
    this.doc.addPage();
    this.y = M;
    this.pageStrip();
  }

  /** Moves to a fresh page when `height` won't fit. True when it did. */
  private ensure(height: number): boolean {
    if (this.y + height <= BOTTOM) return false;
    this.newPage();
    return true;
  }

  private label(text: string, x: number, y: number, options: PDFKit.Mixins.TextOptions & { color?: string } = {}): void {
    const { color = GRAY, ...rest } = options;
    this.doc.font(FONT_BOLD).fontSize(6.2).fillColor(color).text(text.toUpperCase(), x, y, { characterSpacing: 1.1, lineBreak: false, ...rest });
  }

  private textHeight(text: string, font: string, size: number, width: number): number {
    return this.doc.font(font).fontSize(size).heightOfString(text, { width, lineGap: 0.6 });
  }

  /** Full-width ink bar with a tracked uppercase title. */
  private sectionBar(title: string, meta: string): void {
    this.ensure(18 + 60);
    const { doc } = this;
    doc.rect(M, this.y, W, 18).fill(INK);
    this.label(title, M + 8, this.y + 6, { color: "#ffffff" });
    doc.font(FONT_REGULAR).fontSize(6.8).fillColor(ON_INK).text(meta, M, this.y + 5.6, { width: W - 8, align: "right", lineBreak: false });
    this.y += 18;
  }

  // ---- page 1 -----------------------------------------------------------

  /** Report name and date above a heavy rule, on top of every content page. */
  private pageStrip(): void {
    const { doc } = this;
    this.label("HR Analytics Report", M, this.y, { color: INK });
    doc
      .font(FONT_REGULAR)
      .fontSize(7)
      .fillColor(GRAY)
      .text(`${this.data.company.name}  |  Prepared ${DAY.format(this.data.generatedAt)}`, M, this.y - 0.5, { width: W, align: "right", lineBreak: false });
    this.y += 11;
    doc.rect(M, this.y, W, 2).fill(INK);
    this.y += 10;
  }

  private companyHeader(): void {
    const { doc } = this;
    const { company } = this.data;
    const h = 100;
    const logoW = 100;
    const contactW = 176;
    const infoW = W - logoW - contactW;
    const top = this.y;

    doc.lineWidth(1).strokeColor(RULE);
    doc.rect(M, top, W, h).stroke();
    doc.moveTo(M + logoW, top).lineTo(M + logoW, top + h).stroke();
    doc.moveTo(M + logoW + infoW, top).lineTo(M + logoW + infoW, top + h).stroke();

    this.logo(M + 18, top + 18, 64);

    // General info
    const ix = M + logoW + 14;
    const iw = infoW - 28;
    this.label("Company", ix, top + 12);
    const nameSize = this.textHeight(company.name, FONT_BOLD, 17, iw) > 44 ? 13 : 17;
    doc.font(FONT_BOLD).fontSize(nameSize).fillColor(INK).text(company.name, ix, top + 22, { width: iw, height: 44, ellipsis: true, lineGap: 0.6 });
    const facts = [company.category, company.location].filter(Boolean).join("  |  ");
    doc.font(FONT_REGULAR).fontSize(8).fillColor(STEEL).text(facts, ix, top + 68, { width: iw, lineBreak: false, ellipsis: true });
    doc.text(`Work types: ${company.workTypes.join(", ")}`, ix, top + 80, { width: iw, lineBreak: false, ellipsis: true });

    // Contact details, plain text only (never clickable links).
    const cx = M + logoW + infoW + 12;
    const cw = contactW - 24;
    const rows: [string, string | null][] = [
      ["Website", company.website],
      ["Email", company.email],
      ["Phone", company.phone],
    ];
    rows.forEach(([name, value], i) => {
      const ry = top + 12 + i * 29;
      this.label(name, cx, ry);
      doc
        .font(FONT_REGULAR)
        .fontSize(8.2)
        .fillColor(value ? INK : GRAY)
        .text(value ?? "Not given", cx, ry + 9, { width: cw, lineBreak: false, ellipsis: true });
    });

    this.y = top + h + 16;
  }

  /** The company's own uploaded logo, or a monogram square. */
  private logo(x: number, y: number, size: number): void {
    const { doc } = this;
    const path = this.data.company.logoPath;
    if (path) {
      try {
        doc.image(path, x, y, { fit: [size, size], align: "center", valign: "center" });
        return;
      } catch {
        // unreadable image file: fall through to the monogram
      }
    }
    const initials = this.data.company.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toLocaleUpperCase("tr-TR"))
      .join("");
    doc.rect(x, y, size, size).fill(INK);
    doc.font(FONT_BOLD).fontSize(22).fillColor("#ffffff").text(initials, x, y + size / 2 - 14, { width: size, align: "center", lineBreak: false });
  }

  private flagGrid(workType: HrReportWorkType): void {
    const { doc } = this;
    if (this.data.workTypes.length > 1) {
      this.ensure(16 + 50);
      this.label(`${workType.label} reviewers`, M, this.y + 6, { color: INK });
      this.y += 16;
    }
    const flags = [...workType.flags].sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
    const colW = W / 2;
    const pad = 9;
    const inner = colW - 2 * pad;
    const cellHeight = (flag: HrReportFlag) =>
      pad + 11 + 6 + this.textHeight(flag.label, FONT_BOLD, 9.5, inner) + 2 + this.textHeight(flag.explanation, FONT_REGULAR, 7.4, inner) + pad;

    for (let i = 0; i < flags.length; i += 2) {
      const pair = flags.slice(i, i + 2);
      const rowH = Math.max(...pair.map(cellHeight));
      this.ensure(rowH);
      pair.forEach((flag, col) => {
        const x = M + col * colW;
        doc.lineWidth(0.75).strokeColor(RULE).rect(x, this.y, colW, rowH).stroke();
        this.tag(flag.tone, x + pad, this.y + pad);
        const ly = this.y + pad + 11 + 6;
        doc.font(FONT_BOLD).fontSize(9.5).fillColor(INK).text(flag.label, x + pad, ly, { width: inner, lineGap: 0.6 });
        doc.font(FONT_REGULAR).fontSize(7.4).fillColor(STEEL).text(flag.explanation, x + pad, doc.y + 2, { width: inner, lineGap: 0.6 });
      });
      if (pair.length === 1) {
        doc.lineWidth(0.75).strokeColor(RULE).rect(M + colW, this.y, colW, rowH).stroke();
      }
      this.y += rowH;
    }
  }

  /** Filled tag for a strength, outlined for a concern, dashed for mixed signals. */
  private tag(tone: HrReportFlag["tone"], x: number, y: number): void {
    const { doc } = this;
    const text = TONE_TAG[tone];
    doc.font(FONT_BOLD).fontSize(5.8);
    const w = doc.widthOfString(text, { characterSpacing: 1 }) + 10;
    if (tone === "STRENGTH") {
      doc.rect(x, y, w, 11).fill(INK);
    } else if (tone === "CONCERN") {
      doc.lineWidth(0.9).strokeColor(INK).rect(x + 0.45, y + 0.45, w - 0.9, 10.1).stroke();
    } else {
      doc.lineWidth(0.9).strokeColor(GRAY).dash(2, { space: 1.5 }).rect(x + 0.45, y + 0.45, w - 0.9, 10.1).stroke().undash();
    }
    doc
      .fillColor(tone === "STRENGTH" ? "#ffffff" : tone === "CONCERN" ? INK : STEEL)
      .text(text, x + 5, y + 3, { characterSpacing: 1, lineBreak: false });
  }

  private riskBlock(): void {
    const { doc } = this;
    const leftW = 168;
    const rightW = W - leftW;
    const rowH = 15;
    const headH = 16;
    const olderH = 16;
    const footnoteH = 26;
    const minH = 126;
    const all = this.data.risk;

    // Keep the Risk Score on the same page as the flags when it can: show
    // as many of the newest postings as fit (at least MIN_ROWS) and count
    // the rest as older. Only when not even that fits does it move on.
    const MIN_ROWS = 4;
    const rowsFitting = (space: number) => Math.floor((space - 18 - footnoteH - headH - olderH) / rowH);
    if (rowsFitting(BOTTOM - this.y) < Math.min(MIN_ROWS, all.postings.length) || BOTTOM - this.y < 18 + minH + footnoteH) {
      this.newPage();
    }
    const shown = Math.max(Math.min(MIN_ROWS, all.postings.length), Math.min(all.postings.length, rowsFitting(BOTTOM - this.y)));
    const risk = {
      ...all,
      postings: all.postings.slice(0, shown),
      olderPostingsNotShown: all.olderPostingsNotShown + all.postings.length - shown,
    };
    const tableH = risk.score === null ? 40 : headH + Math.max(1, risk.postings.length) * rowH + (risk.olderPostingsNotShown > 0 ? olderH : 0);
    const h = Math.max(minH, tableH);

    this.sectionBar("Risk score", "Reposting a role after marking it filled raises the score");
    const top = this.y;
    doc.lineWidth(1).strokeColor(RULE).rect(M, top, W, h).stroke();
    doc.moveTo(M + leftW, top).lineTo(M + leftW, top + h).stroke();

    // Left: the score and its meter.
    const lx = M + 12;
    const lw = leftW - 24;
    this.label("Current score", lx, top + 12);
    if (risk.score === null) {
      doc.font(FONT_BOLD).fontSize(34).fillColor(GRAY).text("-", lx, top + 24, { lineBreak: false });
      doc.font(FONT_REGULAR).fontSize(7.4).fillColor(STEEL).text("No job postings yet, so there is no history to score.", lx, top + 72, { width: lw, lineGap: 0.6 });
    } else {
      doc.font(FONT_BOLD).fontSize(38).fillColor(INK).text(String(risk.score), lx, top + 20, { lineBreak: false, continued: false });
      const numW = doc.widthOfString(String(risk.score));
      doc.font(FONT_REGULAR).fontSize(13).fillColor(GRAY).text("/3", lx + numW + 3, top + 42, { lineBreak: false });
      const segW = (lw - 8) / 3;
      for (let i = 0; i < 3; i++) {
        doc.rect(lx + i * (segW + 4), top + 72, segW, 6).fill(i < risk.score ? INK : PANEL);
      }
      doc.font(FONT_REGULAR).fontSize(7.4).fillColor(STEEL).text(RISK_NOTES[risk.score] ?? "", lx, top + 86, { width: lw, lineGap: 0.6 });
    }

    // Right: posting history.
    const rx = M + leftW;
    const cols = [
      { name: "Role", w: rightW - 62 - 50 - 64 - 56 },
      { name: "Type", w: 62 },
      { name: "Posted", w: 50 },
      { name: "Outcome", w: 64 },
      { name: "Impact", w: 56 },
    ];
    if (risk.score === null) {
      doc.font(FONT_REGULAR).fontSize(8).fillColor(STEEL).text("Posting history appears here once you publish a job.", rx + 12, top + 14, { width: rightW - 24 });
    } else {
      doc.rect(rx + 0.5, top + 0.5, rightW - 1, headH).fill(WASH);
      let cx = rx + 10;
      for (const col of cols) {
        this.label(col.name, cx, top + 5.5);
        cx += col.w;
      }
      let ry = top + headH;
      if (risk.postings.length === 0) {
        doc.font(FONT_REGULAR).fontSize(7.6).fillColor(STEEL).text("No postings.", rx + 10, ry + 4, { lineBreak: false });
      }
      for (const posting of risk.postings) {
        doc.lineWidth(0.5).strokeColor(HAIR).moveTo(rx, ry).lineTo(rx + rightW, ry).stroke();
        const cells = [posting.jobTitle, posting.workType ?? "-", posting.postedMonth, posting.outcome, IMPACT_TEXT[posting.impact]];
        cx = rx + 10;
        cells.forEach((value, i) => {
          const isImpact = i === cells.length - 1;
          const strong = (isImpact && posting.impact !== "NONE") || i === 0;
          doc
            .font(strong ? FONT_BOLD : FONT_REGULAR)
            .fontSize(7.4)
            .fillColor(isImpact && posting.impact === "NONE" ? GRAY : INK)
            .text(value, cx, ry + 4.3, { width: cols[i].w - 8, lineBreak: false, ellipsis: true });
          cx += cols[i].w;
        });
        ry += rowH;
      }
      if (risk.olderPostingsNotShown > 0) {
        doc.lineWidth(0.5).strokeColor(HAIR).moveTo(rx, ry).lineTo(rx + rightW, ry).stroke();
        doc
          .font(FONT_REGULAR)
          .fontSize(7)
          .fillColor(GRAY)
          .text(`${risk.olderPostingsNotShown} older posting${risk.olderPostingsNotShown === 1 ? "" : "s"} not shown.`, rx + 10, ry + 4.5, { lineBreak: false });
      }
    }
    this.y = top + h + 6;

    doc
      .font(FONT_REGULAR)
      .fontSize(6.8)
      .fillColor(GRAY)
      .text(
        "Impact: +1 risk means the posting reopened a role marked filled and raised the score. Positive means the role was filled and never reopened. Neutral means no effect.",
        M,
        this.y,
        { width: W, lineGap: 0.6 },
      );
    this.y = doc.y + 6;
  }

  // ---- survey pages -----------------------------------------------------

  private categoryBlock(category: HrReportCategory): void {
    const { doc } = this;
    const numW = 54;
    const healthyW = 76;
    const qx = M + 8;
    const qw = W - 16 - healthyW - 2 * numW;
    const headH = 20;
    const colHeadH = 13;
    const rowHeight = (text: string) => Math.max(14, this.textHeight(text, FONT_REGULAR, 7.3, qw - 8) + 6);

    const drawHeader = (continued: boolean) => {
      const top = this.y;
      doc.rect(M, top, W, headH).fill(PANEL);
      doc.rect(M, top, W, 1.5).fill(RULE);
      this.label(continued ? `${category.title} (continued)` : category.title, qx, top + 7.5, { color: INK });
      doc
        .font(FONT_BOLD)
        .fontSize(7.6)
        .fillColor(INK)
        .text(`${category.healthyPercent}% HEALTHY`, M, top + 6.5, { width: W - 8, align: "right", lineBreak: false, characterSpacing: 0.6 });
      const ch = top + headH;
      this.label("Question", qx, ch + 4);
      const hx = qx + qw;
      this.label("Healthy", hx, ch + 4);
      this.label("Unhealthy", hx + healthyW, ch + 4, { width: numW - 6, align: "right", characterSpacing: 0.7 });
      this.label("Skipped", hx + healthyW + numW, ch + 4, { width: numW - 6, align: "right", characterSpacing: 0.7 });
      this.sides(top, headH + colHeadH);
      this.y = ch + colHeadH;
    };

    this.ensure(headH + colHeadH + rowHeight(category.questions[0]?.text ?? ""));
    drawHeader(false);

    for (const q of category.questions) {
      const rh = rowHeight(q.text);
      if (this.y + rh > BOTTOM) {
        doc.rect(M, this.y, W, 1).fill(RULE);
        this.newPage();
        drawHeader(true);
      }
      const top = this.y;
      doc.lineWidth(0.5).strokeColor(HAIR).moveTo(M, top).lineTo(M + W, top).stroke();
      this.sides(top, rh);
      doc.font(FONT_REGULAR).fontSize(7.3).fillColor(INK).text(q.text, qx, top + 3.4, { width: qw - 8, lineGap: 0.6 });
      const hx = qx + qw;
      const barY = top + rh / 2 - 2;
      doc.rect(hx, barY, 40, 4).fill(PANEL);
      if (q.healthyPercent > 0) doc.rect(hx, barY, (40 * q.healthyPercent) / 100, 4).fill(INK);
      const ty = top + rh / 2 - 3.6;
      doc.font(FONT_BOLD).fontSize(7.6).fillColor(INK).text(`${q.healthyPercent}%`, hx + 42, ty, { width: healthyW - 48, align: "right", lineBreak: false });
      doc.font(FONT_REGULAR).fontSize(7.6).fillColor(INK).text(`${q.unhealthyPercent}%`, hx + healthyW, ty, { width: numW - 6, align: "right", lineBreak: false });
      doc.fillColor(GRAY).text(`${q.skippedPercent}%`, hx + healthyW + numW, ty, { width: numW - 6, align: "right", lineBreak: false });
      this.y = top + rh;
    }
    doc.rect(M, this.y, W, 1).fill(RULE);
    this.y += 1;
  }

  /** The block's left and right rules for one row band. */
  private sides(top: number, height: number): void {
    this.doc.rect(M, top, 1, height).fill(RULE);
    this.doc.rect(M + W - 1, top, 1, height).fill(RULE);
  }

  private privacyNote(): void {
    const { doc } = this;
    const skipped = this.data.skippedWorkTypes;
    const text =
      "Built only from published, anonymous reviews. Every figure is a percentage: no review count, review date, reviewer name or single answer appears in this report. " +
      "A healthy answer is the one a well-run workplace would get. " +
      (skipped.length > 0
        ? `${skipped.join(" and ")} ${skipped.length === 1 ? "is" : "are"} left out until enough people have reviewed ${skipped.length === 1 ? "it" : "them"}.`
        : "");
    const h = this.textHeight(text, FONT_REGULAR, 7, W - 20) + 26;
    this.y += 12;
    this.ensure(h);
    doc.lineWidth(0.75).strokeColor(RULE).rect(M, this.y, W, h).stroke();
    this.label("How this report protects reviewers", M + 10, this.y + 8, { color: INK });
    doc.font(FONT_REGULAR).fontSize(7).fillColor(STEEL).text(text.trim(), M + 10, this.y + 18, { width: W - 20, lineGap: 0.6 });
    this.y += h;
  }
}

/** Brand mark bottom left, page number bottom right, on every page. */
function drawFooters(doc: PdfDoc): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const y = PAGE_H - M - 16;
    doc.lineWidth(0.5).strokeColor(HAIR).moveTo(M, y - 6).lineTo(M + W, y - 6).stroke();
    doc.image(BRAND_MARK, M, y, { width: 16, height: 16 });
    doc.font(FONT_BOLD).fontSize(7).fillColor(INK).text("I Worked There", M + 22, y + 4.5, { lineBreak: false, continued: false });
    doc.font(FONT_REGULAR).fillColor(GRAY).text("iworkedthere.com", M + 82, y + 4.5, { lineBreak: false });
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, M, y + 4.5, { width: W, align: "right", lineBreak: false });
  }
}

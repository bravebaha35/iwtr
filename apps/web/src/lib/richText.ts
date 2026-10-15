// A job posting's "Tell us more" is stored as ordinary text with three
// small conventions, so it stays plain text everywhere (the API, search,
// the word filter) and is never HTML:
//   **bold**   __italic__   lines starting "• " or "1. " are list items.
// A marker with no partner on the same line is just text. Everything here
// is pure, so the editor (RichTextEditor) and every place that shows a
// posting (RichText) read and write the same thing.

export type Style = { b: boolean; i: boolean };
// The text without markers, and the style of each character in it.
export type Doc = { text: string; styles: Style[] };
// Replace `remove` characters at `at` with `insert`.
export type Splice = { at: number; remove: number; insert: string };

export const PLAIN: Style = { b: false, i: false };
export const BULLET = "• ";
const NUMBER_RE = /^(\d+)\. /;
const MARKER_RE = /\*\*|__/g;

function parseLine(line: string): Doc {
  const marks = [...line.matchAll(MARKER_RE)].map((m) => ({ at: m.index!, kind: m[0] }));
  // An odd one out (the last of its kind) has no partner: keep it as text.
  for (const kind of ["**", "__"]) {
    const ofKind = marks.filter((m) => m.kind === kind);
    if (ofKind.length % 2 === 1) marks.splice(marks.indexOf(ofKind[ofKind.length - 1]), 1);
  }
  let text = "";
  const styles: Style[] = [];
  const style = { b: false, i: false };
  let from = 0;
  for (const m of marks) {
    const chunk = line.slice(from, m.at);
    text += chunk;
    for (let k = 0; k < chunk.length; k++) styles.push({ ...style });
    if (m.kind === "**") style.b = !style.b;
    else style.i = !style.i;
    from = m.at + 2;
  }
  const rest = line.slice(from);
  text += rest;
  for (let k = 0; k < rest.length; k++) styles.push({ ...style });
  return { text, styles };
}

/** Stored text -> characters and their styles. */
export function parseMarkup(markup: string): Doc {
  const lines = markup.replace(/\r\n?/g, "\n").split("\n").map(parseLine);
  return {
    text: lines.map((l) => l.text).join("\n"),
    styles: lines.flatMap((l, n) => (n === 0 ? l.styles : [PLAIN, ...l.styles])),
  };
}

/** Characters and their styles -> stored text. Markers open and close within a line. */
export function toMarkup(doc: Doc): string {
  const out: string[] = [];
  let line = "";
  let cur: Style = PLAIN;
  const switchTo = (next: Style) => {
    if (cur.b !== next.b) line += "**";
    if (cur.i !== next.i) line += "__";
    cur = next;
  };
  for (let k = 0; k <= doc.text.length; k++) {
    const ch = doc.text[k];
    if (ch === undefined || ch === "\n") {
      switchTo(PLAIN);
      out.push(line);
      line = "";
      continue;
    }
    const s = doc.styles[k] ?? PLAIN;
    // A style that only covers spaces isn't worth markers.
    switchTo(ch.trim() === "" && !(cur.b || cur.i) ? PLAIN : s);
    line += ch;
  }
  return out.join("\n");
}

/** The words alone, for a one-line preview or a count. */
export function stripMarkup(markup: string): string {
  return parseMarkup(markup).text;
}

/** Applies splices (any order) to the text and its styles; new text takes `style`. */
export function applySplices(doc: Doc, splices: Splice[], style: Style = PLAIN): Doc {
  let { text } = doc;
  const styles = [...doc.styles];
  for (const s of [...splices].sort((a, b) => b.at - a.at)) {
    text = text.slice(0, s.at) + s.insert + text.slice(s.at + s.remove);
    styles.splice(s.at, s.remove, ...Array.from({ length: s.insert.length }, () => ({ ...style })));
  }
  return { text, styles };
}

function markerOf(line: string): string | null {
  if (line.startsWith(BULLET)) return BULLET;
  const m = NUMBER_RE.exec(line);
  return m ? m[0] : null;
}

/**
 * Turns the lines touched by the selection into a bullet / numbered list,
 * or back into plain lines when they all already are that kind of list.
 */
export function toggleListSplices(text: string, selStart: number, selEnd: number, kind: "bullet" | "number"): { splices: Splice[]; selEnd: number } {
  const blockStart = text.lastIndexOf("\n", selStart - 1) + 1;
  const nextBreak = text.indexOf("\n", selEnd);
  const blockEnd = nextBreak === -1 ? text.length : nextBreak;
  const lines = text.slice(blockStart, blockEnd).split("\n");
  const isKind = (line: string) => (kind === "bullet" ? line.startsWith(BULLET) : NUMBER_RE.test(line));
  const allOn = lines.every(isKind);
  const splices: Splice[] = [];
  let at = blockStart;
  let grow = 0;
  lines.forEach((line, n) => {
    const old = markerOf(line) ?? "";
    const next = allOn ? "" : kind === "bullet" ? BULLET : `${n + 1}. `;
    splices.push({ at, remove: old.length, insert: next });
    grow += next.length - old.length;
    at += line.length + 1;
  });
  return { splices, selEnd: blockEnd + grow };
}

/**
 * What Enter does inside a list: carries the list on to a new line, or - on
 * a line that holds nothing but its marker - ends the list. Null when the
 * caret isn't on a list line (Enter then just starts a new line).
 */
export function continueListSplice(text: string, caret: number): { splice: Splice; caret: number } | null {
  const lineStart = text.lastIndexOf("\n", caret - 1) + 1;
  const line = text.slice(lineStart, caret);
  const marker = markerOf(line);
  if (!marker) return null;
  if (line.length === marker.length) {
    return { splice: { at: lineStart, remove: marker.length, insert: "" }, caret: lineStart };
  }
  const numbered = NUMBER_RE.exec(line);
  const insert = `\n${numbered ? `${Number(numbered[1]) + 1}. ` : BULLET}`;
  return { splice: { at: caret, remove: 0, insert }, caret: caret + insert.length };
}

/** Plain-text versions of the two list helpers (text in, text out). */
export function toggleList(text: string, selStart: number, selEnd: number, kind: "bullet" | "number") {
  const out = toggleListSplices(text, selStart, selEnd, kind);
  const next = applySplices({ text, styles: Array.from(text, () => PLAIN) }, out.splices).text;
  return { text: next, selStart: text.lastIndexOf("\n", selStart - 1) + 1, selEnd: out.selEnd };
}

export function continueList(text: string, caret: number): { text: string; caret: number } | null {
  const out = continueListSplice(text, caret);
  if (!out) return null;
  return { text: applySplices({ text, styles: Array.from(text, () => PLAIN) }, [out.splice]).text, caret: out.caret };
}

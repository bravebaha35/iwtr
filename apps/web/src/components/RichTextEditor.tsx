"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  BULLET,
  PLAIN,
  applySplices,
  continueListSplice,
  parseMarkup,
  toMarkup,
  toggleListSplices,
  type Doc,
  type Splice,
  type Style,
} from "@/lib/richText";

// The box shows formatting as it will look; what it hands back is the
// stored text of lib/richText (**bold**, __italic__, "• " / "1. " lines).

/** Fills the box with the text as DOM nodes (text nodes only - never HTML). */
function drawDoc(root: HTMLElement, doc: Doc) {
  const nodes: Node[] = [];
  let k = 0;
  while (k < doc.text.length) {
    const s = doc.styles[k] ?? PLAIN;
    let end = k + 1;
    while (end < doc.text.length && (doc.styles[end]?.b ?? false) === s.b && (doc.styles[end]?.i ?? false) === s.i) end++;
    let node: Node = document.createTextNode(doc.text.slice(k, end));
    if (s.i) {
      const i = document.createElement("i");
      i.appendChild(node);
      node = i;
    }
    if (s.b) {
      const b = document.createElement("b");
      b.appendChild(node);
      node = b;
    }
    nodes.push(node);
    k = end;
  }
  // A last line break only shows with something after it.
  const end = document.createElement("br");
  end.setAttribute("data-end", "");
  nodes.push(end);
  root.replaceChildren(...nodes);
}

function isBold(el: HTMLElement): boolean {
  const w = el.style.fontWeight;
  return el.tagName === "B" || el.tagName === "STRONG" || w === "bold" || Number(w) >= 600;
}
function isItalic(el: HTMLElement): boolean {
  return el.tagName === "I" || el.tagName === "EM" || el.style.fontStyle === "italic";
}

/** What the box holds now: its text (spaces made plain) and each character's style. */
function readDoc(root: HTMLElement): Doc {
  let text = "";
  const styles: Style[] = [];
  const push = (t: string, s: Style) => {
    text += t;
    for (let k = 0; k < t.length; k++) styles.push(s);
  };
  const walk = (node: Node, s: Style) => {
    if (node.nodeType === Node.TEXT_NODE) {
      push((node.textContent ?? "").replace(/ /g, " "), s);
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === "BR") {
      if (!node.hasAttribute("data-end")) push("\n", PLAIN);
      return;
    }
    // A block the browser made on its own (pasting, some Enter keys) starts a new line.
    const block = node !== root && (node.tagName === "DIV" || node.tagName === "P");
    if (block && text.length > 0 && !text.endsWith("\n")) push("\n", PLAIN);
    const next = { b: s.b || isBold(node), i: s.i || isItalic(node) };
    node.childNodes.forEach((child) => walk(child, next));
  };
  walk(root, PLAIN);
  return { text, styles };
}

/** Plain-text offset of a point in the box (the same counting as readDoc). */
function offsetOf(root: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(root, 0);
  try {
    range.setEnd(node, offset);
  } catch {
    return 0;
  }
  const holder = document.createElement("div");
  holder.appendChild(range.cloneContents());
  return readDoc(holder).text.length;
}

function selectionIn(root: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const r = sel.getRangeAt(0);
  if (!root.contains(r.startContainer)) return null;
  const a = offsetOf(root, r.startContainer, r.startOffset);
  const b = offsetOf(root, r.endContainer, r.endOffset);
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

/** Puts the caret (or a selection) at plain-text offsets. */
function placeCaret(root: HTMLElement, start: number, end = start) {
  const find = (target: number): [Node, number] => {
    let seen = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const len = node.textContent?.length ?? 0;
        if (seen + len >= target) return [node, target - seen];
        seen += len;
      } else if ((node as HTMLElement).tagName === "BR" && !(node as HTMLElement).hasAttribute("data-end")) {
        if (seen === target) return [node.parentNode!, Array.prototype.indexOf.call(node.parentNode!.childNodes, node)];
        seen += 1;
        if (seen === target) return [node.parentNode!, Array.prototype.indexOf.call(node.parentNode!.childNodes, node) + 1];
      }
      node = walker.nextNode();
    }
    const endBr = root.querySelector("br[data-end]");
    return endBr ? [root, Array.prototype.indexOf.call(root.childNodes, endBr)] : [root, root.childNodes.length];
  };
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  const [sn, so] = find(start);
  const [en, eo] = find(end);
  range.setStart(sn, so);
  range.setEnd(en, eo);
  sel.removeAllRanges();
  sel.addRange(range);
}

const toolButton =
  "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition hover:bg-surface-muted hover:text-foreground";

/**
 * A job posting's "Tell us more": Bold, Italic, Bullet list and Numbered
 * list. Bold and Italic work both ways - select words and press one, or
 * press one and keep typing (Ctrl+B / Ctrl+I too). Enter carries a list on,
 * Enter on an empty list line ends it, and "- " or "* " typed at the start
 * of a line becomes a bullet. Pasted text arrives as plain words.
 */
export function RichTextEditor({
  value,
  onChange,
  maxLength,
  placeholder,
  id,
  className = "",
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  maxLength: number;
  placeholder?: string;
  id?: string;
  // On the wrapper (toolbar + box): give it a height and the box fills it.
  className?: string;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // The stored text this box last produced, so a value coming back from the
  // parent doesn't redraw the box under the caret.
  const shown = useRef<string | null>(null);
  const [active, setActive] = useState({ b: false, i: false });
  const empty = value.length === 0;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || value === shown.current) return;
    drawDoc(el, parseMarkup(value));
    shown.current = value;
  }, [value]);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const next = toMarkup(readDoc(el));
    shown.current = next;
    onChange(next);
  }, [onChange]);

  // Lists, Enter and pasting change whole lines: work on the text, redraw,
  // and put the caret back where it belongs.
  function edit(change: (doc: Doc, start: number, end: number) => { doc: Doc; caret: number; selEnd?: number }) {
    const el = ref.current;
    if (!el) return;
    const sel = selectionIn(el) ?? { start: readDoc(el).text.length, end: readDoc(el).text.length };
    const out = change(readDoc(el), sel.start, sel.end);
    const markup = toMarkup(out.doc);
    if (markup.length > maxLength) return;
    drawDoc(el, out.doc);
    shown.current = markup;
    onChange(markup);
    el.focus();
    placeCaret(el, out.caret, out.selEnd ?? out.caret);
  }

  function format(command: "bold" | "italic") {
    ref.current?.focus();
    if (typeof document.execCommand === "function") document.execCommand(command);
    emit();
    refreshActive();
  }

  function toggle(kind: "bullet" | "number") {
    edit((doc, start, end) => {
      const out = toggleListSplices(doc.text, start, end, kind);
      return { doc: applySplices(doc, out.splices), caret: out.selEnd };
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      edit((doc, start, end) => {
        const cleared = end > start ? applySplices(doc, [{ at: start, remove: end - start, insert: "" }]) : doc;
        const list = continueListSplice(cleared.text, start);
        const splice: Splice = list ? list.splice : { at: start, remove: 0, insert: "\n" };
        return { doc: applySplices(cleared, [splice]), caret: list ? list.caret : start + 1 };
      });
      return;
    }
    if (e.key === " ") {
      const el = ref.current;
      const sel = el && selectionIn(el);
      if (!el || !sel || sel.start !== sel.end) return;
      const text = readDoc(el).text;
      const lineStart = text.lastIndexOf("\n", sel.start - 1) + 1;
      const typed = text.slice(lineStart, sel.start);
      if (typed === "-" || typed === "*") {
        e.preventDefault();
        edit((doc) => ({ doc: applySplices(doc, [{ at: lineStart, remove: typed.length, insert: BULLET }]), caret: lineStart + BULLET.length }));
      }
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n");
    if (!pasted) return;
    edit((doc, start, end) => {
      const room = Math.max(0, maxLength - toMarkup(doc).length + (end - start));
      const insert = pasted.slice(0, room);
      return { doc: applySplices(doc, [{ at: start, remove: end - start, insert }]), caret: start + insert.length };
    });
  }

  // Typing stops at the length limit (deleting still works).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const guard = (e: InputEvent) => {
      if (e.inputType.startsWith("insert") && e.inputType !== "insertParagraph" && toMarkup(readDoc(el)).length >= maxLength) e.preventDefault();
    };
    el.addEventListener("beforeinput", guard);
    return () => el.removeEventListener("beforeinput", guard);
  }, [maxLength]);

  // Bold / Italic light up while the caret is in bold or italic text.
  function refreshActive() {
    const el = ref.current;
    if (!el || typeof document.queryCommandState !== "function" || !selectionIn(el)) return;
    setActive({ b: document.queryCommandState("bold"), i: document.queryCommandState("italic") });
  }
  useEffect(() => {
    document.addEventListener("selectionchange", refreshActive);
    return () => document.removeEventListener("selectionchange", refreshActive);
  });

  const on = "bg-brand-600/12 text-brand-700 dark:bg-brand-400/15 dark:text-brand-300";
  const off = "text-muted-foreground";
  const keep = (e: React.MouseEvent) => e.preventDefault(); // keep the selection in the box

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition focus-within:border-brand-600 dark:focus-within:border-brand-400 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border/70 px-1.5 py-1">
        <button type="button" onMouseDown={keep} onClick={() => format("bold")} aria-pressed={active.b} title="Bold (Ctrl+B)" className={`${toolButton} ${active.b ? on : off}`}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" />
          </svg>
          Bold
        </button>
        <button type="button" onMouseDown={keep} onClick={() => format("italic")} aria-pressed={active.i} title="Italic (Ctrl+I)" className={`${toolButton} ${active.i ? on : off}`}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M14 5h5M5 19h5M15 5l-6 14" />
          </svg>
          Italic
        </button>
        <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
        <button type="button" onMouseDown={keep} onClick={() => toggle("bullet")} title="Bullet list" className={`${toolButton} ${off}`}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M9 6h11M9 12h11M9 18h11" />
            <circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
            <circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none" />
          </svg>
          Bullet list
        </button>
        <button type="button" onMouseDown={keep} onClick={() => toggle("number")} title="Numbered list" className={`${toolButton} ${off}`}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 6h10M10 12h10M10 18h10" />
            <path d="M4 4.6l1.3-.8v4.4M3.7 11.4h2.4l-2.4 3.2h2.6" strokeWidth="1.5" />
          </svg>
          Numbered list
        </button>
        <span className="ml-auto hidden pr-2 text-[11px] text-muted-foreground lg:inline">Enter starts the next item</span>
      </div>
      <div className="relative min-h-0 flex-1">
        {empty && placeholder && (
          <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-3 text-sm leading-relaxed text-muted-foreground">
            {placeholder}
          </span>
        )}
        <div
          ref={ref}
          id={id}
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          aria-placeholder={placeholder}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onKeyDown={onKeyDown}
          onKeyUp={refreshActive}
          onMouseUp={refreshActive}
          onPaste={onPaste}
          onDrop={(e) => e.preventDefault()}
          className="thin-scrollbar h-full min-h-32 w-full overflow-y-auto whitespace-pre-wrap break-words px-3.5 py-3 text-sm leading-relaxed text-foreground focus:outline-none [&_b]:font-semibold"
        />
      </div>
    </div>
  );
}
